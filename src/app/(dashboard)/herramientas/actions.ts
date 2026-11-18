"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Herramienta } from "@/models/Herramienta";
import { HERRAMIENTA_ESTADOS } from "@/lib/herramienta-estados";

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}

const herramientaSchema = z
  .object({
    codigo: z
      .string()
      .min(1, "Falta el código.")
      .transform((v) => v.trim().toUpperCase()),
    nombre: z
      .string()
      .min(1, "Falta el nombre.")
      .transform((v) => v.trim()),
    descripcion: z.string().optional(),
    cantidadTotal: z.coerce.number().min(0, "La cantidad total no puede ser negativa."),
    cantidadDisponible: z.coerce.number().min(0, "La cantidad disponible no puede ser negativa."),
    estado: z.enum(HERRAMIENTA_ESTADOS, { message: "Falta el estado." }),
    ubicacion: z.string().optional(),
    notas: z.string().optional(),
  })
  .refine((data) => data.cantidadDisponible <= data.cantidadTotal, {
    message: "La cantidad disponible no puede ser mayor a la cantidad total.",
    path: ["cantidadDisponible"],
  });

function parseHerramientaForm(formData: FormData) {
  return herramientaSchema.safeParse({
    codigo: formData.get("codigo"),
    nombre: formData.get("nombre"),
    descripcion: formData.get("descripcion") || undefined,
    cantidadTotal: formData.get("cantidadTotal") || 0,
    cantidadDisponible: formData.get("cantidadDisponible") || 0,
    estado: formData.get("estado"),
    ubicacion: formData.get("ubicacion") || undefined,
    notas: formData.get("notas") || undefined,
  });
}

export async function createHerramienta(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseHerramientaForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await Herramienta.create(parsed.data);
  } catch (err) {
    console.error("createHerramienta error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: `Ya existe una herramienta con el código ${parsed.data.codigo}.` };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath("/herramientas");
  return { ok: true };
}

export async function updateHerramienta(id: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseHerramientaForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const item = await Herramienta.findByIdAndUpdate(id, parsed.data);
    if (!item) {
      return { ok: false, error: "El ítem ya no existe." };
    }
  } catch (err) {
    console.error("updateHerramienta error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "Ya existe otra herramienta con ese código." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar: ${message}` };
  }

  revalidatePath("/herramientas");
  return { ok: true };
}

export async function deleteHerramienta(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Herramienta.findByIdAndDelete(id);
  } catch (err) {
    console.error("deleteHerramienta error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath("/herramientas");
  return { ok: true };
}