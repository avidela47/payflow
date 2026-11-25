"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { SimuladorViaje, SIM_PAYMENT_MODES } from "@/models/SimuladorViaje";
import { getSession } from "@/lib/auth";

// Mismo patrón que actions.ts (Viatico): sesión, zod, connectDB,
// try/catch con mensaje, revalidatePath. El simulador se guarda siempre
// como documento completo (como Viatico con sus empleados/pagos) — no hay
// endpoints sueltos para un ítem o un pago individual.

const pagoSchema = z.object({
  monto: z.coerce.number().positive(),
  fecha: z.string().min(1),
});

const itemSchema = z.object({
  proveedor: z.string().min(1, "Falta el proveedor."),
  fechaCompra: z.string().optional(),
  fechaFactura: z.string().optional(),
  neto: z.coerce.number().nonnegative(),
  iva: z.coerce.number().nonnegative(),
  formaPago: z.enum(SIM_PAYMENT_MODES).optional(),
  fechaPago: z.string().optional(),
  pagos: z.array(pagoSchema).default([]),
});

const simuladorSchema = z.object({
  nombre: z.string().min(1, "Falta el nombre de la simulación."),
  items: z.array(itemSchema).default([]),
  notes: z.string().optional(),
});

export type SimuladorFormInput = z.infer<typeof simuladorSchema>;

export type SimuladorListItem = {
  id: string;
  nombre: string;
  createdAtISO: string;
  itemsCount: number;
  total: number;
};

export type SimuladorDetalle = {
  id: string;
  nombre: string;
  notes?: string;
  items: {
    proveedor: string;
    fechaCompraISO?: string;
    fechaFacturaISO?: string;
    neto: number;
    iva: number;
    formaPago?: (typeof SIM_PAYMENT_MODES)[number];
    fechaPagoISO?: string;
    pagos: { monto: number; fechaISO: string }[];
  }[];
};

function toISO(d?: Date): string | undefined {
  return d ? d.toISOString().slice(0, 10) : undefined;
}

function buildDoc(data: SimuladorFormInput) {
  return {
    nombre: data.nombre,
    items: data.items.map((it) => ({
      proveedor: it.proveedor,
      fechaCompra: it.fechaCompra ? new Date(it.fechaCompra) : undefined,
      fechaFactura: it.fechaFactura ? new Date(it.fechaFactura) : undefined,
      neto: it.neto,
      iva: it.iva,
      formaPago: it.formaPago,
      fechaPago: it.fechaPago ? new Date(it.fechaPago) : undefined,
      pagos: it.pagos.map((p) => ({ monto: p.monto, fecha: new Date(p.fecha) })),
    })),
    notes: data.notes || undefined,
  };
}

export async function listSimuladores(): Promise<SimuladorListItem[]> {
  await connectDB();
  const docs = await SimuladorViaje.find({}).sort({ createdAt: -1 }).limit(200).lean();
  return docs.map((d) => ({
    id: d._id.toString(),
    nombre: d.nombre,
    createdAtISO: d.createdAt.toISOString(),
    itemsCount: (d.items ?? []).length,
    total: (d.items ?? []).reduce((s, it) => s + (it.neto || 0) + (it.iva || 0), 0),
  }));
}

export async function getSimulador(id: string): Promise<SimuladorDetalle | null> {
  await connectDB();
  const d = await SimuladorViaje.findById(id).lean();
  if (!d) return null;
  return {
    id: d._id.toString(),
    nombre: d.nombre,
    notes: d.notes,
    items: (d.items ?? []).map((it) => ({
      proveedor: it.proveedor,
      fechaCompraISO: toISO(it.fechaCompra),
      fechaFacturaISO: toISO(it.fechaFactura),
      neto: it.neto,
      iva: it.iva,
      formaPago: it.formaPago,
      fechaPagoISO: toISO(it.fechaPago),
      pagos: (it.pagos ?? []).map((p) => ({ monto: p.monto, fechaISO: toISO(p.fecha)! })),
    })),
  };
}

export async function createSimulador(input: SimuladorFormInput) {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "No autenticado." };

  const parsed = simuladorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  try {
    await connectDB();
    const created = await SimuladorViaje.create(buildDoc(parsed.data));
    revalidatePath("/viaticos");
    return { ok: true, id: created._id.toString() };
  } catch (err) {
    console.error("createSimulador error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear la simulación: ${message}` };
  }
}

export async function updateSimulador(id: string, input: SimuladorFormInput) {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "No autenticado." };

  const parsed = simuladorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  try {
    await connectDB();
    await SimuladorViaje.findByIdAndUpdate(id, { $set: buildDoc(parsed.data) });
    revalidatePath("/viaticos");
    return { ok: true };
  } catch (err) {
    console.error("updateSimulador error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo guardar la simulación: ${message}` };
  }
}

export async function deleteSimulador(id: string) {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "No autenticado." };

  try {
    await connectDB();
    await SimuladorViaje.findByIdAndDelete(id);
    revalidatePath("/viaticos");
    return { ok: true };
  } catch (err) {
    console.error("deleteSimulador error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar la simulación: ${message}` };
  }
}
