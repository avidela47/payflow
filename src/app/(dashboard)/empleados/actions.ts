"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
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
    banco: z.string().optional(),
    cbuAlias: z.string().optional(),
    area: z.string().optional(),
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
    banco: formData.get("banco") || undefined,
    cbuAlias: formData.get("cbuAlias") || undefined,
    area: formData.get("area") || undefined,
  });
}

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "empleados");

// Si vino un archivo nuevo en `foto`, lo valida y lo guarda en disco,
// devolviendo la ruta pública para guardar en Mongo. Si no vino archivo
// (el campo quedó vacío al editar sin tocar la foto), devuelve `path:
// undefined` — y como Mongoose ignora las claves en `undefined` en un
// update plano (mismo criterio que usamos en Ventas para USD/canal), la
// foto existente queda intacta.
async function savePhotoIfPresent(
  formData: FormData
): Promise<{ ok: true; path?: string } | { ok: false; error: string }> {
  const file = formData.get("foto");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: true };
  }

  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "La foto tiene que ser una imagen." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "La imagen pesa más de 2MB." };
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = file.type.split("/")[1] || "jpg";
  const filename = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), bytes);

  return { ok: true, path: `/uploads/empleados/${filename}` };
}

async function deleteUploadedFile(publicPath?: string) {
  if (!publicPath) return;
  const fullPath = path.join(process.cwd(), "public", publicPath);
  // Si el archivo ya no está, no es un error que deba frenar nada.
  await unlink(fullPath).catch(() => {});
}

// Documentos adjuntos (DNI, contrato, certificados...) — 2026-11-25, pedido
// de Ariel. A diferencia de la foto (un campo que se reemplaza y viaja con
// el resto del formulario), cada documento se sube con su propia action,
// apenas se elige el archivo, y se agrega a `documentos` con $push — así el
// modal no necesita juntar varios archivos y mandarlos recién al guardar
// toda la ficha.
const MAX_DOC_BYTES = 10 * 1024 * 1024;
const DOC_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const DOCS_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "empleados", "documentos");

export type EmployeeDocumentoResult = {
  nombre: string;
  path: string;
  mimeType: string;
  size: number;
  uploadedAtISO: string;
};

export async function uploadEmployeeDocument(
  employeeId: string,
  formData: FormData
): Promise<{ ok: true; documento: EmployeeDocumentoResult } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const file = formData.get("archivo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No se seleccionó ningún archivo." };
  }
  if (!DOC_ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: "Solo se aceptan archivos PDF, JPG o PNG." };
  }
  if (file.size > MAX_DOC_BYTES) {
    return { ok: false, error: "El archivo pesa más de 10MB." };
  }

  try {
    await connectDB();
    const exists = await Employee.exists({ _id: employeeId });
    if (!exists) return { ok: false, error: "El empleado ya no existe." };

    await mkdir(DOCS_UPLOAD_DIR, { recursive: true });
    const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
    const filename = `${randomUUID()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(DOCS_UPLOAD_DIR, filename), bytes);

    const uploadedAt = new Date();
    const documento = {
      nombre: file.name || filename,
      path: `/uploads/empleados/documentos/${filename}`,
      mimeType: file.type,
      size: file.size,
      uploadedAt,
    };
    await Employee.findByIdAndUpdate(employeeId, { $push: { documentos: documento } });

    revalidatePath("/empleados");
    return { ok: true, documento: { ...documento, uploadedAtISO: uploadedAt.toISOString() } };
  } catch (err) {
    console.error("uploadEmployeeDocument error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo subir el archivo: ${message}` };
  }
}

export async function deleteEmployeeDocument(employeeId: string, documentoPath: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Employee.findByIdAndUpdate(employeeId, { $pull: { documentos: { path: documentoPath } } });
    const fullPath = path.join(process.cwd(), "public", documentoPath);
    await unlink(fullPath).catch(() => {});
  } catch (err) {
    console.error("deleteEmployeeDocument error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar el archivo: ${message}` };
  }

  revalidatePath("/empleados");
  return { ok: true };
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

  const photoResult = await savePhotoIfPresent(formData);
  if (!photoResult.ok) {
    return { ok: false, error: photoResult.error };
  }

  try {
    await connectDB();
    await Employee.create({
      ...parsed.data,
      fechaIngreso: parsed.data.fechaIngreso ? new Date(parsed.data.fechaIngreso) : undefined,
      foto: photoResult.path,
    });
  } catch (err) {
    console.error("createEmployee error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo guardar el empleado: ${message}` };
  }

  revalidatePath("/empleados");
  revalidatePath("/sueldos");
  // Igual que Sueldos/Costos Fijos/Cheques/Caja Chica/Agenda/Vault: el
  // Dashboard ("/") también lee empleados activos (para armar la lista de
  // Sueldos del mes) y tiene su propio caché de ruta en Next — sin este
  // revalidate, seguía mostrando el valor viejo hasta el próximo deploy.
  revalidatePath("/");
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

  const photoResult = await savePhotoIfPresent(formData);
  if (!photoResult.ok) {
    return { ok: false, error: photoResult.error };
  }

  try {
    await connectDB();

    // Si subieron una foto nueva, borramos la anterior del disco para no
    // ir acumulando archivos huérfanos en el VPS.
    if (photoResult.path) {
      const previous = await Employee.findById(employeeId).select("foto").lean();
      if (previous?.foto) {
        await deleteUploadedFile(previous.foto);
      }
    }

    await Employee.findByIdAndUpdate(employeeId, {
      ...parsed.data,
      fechaIngreso: parsed.data.fechaIngreso ? new Date(parsed.data.fechaIngreso) : undefined,
      foto: photoResult.path,
    });
  } catch (err) {
    console.error("updateEmployee error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar el empleado: ${message}` };
  }

  revalidatePath("/empleados");
  revalidatePath("/sueldos");
  revalidatePath("/");
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
  revalidatePath("/");
  return { ok: true };
}

export async function deleteEmployee(employeeId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const existing = await Employee.findById(employeeId).select("foto documentos").lean();
    await Employee.findByIdAndDelete(employeeId);
    if (existing?.foto) {
      await deleteUploadedFile(existing.foto);
    }
    for (const doc of existing?.documentos ?? []) {
      await deleteUploadedFile(doc.path);
    }
  } catch (err) {
    console.error("deleteEmployee error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar el empleado: ${message}` };
  }

  revalidatePath("/empleados");
  revalidatePath("/sueldos");
  revalidatePath("/");
  return { ok: true };
}