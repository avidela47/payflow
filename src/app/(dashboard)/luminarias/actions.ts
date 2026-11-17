"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Luminaria } from "@/models/Luminaria";
import { LUMINARIA_ORIGENES } from "@/lib/luminaria-origen";

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}

const luminariaSchema = z.object({
  codigo: z
    .string()
    .min(1, "Falta el código.")
    .transform((v) => v.trim().toUpperCase()),
  descripcion: z
    .string()
    .min(1, "Falta la descripción.")
    .transform((v) => v.trim()),
  origen: z.enum(LUMINARIA_ORIGENES, { message: "Falta el origen." }),
  stockActual: z.coerce.number().min(0, "El stock actual no puede ser negativo."),
  stockMinimo: z.coerce.number().min(0, "El mínimo no puede ser negativo."),
  precio: z.coerce.number().min(0, "El precio no puede ser negativo."),
  proveedor: z.string().optional(),
  notas: z.string().optional(),
  tieneReceta: z.coerce.boolean().optional(),
});

function parseLuminariaForm(formData: FormData) {
  return luminariaSchema.safeParse({
    codigo: formData.get("codigo"),
    descripcion: formData.get("descripcion"),
    origen: formData.get("origen"),
    stockActual: formData.get("stockActual") || 0,
    stockMinimo: formData.get("stockMinimo") || 0,
    precio: formData.get("precio") || 0,
    proveedor: formData.get("proveedor") || undefined,
    notas: formData.get("notas") || undefined,
    tieneReceta: formData.get("tieneReceta") === "on",
  });
}

export async function createLuminaria(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseLuminariaForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await Luminaria.create(parsed.data);
  } catch (err) {
    console.error("createLuminaria error:", err);
    if (isDuplicateKeyError(err)) {
      return {
        ok: false,
        error: `Ya existe una luminaria con el código ${parsed.data.codigo} y ese mismo origen.`,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath("/luminarias");
  return { ok: true };
}

export async function updateLuminaria(id: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseLuminariaForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const item = await Luminaria.findByIdAndUpdate(id, parsed.data);
    if (!item) {
      return { ok: false, error: "El ítem ya no existe." };
    }
  } catch (err) {
    console.error("updateLuminaria error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "Ya existe otra luminaria con ese código y ese origen." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar: ${message}` };
  }

  revalidatePath("/luminarias");
  return { ok: true };
}

export async function deleteLuminaria(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Luminaria.findByIdAndDelete(id);
  } catch (err) {
    console.error("deleteLuminaria error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath("/luminarias");
  return { ok: true };
}