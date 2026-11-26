"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Licitacion, LICITACION_ESTADOS } from "@/models/Licitacion";
import { runLicitacionesDigest } from "@/lib/licitaciones-digest";

const licitacionSchema = z.object({
  entidad: z.string().min(1, "Falta el nombre de la entidad."),
  estado: z.enum(LICITACION_ESTADOS),
  numeroProveedor: z.string().optional(),
  observaciones: z.string().optional(),
  itemNumero: z.array(z.string()).default([]),
  itemEstado: z.array(z.enum(LICITACION_ESTADOS)).default([]),
});

function parseLicitacionForm(formData: FormData) {
  return licitacionSchema.safeParse({
    entidad: formData.get("entidad"),
    estado: formData.get("estado"),
    numeroProveedor: formData.get("numeroProveedor") || undefined,
    observaciones: formData.get("observaciones") || undefined,
    itemNumero: formData.getAll("itemNumero"),
    itemEstado: formData.getAll("itemEstado"),
  });
}

// Filas de licitación sin número cargado se descartan acá — mismo
// criterio que usa Pagos con sus filas de cheque: una fila a medio
// completar no tiene que bloquear el guardado del resto.
function buildLicitacionesArray(data: {
  itemNumero: string[];
  itemEstado: (typeof LICITACION_ESTADOS)[number][];
}) {
  return data.itemNumero
    .map((numero, i) => ({ numero: numero.trim(), estado: data.itemEstado[i] }))
    .filter((item) => item.numero.length > 0);
}

export async function createLicitacion(formData: FormData) {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "No autenticado." };

  const parsed = parseLicitacionForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  if (parsed.data.itemNumero.length !== parsed.data.itemEstado.length) {
    return { ok: false, error: "Los datos de las licitaciones quedaron desalineados. Recargá el formulario." };
  }

  try {
    await connectDB();
    await Licitacion.create({
      entidad: parsed.data.entidad,
      estado: parsed.data.estado,
      numeroProveedor: parsed.data.numeroProveedor,
      observaciones: parsed.data.observaciones,
      licitaciones: buildLicitacionesArray(parsed.data),
    });
  } catch (err) {
    console.error("createLicitacion error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear la entidad: ${message}` };
  }

  revalidatePath("/licitaciones");
  return { ok: true };
}

export async function updateLicitacion(id: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "No autenticado." };

  const parsed = parseLicitacionForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  if (parsed.data.itemNumero.length !== parsed.data.itemEstado.length) {
    return { ok: false, error: "Los datos de las licitaciones quedaron desalineados. Recargá el formulario." };
  }

  try {
    await connectDB();
    await Licitacion.findByIdAndUpdate(id, {
      entidad: parsed.data.entidad,
      estado: parsed.data.estado,
      numeroProveedor: parsed.data.numeroProveedor,
      observaciones: parsed.data.observaciones,
      licitaciones: buildLicitacionesArray(parsed.data),
    });
  } catch (err) {
    console.error("updateLicitacion error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar la entidad: ${message}` };
  }

  revalidatePath("/licitaciones");
  return { ok: true };
}

export async function deleteLicitacion(id: string) {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "No autenticado." };

  try {
    await connectDB();
    await Licitacion.findByIdAndDelete(id);
  } catch (err) {
    console.error("deleteLicitacion error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar la entidad: ${message}` };
  }

  revalidatePath("/licitaciones");
  return { ok: true };
}

// Dispara el mismo resumen semanal que el cron, pero a demanda — mismo
// patrón que sendAgendaDigestNow (solo OWNER, para poder probar el envío
// sin esperar al cron).
export async function sendLicitacionesDigestNow() {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "No autenticado." };
  if (session.user.role !== "OWNER") {
    return { ok: false, error: "No autorizado." };
  }

  try {
    const result = await runLicitacionesDigest();
    if (!result.sent) {
      return { ok: true, message: "No hay ninguna entidad cargada todavía — no se mandó ningún mail." };
    }
    return { ok: true, message: `Mail enviado con ${result.count} entidad(es).` };
  } catch (err) {
    console.error("sendLicitacionesDigestNow error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo enviar: ${message}` };
  }
}
