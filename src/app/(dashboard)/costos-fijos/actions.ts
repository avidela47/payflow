"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { FixedCostCategory, FixedCostEntry } from "@/models/FixedCost";
import { getSession } from "@/lib/auth";

// Categorías típicas de ITELSA para no arrancar con la lista vacía. Se
// insertan solo si la colección está vacía (ver ensureDefaultCategories) —
// después de eso, Ariel las administra desde la UI (alta/edición/borrado).
const DEFAULT_CATEGORIES: { name: string; kind: string }[] = [
  { name: "IIBB", kind: "impuesto" },
  { name: "IVA", kind: "impuesto" },
  { name: "SICORE", kind: "impuesto" },
  { name: "F931", kind: "impuesto" },
  { name: "Monotributo", kind: "impuesto" },
  { name: "Autónomos", kind: "impuesto" },
  { name: "Alquiler", kind: "alquiler" },
  { name: "Seguros", kind: "seguro" },
  { name: "Servicios", kind: "servicio" },
];

export async function ensureDefaultCategories() {
  await connectDB();
  const count = await FixedCostCategory.countDocuments();
  if (count === 0) {
    await FixedCostCategory.insertMany(DEFAULT_CATEGORIES);
  }
}

// ---------- Categorías ----------

const categorySchema = z.object({
  name: z.string().min(1, "Falta el nombre."),
  kind: z.string().optional(),
  notes: z.string().optional(),
});

export async function createFixedCostCategory(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await FixedCostCategory.create(parsed.data);
  } catch (err) {
    console.error("createFixedCostCategory error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear la categoría: ${message}` };
  }

  revalidatePath("/costos-fijos");
  return { ok: true };
}

export async function updateFixedCostCategory(categoryId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await FixedCostCategory.findByIdAndUpdate(categoryId, parsed.data);
  } catch (err) {
    console.error("updateFixedCostCategory error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar la categoría: ${message}` };
  }

  revalidatePath("/costos-fijos");
  return { ok: true };
}

export async function deleteFixedCostCategory(categoryId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const inUse = await FixedCostEntry.exists({ category: categoryId });
    if (inUse) {
      return {
        ok: false,
        error: "No se puede borrar: hay costos cargados con esta categoría.",
      };
    }
    await FixedCostCategory.findByIdAndDelete(categoryId);
  } catch (err) {
    console.error("deleteFixedCostCategory error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar la categoría: ${message}` };
  }

  revalidatePath("/costos-fijos");
  return { ok: true };
}

// ---------- Costos (entradas por período) ----------

const entrySchema = z.object({
  categoryId: z.string().min(1, "Elegí una categoría."),
  period: z.string().min(1, "Falta el período."), // "YYYY-MM"
  currency: z.enum(["ARS", "USD"]).default("ARS"),
  // Solo aplica con currency="USD": no pide cotización, no calcula
  // equivalente en pesos — queda como gasto aparte, en dólares puros.
  noConversion: z.boolean().optional().default(false),
  // Uno u otro según `currency` (y `noConversion`) — se valida a mano
  // abajo, no acá, porque cuál es obligatorio depende de esos valores.
  amount: z.coerce.number().positive().optional(),
  usdAmount: z.coerce.number().positive().optional(),
  exchangeRate: z.coerce.number().positive().optional(),
  paymentMode: z.string().optional(),
  dueDate: z.string().optional(), // "YYYY-MM-DD"
  notes: z.string().optional(),
});

