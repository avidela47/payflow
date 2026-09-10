"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Check } from "@/models/Check";
import { getSession } from "@/lib/auth";

const checkSchema = z.object({
  type: z.enum(["ELECTRONICO", "FISICO"]),
  issueDate: z.string().min(1, "Falta la fecha de emisión."),
  paymentDate: z.string().min(1, "Falta la fecha de pago."),
  checkNumber: z.string().min(1, "Falta el número de cheque."),
  echeqId: z.string().optional(),
  issuerName: z.string().min(1, "Falta el librador."),
  issuerCuit: z.string().optional(),
  issuingBank: z.string().optional(),
  amount: z.coerce.number().positive("El monto tiene que ser mayor a cero."),
  status: z.enum(["ACTIVO", "COBRADO", "ENDOSADO", "DEPOSITADO", "CADUCADO", "OTRO"]),
  currentHolder: z.string().optional(),
  requestedBy: z.string().optional(),
  notes: z.string().optional(),
});

function parseCheckForm(formData: FormData) {
  return checkSchema.safeParse({
    type: formData.get("type"),
    issueDate: formData.get("issueDate"),
    paymentDate: formData.get("paymentDate"),
    checkNumber: formData.get("checkNumber"),
    echeqId: formData.get("echeqId") || undefined,
    issuerName: formData.get("issuerName"),
    issuerCuit: formData.get("issuerCuit") || undefined,
    issuingBank: formData.get("issuingBank") || undefined,
    amount: formData.get("amount"),
    status: formData.get("status") || "ACTIVO",
    currentHolder: formData.get("currentHolder") || undefined,
    requestedBy: formData.get("requestedBy") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

export async function createCheck(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseCheckForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await Check.create({
      ...parsed.data,
      issueDate: new Date(parsed.data.issueDate),
      paymentDate: new Date(parsed.data.paymentDate),
    });
  } catch (err) {
    console.error("createCheck error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo guardar el cheque: ${message}` };
  }

  revalidatePath("/cheques");
  return { ok: true };
}

export async function updateCheck(checkId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseCheckForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await Check.findByIdAndUpdate(checkId, {
      ...parsed.data,
      issueDate: new Date(parsed.data.issueDate),
      paymentDate: new Date(parsed.data.paymentDate),
    });
  } catch (err) {
    console.error("updateCheck error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo editar el cheque: ${message}` };
  }

  revalidatePath("/cheques");
  return { ok: true };
}

export async function setCheckStatus(
  checkId: string,
  status: "ACTIVO" | "COBRADO" | "ENDOSADO" | "DEPOSITADO" | "CADUCADO" | "OTRO"
) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Check.findByIdAndUpdate(checkId, { status });
  } catch (err) {
    console.error("setCheckStatus error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo cambiar el estado: ${message}` };
  }

  revalidatePath("/cheques");
  return { ok: true };
}

export async function deleteCheck(checkId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Check.findByIdAndDelete(checkId);
  } catch (err) {
    console.error("deleteCheck error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar el cheque: ${message}` };
  }

  revalidatePath("/cheques");
  return { ok: true };
}