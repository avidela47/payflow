"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { AgendaEntry } from "@/models/AgendaEntry";
import { getSession } from "@/lib/auth";
import { runAgendaDigest } from "@/lib/agenda-digest";

const agendaSchema = z.object({
  title: z.string().min(1, "Falta el título."),
  date: z.string().min(1, "Falta la fecha."), // "YYYY-MM-DD"
  notes: z.string().optional(),
});

export async function createAgendaEntry(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = agendaSchema.safeParse({
    title: formData.get("title"),
    date: formData.get("date"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await AgendaEntry.create({
      title: parsed.data.title,
      date: new Date(parsed.data.date),
      notes: parsed.data.notes,
    });
  } catch (err) {
    console.error("createAgendaEntry error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo guardar el recordatorio: ${message}` };
  }

  revalidatePath("/agenda");
  return { ok: true };
}

export async function deleteAgendaEntry(entryId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await AgendaEntry.findByIdAndDelete(entryId);
  } catch (err) {
    console.error("deleteAgendaEntry error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar el recordatorio: ${message}` };
  }

  revalidatePath("/agenda");
  return { ok: true };
}

// Dispara el mismo digest que el cron de Vercel, pero a demanda — el cron
// no corre en desarrollo, así que esto es lo que permite probar que el
// envío de mail funciona antes de tener todo desplegado.
export async function sendAgendaDigestNow() {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }
  // Solo OWNER puede disparar el envío de prueba — la contadora no lo ve
  // en la UI, pero esto evita que lo dispare igual llamando la acción
  // directamente (mismo patrón que Vault).
  if (session.user.role !== "OWNER") {
    return { ok: false, error: "No autorizado." };
  }

  try {
    const result = await runAgendaDigest();
    if (!result.sent) {
      return { ok: true, message: "No había nada agendado para hoy — no se mandó ningún mail." };
    }
    return { ok: true, message: `Mail enviado con ${result.count} item(s) de hoy.` };
  } catch (err) {
    console.error("sendAgendaDigestNow error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo mandar el mail: ${message}` };
  } finally {
    revalidatePath("/agenda");
  }
}