"use server";

import { z } from "zod";
import path from "path";
import { randomUUID } from "crypto";
import { writeFile, mkdir, unlink } from "fs/promises";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Receta } from "@/models/Receta";
import { Componente } from "@/models/Componente";

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}

// ---------- foto (mismo patrón que Componente.foto, ver componentes/actions.ts) ----------

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "recetas");

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

  return { ok: true, path: `/uploads/recetas/${filename}` };
}

async function deletePhotoFile(publicPath?: string) {
  if (!publicPath) return;
  const fullPath = path.join(process.cwd(), "public", publicPath);
  await unlink(fullPath).catch(() => {});
}

// ---------- componentes de la receta ----------

const componenteLineaSchema = z.object({
  componenteId: z.string().min(1),
  cantidad: z.coerce.number().positive("La cantidad de cada componente debe ser mayor a 0."),
});

const recetaSchema = z.object({
  codigo: z
    .string()
    .min(1, "Falta el código.")
    .transform((v) => v.trim().toUpperCase()),
  nombre: z
    .string()
    .min(1, "Falta el nombre.")
    .transform((v) => v.trim()),
  activa: z.coerce.boolean(),
  notas: z.string().optional(),
  componentes: z
    .array(componenteLineaSchema)
    .min(1, "Agregá al menos un componente."),
});

function parseRecetaForm(formData: FormData) {
  let componentes: unknown = [];
  try {
    componentes = JSON.parse(String(formData.get("componentesJson") || "[]"));
  } catch {
    componentes = [];
  }

  return recetaSchema.safeParse({
    codigo: formData.get("codigo"),
    nombre: formData.get("nombre"),
    activa: formData.get("activa") === "true",
    notas: formData.get("notas") || undefined,
    componentes,
  });
}

// Completa codigo/descripcion de cada línea a partir del Componente real
// (snapshot, ver nota en Receta.ts) y valida que no se haya elegido un
// componente repetido ni uno que ya no existe.
async function resolverComponentes(
  lineas: { componenteId: string; cantidad: number }[]
): Promise<{ ok: true; data: { componenteId: string; codigoComponente: string; descripcionComponente: string; cantidad: number }[] } | { ok: false; error: string }> {
  const ids = lineas.map((l) => l.componenteId);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "No podés repetir el mismo componente en una receta." };
  }

  const componentes = await Componente.find({ _id: { $in: ids } })
    .select("codigo descripcion")
    .lean();
  const porId = new Map(componentes.map((c) => [c._id.toString(), c]));

  const data = [];
  for (const linea of lineas) {
    const componente = porId.get(linea.componenteId);
    if (!componente) {
      return { ok: false, error: "Uno de los componentes elegidos ya no existe." };
    }
    data.push({
      componenteId: linea.componenteId,
      codigoComponente: componente.codigo,
      descripcionComponente: componente.descripcion,
      cantidad: linea.cantidad,
    });
  }
  return { ok: true, data };
}

export async function createReceta(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseRecetaForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const photoResult = await savePhotoIfPresent(formData);
  if (!photoResult.ok) {
    return { ok: false, error: photoResult.error };
  }

  try {
    await connectDB();

    const resolved = await resolverComponentes(parsed.data.componentes);
    if (!resolved.ok) {
      return { ok: false, error: resolved.error };
    }

    await Receta.create({
      codigo: parsed.data.codigo,
      nombre: parsed.data.nombre,
      activa: parsed.data.activa,
      notas: parsed.data.notas,
      componentes: resolved.data,
      foto: photoResult.path,
    });
  } catch (err) {
    console.error("createReceta error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: `Ya existe una receta con el código ${parsed.data.codigo}.` };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath("/recetas");
  return { ok: true };
}

export async function updateReceta(id: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseRecetaForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const photoResult = await savePhotoIfPresent(formData);
  if (!photoResult.ok) {
    return { ok: false, error: photoResult.error };
  }

  try {
    await connectDB();

    const previous = await Receta.findById(id);
    if (!previous) {
      return { ok: false, error: "La receta ya no existe." };
    }

    const resolved = await resolverComponentes(parsed.data.componentes);
    if (!resolved.ok) {
      return { ok: false, error: resolved.error };
    }

    // Igual criterio que el original: la versión sube solo si cambió la
    // composición de componentes (código+cantidad), no por cualquier
    // edición (nombre, notas, estado, foto no cuentan).
    const firmaAnterior = JSON.stringify(
      previous.componentes
        .map((c) => ({ id: c.componenteId.toString(), cantidad: c.cantidad }))
        .sort((a, b) => a.id.localeCompare(b.id))
    );
    const firmaNueva = JSON.stringify(
      resolved.data
        .map((c) => ({ id: c.componenteId, cantidad: c.cantidad }))
        .sort((a, b) => a.id.localeCompare(b.id))
    );
    const componentesCambiaron = firmaAnterior !== firmaNueva;

    await Receta.findByIdAndUpdate(id, {
      nombre: parsed.data.nombre,
      activa: parsed.data.activa,
      notas: parsed.data.notas,
      componentes: resolved.data,
      ...(componentesCambiaron
        ? { version: previous.version + 1, fechaVersion: new Date() }
        : {}),
      ...(photoResult.path ? { foto: photoResult.path } : {}),
    });

    if (photoResult.path && previous.foto) {
      await deletePhotoFile(previous.foto);
    }
  } catch (err) {
    console.error("updateReceta error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar: ${message}` };
  }

  revalidatePath("/recetas");
  return { ok: true };
}

// Borrado real (ver nota en Receta.ts): por ahora nada referencia una
// Receta en PayFlow, así que no hace falta bloquear nada acá — se revisa
// cuando exista Fabricar.
export async function deleteReceta(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const existing = await Receta.findById(id).select("foto").lean();
    await Receta.findByIdAndDelete(id);
    if (existing?.foto) {
      await deletePhotoFile(existing.foto);
    }
  } catch (err) {
    console.error("deleteReceta error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath("/recetas");
  return { ok: true };
}
