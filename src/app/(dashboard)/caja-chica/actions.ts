"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { PettyCashMovement } from "@/models/PettyCash";
import { getSession } from "@/lib/auth";

const movementSchema = z.object({
  date: z.string().min(1, "Falta la fecha."), // "YYYY-MM-DD"
  concept: z.string().min(1, "Falta el concepto."),
  amount: z.coerce.number().positive("El monto tiene que ser mayor a cero."),
  type: z.enum(["ingreso", "egreso"]),
});

async function currentBalance(): Promise<number> {
  const agg = await PettyCashMovement.aggregate([
    {
      $group: {
        _id: null,
        ingresos: { $sum: { $cond: [{ $eq: ["$type", "ingreso"] }, "$amount", 0] } },
        egresos: { $sum: { $cond: [{ $eq: ["$type", "egreso"] }, "$amount", 0] } },
      },
    },
  ]);
  return agg[0] ? agg[0].ingresos - agg[0].egresos : 0;
}

export async function createPettyCashMovement(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = movementSchema.safeParse({
    date: formData.get("date"),
    concept: formData.get("concept"),
    amount: formData.get("amount"),
    type: formData.get("type"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();

    // Un egreso no puede dejar la caja en negativo. Se valida contra el
    // saldo real (todos los movimientos), no contra lo que se ve en pantalla.
    if (parsed.data.type === "egreso") {
      const balance = await currentBalance();
      if (parsed.data.amount > balance) {
        return {
          ok: false,
          error: `Ese egreso supera el saldo actual de la caja ($${balance.toFixed(2)}).`,
        };
      }
    }

    await PettyCashMovement.create({
      date: new Date(parsed.data.date),
      concept: parsed.data.concept,
      amount: parsed.data.amount,
      type: parsed.data.type,
    });
  } catch (err) {
    console.error("createPettyCashMovement error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo guardar el movimiento: ${message}` };
  }

  revalidatePath("/caja-chica");
  // Igual que Sueldos/Costos Fijos/Cheques: el Dashboard ("/") también lee
  // estos datos y tiene su propio caché de ruta en Next — sin este
  // revalidate, sus tarjetas seguían mostrando el valor viejo hasta el
  // próximo deploy.
  revalidatePath("/");
  return { ok: true };
}

export async function deletePettyCashMovement(movementId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await PettyCashMovement.findByIdAndDelete(movementId);
  } catch (err) {
    console.error("deletePettyCashMovement error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar el movimiento: ${message}` };
  }

  revalidatePath("/caja-chica");
  revalidatePath("/");
  return { ok: true };
}