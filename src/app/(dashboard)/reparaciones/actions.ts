"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Reparacion } from "@/models/Reparacion";
import { Componente } from "@/models/Componente";
import { MovimientoComponente } from "@/models/MovimientoComponente";
import { getNextSequence } from "@/models/Counter";

async function generarNumeroReparacion(): Promise<string> {
  const seq = await getNextSequence("reparacion");
  return `REP-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
}

const lineaSchema = z.object({
  codigoLuminaria: z.string().optional(),
  descripcion: z.string().min(1, "Falta la descripción de una línea."),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
});

const reparacionSchema = z.object({
  clientId: z.string().optional(),
  razonSocial: z.string().min(1, "Falta el cliente."),
  presupuestoId: z.string().optional(),
  numeroPresupuesto: z.string().optional(),
  fechaEntrega: z.string().optional(),
  notas: z.string().optional(),
  lineasJson: z.string().min(1),
});

export async function createReparacion(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = reparacionSchema.safeParse({
    clientId: formData.get("clientId") || undefined,
    razonSocial: formData.get("razonSocial"),
    presupuestoId: formData.get("presupuestoId") || undefined,
    numeroPresupuesto: formData.get("numeroPresupuesto") || undefined,
    fechaEntrega: formData.get("fechaEntrega") || undefined,
    notas: formData.get("notas") || undefined,
    lineasJson: formData.get("lineasJson"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  let lineasRaw: unknown;
  try {
    lineasRaw = JSON.parse(parsed.data.lineasJson);
  } catch {
    return { ok: false, error: "Líneas inválidas." };
  }
  const lineasParsed = z.array(lineaSchema).min(1, "Agregá al menos una línea.").safeParse(lineasRaw);
  if (!lineasParsed.success) {
    return { ok: false, error: lineasParsed.error.issues[0]?.message ?? "Líneas inválidas." };
  }

  try {
    await connectDB();
    const numero = await generarNumeroReparacion();
    await Reparacion.create({
      numero,
      clienteId: parsed.data.clientId || undefined,
      razonSocial: parsed.data.razonSocial,
      presupuestoId: parsed.data.presupuestoId || undefined,
      numeroPresupuesto: parsed.data.numeroPresupuesto || "",
      vendedor: session.user.name || session.user.email || "",
      fechaEntrega: parsed.data.fechaEntrega ? new Date(parsed.data.fechaEntrega) : undefined,
      notas: parsed.data.notas || "",
      lineas: lineasParsed.data,
    });
  } catch (err) {
    console.error("createReparacion error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath("/reparaciones");
  revalidatePath("/fabrica-proyectos");
  return { ok: true };
}

export type ReparacionActiva = {
  id: string;
  numero: string;
  razonSocial: string;
  lineas: { codigoLuminaria?: string; descripcion: string; cantidad: number }[];
  estado: "PENDIENTE" | "EN_PROCESO";
  tomadoPor?: string;
  createdAtISO: string;
};

// Usado por la pantalla kiosco /fabrica-proyectos para el polling (ver
// fabrica-proyectos-client.tsx) — mismo rol que listarProyectosActivos en
// proyectos/actions.ts. Devuelve solo las NO terminadas (LISTA queda
// afuera, ya no le interesa al taller en el día a día). Sin prioridad —
// a diferencia de Proyecto, Ariel no pidió urgencias para Reparación.
export async function listarReparacionesActivas(): Promise<ReparacionActiva[]> {
  await connectDB();
  const reparaciones = await Reparacion.find({ estado: { $ne: "LISTA" } })
    .sort({ createdAt: 1 })
    .lean();

  return reparaciones.map((r) => ({
    id: r._id.toString(),
    numero: r.numero,
    razonSocial: r.razonSocial,
    lineas: r.lineas.map((l) => ({
      codigoLuminaria: l.codigoLuminaria,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
    })),
    estado: r.estado as "PENDIENTE" | "EN_PROCESO",
    tomadoPor: r.tomadoPor,
    createdAtISO: r.createdAt.toISOString(),
  }));
}

// Tomar: acción de taller, pensada para la pantalla kiosco (igual que
// tomarProyecto en proyectos/actions.ts) pero también disponible desde el
// detalle de la Reparación (/reparaciones/[id]) para quien la gestiona
// desde el escritorio. El operario se elige de Empleados activos, mismo
// criterio que Proyecto.
export async function tomarReparacion(id: string, operario: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }
  if (!operario) {
    return { ok: false, error: "Elegí quién toma la reparación." };
  }

  try {
    await connectDB();
    const reparacion = await Reparacion.findById(id);
    if (!reparacion) {
      return { ok: false, error: "La reparación ya no existe." };
    }
    if (reparacion.estado !== "PENDIENTE") {
      return { ok: false, error: "Esta reparación ya fue tomada." };
    }

    await Reparacion.findByIdAndUpdate(id, {
      $set: { estado: "EN_PROCESO", tomadoPor: operario, fechaTomada: new Date() },
    });
  } catch (err) {
    console.error("tomarReparacion error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo tomar: ${message}` };
  }

  revalidatePath("/reparaciones");
  revalidatePath(`/reparaciones/${id}`);
  revalidatePath("/fabrica-proyectos");
  return { ok: true };
}

