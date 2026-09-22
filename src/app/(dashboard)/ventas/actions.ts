"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { getSession } from "@/lib/auth";

const saleSchema = z.object({
  clientId: z.string().min(1, "Elegí un cliente."),
  saleDate: z.string().min(1, "Falta la fecha de venta."),
  paymentMethod: z.string().optional(),
  expectedCollectionDate: z.string().optional(),
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

function parseSaleForm(formData: FormData) {
  return saleSchema.safeParse({
    clientId: formData.get("clientId"),
    saleDate: formData.get("saleDate"),
    paymentMethod: formData.get("paymentMethod") || undefined,
    expectedCollectionDate: formData.get("expectedCollectionDate") || undefined,
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

// Mismo criterio que Costos Fijos: si es USD, exige monto en USD +
// cotización y calcula el equivalente en pesos; si es ARS, exige el
// monto directo.
function resolveAmount(data: z.infer<typeof saleSchema>):
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

export async function createSale(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseSaleForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const resolved = resolveAmount(parsed.data);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  try {
    await connectDB();
    await Sale.create({
      client: parsed.data.clientId,
      saleDate: new Date(parsed.data.saleDate),
      paymentMethod: parsed.data.paymentMethod,
      expectedCollectionDate: parsed.data.expectedCollectionDate
        ? new Date(parsed.data.expectedCollectionDate)
        : undefined,
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
    console.error("createSale error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear la venta: ${message}` };
  }

  revalidatePath("/ventas");
  revalidatePath("/");
  return { ok: true };
}

export async function updateSale(saleId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseSaleForm(formData);
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
    await Sale.findByIdAndUpdate(saleId, {
      $set: {
        client: parsed.data.clientId,
        saleDate: new Date(parsed.data.saleDate),
        paymentMethod: parsed.data.paymentMethod,
        expectedCollectionDate: parsed.data.expectedCollectionDate
          ? new Date(parsed.data.expectedCollectionDate)
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
    console.error("updateSale error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo editar la venta: ${message}` };
  }

  revalidatePath("/ventas");
  revalidatePath("/");
  return { ok: true };
}

export async function setSaleCollected(saleId: string, collected: boolean) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    if (collected) {
      await Sale.findByIdAndUpdate(saleId, { collected: true, collectedDate: new Date() });
    } else {
      await Sale.findByIdAndUpdate(saleId, { collected: false, $unset: { collectedDate: "" } });
    }
  } catch (err) {
    console.error("setSaleCollected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo cambiar el estado: ${message}` };
  }

  revalidatePath("/ventas");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteSale(saleId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Sale.findByIdAndDelete(saleId);
  } catch (err) {
    console.error("deleteSale error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar la venta: ${message}` };
  }

  revalidatePath("/ventas");
  revalidatePath("/");
  return { ok: true };
}