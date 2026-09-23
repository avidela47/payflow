"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Purchase, PURCHASE_RECEIPT_STATUSES, type PurchaseReceiptStatus } from "@/models/Purchase";
import { getSession } from "@/lib/auth";

const purchaseSchema = z.object({
  providerId: z.string().min(1, "Elegí un proveedor."),
  purchaseDate: z.string().min(1, "Falta la fecha de compra."),
  paymentMethod: z.string().optional(),
  expectedPaymentDate: z.string().optional(),
  currency: z.enum(["ARS", "USD"]).default("ARS"),
  // Uno u otro según `currency` — se valida a mano abajo, no acá.
  amount: z.coerce.number().positive().optional(),
  usdAmount: z.coerce.number().positive().optional(),
  exchangeRate: z.coerce.number().positive().optional(),
  remitoNumber: z.string().optional(),
  invoiceNumber: z.string().optional(),
  purchaseOrderNumber: z.string().optional(),
  notes: z.string().optional(),
});

function parsePurchaseForm(formData: FormData) {
  return purchaseSchema.safeParse({
    providerId: formData.get("providerId"),
    purchaseDate: formData.get("purchaseDate"),
    paymentMethod: formData.get("paymentMethod") || undefined,
    expectedPaymentDate: formData.get("expectedPaymentDate") || undefined,
    currency: formData.get("currency") || "ARS",
    amount: formData.get("amount") || undefined,
    usdAmount: formData.get("usdAmount") || undefined,
    exchangeRate: formData.get("exchangeRate") || undefined,
    remitoNumber: formData.get("remitoNumber") || undefined,
    invoiceNumber: formData.get("invoiceNumber") || undefined,
    purchaseOrderNumber: formData.get("purchaseOrderNumber") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

// Mismo criterio que Ventas/Costos Fijos: si es USD, exige monto en USD +
// cotización y calcula el equivalente en pesos; si es ARS, exige el monto
// directo.
function resolveAmount(data: z.infer<typeof purchaseSchema>):
  | { ok: true; amount: number; currency: "ARS" | "USD"; usdAmount?: number; exchangeRate?: number }
  | { ok: false; error: string } {
  if (data.currency === "USD") {
    if (!data.usdAmount || !data.exchangeRate) {
      return { ok: false, error: "Falta el monto en USD o la cotización." };
    }
    return {
      ok: true,
      amount: Math.round(data.usdAmount * data.exchangeRate * 100) / 100,
      currency: "USD",
      usdAmount: data.usdAmount,
      exchangeRate: data.exchangeRate,
    };
  }

  if (!data.amount) {
    return { ok: false, error: "El monto tiene que ser mayor a cero." };
  }
  return { ok: true, amount: data.amount, currency: "ARS" };
}

export async function createPurchase(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parsePurchaseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const resolved = resolveAmount(parsed.data);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  try {
    await connectDB();
    await Purchase.create({
      provider: parsed.data.providerId,
      purchaseDate: new Date(parsed.data.purchaseDate),
      paymentMethod: parsed.data.paymentMethod,
      expectedPaymentDate: parsed.data.expectedPaymentDate
        ? new Date(parsed.data.expectedPaymentDate)
        : undefined,
      // Toda compra nueva arranca "en curso" — se cambia a mano desde la
      // tabla una vez que se recibe.
      receiptStatus: "EN_CURSO",
      amount: resolved.amount,
      currency: resolved.currency,
      usdAmount: resolved.usdAmount,
      exchangeRate: resolved.exchangeRate,
      remitoNumber: parsed.data.remitoNumber,
      invoiceNumber: parsed.data.invoiceNumber,
      purchaseOrderNumber: parsed.data.purchaseOrderNumber,
      notes: parsed.data.notes,
    });
  } catch (err) {
    console.error("createPurchase error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear la compra: ${message}` };
  }

  revalidatePath("/compras");
  revalidatePath("/");
  return { ok: true };
}

export async function updatePurchase(purchaseId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parsePurchaseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const resolved = resolveAmount(parsed.data);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  try {
    await connectDB();
    // $set explícito (a diferencia del create) porque, al pasar de USD a
    // ARS, necesitamos poder BORRAR usdAmount/exchangeRate viejos — con
    // $unset, no dejándolos pegados con el valor anterior.
    await Purchase.findByIdAndUpdate(purchaseId, {
      $set: {
        provider: parsed.data.providerId,
        purchaseDate: new Date(parsed.data.purchaseDate),
        paymentMethod: parsed.data.paymentMethod,
        expectedPaymentDate: parsed.data.expectedPaymentDate
          ? new Date(parsed.data.expectedPaymentDate)
          : undefined,
        amount: resolved.amount,
        currency: resolved.currency,
        remitoNumber: parsed.data.remitoNumber,
        invoiceNumber: parsed.data.invoiceNumber,
        purchaseOrderNumber: parsed.data.purchaseOrderNumber,
        notes: parsed.data.notes,
        ...(resolved.currency === "USD"
          ? { usdAmount: resolved.usdAmount, exchangeRate: resolved.exchangeRate }
          : {}),
      },
      ...(resolved.currency === "ARS" ? { $unset: { usdAmount: "", exchangeRate: "" } } : {}),
    });
  } catch (err) {
    console.error("updatePurchase error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo editar la compra: ${message}` };
  }

  revalidatePath("/compras");
  revalidatePath("/");
  return { ok: true };
}

export async function setPurchasePaid(purchaseId: string, paid: boolean) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    if (paid) {
      await Purchase.findByIdAndUpdate(purchaseId, { paid: true, paidDate: new Date() });
    } else {
      await Purchase.findByIdAndUpdate(purchaseId, { paid: false, $unset: { paidDate: "" } });
    }
  } catch (err) {
    console.error("setPurchasePaid error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo cambiar el estado de pago: ${message}` };
  }

  revalidatePath("/compras");
  revalidatePath("/");
  return { ok: true };
}

export async function setPurchaseReceiptStatus(purchaseId: string, status: PurchaseReceiptStatus) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  if (!PURCHASE_RECEIPT_STATUSES.includes(status)) {
    return { ok: false, error: "Estado de recepción inválido." };
  }

  try {
    await connectDB();
    await Purchase.findByIdAndUpdate(purchaseId, { receiptStatus: status });
  } catch (err) {
    console.error("setPurchaseReceiptStatus error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo cambiar el estado de recepción: ${message}` };
  }

  revalidatePath("/compras");
  revalidatePath("/");
  return { ok: true };
}

export async function deletePurchase(purchaseId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Purchase.findByIdAndDelete(purchaseId);
  } catch (err) {
    console.error("deletePurchase error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar la compra: ${message}` };
  }

  revalidatePath("/compras");
  revalidatePath("/");
  return { ok: true };
}