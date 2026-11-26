"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { connectDB } from "@/lib/db";
import {
  Viatico,
  VIATICO_HONORARIO_TYPES,
  VIATICO_PAYMENT_MODES,
  VIATICO_EMPLOYEE_PAYMENT_MODES,
  VIATICO_CONDICIONES_PAYMENT_MODES,
} from "@/models/Viatico";
import { getSession } from "@/lib/auth";

// A diferencia de Compras/Sueldos (formularios planos, FormData), Viáticos
// tiene listas dinámicas (empleados, extras, materiales) que no se
// codifican bien en FormData — así que estas actions reciben un objeto ya
// armado desde el cliente en vez de FormData. El resto del patrón
// (sesión, zod, try/catch, revalidatePath) se mantiene igual al resto del
// proyecto.

const pagoSchema = z.object({
  monto: z.coerce.number().positive(),
  fecha: z.string().min(1),
});

const empleadoSchema = z.object({
  employeeId: z.string().min(1),
  honorarioType: z.enum(VIATICO_HONORARIO_TYPES),
  monto: z.coerce.number().nonnegative(),
  iva: z.coerce.number().nonnegative().optional(),
  dias: z.coerce.number().positive().optional(),
  paymentMode: z.enum(VIATICO_EMPLOYEE_PAYMENT_MODES).optional(),
  pagos: z.array(pagoSchema).default([]),
});

const extraSchema = z.object({
  descripcion: z.string().min(1),
  monto: z.coerce.number().nonnegative(),
  iva: z.coerce.number().nonnegative().optional(),
  paymentMode: z.enum(VIATICO_PAYMENT_MODES).optional(),
});

const materialSchema = z.object({
  descripcion: z.string().min(1),
  cantidad: z.coerce.number().nonnegative().optional(),
  monto: z.coerce.number().nonnegative(),
  iva: z.coerce.number().nonnegative().optional(),
  paymentMode: z.enum(VIATICO_PAYMENT_MODES).optional(),
});

const topeGastoSchema = z.object({
  descripcion: z.string().min(1),
  monto: z.coerce.number().nonnegative(),
  iva: z.coerce.number().nonnegative().optional(),
  paymentMode: z.enum(VIATICO_PAYMENT_MODES).optional(),
});

const topeDiarioSchema = z.object({
  employeeId: z.string().min(1),
  monto: z.coerce.number().nonnegative(),
  iva: z.coerce.number().nonnegative().optional(),
  gastos: z.array(topeGastoSchema).default([]),
});

const viaticoSchema = z
  .object({
    nombre: z.string().min(1, "Falta el nombre del viaje."),
    paidBy: z.string().optional(),
    fechaInicio: z.string().min(1, "Falta la fecha de inicio."),
    fechaFin: z.string().min(1, "Falta la fecha de fin."),
    empleados: z.array(empleadoSchema).default([]),
    hospedajeLugar: z.string().optional(),
    hospedajeCheckIn: z.string().optional(),
    hospedajeCheckOut: z.string().optional(),
    hospedajeCostoPorDia: z.coerce.number().nonnegative().optional(),
    hospedajeIvaPorDia: z.coerce.number().nonnegative().optional(),
    hospedajeCantidadDias: z.coerce.number().nonnegative().optional(),
    hospedajePaidBy: z.string().optional(),
    combustibleMonto: z.coerce.number().nonnegative().optional(),
    combustibleIva: z.coerce.number().nonnegative().optional(),
    combustiblePaidBy: z.string().optional(),
    extras: z.array(extraSchema).default([]),
    materiales: z.array(materialSchema).default([]),
    seguroCompania: z.string().optional(),
    seguroCobertura: z.string().optional(),
    seguroCantidadDias: z.coerce.number().nonnegative().optional(),
    seguroCosto: z.coerce.number().nonnegative().optional(),
    seguroIva: z.coerce.number().nonnegative().optional(),
    topesDiarios: z.array(topeDiarioSchema).default([]),
    notes: z.string().optional(),
  })
  .refine((data) => data.fechaFin >= data.fechaInicio, {
    message: "La fecha de fin no puede ser anterior a la de inicio.",
    path: ["fechaFin"],
  });

export type ViaticoFormInput = z.infer<typeof viaticoSchema>;

