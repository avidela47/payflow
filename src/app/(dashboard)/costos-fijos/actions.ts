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
  amount: z.coerce.number().positive("El monto tiene que ser mayor a cero."),
  paymentMode: z.string().optional(),
  dueDate: z.string().optional(), // "YYYY-MM-DD"
  notes: z.string().optional(),
});

function parseEntryForm(formData: FormData) {
  return entrySchema.safeParse({
    categoryId: formData.get("categoryId"),
    period: formData.get("period"),
    amount: formData.get("amount"),
    paymentMode: formData.get("paymentMode") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    notes: formData.get("notes") || undefined,
  });
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

  const [year, month] = parsed.data.period.split("-").map(Number);
  const period = new Date(year, month - 1, 1);

  try {
    await connectDB();
    // Un solo costo por categoría+período — si ya existe, lo actualiza en
    // vez de tirar error de clave duplicada (misma idea que en Sueldos).
    await FixedCostEntry.findOneAndUpdate(
      { category: parsed.data.categoryId, period },
      {
        category: parsed.data.categoryId,
        period,
        amount: parsed.data.amount,
        paymentMode: parsed.data.paymentMode,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
        notes: parsed.data.notes,
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

  const [year, month] = parsed.data.period.split("-").map(Number);
  const period = new Date(year, month - 1, 1);

  try {
    await connectDB();
    await FixedCostEntry.findByIdAndUpdate(entryId, {
      category: parsed.data.categoryId,
      period,
      amount: parsed.data.amount,
      paymentMode: parsed.data.paymentMode,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      notes: parsed.data.notes,
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