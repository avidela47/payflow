"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Provider } from "@/models/Provider";
import { getNextSequence } from "@/models/Counter";
import { IVA_CONDITIONS } from "@/lib/iva-conditions";

// Detecta el error de índice único de MongoDB (E11000) sin depender de un
// tipo de error específico — Mongoose lo tira como un objeto plano, no
// como instancia de Error.
function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;
}

// Mismo criterio que Clientes: sin restricción de rol (OWNER y ACCOUNTANT
// comparten el módulo), nombre siempre normalizado a MAYÚSCULA y razón
// social a minúscula, código correlativo autogenerado.
const providerSchema = z.object({
  nombre: z
    .string()
    .min(1, "Falta el nombre.")
    .transform((v) => v.trim().toUpperCase()),
  razonSocial: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim().toLowerCase() : v)),
  cuit: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().optional(),
  direccion: z.string().optional(),
  localidad: z.string().optional(),
  provincia: z.string().optional(),
  contacto: z.string().optional(),
  condicionIva: z.enum(IVA_CONDITIONS).optional().or(z.literal("")),
  notas: z.string().optional(),
});

function parseProviderForm(formData: FormData) {
  return providerSchema.safeParse({
    nombre: formData.get("nombre"),
    razonSocial: formData.get("razonSocial") || undefined,
    cuit: formData.get("cuit") || undefined,
    telefono: formData.get("telefono") || undefined,
    email: formData.get("email") || undefined,
    direccion: formData.get("direccion") || undefined,
    localidad: formData.get("localidad") || undefined,
    provincia: formData.get("provincia") || undefined,
    contacto: formData.get("contacto") || undefined,
    condicionIva: formData.get("condicionIva") || undefined,
    notas: formData.get("notas") || undefined,
  });
}

export async function createProvider(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseProviderForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const seq = await getNextSequence("provider");
    const codigo = `PROV-${String(seq).padStart(3, "0")}`;
    await Provider.create({
      ...parsed.data,
      codigo,
      condicionIva: parsed.data.condicionIva || undefined,
    });
  } catch (err) {
    console.error("createProvider error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "Ya existe un proveedor con ese nombre." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear el proveedor: ${message}` };
  }

  revalidatePath("/proveedores");
  return { ok: true };
}

export async function updateProvider(providerId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseProviderForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const provider = await Provider.findByIdAndUpdate(providerId, {
      ...parsed.data,
      condicionIva: parsed.data.condicionIva || undefined,
    });
    if (!provider) {
      return { ok: false, error: "El proveedor ya no existe." };
    }
  } catch (err) {
    console.error("updateProvider error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "Ya existe otro proveedor con ese nombre." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar el proveedor: ${message}` };
  }

  revalidatePath("/proveedores");
  return { ok: true };
}

export async function deleteProvider(providerId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Provider.findByIdAndDelete(providerId);
  } catch (err) {
    console.error("deleteProvider error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar el proveedor: ${message}` };
  }

  revalidatePath("/proveedores");
  return { ok: true };
}