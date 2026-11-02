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
  // Canal + desglose. Todo opcional: es informativo, no bloquea el guardado.
  channel: z.enum(["OFICINA", "MERCADO_LIBRE"]).default("OFICINA"),
  mlCommission: z.coerce.number().min(0).optional(),
  mlShipping: z.coerce.number().min(0).optional(),
  mlTaxes: z.coerce.number().min(0).optional(),
  profitPct: z.coerce.number().min(0).optional(),
  iibbPct: z.coerce.number().min(0).optional(),
  ivaPct: z.coerce.number().min(0).optional(),
  otherPct: z.coerce.number().min(0).optional(),
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
    channel: formData.get("channel") || "OFICINA",
    mlCommission: formData.get("mlCommission") || undefined,
    mlShipping: formData.get("mlShipping") || undefined,
    mlTaxes: formData.get("mlTaxes") || undefined,
    profitPct: formData.get("profitPct") || undefined,
    iibbPct: formData.get("iibbPct") || undefined,
    ivaPct: formData.get("ivaPct") || undefined,
    otherPct: formData.get("otherPct") || undefined,
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
      channel: parsed.data.channel,
      ...(parsed.data.channel === "MERCADO_LIBRE"
        ? {
            mlCommission: parsed.data.mlCommission,
            mlShipping: parsed.data.mlShipping,
            mlTaxes: parsed.data.mlTaxes,
          }
        : {
            profitPct: parsed.data.profitPct,
            iibbPct: parsed.data.iibbPct,
            ivaPct: parsed.data.ivaPct,
            otherPct: parsed.data.otherPct,
          }),
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

  // $set/$unset explícitos (igual que con USD/ARS) para poder limpiar los
  // campos del canal que no corresponde cuando se cambia de uno a otro.
  const setFields: Record<string, unknown> = {
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
    channel: parsed.data.channel,
  };

  const unsetFields: Record<string, "" > = {};

  if (resolved.currency === "USD") {
    setFields.usdAmount = resolved.usdAmount;
    setFields.exchangeRate = resolved.exchangeRate;
  } else {
    unsetFields.usdAmount = "";
    unsetFields.exchangeRate = "";
  }

  if (parsed.data.channel === "MERCADO_LIBRE") {
    setFields.mlCommission = parsed.data.mlCommission;
    setFields.mlShipping = parsed.data.mlShipping;
    setFields.mlTaxes = parsed.data.mlTaxes;
    unsetFields.profitPct = "";
    unsetFields.iibbPct = "";
    unsetFields.ivaPct = "";
    unsetFields.otherPct = "";
  } else {
    setFields.profitPct = parsed.data.profitPct;
    setFields.iibbPct = parsed.data.iibbPct;
    setFields.ivaPct = parsed.data.ivaPct;
    setFields.otherPct = parsed.data.otherPct;
    unsetFields.mlCommission = "";
    unsetFields.mlShipping = "";
    unsetFields.mlTaxes = "";
  }

  try {
    await connectDB();
    await Sale.findByIdAndUpdate(saleId, {
      $set: setFields,
      $unset: unsetFields,
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