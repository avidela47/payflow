"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Employee } from "@/models/Employee";
import { getSession } from "@/lib/auth";

const employeeSchema = z
  .object({
    nombre: z.string().min(1, "Falta el nombre."),
    apellido: z.string().min(1, "Falta el apellido."),
    dni: z.string().optional(),
    direccion: z.string().optional(),
    telefono: z.string().optional(),
    email: z.string().email("Email inválido.").optional().or(z.literal("")),
    fechaIngreso: z.string().optional(), // "YYYY-MM-DD"
    notas: z.string().optional(),
    category: z.enum(["MONOTRIBUTISTA", "EMPLEADO"]),
    monotributoCategoria: z.string().optional(),
    paymentType: z.enum(["FIJO", "POR_HORA"]).optional().or(z.literal("")),
    cuit: z.string().optional(),
    hourlyRate: z.coerce.number().positive().optional().or(z.literal("")),
  })
  .transform((data) => ({
    ...data,
    // La categoría de monotributo solo aplica si es Monotributista.
    monotributoCategoria:
      data.category === "MONOTRIBUTISTA" && data.monotributoCategoria
        ? data.monotributoCategoria
        : undefined,
    // "por hora" es un atributo de EMPLEADO, no de MONOTRIBUTISTA — si
    // mandan un monotributista, ignoramos paymentType/hourlyRate.
    paymentType: data.category === "EMPLEADO" && data.paymentType ? data.paymentType : undefined,
    hourlyRate:
      data.category === "EMPLEADO" && data.paymentType === "POR_HORA" && data.hourlyRate
        ? data.hourlyRate
        : undefined,
  }));

function parseEmployeeForm(formData: FormData) {
  return employeeSchema.safeParse({
    nombre: formData.get("nombre"),
    apellido: formData.get("apellido"),
    dni: formData.get("dni") || undefined,
    direccion: formData.get("direccion") || undefined,
    telefono: formData.get("telefono") || undefined,
    email: formData.get("email") || undefined,
    fechaIngreso: formData.get("fechaIngreso") || undefined,
    notas: formData.get("notas") || undefined,
    category: formData.get("category"),
    monotributoCategoria: formData.get("monotributoCategoria") || undefined,
    paymentType: formData.get("paymentType") || undefined,
    cuit: formData.get("cuit") || undefined,
    hourlyRate: formData.get("hourlyRate") || undefined,
  });
}

export async function createEmployee(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseEmployeeForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await Employee.create({
      ...parsed.data,
      fechaIngreso: parsed.data.fechaIngreso ? new Date(parsed.data.fechaIngreso) : undefined,
    });
  } catch (err) {
    console.error("createEmployee error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo guardar el empleado: ${message}` };
  }

  revalidatePath("/empleados");
  revalidatePath("/sueldos");
  return { ok: true };
}

export async function updateEmployee(employeeId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseEmployeeForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await Employee.findByIdAndUpdate(employeeId, {
      ...parsed.data,
      fechaIngreso: parsed.data.fechaIngreso ? new Date(parsed.data.fechaIngreso) : undefined,
    });
  } catch (err) {
    console.error("updateEmployee error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar el empleado: ${message}` };
  }

  revalidatePath("/empleados");
  revalidatePath("/sueldos");
  return { ok: true };
}

export async function setEmployeeActive(employeeId: string, active: boolean) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  await connectDB();
  await Employee.findByIdAndUpdate(employeeId, { active });

  revalidatePath("/empleados");
  revalidatePath("/sueldos");
  return { ok: true };
}

export async function deleteEmployee(employeeId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Employee.findByIdAndDelete(employeeId);
  } catch (err) {
    console.error("deleteEmployee error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar el empleado: ${message}` };
  }

  revalidatePath("/empleados");
  revalidatePath("/sueldos");
  return { ok: true };
}