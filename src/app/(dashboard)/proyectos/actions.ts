"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Proyecto } from "@/models/Proyecto";
import { ProyectoAvance } from "@/models/ProyectoAvance";
import { PROYECTO_PRIORIDADES } from "@/lib/proyecto-estados";
import { getNextSequence } from "@/models/Counter";
import { ejecutarFabricacion } from "@/lib/fabricacion";

async function generarNumeroProyecto(): Promise<string> {
  const seq = await getNextSequence("proyecto");
  return `AV-${1000 + seq}`;
}

export type ProyectoActivo = {
  id: string;
  numero: string;
  cliente: string;
  nombre?: string;
  prioridad: (typeof PROYECTO_PRIORIDADES)[number];
  estado: "NUEVO" | "PREPARACION" | "FABRICACION";
  items: { id: string; modelo: string; cantidadSolicitada: number; cantidadCompletada: number }[];
  tomadoPor?: string;
  createdAtISO: string;
};

// Usado por la pantalla kiosco /fabrica-proyectos para el polling (ver
// fabrica-proyectos-client.tsx) — devuelve solo los proyectos NO listos,
// que son los que le interesan al taller en el día a día. Ordenados por
// prioridad (urgente primero) y luego por antigüedad (el más viejo
// primero), igual criterio que el original.
export async function listarProyectosActivos(): Promise<ProyectoActivo[]> {
  await connectDB();
  const proyectos = await Proyecto.find({ estado: { $ne: "LISTO" } })
    .sort({ createdAt: 1 })
    .lean();

  const urgentes = proyectos.filter((p) => p.prioridad === "URGENTE");
  const normales = proyectos.filter((p) => p.prioridad !== "URGENTE");

  return [...urgentes, ...normales].map((p) => ({
    id: p._id.toString(),
    numero: p.numero,
    cliente: p.cliente,
    nombre: p.nombre,
    prioridad: p.prioridad,
    estado: p.estado as "NUEVO" | "PREPARACION" | "FABRICACION",
    items: p.items.map((it) => ({
      id: it.id,
      modelo: it.modelo,
      cantidadSolicitada: it.cantidadSolicitada,
      cantidadCompletada: it.cantidadCompletada,
    })),
    tomadoPor: p.tomadoPor,
    createdAtISO: p.createdAt.toISOString(),
  }));
}

const itemSchema = z.object({
  modelo: z.string().min(1).transform((v) => v.trim().toUpperCase()),
  cantidadSolicitada: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
});

const proyectoSchema = z.object({
  cliente: z.string().min(1, "Falta el cliente."),
  nombre: z.string().optional(),
  fechaObjetivo: z.string().optional(),
  prioridad: z.enum(PROYECTO_PRIORIDADES),
  notas: z.string().optional(),
  itemsJson: z.string().min(1),
});

