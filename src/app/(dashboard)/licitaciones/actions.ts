"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Licitacion, LICITACION_ESTADOS, type IDocumentoLicitacion, type ILicitacionItem } from "@/models/Licitacion";
import { runLicitacionesDigest } from "@/lib/licitaciones-digest";

const licitacionSchema = z.object({
  entidad: z.string().min(1, "Falta el nombre de la entidad."),
  estado: z.enum(LICITACION_ESTADOS),
  numeroProveedor: z.string().optional(),
  observaciones: z.string().optional(),
  itemNumero: z.array(z.string()).default([]),
  itemEstado: z.array(z.enum(LICITACION_ESTADOS)).default([]),
});

function parseLicitacionForm(formData: FormData) {
  return licitacionSchema.safeParse({
    entidad: formData.get("entidad"),
    estado: formData.get("estado"),
    numeroProveedor: formData.get("numeroProveedor") || undefined,
    observaciones: formData.get("observaciones") || undefined,
    itemNumero: formData.getAll("itemNumero"),
    itemEstado: formData.getAll("itemEstado"),
  });
}

// Documento adjunto de cada licitación (pliego, constancia...) — pedido de
// Ariel, 2026-11-26. A diferencia de los "documentos" de Empleados/
// Viáticos (se suben con su propia action porque cuelgan de un registro ya
// existente), acá cada fila de licitación puede no existir todavía en la
// base mientras se está cargando el modal — así que el archivo viaja junto
// con el resto del formulario (itemDocumentoFile/itemDocumentoExisting,
// alineados por índice con itemNumero/itemEstado) y recién se resuelve acá
// al guardar.
const MAX_DOC_BYTES = 10 * 1024 * 1024;
const DOC_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const DOCS_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "licitaciones", "documentos");

async function deleteUploadedFile(publicPath?: string) {
  if (!publicPath) return;
  const fullPath = path.join(process.cwd(), "public", publicPath);
  // Si el archivo ya no está, no es un error que deba frenar nada.
  await unlink(fullPath).catch(() => {});
}

// Resuelve el documento final de una fila: un archivo nuevo elegido ahora
// gana siempre; si no hay archivo nuevo, se conserva el documento existente
// que el cliente reenvía tal cual (JSON) para no perderlo al reconstruir
// todo el array; si no hay ninguno de los dos, la licitación queda sin
// documento.
async function resolveItemDocumento(
  file: FormDataEntryValue | undefined,
  existingJson: FormDataEntryValue | undefined
): Promise<IDocumentoLicitacion | undefined> {
  if (file instanceof File && file.size > 0) {
    if (!DOC_ALLOWED_TYPES.includes(file.type)) {
      throw new Error("Solo se aceptan archivos PDF, JPG o PNG para el documento de la licitación.");
    }
    if (file.size > MAX_DOC_BYTES) {
      throw new Error("El documento de una licitación pesa más de 10MB.");
    }
    await mkdir(DOCS_UPLOAD_DIR, { recursive: true });
    const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
    const filename = `${randomUUID()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(DOCS_UPLOAD_DIR, filename), bytes);
    return {
      nombre: file.name || filename,
      path: `/uploads/licitaciones/documentos/${filename}`,
      mimeType: file.type,
      size: file.size,
      uploadedAt: new Date(),
    };
  }

  if (typeof existingJson === "string" && existingJson.trim().length > 0) {
    try {
      const parsed = JSON.parse(existingJson);
      if (parsed && typeof parsed.path === "string") {
        return {
          nombre: String(parsed.nombre ?? parsed.path),
          path: parsed.path,
          mimeType: String(parsed.mimeType ?? "application/octet-stream"),
          size: Number(parsed.size) || 0,
          uploadedAt: parsed.uploadedAtISO ? new Date(parsed.uploadedAtISO) : new Date(),
        };
      }
    } catch {
      // JSON inválido — se trata como si no hubiera documento existente.
    }
  }

  return undefined;
}

// Filas de licitación sin número cargado se descartan acá — mismo
// criterio que usa Pagos con sus filas de cheque: una fila a medio
// completar no tiene que bloquear el guardado del resto. Los documentos de
// filas descartadas simplemente no se persisten (si llegaron a subir un
// archivo nuevo, nunca se escribió en base, así que no queda huérfano).
async function buildLicitacionesArray(
  data: {
    itemNumero: string[];
    itemEstado: (typeof LICITACION_ESTADOS)[number][];
  },
  formData: FormData
): Promise<ILicitacionItem[]> {
  const files = formData.getAll("itemDocumentoFile");
  const existentes = formData.getAll("itemDocumentoExisting");

  const rows = data.itemNumero
    .map((numero, i) => ({
      numero: numero.trim(),
      estado: data.itemEstado[i],
      file: files[i],
      existing: existentes[i],
    }))
    .filter((row) => row.numero.length > 0);

  const items: ILicitacionItem[] = [];
  for (const row of rows) {
    const documento = await resolveItemDocumento(row.file, row.existing);
    items.push({ numero: row.numero, estado: row.estado, ...(documento ? { documento } : {}) });
  }
  return items;
}

// Después de reconstruir el array completo de licitaciones, borra del
// disco los documentos que ya no quedaron referenciados por ninguna fila
// (fila borrada, documento reemplazado o quitado a mano).
async function limpiarDocumentosHuerfanos(antes: ILicitacionItem[], despues: ILicitacionItem[]) {
  const pathsVigentes = new Set(despues.map((it) => it.documento?.path).filter(Boolean));
  for (const item of antes) {
    if (item.documento?.path && !pathsVigentes.has(item.documento.path)) {
      await deleteUploadedFile(item.documento.path);
    }
  }
}

export async function createLicitacion(formData: FormData) {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "No autenticado." };

  const parsed = parseLicitacionForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  if (parsed.data.itemNumero.length !== parsed.data.itemEstado.length) {
    return { ok: false, error: "Los datos de las licitaciones quedaron desalineados. Recargá el formulario." };
  }

  try {
    await connectDB();
    const licitaciones = await buildLicitacionesArray(parsed.data, formData);
    await Licitacion.create({
      entidad: parsed.data.entidad,
      estado: parsed.data.estado,
      numeroProveedor: parsed.data.numeroProveedor,
      observaciones: parsed.data.observaciones,
      licitaciones,
    });
  } catch (err) {
    console.error("createLicitacion error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear la entidad: ${message}` };
  }

  revalidatePath("/licitaciones");
  return { ok: true };
}

