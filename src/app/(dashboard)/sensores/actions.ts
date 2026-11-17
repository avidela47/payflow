"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { SensorFuente } from "@/models/SensorFuente";
import { SENSOR_FUENTE_TIPOS } from "@/lib/sensor-fuente-tipos";

// Mismo truco que en Proveedores/Payment: detecta el error de índice único
// de MongoDB (E11000) sin depender de un tipo de error específico.
function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}

const sensorFuenteSchema = z.object({
  codigo: z
    .string()
    .min(1, "Falta el código.")
    .transform((v) => v.trim().toUpperCase()),
  descripcion: z
    .string()
    .min(1, "Falta la descripción.")
    .transform((v) => v.trim()),
  tipo: z.enum(SENSOR_FUENTE_TIPOS, { message: "Falta el tipo." }),
  stockActual: z.coerce.number().min(0, "El stock actual no puede ser negativo."),
  stockMinimo: z.coerce.number().min(0, "El mínimo no puede ser negativo."),
  precio: z.coerce.number().min(0, "El precio no puede ser negativo."),
  proveedor: z.string().optional(),
  notas: z.string().optional(),
});

function parseSensorFuenteForm(formData: FormData) {
  return sensorFuenteSchema.safeParse({
    codigo: formData.get("codigo"),
    descripcion: formData.get("descripcion"),
    tipo: formData.get("tipo"),
    stockActual: formData.get("stockActual") || 0,
    stockMinimo: formData.get("stockMinimo") || 0,
    precio: formData.get("precio") || 0,
    proveedor: formData.get("proveedor") || undefined,
    notas: formData.get("notas") || undefined,
  });
}

export async function createSensorFuente(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseSensorFuenteForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await SensorFuente.create(parsed.data);
  } catch (err) {
    console.error("createSensorFuente error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: `Ya existe un sensor/fuente con el código ${parsed.data.codigo}.` };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath("/sensores");
  return { ok: true };
}

export async function updateSensorFuente(id: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseSensorFuenteForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const item = await SensorFuente.findByIdAndUpdate(id, parsed.data);
    if (!item) {
      return { ok: false, error: "El ítem ya no existe." };
    }
  } catch (err) {
    console.error("updateSensorFuente error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "Ya existe otro sensor/fuente con ese código." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar: ${message}` };
  }

  revalidatePath("/sensores");
  return { ok: true };
}

export async function deleteSensorFuente(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await SensorFuente.findByIdAndDelete(id);
  } catch (err) {
    console.error("deleteSensorFuente error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath("/sensores");
  return { ok: true };
}