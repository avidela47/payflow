"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { PayrollEntry } from "@/models/PayrollEntry";
import { getSession } from "@/lib/auth";

// Un solo envío puede cargar las dos partes del pago (registrado e
// informal) — el form ya las suma y las manda como dos montos separados.
const payrollSchema = z.object({
  employeeId: z.string().min(1),
  period: z.string().min(1), // "YYYY-MM"
  registradoAmount: z.coerce.number().nonnegative().optional(),
  informalAmount: z.coerce.number().nonnegative().optional(),
  paidBy: z.string().optional(),
  notes: z.string().optional(),
});

export async function createPayrollEntry(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = payrollSchema.safeParse({
    employeeId: formData.get("employeeId"),
    period: formData.get("period"),
    registradoAmount: formData.get("registradoAmount") || undefined,
    informalAmount: formData.get("informalAmount") || undefined,
    paidBy: formData.get("paidBy") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos. Revisá el formulario." };
  }

  const registrado = parsed.data.registradoAmount ?? 0;
  const informal = parsed.data.informalAmount ?? 0;

  if (registrado <= 0 && informal <= 0) {
    return { ok: false, error: "Ingresá al menos un monto mayor a cero." };
  }

  const [year, month] = parsed.data.period.split("-").map(Number);
  const period = new Date(year, month - 1, 1);

  try {
    await connectDB();

    if (registrado > 0) {
      await PayrollEntry.findOneAndUpdate(
        { employee: parsed.data.employeeId, period, modality: "REGISTRADO" },
        {
          employee: parsed.data.employeeId,
          period,
          modality: "REGISTRADO",
          amount: registrado,
          paidBy: parsed.data.paidBy,
          notes: parsed.data.notes,
        },
        { upsert: true, new: true }
      );
    }

    if (informal > 0) {
      await PayrollEntry.findOneAndUpdate(
        { employee: parsed.data.employeeId, period, modality: "INFORMAL" },
        {
          employee: parsed.data.employeeId,
          period,
          modality: "INFORMAL",
          amount: informal,
          paidBy: parsed.data.paidBy,
          notes: parsed.data.notes,
        },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.error("createPayrollEntry error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo guardar el pago: ${message}` };
  }

  revalidatePath("/sueldos");
  return { ok: true };
}

// A partir de acá: acciones sobre el PAR registrado+informal de un
// empleado en un período (una sola fila en la tabla), no sobre un
// PayrollEntry individual.

export async function setPayrollGroupPaid(employeeId: string, periodISO: string, paid: boolean) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const period = new Date(periodISO);
    await PayrollEntry.updateMany(
      { employee: employeeId, period },
      { paid, paidAt: paid ? new Date() : undefined }
    );
  } catch (err) {
    console.error("setPayrollGroupPaid error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo cambiar el estado: ${message}` };
  }

  revalidatePath("/sueldos");
  return { ok: true };
}

const groupSchema = z.object({
  registradoAmount: z.coerce.number().nonnegative().optional(),
  informalAmount: z.coerce.number().nonnegative().optional(),
  paidBy: z.string().optional(),
  notes: z.string().optional(),
});

export async function updatePayrollGroup(
  employeeId: string,
  periodISO: string,
  formData: FormData
) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = groupSchema.safeParse({
    registradoAmount: formData.get("registradoAmount") || undefined,
    informalAmount: formData.get("informalAmount") || undefined,
    paidBy: formData.get("paidBy") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos." };
  }

  const registrado = parsed.data.registradoAmount ?? 0;
  const informal = parsed.data.informalAmount ?? 0;
  const period = new Date(periodISO);

  try {
    await connectDB();

    if (registrado > 0) {
      await PayrollEntry.findOneAndUpdate(
        { employee: employeeId, period, modality: "REGISTRADO" },
        {
          employee: employeeId,
          period,
          modality: "REGISTRADO",
          amount: registrado,
          paidBy: parsed.data.paidBy,
          notes: parsed.data.notes,
        },
        { upsert: true, new: true }
      );
    } else {
      // Dejar el monto en 0 borra esa parte (así se puede sacar el
      // "informal" de un pago sin tener que borrar todo).
      await PayrollEntry.deleteOne({ employee: employeeId, period, modality: "REGISTRADO" });
    }

    if (informal > 0) {
      await PayrollEntry.findOneAndUpdate(
        { employee: employeeId, period, modality: "INFORMAL" },
        {
          employee: employeeId,
          period,
          modality: "INFORMAL",
          amount: informal,
          paidBy: parsed.data.paidBy,
          notes: parsed.data.notes,
        },
        { upsert: true, new: true }
      );
    } else {
      await PayrollEntry.deleteOne({ employee: employeeId, period, modality: "INFORMAL" });
    }
  } catch (err) {
    console.error("updatePayrollGroup error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo editar el pago: ${message}` };
  }

  revalidatePath("/sueldos");
  return { ok: true };
}

export async function deletePayrollGroup(employeeId: string, periodISO: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const period = new Date(periodISO);
    await PayrollEntry.deleteMany({ employee: employeeId, period });
  } catch (err) {
    console.error("deletePayrollGroup error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar el pago: ${message}` };
  }

  revalidatePath("/sueldos");
  return { ok: true };
}