// "Condiciones de viaje" (papel de Ariel, 2026-11-25): ficha aparte, ligada
// a un viaje ya cargado — se guarda con su propia action en vez de ir
// adentro de viaticoSchema, así el modal de condiciones no necesita mandar
// todo el formulario completo del viaje para guardar solo esto.
const condicionesSchema = z.object({
  empleadosNombres: z.array(z.string().min(1)).default([]),
  viaticosPactados: z.string().optional(),
  llevanInsumos: z.boolean().optional(),
  tieneVale: z.boolean().optional(),
  numeroVale: z.string().optional(),
  formaPago: z.enum(VIATICO_CONDICIONES_PAYMENT_MODES).optional(),
  montoEfectivo: z.coerce.number().nonnegative().optional(),
});

export type CondicionesFormInput = z.infer<typeof condicionesSchema>;

// Tope diario de viático, por empleado (`topesDiarios`): cada empleado
// puede tener su propio tope sobre el monto por día (solo aplica a
// honorarioType "DIA"). Si el monto por día de un empleado supera SU
// tope, la diferencia x cantidad de días se guarda en `excedente` como
// línea informativa ("Excedente de viáticos"). El excedente NO se suma
// aparte al total — ya está incluido dentro del monto de ese empleado, es
// solo para identificarlo como excedente. Un empleado sin tope asignado
// no genera excedente.
// 2026-11-26 (Ariel): tanto el honorario del empleado como el tope ahora
// discriminan neto/IVA — la comparación se hace sobre el TOTAL (neto+IVA)
// de cada uno, no solo sobre el neto, porque lo que importa acá es cuánto
// termina cobrando el empleado por día contra cuánto se le autorizó.
function calcularExcedente(
  empleados: z.infer<typeof empleadoSchema>[],
  topesDiarios: z.infer<typeof topeDiarioSchema>[]
): number {
  if (topesDiarios.length === 0) return 0;
  const topeByEmployee = new Map(topesDiarios.map((t) => [t.employeeId, t.monto + (t.iva ?? 0)]));
  return empleados.reduce((sum, emp) => {
    if (emp.honorarioType !== "DIA") return sum;
    const tope = topeByEmployee.get(emp.employeeId);
    if (tope == null) return sum;
    const totalPorDia = emp.monto + (emp.iva ?? 0);
    const diff = totalPorDia - tope;
    if (diff <= 0) return sum;
    return sum + diff * (emp.dias ?? 1);
  }, 0);
}

function buildDoc(data: ViaticoFormInput) {
  return {
    nombre: data.nombre,
    paidBy: data.paidBy || undefined,
    fechaInicio: new Date(data.fechaInicio),
    fechaFin: new Date(data.fechaFin),
    empleados: data.empleados.map((e) => ({
      employee: e.employeeId,
      honorarioType: e.honorarioType,
      monto: e.monto,
      iva: e.iva,
      dias: e.dias,
      paymentMode: e.paymentMode,
      pagos: e.pagos.map((p) => ({ monto: p.monto, fecha: new Date(p.fecha) })),
    })),
    hospedaje: {
      lugar: data.hospedajeLugar || undefined,
      checkIn: data.hospedajeCheckIn ? new Date(data.hospedajeCheckIn) : undefined,
      checkOut: data.hospedajeCheckOut ? new Date(data.hospedajeCheckOut) : undefined,
      costoPorDia: data.hospedajeCostoPorDia,
      ivaPorDia: data.hospedajeIvaPorDia,
      cantidadDias: data.hospedajeCantidadDias,
      paidBy: data.hospedajePaidBy || undefined,
    },
    combustible: {
      monto: data.combustibleMonto,
      iva: data.combustibleIva,
      paidBy: data.combustiblePaidBy || undefined,
    },
    extras: data.extras,
    materiales: data.materiales,
    seguro: {
      compania: data.seguroCompania || undefined,
      cobertura: data.seguroCobertura || undefined,
      cantidadDias: data.seguroCantidadDias,
      costo: data.seguroCosto,
      iva: data.seguroIva,
    },
    topesDiarios: data.topesDiarios.map((t) => ({
      employee: t.employeeId,
      monto: t.monto,
      iva: t.iva,
      gastos: t.gastos.map((g) => ({
        descripcion: g.descripcion,
        monto: g.monto,
        iva: g.iva,
        paymentMode: g.paymentMode,
      })),
    })),
    excedente: calcularExcedente(data.empleados, data.topesDiarios),
    notes: data.notes || undefined,
  };
}

export async function createViatico(input: ViaticoFormInput) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = viaticoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await Viatico.create(buildDoc(parsed.data));
  } catch (err) {
    console.error("createViatico error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear el viaje: ${message}` };
  }

  revalidatePath("/viaticos");
  revalidatePath("/");
  return { ok: true };
}

