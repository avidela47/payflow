"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Material } from "@/models/Material";
import { MATERIAL_UNIDADES } from "@/lib/material-unidades";

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}

const materialSchema = z.object({
  codigo: z
    .string()
    .min(1, "Falta el código.")
    .transform((v) => v.trim().toUpperCase()),
  descripcion: z
    .string()
    .min(1, "Falta la descripción.")
    .transform((v) => v.trim()),
  unidad: z.enum(MATERIAL_UNIDADES, { message: "Falta la unidad." }),
  stockActual: z.coerce.number().min(0, "El stock actual no puede ser negativo."),
  stockMinimo: z.coerce.number().min(0, "El mínimo no puede ser negativo."),
  precio: z.coerce.number().min(0, "El precio no puede ser negativo."),
  proveedor: z.string().optional(),
  notas: z.string().optional(),
});

function parseMaterialForm(formData: FormData) {
  return materialSchema.safeParse({
    codigo: formData.get("codigo"),
    descripcion: formData.get("descripcion"),
    unidad: formData.get("unidad"),
    stockActual: formData.get("stockActual") || 0,
    stockMinimo: formData.get("stockMinimo") || 0,
    precio: formData.get("precio") || 0,
    proveedor: formData.get("proveedor") || undefined,
    notas: formData.get("notas") || undefined,
  });
}

export async function createMaterial(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseMaterialForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await Material.create(parsed.data);
  } catch (err) {
    console.error("createMaterial error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: `Ya existe un material con el código ${parsed.data.codigo}.` };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath("/materiales");
  return { ok: true };
}

export async function updateMaterial(id: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseMaterialForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const item = await Material.findByIdAndUpdate(id, parsed.data);
    if (!item) {
      return { ok: false, error: "El ítem ya no existe." };
    }
  } catch (err) {
    console.error("updateMaterial error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "Ya existe otro material con ese código." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar: ${message}` };
  }

  revalidatePath("/materiales");
  return { ok: true };
}

export async function deleteMaterial(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Material.findByIdAndDelete(id);
  } catch (err) {
    console.error("deleteMaterial error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath("/materiales");
  return { ok: true };
}