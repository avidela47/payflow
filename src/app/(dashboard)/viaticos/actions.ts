"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Viatico, VIATICO_HONORARIO_TYPES } from "@/models/Viatico";
import { getSession } from "@/lib/auth";

// A diferencia de Compras/Sueldos (formularios planos, FormData), Viáticos
// tiene listas dinámicas (empleados, extras, materiales) que no se
// codifican bien en FormData — así que estas actions reciben un objeto ya
// armado desde el cliente en vez de FormData. El resto del patrón
// (sesión, zod, try/catch, revalidatePath) se mantiene igual al resto del
// proyecto.

const empleadoSchema = z.object({
  employeeId: z.string().min(1),
  honorarioType: z.enum(VIATICO_HONORARIO_TYPES),
  monto: z.coerce.number().nonnegative(),
  dias: z.coerce.number().positive().optional(),
});

const extraSchema = z.object({
  descripcion: z.string().min(1),
  monto: z.coerce.number().nonnegative(),
});

const materialSchema = z.object({
  descripcion: z.string().min(1),
  cantidad: z.coerce.number().nonnegative().optional(),
  monto: z.coerce.number().nonnegative(),
});

const topeDiarioSchema = z.object({
  employeeId: z.string().min(1),
  monto: z.coerce.number().nonnegative(),
});

const viaticoSchema = z.object({
  nombre: z.string().min(1, "Falta el nombre del viaje."),
  paidBy: z.string().optional(),
  fecha: z.string().min(1, "Falta la fecha."),
  empleados: z.array(empleadoSchema).default([]),
  hospedajeLugar: z.string().optional(),
  hospedajeCheckIn: z.string().optional(),
  hospedajeCheckOut: z.string().optional(),
  hospedajeCostoPorDia: z.coerce.number().nonnegative().optional(),
  hospedajeCantidadDias: z.coerce.number().nonnegative().optional(),
  hospedajePaidBy: z.string().optional(),
  combustibleMonto: z.coerce.number().nonnegative().optional(),
  combustiblePaidBy: z.string().optional(),
  extras: z.array(extraSchema).default([]),
  materiales: z.array(materialSchema).default([]),
  seguroCompania: z.string().optional(),
  seguroCobertura: z.string().optional(),
  seguroCantidadDias: z.coerce.number().nonnegative().optional(),
  seguroCosto: z.coerce.number().nonnegative().optional(),
  topesDiarios: z.array(topeDiarioSchema).default([]),
  notes: z.string().optional(),
});

export type ViaticoFormInput = z.infer<typeof viaticoSchema>;

// Tope diario de viático, por empleado (`topesDiarios`): cada empleado
// puede tener su propio tope sobre el monto por día (solo aplica a
// honorarioType "DIA"). Si el monto por día de un empleado supera SU
// tope, la diferencia x cantidad de días se guarda en `excedente` como
// línea informativa ("Excedente de viáticos"). El excedente NO se suma
// aparte al total — ya está incluido dentro del monto de ese empleado, es
// solo para identificarlo como excedente. Un empleado sin tope asignado
// no genera excedente.
function calcularExcedente(
  empleados: z.infer<typeof empleadoSchema>[],
  topesDiarios: z.infer<typeof topeDiarioSchema>[]
): number {
  if (topesDiarios.length === 0) return 0;
  const topeByEmployee = new Map(topesDiarios.map((t) => [t.employeeId, t.monto]));
  return empleados.reduce((sum, emp) => {
    if (emp.honorarioType !== "DIA") return sum;
    const tope = topeByEmployee.get(emp.employeeId);
    if (tope == null) return sum;
    const diff = emp.monto - tope;
    if (diff <= 0) return sum;
    return sum + diff * (emp.dias ?? 1);
  }, 0);
}

function buildDoc(data: ViaticoFormInput) {
  return {
    nombre: data.nombre,
    paidBy: data.paidBy || undefined,
    fecha: new Date(data.fecha),
    empleados: data.empleados.map((e) => ({
      employee: e.employeeId,
      honorarioType: e.honorarioType,
      monto: e.monto,
      dias: e.dias,
    })),
    hospedaje: {
      lugar: data.hospedajeLugar || undefined,
      checkIn: data.hospedajeCheckIn ? new Date(data.hospedajeCheckIn) : undefined,
      checkOut: data.hospedajeCheckOut ? new Date(data.hospedajeCheckOut) : undefined,
      costoPorDia: data.hospedajeCostoPorDia,
      cantidadDias: data.hospedajeCantidadDias,
      paidBy: data.hospedajePaidBy || undefined,
    },
    combustible: {
      monto: data.combustibleMonto,
      paidBy: data.combustiblePaidBy || undefined,
    },
    extras: data.extras,
    materiales: data.materiales,
    seguro: {
      compania: data.seguroCompania || undefined,
      cobertura: data.seguroCobertura || undefined,
      cantidadDias: data.seguroCantidadDias,
      costo: data.seguroCosto,
    },
    topesDiarios: data.topesDiarios.map((t) => ({ employee: t.employeeId, monto: t.monto })),
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
    return { ok: false, error: `No se pudo crear el viático: ${message}` };
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
    return { ok: false, error: `No se pudo editar el viático: ${message}` };
  }

  revalidatePath("/viaticos");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteViatico(viaticoId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Viatico.findByIdAndDelete(viaticoId);
  } catch (err) {
    console.error("deleteViatico error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar el viático: ${message}` };
  }

  revalidatePath("/viaticos");
  revalidatePath("/");
  return { ok: true };
}