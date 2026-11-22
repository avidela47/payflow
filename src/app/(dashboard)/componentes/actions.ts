"use server";

import { z } from "zod";
import path from "path";
import { randomUUID } from "crypto";
import { writeFile, mkdir, unlink } from "fs/promises";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Componente } from "@/models/Componente";
import { MovimientoComponente } from "@/models/MovimientoComponente";
import { Receta } from "@/models/Receta";
import { COMPONENTE_UNIDADES } from "@/lib/componente-unidades";
import {
  MOVIMIENTO_COMPONENTE_TIPOS_MANUALES,
  esMovimientoDeEntrada,
} from "@/lib/movimiento-componente-tipos";

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}

// ---------- foto (mismo patrón que Employee.foto, ver empleados/actions.ts) ----------

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "componentes");

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

  return { ok: true, path: `/uploads/componentes/${filename}` };
}

async function deletePhotoFile(publicPath?: string) {
  if (!publicPath) return;
  const fullPath = path.join(process.cwd(), "public", publicPath);
  await unlink(fullPath).catch(() => {});
}

// ---------- CRUD ----------

const componenteSchema = z.object({
  codigo: z
    .string()
    .min(1, "Falta el código.")
    .transform((v) => v.trim().toUpperCase()),
  descripcion: z
    .string()
    .min(1, "Falta la descripción.")
    .transform((v) => v.trim()),
  unidad: z.enum(COMPONENTE_UNIDADES, { message: "Falta la unidad." }),
  stockActual: z.coerce.number().min(0, "El stock actual no puede ser negativo."),
  stockMinimo: z.coerce.number().min(0, "El mínimo no puede ser negativo."),
  precio: z.coerce.number().min(0, "El precio no puede ser negativo."),
  proveedor: z.string().optional(),
  ubicacion: z.string().optional(),
  notas: z.string().optional(),
});

function parseComponenteForm(formData: FormData) {
  return componenteSchema.safeParse({
    codigo: formData.get("codigo"),
    descripcion: formData.get("descripcion"),
    unidad: formData.get("unidad"),
    stockActual: formData.get("stockActual") || 0,
    stockMinimo: formData.get("stockMinimo") || 0,
    precio: formData.get("precio") || 0,
    proveedor: formData.get("proveedor") || undefined,
    ubicacion: formData.get("ubicacion") || undefined,
    notas: formData.get("notas") || undefined,
  });
}

export async function createComponente(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseComponenteForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const photoResult = await savePhotoIfPresent(formData);
  if (!photoResult.ok) {
    return { ok: false, error: photoResult.error };
  }

  try {
    await connectDB();
    await Componente.create({ ...parsed.data, foto: photoResult.path });
  } catch (err) {
    console.error("createComponente error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: `Ya existe un componente con el código ${parsed.data.codigo}.` };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath("/componentes");
  return { ok: true };
}

export async function updateComponente(id: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseComponenteForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const photoResult = await savePhotoIfPresent(formData);
  if (!photoResult.ok) {
    return { ok: false, error: photoResult.error };
  }

  try {
    await connectDB();
    const previous = await Componente.findById(id).select("foto").lean();
    if (!previous) {
      return { ok: false, error: "El componente ya no existe." };
    }

    await Componente.findByIdAndUpdate(id, {
      ...parsed.data,
      // Igual criterio que Employee: si no mandaron foto nueva, path queda
      // undefined y Mongoose no toca el campo — la foto existente no se pierde.
      ...(photoResult.path ? { foto: photoResult.path } : {}),
    });

    if (photoResult.path && previous.foto) {
      await deletePhotoFile(previous.foto);
    }
  } catch (err) {
    console.error("updateComponente error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "Ya existe otro componente con ese código." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar: ${message}` };
  }

  revalidatePath("/componentes");
  return { ok: true };
}

// Borrar: bloqueado si el Componente ya tiene movimientos registrados
// (decisión de Ariel, 2026-11-22, mismo criterio que Recibos con pagos) —
// a diferencia del original, que nunca borraba de verdad (ocultaba con un
// flag "activo", sin forma de verlo ni recuperarlo desde la pantalla). Un
// Componente sin historial todavía se puede borrar libre.
//
// 2026-11-22 (Recetas): también bloqueado si el Componente está usado en
// alguna Receta — esto ya estaba anotado como pendiente en el comentario
// de Componente.ts desde que se construyó ese módulo, antes de que
// existiera Recetas.
export async function deleteComponente(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const tieneMovimientos = await MovimientoComponente.countDocuments({ componenteId: id });
    if (tieneMovimientos > 0) {
      return {
        ok: false,
        error: "No se puede borrar un componente con movimientos registrados — queda como historial.",
      };
    }

    const enReceta = await Receta.countDocuments({ "componentes.componenteId": id });
    if (enReceta > 0) {
      return {
        ok: false,
        error: "No se puede borrar un componente que está usado en una o más Recetas.",
      };
    }

    const existing = await Componente.findById(id).select("foto").lean();
    await Componente.findByIdAndDelete(id);
    if (existing?.foto) {
      await deletePhotoFile(existing.foto);
    }
  } catch (err) {
    console.error("deleteComponente error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath("/componentes");
  return { ok: true };
}

// ---------- movimientos (entrada/ajuste, igual criterio que Materiales) ----------
//
// Portado de Gestión de Luminarias: el stock de Componentes no se edita
// solo a mano, se mueve con estos tipos y queda historial. Solo se exponen
// los 3 tipos manuales (ver movimiento-componente-tipos.ts) — "salida por
// producción" la va a generar la futura lógica de Fabricar, no esta pantalla.

const movimientoSchema = z.object({
  tipo: z.enum(MOVIMIENTO_COMPONENTE_TIPOS_MANUALES, { message: "Falta el tipo de movimiento." }),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  referencia: z.string().optional(),
  notas: z.string().optional(),
});

export async function registrarMovimientoComponente(componenteId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = movimientoSchema.safeParse({
    tipo: formData.get("tipo"),
    cantidad: formData.get("cantidad"),
    referencia: formData.get("referencia") || undefined,
    notas: formData.get("notas") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { tipo, cantidad, referencia, notas } = parsed.data;

  try {
    await connectDB();
    const componente = await Componente.findById(componenteId);
    if (!componente) {
      return { ok: false, error: "El componente ya no existe." };
    }

    const esEntrada = esMovimientoDeEntrada(tipo);
    if (!esEntrada && componente.stockActual < cantidad) {
      return { ok: false, error: `Stock insuficiente. Disponible: ${componente.stockActual}.` };
    }

    const delta = esEntrada ? cantidad : -cantidad;
    const stockResultante = componente.stockActual + delta;

    await Componente.findByIdAndUpdate(componenteId, { $inc: { stockActual: delta } });

    await MovimientoComponente.create({
      componenteId: componente._id,
      codigoComponente: componente.codigo,
      descripcionComponente: componente.descripcion,
      tipo,
      cantidad,
      stockResultante,
      referencia: referencia || "",
      notas: notas || "",
      usuario: session.user.name || session.user.email || "",
    });
  } catch (err) {
    console.error("registrarMovimientoComponente error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo registrar el movimiento: ${message}` };
  }

  revalidatePath("/componentes");
  return { ok: true };
}

// getMovimientosComponente se movió a /movimientos-componentes (pantalla
// global del historial, ver page.tsx de ese módulo) — ya no hace falta acá.