// Alta manual — para adelantarse a la demanda sin que exista una Orden de
// Trabajo detrás (igual que el original: /proyectos/crear). La otra forma
// de generar un Proyecto es automática, al ejecutar una OT que necesita
// fabricar algo (ver ordenes/actions.ts).
export async function createProyecto(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = proyectoSchema.safeParse({
    cliente: formData.get("cliente"),
    nombre: formData.get("nombre") || undefined,
    fechaObjetivo: formData.get("fechaObjetivo") || undefined,
    prioridad: formData.get("prioridad"),
    notas: formData.get("notas") || undefined,
    itemsJson: formData.get("itemsJson"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  let itemsRaw: unknown;
  try {
    itemsRaw = JSON.parse(parsed.data.itemsJson);
  } catch {
    return { ok: false, error: "Ítems inválidos." };
  }
  const itemsParsed = z.array(itemSchema).min(1, "Agregá al menos un modelo.").safeParse(itemsRaw);
  if (!itemsParsed.success) {
    return { ok: false, error: itemsParsed.error.issues[0]?.message ?? "Ítems inválidos." };
  }

  try {
    await connectDB();
    const numero = await generarNumeroProyecto();
    const items = itemsParsed.data.map((it, idx) => ({
      id: `${numero}-${idx + 1}`,
      modelo: it.modelo,
      cantidadSolicitada: it.cantidadSolicitada,
      cantidadCompletada: 0,
    }));

    await Proyecto.create({
      numero,
      cliente: parsed.data.cliente,
      nombre: parsed.data.nombre || "",
      fechaObjetivo: parsed.data.fechaObjetivo ? new Date(parsed.data.fechaObjetivo) : undefined,
      prioridad: parsed.data.prioridad,
      notas: parsed.data.notas || "",
      items,
    });
  } catch (err) {
    console.error("createProyecto error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath("/proyectos");
  revalidatePath("/fabrica-proyectos");
  return { ok: true };
}

export async function deleteProyecto(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await Proyecto.findByIdAndDelete(id);
  } catch (err) {
    console.error("deleteProyecto error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath("/proyectos");
  revalidatePath("/fabrica-proyectos");
  return { ok: true };
}

// Tomar/avance/listo: acciones de taller, pensadas para la pantalla
// kiosco /fabrica-proyectos. El operario se elige de Empleados activos
// (instrucción de Ariel, 2026-11-23) — no hace falta loguearse individual
// para estas tres acciones, mismo criterio que el original (que ahí usaba
// nombres hardcodeados), pero la sesión logueada en el dispositivo sí
// tiene que tener acceso al módulo.
export async function tomarProyecto(id: string, operario: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }
  if (!operario) {
    return { ok: false, error: "Elegí quién toma el proyecto." };
  }

  try {
    await connectDB();
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) {
      return { ok: false, error: "El proyecto ya no existe." };
    }
    if (proyecto.estado !== "NUEVO") {
      return { ok: false, error: "Este proyecto ya fue tomado." };
    }

    await Proyecto.findByIdAndUpdate(id, {
      $set: { estado: "PREPARACION", tomadoPor: operario, fechaTomado: new Date() },
    });
  } catch (err) {
    console.error("tomarProyecto error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo tomar: ${message}` };
  }

  revalidatePath("/fabrica-proyectos");
  revalidatePath("/proyectos");
  return { ok: true };
}

export async function cargarAvanceProyecto(
  id: string,
  params: { itemId: string; cantidad: number; operario: string }
) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }
  const { itemId, cantidad, operario } = params;
  if (!operario) {
    return { ok: false, error: "Elegí quién fabricó." };
  }
  if (!itemId || !Number.isInteger(cantidad) || cantidad <= 0) {
    return { ok: false, error: "Cantidad inválida." };
  }

  try {
    await connectDB();
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) {
      return { ok: false, error: "El proyecto ya no existe." };
    }
    if (proyecto.estado === "NUEVO") {
      return { ok: false, error: "El proyecto todavía no fue tomado." };
    }
    if (proyecto.estado === "LISTO") {
      return { ok: false, error: "El proyecto ya está finalizado." };
    }

    const item = proyecto.items.find((i) => i.id === itemId);
    if (!item) {
      return { ok: false, error: "Modelo no encontrado en este proyecto." };
    }
    const pendiente = item.cantidadSolicitada - item.cantidadCompletada;
    if (cantidad > pendiente) {
      return { ok: false, error: `Solo quedan ${pendiente} unidades pendientes de este modelo.` };
    }

    // Núcleo real: descuenta Componentes, suma stock de Luminaria
    // FABRICADA, deja registro en Produccion — mismo bloque que usa
    // Fabricar (ver lib/fabricacion.ts).
    const resultado = await ejecutarFabricacion({
      codigoReceta: item.modelo,
      cantidad,
      operario,
      notas: `Proyecto ${proyecto.numero}`,
    });
    if (!resultado.ok) {
      return { ok: false, error: resultado.error };
    }

    item.cantidadCompletada += cantidad;
    if (proyecto.estado === "PREPARACION") {
      proyecto.estado = "FABRICACION";
    }
    await proyecto.save();

    await ProyectoAvance.create({
      proyectoId: proyecto._id,
      numeroProyecto: proyecto.numero,
      itemId,
      modelo: item.modelo,
      cantidad,
      operario,
      produccionId: resultado.produccionId,
    });
  } catch (err) {
    console.error("cargarAvanceProyecto error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo cargar el avance: ${message}` };
  }

  revalidatePath("/fabrica-proyectos");
  revalidatePath("/proyectos");
  revalidatePath("/componentes");
  revalidatePath("/movimientos-componentes");
  revalidatePath("/luminarias");
  revalidatePath("/fabricar");
  return { ok: true };
}

export async function marcarProyectoListo(id: string, operario: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }
  if (!operario) {
    return { ok: false, error: "Elegí quién marca el proyecto como listo." };
  }

  try {
    await connectDB();
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) {
      return { ok: false, error: "El proyecto ya no existe." };
    }
    if (proyecto.estado === "LISTO") {
      return { ok: false, error: "El proyecto ya estaba marcado como listo." };
    }

    const totalSolicitado = proyecto.items.reduce((a, i) => a + i.cantidadSolicitada, 0);
    const totalCompletado = proyecto.items.reduce((a, i) => a + i.cantidadCompletada, 0);
    if (totalCompletado < totalSolicitado) {
      return { ok: false, error: "Todavía falta completar producción." };
    }

    await Proyecto.findByIdAndUpdate(id, { $set: { estado: "LISTO", fechaListo: new Date() } });
  } catch (err) {
    console.error("marcarProyectoListo error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo marcar como listo: ${message}` };
  }

  revalidatePath("/fabrica-proyectos");
  revalidatePath("/proyectos");
  revalidatePath("/ordenes");
  return { ok: true };
}
