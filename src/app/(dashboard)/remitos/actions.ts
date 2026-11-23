"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Remito } from "@/models/Remito";
import { OrdenTrabajo } from "@/models/OrdenTrabajo";
import { Reparacion } from "@/models/Reparacion";
import { REMITO_ESTADOS } from "@/lib/remito-estados";

function generarNumero(): Promise<string> {
  return Remito.findOne()
    .sort({ createdAt: -1 })
    .then((ultimo) => {
      const anio = new Date().getFullYear();
      if (!ultimo?.numero) return `REM-${anio}-0001`;
      const partes = ultimo.numero.split("-");
      const num = parseInt(partes[2] || "0", 10) + 1;
      return `REM-${anio}-${String(num).padStart(4, "0")}`;
    });
}

const lineaSchema = z.object({
  codigo: z.string().optional(),
  descripcion: z.string().min(1, "Falta la descripción de un ítem."),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  unidad: z.string().optional(),
});

const remitoSchema = z.object({
  fecha: z.coerce.date(),
  clientId: z.string().optional(),
  razonSocial: z.string().min(1, "Falta el cliente."),
  presupuestoId: z.string().optional(),
  numeroPresupuesto: z.string().optional(),
  ordenTrabajoId: z.string().optional(),
  reparacionId: z.string().optional(),
  notas: z.string().optional(),
  lineas: z.array(lineaSchema).min(1, "Agregá al menos un ítem."),
});

function parseRemitoForm(formData: FormData) {
  let lineasRaw: unknown = [];
  try {
    lineasRaw = JSON.parse((formData.get("lineasJson") as string) || "[]");
  } catch {
    lineasRaw = [];
  }

  return remitoSchema.safeParse({
    fecha: formData.get("fecha") || new Date(),
    clientId: formData.get("clientId") || undefined,
    razonSocial: formData.get("razonSocial"),
    presupuestoId: formData.get("presupuestoId") || undefined,
    numeroPresupuesto: formData.get("numeroPresupuesto") || undefined,
    ordenTrabajoId: formData.get("ordenTrabajoId") || undefined,
    reparacionId: formData.get("reparacionId") || undefined,
    notas: formData.get("notas") || undefined,
    lineas: lineasRaw,
  });
}

export async function createRemito(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseRemitoForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();

    let numeroOrden = "";
    if (parsed.data.ordenTrabajoId) {
      const orden = await OrdenTrabajo.findById(parsed.data.ordenTrabajoId);
      if (!orden) {
        return { ok: false, error: "La Orden de Trabajo elegida ya no existe." };
      }
      numeroOrden = orden.numero;
    }

    let numeroReparacion = "";
    if (parsed.data.reparacionId) {
      const reparacion = await Reparacion.findById(parsed.data.reparacionId);
      if (!reparacion) {
        return { ok: false, error: "La Reparación elegida ya no existe." };
      }
      numeroReparacion = reparacion.numero;
    }

    const numero = await generarNumero();
    await Remito.create({ ...parsed.data, numero, numeroOrden, numeroReparacion });
  } catch (err) {
    console.error("createRemito error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath("/remitos");
  return { ok: true };
}

// Cambio rápido de estado desde el desplegable de la fila — un remito no
// se edita después de creado (igual que el original, que tampoco tiene
// pantalla de edición), solo cambia de estado o se borra.
export async function updateRemitoEstado(id: string, estado: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsedEstado = z.enum(REMITO_ESTADOS).safeParse(estado);
  if (!parsedEstado.success) {
    return { ok: false, error: "Estado inválido." };
  }

  try {
    await connectDB();
    const item = await Remito.findByIdAndUpdate(id, { estado: parsedEstado.data });
    if (!item) {
      return { ok: false, error: "El remito ya no existe." };
    }
  } catch (err) {
    console.error("updateRemitoEstado error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar el estado: ${message}` };
  }

  revalidatePath("/remitos");
  return { ok: true };
}

export async function deleteRemito(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Remito.findByIdAndDelete(id);
  } catch (err) {
    console.error("deleteRemito error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath("/remitos");
  return { ok: true };
}