export async function updateLicitacion(id: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "No autenticado." };

  const parsed = parseLicitacionForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  if (parsed.data.itemNumero.length !== parsed.data.itemEstado.length) {
    return { ok: false, error: "Los datos de las licitaciones quedaron desalineados. Recargá el formulario." };
  }

  try {
    await connectDB();
    const antes = await Licitacion.findById(id).select("licitaciones").lean();
    if (!antes) return { ok: false, error: "La entidad ya no existe." };

    const licitaciones = await buildLicitacionesArray(parsed.data, formData);
    await Licitacion.findByIdAndUpdate(id, {
      entidad: parsed.data.entidad,
      estado: parsed.data.estado,
      numeroProveedor: parsed.data.numeroProveedor,
      observaciones: parsed.data.observaciones,
      licitaciones,
    });
    await limpiarDocumentosHuerfanos(antes.licitaciones ?? [], licitaciones);
  } catch (err) {
    console.error("updateLicitacion error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar la entidad: ${message}` };
  }

  revalidatePath("/licitaciones");
  return { ok: true };
}

export async function deleteLicitacion(id: string) {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "No autenticado." };

  try {
    await connectDB();
    const entidad = await Licitacion.findById(id).select("licitaciones").lean();
    for (const item of entidad?.licitaciones ?? []) {
      await deleteUploadedFile(item.documento?.path);
    }
    await Licitacion.findByIdAndDelete(id);
  } catch (err) {
    console.error("deleteLicitacion error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar la entidad: ${message}` };
  }

  revalidatePath("/licitaciones");
  return { ok: true };
}

// Dispara el mismo resumen semanal que el cron, pero a demanda — mismo
// patrón que sendAgendaDigestNow (solo OWNER, para poder probar el envío
// sin esperar al cron).
export async function sendLicitacionesDigestNow() {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "No autenticado." };
  if (session.user.role !== "OWNER") {
    return { ok: false, error: "No autorizado." };
  }

  try {
    const result = await runLicitacionesDigest();
    if (!result.sent) {
      return { ok: true, message: "No hay ninguna entidad cargada todavía — no se mandó ningún mail." };
    }
    return { ok: true, message: `Mail enviado con ${result.count} entidad(es).` };
  } catch (err) {
    console.error("sendLicitacionesDigestNow error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo enviar: ${message}` };
  }
}
