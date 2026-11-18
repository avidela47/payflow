"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Presupuesto } from "@/models/Presupuesto";
import { getNextSequence } from "@/models/Counter";
import { PRESUPUESTO_ESTADOS } from "@/lib/presupuesto-estados";

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}

// Numeración tipo AFIP, igual al original ("0001-00010001"), pero generada
// con el contador atómico que ya usa PayFlow para Clientes (getNextSequence)
// en vez de "buscar el último y sumarle 1" — ese patrón del original tiene
// condición de carrera si dos personas guardan casi al mismo tiempo. Mismo
// criterio que el fix de Despachos: el formato visible es igual, la
// garantía interna de que no se repita es más sólida.
async function generarNumeroPresupuesto(): Promise<string> {
  const seq = await getNextSequence("presupuesto");
  return `0001-${(10000 + seq).toString().padStart(8, "0")}`;
}

const lineaSchema = z.object({
  codigo: z.string().optional(),
  descripcion: z.string().min(1, "Falta la descripción de una línea."),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  bonificacion: z.coerce.number().min(0).max(100).default(0),
  precioUnitario: z.coerce.number().min(0, "El precio no puede ser negativo."),
  plazoEntregaLinea: z.string().optional(),
});

const presupuestoSchema = z.object({
  fecha: z.coerce.date(),
  validezDias: z.coerce.number().int().min(0).default(5),
  vendedor: z.string().optional(),
  clientId: z.string().optional(),
  razonSocial: z.string().min(1, "Falta la razón social."),
  cuit: z.string().optional(),
  direccion: z.string().optional(),
  localidad: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().optional(),
  atencion: z.string().optional(),
  condicionIva: z.string().optional(),
  moneda: z.string().default("U$D"),
  ivaMonto: z.coerce.number().min(0).default(0),
  formaPago: z.string().optional(),
  plazoEntrega: z.string().optional(),
  cotizacion: z.string().optional(),
  comentario: z.string().optional(),
  estado: z.enum(PRESUPUESTO_ESTADOS).default("BORRADOR"),
  notas: z.string().optional(),
  lineas: z.array(lineaSchema).min(1, "Agregá al menos una línea."),
});

function parsePresupuestoForm(formData: FormData) {
  let lineasRaw: unknown = [];
  try {
    lineasRaw = JSON.parse((formData.get("lineasJson") as string) || "[]");
  } catch {
    lineasRaw = [];
  }

  return presupuestoSchema.safeParse({
    fecha: formData.get("fecha") || new Date(),
    validezDias: formData.get("validezDias") || 5,
    vendedor: formData.get("vendedor") || undefined,
    clientId: formData.get("clientId") || undefined,
    razonSocial: formData.get("razonSocial"),
    cuit: formData.get("cuit") || undefined,
    direccion: formData.get("direccion") || undefined,
    localidad: formData.get("localidad") || undefined,
    telefono: formData.get("telefono") || undefined,
    email: formData.get("email") || undefined,
    atencion: formData.get("atencion") || undefined,
    condicionIva: formData.get("condicionIva") || undefined,
    moneda: formData.get("moneda") || "U$D",
    ivaMonto: formData.get("ivaMonto") || 0,
    formaPago: formData.get("formaPago") || undefined,
    plazoEntrega: formData.get("plazoEntrega") || undefined,
    cotizacion: formData.get("cotizacion") || undefined,
    comentario: formData.get("comentario") || undefined,
    estado: formData.get("estado") || "BORRADOR",
    notas: formData.get("notas") || undefined,
    lineas: lineasRaw,
  });
}

// precioTotal de cada línea y subtotal/total generales se calculan acá,
// nunca se confía en lo que mande el formulario — el cliente solo manda
// cantidad/bonificación/precioUnitario, el resto es derivado.
function calcularTotales(lineas: z.infer<typeof lineaSchema>[], ivaMonto: number) {
  const lineasCalculadas = lineas.map((l) => {
    const precioTotal =
      Math.round(l.cantidad * l.precioUnitario * (1 - l.bonificacion / 100) * 100) / 100;
    return { ...l, precioTotal };
  });
  const subtotal = Math.round(lineasCalculadas.reduce((acc, l) => acc + l.precioTotal, 0) * 100) / 100;
  const total = Math.round((subtotal + ivaMonto) * 100) / 100;
  return { lineasCalculadas, subtotal, total };
}

export async function createPresupuesto(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parsePresupuestoForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { lineas, ivaMonto, ...rest } = parsed.data;
  const { lineasCalculadas, subtotal, total } = calcularTotales(lineas, ivaMonto);

  try {
    await connectDB();
    const numero = await generarNumeroPresupuesto();
    await Presupuesto.create({
      ...rest,
      numero,
      iva: ivaMonto,
      lineas: lineasCalculadas,
      subtotal,
      total,
    });
  } catch (err) {
    console.error("createPresupuesto error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "Ya existe un presupuesto con ese número. Reintentá." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath("/presupuestos");
  return { ok: true };
}

export async function updatePresupuesto(id: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parsePresupuestoForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { lineas, ivaMonto, ...rest } = parsed.data;
  const { lineasCalculadas, subtotal, total } = calcularTotales(lineas, ivaMonto);

  try {
    await connectDB();
    const item = await Presupuesto.findByIdAndUpdate(id, {
      ...rest,
      iva: ivaMonto,
      lineas: lineasCalculadas,
      subtotal,
      total,
    });
    if (!item) {
      return { ok: false, error: "El presupuesto ya no existe." };
    }
  } catch (err) {
    console.error("updatePresupuesto error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar: ${message}` };
  }

  revalidatePath("/presupuestos");
  return { ok: true };
}

export async function deletePresupuesto(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Presupuesto.findByIdAndDelete(id);
  } catch (err) {
    console.error("deletePresupuesto error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath("/presupuestos");
  return { ok: true };
}