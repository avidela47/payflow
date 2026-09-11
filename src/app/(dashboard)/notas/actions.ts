"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Note, NOTE_COLORS } from "@/models/Note";

// Notas privadas por usuario: cada acción vuelve a chequear la sesión y
// filtra/valida por `user: session.user.id` — nunca se confía en un id que
// venga del cliente para saber de quién es la nota.

const noteSchema = z.object({
  title: z.string().optional(),
  content: z.string().min(1, "La nota no puede estar vacía."),
  color: z.enum(NOTE_COLORS).default("yellow"),
});

export async function createNote(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = noteSchema.safeParse({
    title: formData.get("title") || undefined,
    content: formData.get("content"),
    color: formData.get("color") || "yellow",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await Note.create({
      user: session.user.id,
      title: parsed.data.title,
      content: parsed.data.content,
      color: parsed.data.color,
    });
  } catch (err) {
    console.error("createNote error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear la nota: ${message}` };
  }

  revalidatePath("/notas");
  return { ok: true };
}

export async function updateNote(noteId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = noteSchema.safeParse({
    title: formData.get("title") || undefined,
    content: formData.get("content"),
    color: formData.get("color") || "yellow",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    // Filtramos por user acá también: si alguien intenta editar una nota
    // que no es suya (id adivinado/copiado), findOneAndUpdate no encuentra
    // nada y no pasa nada — no hace falta un error especial para eso.
    await Note.findOneAndUpdate(
      { _id: noteId, user: session.user.id },
      {
        title: parsed.data.title,
        content: parsed.data.content,
        color: parsed.data.color,
      }
    );
  } catch (err) {
    console.error("updateNote error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo editar la nota: ${message}` };
  }

  revalidatePath("/notas");
  return { ok: true };
}

export async function deleteNote(noteId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Note.findOneAndDelete({ _id: noteId, user: session.user.id });
  } catch (err) {
    console.error("deleteNote error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar la nota: ${message}` };
  }

  revalidatePath("/notas");
  return { ok: true };
}

export async function toggleNotePinned(noteId: string, pinned: boolean) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Note.findOneAndUpdate({ _id: noteId, user: session.user.id }, { pinned });
  } catch (err) {
    console.error("toggleNotePinned error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo cambiar el estado: ${message}` };
  }

  revalidatePath("/notas");
  return { ok: true };
}