// Borrar: solo en PENDIENTE, sin ejecutar — mismo criterio que
// OrdenTrabajo. Acá no hace falta la nota sobre "devolver stock" al
// borrar (ver OrdenTrabajo.ts): Reparación nunca tocó stock de Luminaria
// en ningún momento (es del cliente), así que no hay nada que devolver.
export async function deleteReparacion(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const reparacion = await Reparacion.findById(id);
    if (!reparacion) {
      return { ok: false, error: "La reparación ya no existe." };
    }
    if (reparacion.ejecutada || reparacion.estado !== "PENDIENTE") {
      return { ok: false, error: "Solo se puede borrar una reparación pendiente, sin ejecutar." };
    }
    await Reparacion.findByIdAndDelete(id);
  } catch (err) {
    console.error("deleteReparacion error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath("/reparaciones");
  return { ok: true };
}

const componenteUsadoSchema = z.object({
  componenteId: z.string().min(1),
  cantidad: z.coerce.number().positive(),
});

// Ejecutar ("marcar lista"): a diferencia de OrdenTrabajo, acá no hay
// chequeo de stock de Luminaria ni generación de Proyecto de fábrica — la
// luminaria es del cliente. Lo único real es el descuento de Componentes,
// elegido a mano (confirmado por Ariel: no es por Receta, cada reparación
// puede gastar cosas distintas aunque sea la misma luminaria). Sí o sí
// descuenta stock real de Componente y deja registro en
// MovimientoComponente — a diferencia de itemsDescontados en
// OrdenTrabajo (que es un snapshot informativo, el descuento real pasa
// después al despachar), acá el descuento ES real y ocurre en este mismo
// paso, porque no hay ningún otro documento posterior (Despacho) que
// vuelva a tocar Componentes.
//
// Requiere que la reparación ya esté EN_PROCESO (tomada por alguien, ver
// tomarReparacion) — igual secuencia que Proyecto (tomar → avance), para
// que el taller siempre quede con un responsable asignado antes de
// cerrarla. El operario que queda en MovimientoComponente es el mismo
// que la tomó (reparacion.tomadoPor), no uno nuevo elegido en este paso.
export async function ejecutarReparacion(id: string, componentesJson: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  let componentesRaw: unknown;
  try {
    componentesRaw = JSON.parse(componentesJson);
  } catch {
    return { ok: false, error: "Componentes inválidos." };
  }
  const componentesParsed = z
    .array(componenteUsadoSchema)
    .min(1, "Elegí al menos un componente usado.")
    .safeParse(componentesRaw);
  if (!componentesParsed.success) {
    return { ok: false, error: componentesParsed.error.issues[0]?.message ?? "Componentes inválidos." };
  }

  try {
    await connectDB();
    const reparacion = await Reparacion.findById(id);
    if (!reparacion) {
      return { ok: false, error: "La reparación ya no existe." };
    }
    if (reparacion.ejecutada || reparacion.estado === "LISTA") {
      return { ok: false, error: "Esta reparación ya fue ejecutada." };
    }
    if (reparacion.estado !== "EN_PROCESO") {
      return { ok: false, error: "Primero hay que tomar la reparación." };
    }

    // 1. Validar stock de todos los componentes elegidos con datos recién
    // leídos, antes de descontar nada — todo o nada, igual criterio que
    // ejecutarFabricacion en lib/fabricacion.ts.
    const faltantes: string[] = [];
    const lineas: {
      componenteId: string;
      codigo: string;
      descripcion: string;
      cantidad: number;
    }[] = [];
    for (const item of componentesParsed.data) {
      const componente = await Componente.findById(item.componenteId);
      if (!componente) {
        faltantes.push("Un componente elegido ya no existe.");
        continue;
      }
      if (componente.stockActual < item.cantidad) {
        faltantes.push(`${componente.codigo} — necesitás ${item.cantidad}, hay ${componente.stockActual}`);
      }
      lineas.push({
        componenteId: componente._id.toString(),
        codigo: componente.codigo,
        descripcion: componente.descripcion,
        cantidad: item.cantidad,
      });
    }
    if (faltantes.length > 0) {
      return { ok: false, error: `Stock insuficiente: ${faltantes.join("; ")}` };
    }

    // 2. Descontar cada componente y dejar registro del movimiento.
    const operario = reparacion.tomadoPor || session.user.name || session.user.email || "";
    const componentesDescontados = [];
    for (const linea of lineas) {
      const actualizado = await Componente.findByIdAndUpdate(
        linea.componenteId,
        { $inc: { stockActual: -linea.cantidad } },
        { new: true }
      );
      componentesDescontados.push({
        componenteId: linea.componenteId,
        codigoComponente: linea.codigo,
        descripcionComponente: linea.descripcion,
        cantidad: linea.cantidad,
      });
      await MovimientoComponente.create({
        componenteId: linea.componenteId,
        codigoComponente: linea.codigo,
        descripcionComponente: linea.descripcion,
        tipo: "SALIDA_REPARACION",
        cantidad: linea.cantidad,
        stockResultante: actualizado!.stockActual,
        referencia: reparacion.numero,
        notas: `Reparación ${reparacion.numero} — ${reparacion.razonSocial}`,
        usuario: operario,
      });
    }

    await Reparacion.findByIdAndUpdate(id, {
      $set: {
        ejecutada: true,
        fechaEjecucion: new Date(),
        estado: "LISTA",
        componentesDescontados,
      },
    });
  } catch (err) {
    console.error("ejecutarReparacion error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo ejecutar: ${message}` };
  }

  revalidatePath("/reparaciones");
  revalidatePath(`/reparaciones/${id}`);
  revalidatePath("/fabrica-proyectos");
  return { ok: true, mensaje: "Reparación marcada como lista. Se descontó el stock de Componentes." };
}