function parseEntryForm(formData: FormData) {
  return entrySchema.safeParse({
    categoryId: formData.get("categoryId"),
    period: formData.get("period"),
    currency: formData.get("currency") || "ARS",
    noConversion: formData.get("noConversion") === "on",
    amount: formData.get("amount") || undefined,
    usdAmount: formData.get("usdAmount") || undefined,
    exchangeRate: formData.get("exchangeRate") || undefined,
    paymentMode: formData.get("paymentMode") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

// Calcula el monto en pesos a guardar según la moneda elegida. Si es USD
// "sin conversión", no calcula nada — queda en 0 y el monto real vive
// solo en `usdAmount` (gasto aparte, no entra a los totales en pesos). Si
// es USD normal, exige monto en USD + cotización y calcula el
// equivalente; si es ARS, exige el monto directo. Devuelve un error
// legible si falta algo.
function resolveAmount(data: z.infer<typeof entrySchema>):
  | {
      ok: true;
      amount: number;
      currency: "ARS" | "USD";
      usdAmount?: number;
      exchangeRate?: number;
      noConversion: boolean;
    }
  | { ok: false; error: string } {
  if (data.currency === "USD") {
    if (!data.usdAmount) {
      return { ok: false, error: "Falta el monto en USD." };
    }

    if (data.noConversion) {
      return {
        ok: true,
        amount: 0,
        currency: "USD",
        usdAmount: data.usdAmount,
        noConversion: true,
      };
    }

    if (!data.exchangeRate) {
      return { ok: false, error: "Falta la cotización (o tildá \"Sin conversión\")." };
    }
    return {
      ok: true,
      amount: Math.round(data.usdAmount * data.exchangeRate * 100) / 100,
      currency: "USD",
      usdAmount: data.usdAmount,
      exchangeRate: data.exchangeRate,
      noConversion: false,
    };
  }

  if (!data.amount) {
    return { ok: false, error: "El monto tiene que ser mayor a cero." };
  }
  return { ok: true, amount: data.amount, currency: "ARS", noConversion: false };
}

export async function createFixedCostEntry(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseEntryForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const resolved = resolveAmount(parsed.data);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  const [year, month] = parsed.data.period.split("-").map(Number);
  const period = new Date(year, month - 1, 1);

  try {
    await connectDB();
    // Un solo costo por categoría+período+moneda — si ya existe ESE par
    // exacto, lo actualiza en vez de tirar error de clave duplicada
    // (misma idea que en Sueldos). Por moneda, no solo por categoría+
    // período, para que una misma categoría pueda tener a la vez un
    // costo en pesos y otro en dólares el mismo mes (ej. alquiler).
    //
    // $set/$unset explícito (no un objeto plano) para poder borrar
    // exchangeRate si ya existía un costo en USD convertido y ahora se
    // vuelve a cargar "sin conversión" — con un objeto plano, Mongoose
    // deja los campos no incluidos tal cual estaban, no los borra.
    await FixedCostEntry.findOneAndUpdate(
      { category: parsed.data.categoryId, period, currency: resolved.currency },
      {
        $set: {
          category: parsed.data.categoryId,
          period,
          amount: resolved.amount,
          currency: resolved.currency,
          noConversion: resolved.noConversion,
          paymentMode: parsed.data.paymentMode,
          dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
          notes: parsed.data.notes,
          ...(resolved.currency === "USD" ? { usdAmount: resolved.usdAmount } : {}),
          ...(resolved.currency === "USD" && !resolved.noConversion
            ? { exchangeRate: resolved.exchangeRate }
            : {}),
        },
        ...(resolved.currency === "USD" && resolved.noConversion
          ? { $unset: { exchangeRate: "" } }
          : {}),
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("createFixedCostEntry error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo guardar el costo: ${message}` };
  }

  revalidatePath("/costos-fijos");
  return { ok: true };
}

export async function updateFixedCostEntry(entryId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseEntryForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const resolved = resolveAmount(parsed.data);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  const [year, month] = parsed.data.period.split("-").map(Number);
  const period = new Date(year, month - 1, 1);

  try {
    await connectDB();
    // $set explícito acá porque, al pasar de USD a ARS (o de USD
    // convertido a USD "sin conversión"), necesitamos poder BORRAR
    // usdAmount/exchangeRate viejos — con un objeto plano quedarían
    // pegados con el valor anterior en vez de borrarse.
    const unsetFields: Record<string, ""> = {};
    if (resolved.currency === "ARS") {
      unsetFields.usdAmount = "";
      unsetFields.exchangeRate = "";
    } else if (resolved.noConversion) {
      unsetFields.exchangeRate = "";
    }

    await FixedCostEntry.findByIdAndUpdate(entryId, {
      $set: {
        category: parsed.data.categoryId,
        period,
        amount: resolved.amount,
        currency: resolved.currency,
        noConversion: resolved.noConversion,
        paymentMode: parsed.data.paymentMode,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
        notes: parsed.data.notes,
        ...(resolved.currency === "USD" ? { usdAmount: resolved.usdAmount } : {}),
        ...(resolved.currency === "USD" && !resolved.noConversion
          ? { exchangeRate: resolved.exchangeRate }
          : {}),
      },
      ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}),
    });
  } catch (err) {
    console.error("updateFixedCostEntry error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo editar el costo: ${message}` };
  }

  revalidatePath("/costos-fijos");
  return { ok: true };
}

export async function setFixedCostEntryPaid(entryId: string, paid: boolean) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await FixedCostEntry.findByIdAndUpdate(entryId, { paid });
  } catch (err) {
    console.error("setFixedCostEntryPaid error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo cambiar el estado: ${message}` };
  }

  revalidatePath("/costos-fijos");
  return { ok: true };
}

export async function deleteFixedCostEntry(entryId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await FixedCostEntry.findByIdAndDelete(entryId);
  } catch (err) {
    console.error("deleteFixedCostEntry error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar el costo: ${message}` };
  }

  revalidatePath("/costos-fijos");
  return { ok: true };
}