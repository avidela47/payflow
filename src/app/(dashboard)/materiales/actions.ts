"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Material } from "@/models/Material";
import { MovimientoMaterial } from "@/models/MovimientoMaterial";
import { OrdenTrabajo } from "@/models/OrdenTrabajo";
import { MATERIAL_UNIDADES } from "@/lib/material-unidades";
import { MOVIMIENTO_MATERIAL_TIPOS } from "@/lib/movimiento-material-tipos";

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}

const materialSchema = z.object({
  codigo: z
    .string()
    .min(1, "Falta el código.")
    .transform((v) => v.trim().toUpperCase()),
  descripcion: z
    .string()
    .min(1, "Falta la descripción.")
    .transform((v) => v.trim()),
  unidad: z.enum(MATERIAL_UNIDADES, { message: "Falta la unidad." }),
  stockActual: z.coerce.number().min(0, "El stock actual no puede ser negativo."),
  stockMinimo: z.coerce.number().min(0, "El mínimo no puede ser negativo."),
  precio: z.coerce.number().min(0, "El precio no puede ser negativo."),
  proveedor: z.string().optional(),
  notas: z.string().optional(),
});

function parseMaterialForm(formData: FormData) {
  return materialSchema.safeParse({
    codigo: formData.get("codigo"),
    descripcion: formData.get("descripcion"),
    unidad: formData.get("unidad"),
    stockActual: formData.get("stockActual") || 0,
    stockMinimo: formData.get("stockMinimo") || 0,
    precio: formData.get("precio") || 0,
    proveedor: formData.get("proveedor") || undefined,
    notas: formData.get("notas") || undefined,
  });
}

export async function createMaterial(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseMaterialForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await Material.create(parsed.data);
  } catch (err) {
    console.error("createMaterial error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: `Ya existe un material con el código ${parsed.data.codigo}.` };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath("/materiales");
  return { ok: true };
}

export async function updateMaterial(id: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseMaterialForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const item = await Material.findByIdAndUpdate(id, parsed.data);
    if (!item) {
      return { ok: false, error: "El ítem ya no existe." };
    }
  } catch (err) {
    console.error("updateMaterial error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "Ya existe otro material con ese código." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar: ${message}` };
  }

  revalidatePath("/materiales");
  return { ok: true };
}

export async function deleteMaterial(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Material.findByIdAndDelete(id);
  } catch (err) {
    console.error("deleteMaterial error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath("/materiales");
  return { ok: true };
}

// ---------- movimientos (entrada/salida/devolución) ----------
//
// Portado de Gestión de Luminarias: ahí el stock de Materiales no se edita
// solo a mano, se mueve con estos tres tipos y queda historial. "Requiere
// número de OT" exige Salida Y Devolución (igual que el modal del original
// — el backend original solo lo exigía de verdad para la salida, pero
// Ariel pidió explícitamente igualar el comportamiento del original tal
// como lo ve el usuario, no el detalle interno del servidor viejo).
//
// ordenTrabajoId: conectado el 2026-11-23, ahora que el módulo de Órdenes
// de Trabajo existe (Fase 5) — se elige de una lista real en vez de texto
// libre, igual que el original. numeroOrden queda como snapshot del
// numero de esa OT al momento del movimiento.

const movimientoSchema = z.object({
  tipo: z.enum(MOVIMIENTO_MATERIAL_TIPOS, { message: "Falta el tipo de movimiento." }),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  ordenTrabajoId: z.string().optional(),
  notas: z.string().optional(),
});

export async function registrarMovimientoMaterial(materialId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = movimientoSchema.safeParse({
    tipo: formData.get("tipo"),
    cantidad: formData.get("cantidad"),
    ordenTrabajoId: formData.get("ordenTrabajoId") || undefined,
    notas: formData.get("notas") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { tipo, cantidad, ordenTrabajoId, notas } = parsed.data;

  if ((tipo === "SALIDA" || tipo === "DEVOLUCION") && !ordenTrabajoId) {
    return { ok: false, error: "Este movimiento requiere elegir una Orden de Trabajo." };
  }

  try {
    await connectDB();
    const material = await Material.findById(materialId);
    if (!material) {
      return { ok: false, error: "El material ya no existe." };
    }

    let numeroOrden = "";
    if (ordenTrabajoId) {
      const orden = await OrdenTrabajo.findById(ordenTrabajoId);
      if (!orden) {
        return { ok: false, error: "La Orden de Trabajo elegida ya no existe." };
      }
      numeroOrden = orden.numero;
    }

    if (tipo === "SALIDA" && material.stockActual < cantidad) {
      return { ok: false, error: `Stock insuficiente. Disponible: ${material.stockActual}.` };
    }

    const delta = tipo === "SALIDA" ? -cantidad : cantidad;
    const stockResultante = material.stockActual + delta;

    await Material.findByIdAndUpdate(materialId, { $inc: { stockActual: delta } });

    await MovimientoMaterial.create({
      materialId: material._id,
      codigoMaterial: material.codigo,
      descripcionMaterial: material.descripcion,
      tipo,
      cantidad,
      stockResultante,
      ordenTrabajoId: ordenTrabajoId || undefined,
      numeroOrden,
      notas: notas || "",
      usuario: session.user.name || session.user.email || "",
    });
  } catch (err) {
    console.error("registrarMovimientoMaterial error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo registrar el movimiento: ${message}` };
  }

  revalidatePath("/materiales");
  return { ok: true };
}

export async function getMovimientosMaterial(materialId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false as const, error: "No autenticado." };
  }

  try {
    await connectDB();
    const movimientos = await MovimientoMaterial.find({ materialId })
      .sort({ createdAt: -1 })
      .lean();

    return {
      ok: true as const,
      data: movimientos.map((m) => ({
        id: m._id.toString(),
        tipo: m.tipo,
        cantidad: m.cantidad,
        stockResultante: m.stockResultante,
        numeroOrden: m.numeroOrden,
        notas: m.notas,
        usuario: m.usuario,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  } catch (err) {
    console.error("getMovimientosMaterial error:", err);
    return { ok: false as const, error: "No se pudo obtener el historial." };
  }
}