"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { VaultEntry, VaultAccessLog } from "@/models/Vault";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

// Todo el módulo es OWNER-only por default (ver ARCHITECTURE.md sección
// 4/2) — cada acción revalida el rol server-side, no confiamos solo en el
// redirect de la página.
async function requireOwner() {
  const session = await getSession();
  if (session?.user?.role !== "OWNER") {
    return null;
  }
  return session;
}

// La auditoría no debe tumbar la acción principal si falla por algo
// puntual (ej. un problema de red puntual con Mongo) — se loguea el error
// y se sigue.
async function logAccess(
  vaultEntryId: string,
  userId: string,
  action: "VIEW" | "REVEAL" | "EDIT" | "CREATE" | "DELETE"
) {
  try {
    await VaultAccessLog.create({ vaultEntry: vaultEntryId, user: userId, action });
  } catch (err) {
    console.error("No se pudo registrar el acceso al vault:", err);
  }
}

const createSchema = z.object({
  service: z.string().min(1, "Falta el servicio."),
  username: z.string().optional(),
  value: z.string().min(1, "Falta la contraseña/clave."),
  link: z.string().optional(),
  notes: z.string().optional(),
});

export async function createVaultEntry(formData: FormData) {
  const session = await requireOwner();
  if (!session) {
    return { ok: false, error: "No autorizado." };
  }

  const parsed = createSchema.safeParse({
    service: formData.get("service"),
    username: formData.get("username") || undefined,
    value: formData.get("value"),
    link: formData.get("link") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const { encryptedValue, iv, authTag } = encryptSecret(parsed.data.value);
    const entry = await VaultEntry.create({
      service: parsed.data.service,
      username: parsed.data.username,
      encryptedValue,
      iv,
      authTag,
      link: parsed.data.link,
      notes: parsed.data.notes,
    });
    await logAccess(entry._id.toString(), session.user.id, "CREATE");
  } catch (err) {
    console.error("createVaultEntry error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo guardar la credencial: ${message}` };
  }

  revalidatePath("/vault");
  return { ok: true };
}

const editSchema = z.object({
  service: z.string().min(1, "Falta el servicio."),
  username: z.string().optional(),
  value: z.string().optional(), // vacío = no cambiar la clave ya guardada
  link: z.string().optional(),
  notes: z.string().optional(),
});

export async function updateVaultEntry(entryId: string, formData: FormData) {
  const session = await requireOwner();
  if (!session) {
    return { ok: false, error: "No autorizado." };
  }

  const parsed = editSchema.safeParse({
    service: formData.get("service"),
    username: formData.get("username") || undefined,
    value: formData.get("value") || undefined,
    link: formData.get("link") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const update: Record<string, unknown> = {
      service: parsed.data.service,
      username: parsed.data.username,
      link: parsed.data.link,
      notes: parsed.data.notes,
    };
    if (parsed.data.value) {
      const { encryptedValue, iv, authTag } = encryptSecret(parsed.data.value);
      update.encryptedValue = encryptedValue;
      update.iv = iv;
      update.authTag = authTag;
    }
    const entry = await VaultEntry.findByIdAndUpdate(entryId, update);
    if (!entry) {
      return { ok: false, error: "La credencial ya no existe." };
    }
    await logAccess(entryId, session.user.id, "EDIT");
  } catch (err) {
    console.error("updateVaultEntry error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar la credencial: ${message}` };
  }

  revalidatePath("/vault");
  return { ok: true };
}

export async function deleteVaultEntry(entryId: string) {
  const session = await requireOwner();
  if (!session) {
    return { ok: false, error: "No autorizado." };
  }

  try {
    await connectDB();
    // El log de auditoría queda como historial propio aunque se borre la
    // entrada referenciada — no lo borramos en cascada.
    await logAccess(entryId, session.user.id, "DELETE");
    await VaultEntry.findByIdAndDelete(entryId);
  } catch (err) {
    console.error("deleteVaultEntry error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar la credencial: ${message}` };
  }

  revalidatePath("/vault");
  return { ok: true };
}

export async function revealVaultEntry(entryId: string) {
  const session = await requireOwner();
  if (!session) {
    return { ok: false as const, error: "No autorizado." };
  }

  try {
    await connectDB();
    const entry = await VaultEntry.findById(entryId);
    if (!entry) {
      return { ok: false as const, error: "La credencial ya no existe." };
    }
    const value = decryptSecret({
      encryptedValue: entry.encryptedValue,
      iv: entry.iv,
      authTag: entry.authTag,
    });
    await logAccess(entryId, session.user.id, "REVEAL");
    return { ok: true as const, value };
  } catch (err) {
    console.error("revealVaultEntry error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false as const, error: `No se pudo revelar la clave: ${message}` };
  }
}