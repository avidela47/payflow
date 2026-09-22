"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Client } from "@/models/Client";
import { getNextSequence } from "@/models/Counter";
import { IVA_CONDITIONS } from "@/lib/iva-conditions";

// Detecta el error de índice único de MongoDB (E11000) sin depender de un
// tipo de error específico — Mongoose lo tira como un objeto plano, no
// como instancia de Error.
function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;
}

// Compartido entre OWNER y ACCOUNTANT — sin restricción de rol, igual que
// Empleados/Cheques/Agenda (a diferencia de Notas, que es privado, y de
// Vault, que solo dejamos entrar a esos dos roles pero no a otros que
// pudieran existir en el futuro).

// Prolijidad de carga: sin importar cómo lo tipeen, el nombre siempre
// queda en MAYÚSCULA y la razón social en minúscula. Se normaliza acá
// (server action), no en el input, para que quede igual sin importar por
// dónde se cargue o edite el cliente.
const clientSchema = z.object({
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

function parseClientForm(formData: FormData) {
  return clientSchema.safeParse({
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

export async function createClient(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const seq = await getNextSequence("client");
    const codigo = `CLI-${String(seq).padStart(3, "0")}`;
    await Client.create({
      ...parsed.data,
      codigo,
      condicionIva: parsed.data.condicionIva || undefined,
    });
  } catch (err) {
    console.error("createClient error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "Ya existe un cliente con ese nombre." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear el cliente: ${message}` };
  }

  revalidatePath("/clientes");
  return { ok: true };
}

export async function updateClient(clientId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const client = await Client.findByIdAndUpdate(clientId, {
      ...parsed.data,
      condicionIva: parsed.data.condicionIva || undefined,
    });
    if (!client) {
      return { ok: false, error: "El cliente ya no existe." };
    }
  } catch (err) {
    console.error("updateClient error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "Ya existe otro cliente con ese nombre." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar el cliente: ${message}` };
  }

  revalidatePath("/clientes");
  return { ok: true };
}

export async function deleteClient(clientId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Client.findByIdAndDelete(clientId);
  } catch (err) {
    console.error("deleteClient error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar el cliente: ${message}` };
  }

  revalidatePath("/clientes");
  return { ok: true };
}