export async function updateViatico(viaticoId: string, input: ViaticoFormInput) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = viaticoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await Viatico.findByIdAndUpdate(viaticoId, { $set: buildDoc(parsed.data) });
  } catch (err) {
    console.error("updateViatico error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo editar el viaje: ${message}` };
  }

  revalidatePath("/viaticos");
  revalidatePath("/");
  return { ok: true };
}

export async function updateCondicionesViaje(viaticoId: string, input: CondicionesFormInput) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = condicionesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const exists = await Viatico.exists({ _id: viaticoId });
    if (!exists) return { ok: false, error: "El viaje ya no existe." };
    await Viatico.findByIdAndUpdate(viaticoId, {
      $set: {
        condiciones: {
          empleadosNombres: parsed.data.empleadosNombres.filter((n) => n.trim()),
          viaticosPactados: parsed.data.viaticosPactados || undefined,
          llevanInsumos: parsed.data.llevanInsumos,
          tieneVale: parsed.data.tieneVale,
          numeroVale: parsed.data.tieneVale ? parsed.data.numeroVale || undefined : undefined,
          formaPago: parsed.data.formaPago,
          montoEfectivo: parsed.data.formaPago === "EFECTIVO" ? parsed.data.montoEfectivo : undefined,
        },
      },
    });
  } catch (err) {
    console.error("updateCondicionesViaje error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudieron guardar las condiciones: ${message}` };
  }

  revalidatePath("/viaticos");
  return { ok: true };
}

// Documentos adjuntos del viaje (comprobantes, facturas escaneadas,
// reservas...) — mismo mecanismo que uploadEmployeeDocument en
// empleados/actions.ts: cada archivo se sube con su propia action apenas
// se elige, se guarda a disco en el VPS y se agrega a `documentos` con
// $push. 2026-11-25, pedido de Ariel: botón antes de "Condiciones".
const MAX_DOC_BYTES = 10 * 1024 * 1024;
const DOC_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const DOCS_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "viaticos", "documentos");

export type ViaticoDocumentoResult = {
  nombre: string;
  path: string;
  mimeType: string;
  size: number;
  uploadedAtISO: string;
};

export async function uploadViaticoDocument(
  viaticoId: string,
  formData: FormData
): Promise<{ ok: true; documento: ViaticoDocumentoResult } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const file = formData.get("archivo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No se seleccionó ningún archivo." };
  }
  if (!DOC_ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: "Solo se aceptan archivos PDF, JPG o PNG." };
  }
  if (file.size > MAX_DOC_BYTES) {
    return { ok: false, error: "El archivo pesa más de 10MB." };
  }

  try {
    await connectDB();
    const exists = await Viatico.exists({ _id: viaticoId });
    if (!exists) return { ok: false, error: "El viaje ya no existe." };

    await mkdir(DOCS_UPLOAD_DIR, { recursive: true });
    const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
    const filename = `${randomUUID()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(DOCS_UPLOAD_DIR, filename), bytes);

    const uploadedAt = new Date();
    const documento = {
      nombre: file.name || filename,
      path: `/uploads/viaticos/documentos/${filename}`,
      mimeType: file.type,
      size: file.size,
      uploadedAt,
    };
    await Viatico.findByIdAndUpdate(viaticoId, { $push: { documentos: documento } });

    revalidatePath("/viaticos");
    return { ok: true, documento: { ...documento, uploadedAtISO: uploadedAt.toISOString() } };
  } catch (err) {
    console.error("uploadViaticoDocument error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo subir el archivo: ${message}` };
  }
}

export async function deleteViaticoDocument(viaticoId: string, documentoPath: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Viatico.findByIdAndUpdate(viaticoId, { $pull: { documentos: { path: documentoPath } } });
    const fullPath = path.join(process.cwd(), "public", documentoPath);
    await unlink(fullPath).catch(() => {});
  } catch (err) {
    console.error("deleteViaticoDocument error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar el archivo: ${message}` };
  }

  revalidatePath("/viaticos");
  return { ok: true };
}

export async function deleteViatico(viaticoId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const existing = await Viatico.findById(viaticoId).select("documentos").lean();
    await Viatico.findByIdAndDelete(viaticoId);
    for (const doc of existing?.documentos ?? []) {
      const fullPath = path.join(process.cwd(), "public", doc.path);
      await unlink(fullPath).catch(() => {});
    }
  } catch (err) {
    console.error("deleteViatico error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar el viaje: ${message}` };
  }

  revalidatePath("/viaticos");
  revalidatePath("/");
  return { ok: true };
}