"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { OrdenTrabajo } from "@/models/OrdenTrabajo";
import { Luminaria } from "@/models/Luminaria";
import { Proyecto } from "@/models/Proyecto";
import { getNextSequence } from "@/models/Counter";

async function generarNumeroOrden(): Promise<string> {
  const seq = await getNextSequence("ordenTrabajo");
  return `OT-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
}

async function generarNumeroProyecto(): Promise<string> {
  const seq = await getNextSequence("proyecto");
  return `AV-${1000 + seq}`;
}

const lineaSchema = z.object({
  codigoLuminaria: z.string().min(1).transform((v) => v.trim().toUpperCase()),
  descripcion: z.string().min(1, "Falta la descripción de una línea."),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
});

const ordenSchema = z.object({
  clientId: z.string().optional(),
  razonSocial: z.string().min(1, "Falta el cliente."),
  presupuestoId: z.string().optional(),
  numeroPresupuesto: z.string().optional(),
  fechaEntrega: z.string().optional(),
  notas: z.string().optional(),
  lineasJson: z.string().min(1),
});

export async function createOrdenTrabajo(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = ordenSchema.safeParse({
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
    const numero = await generarNumeroOrden();
    await OrdenTrabajo.create({
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
    console.error("createOrdenTrabajo error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath("/ordenes");
  return { ok: true };
}

// Borrar: solo en PENDIENTE (igual que el original, que además nunca
// descontó stock al ejecutar — ver nota en models/OrdenTrabajo.ts sobre
// por qué no se replica el intento de "devolver stock" del DELETE viejo).
export async function deleteOrdenTrabajo(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const orden = await OrdenTrabajo.findById(id);
    if (!orden) {
      return { ok: false, error: "La orden ya no existe." };
    }
    if (orden.ejecutada || orden.estado !== "PENDIENTE") {
      return { ok: false, error: "Solo se puede borrar una orden pendiente, sin ejecutar." };
    }
    await OrdenTrabajo.findByIdAndDelete(id);
  } catch (err) {
    console.error("deleteOrdenTrabajo error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath("/ordenes");
  return { ok: true };
}

// Ejecutar: para cada línea busca stock de Luminaria (cualquier origen,
// prioridad FABRICADA → NACIONAL → IMPORTADA, igual orden de prioridad
// que el original entre ProductoTerminado/LuminariaComercial). Lo que no
// cubre el stock existente genera un Proyecto de fábrica automático (ver
// hallazgo de arquitectura en planificacion/fusion-gestion-luminarias.md).
// No descuenta nada todavía — itemsDescontados es solo el plan informativo
// de lo que se tomaría al despachar (el descuento real ocurre al confirmar
// el Despacho correspondiente, igual que el resto de PayFlow).
const PRIORIDAD_ORIGEN = ["FABRICADA", "NACIONAL", "IMPORTADA"] as const;

export async function ejecutarOrdenTrabajo(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const orden = await OrdenTrabajo.findById(id);
    if (!orden) {
      return { ok: false, error: "La orden ya no existe." };
    }
    if (orden.ejecutada) {
      return { ok: false, error: "Esta orden ya fue ejecutada." };
    }

    // Si ya hay un proyecto generado antes y sigue sin estar LISTO, no se
    // genera uno nuevo — hay que esperar a que el taller lo termine.
    if (orden.proyectoFabricaId) {
      const proyectoExistente = await Proyecto.findById(orden.proyectoFabricaId);
      if (proyectoExistente && proyectoExistente.estado !== "LISTO") {
        return {
          ok: false,
          error: `Ya hay un proyecto de fábrica en curso: ${proyectoExistente.numero}. Esperá a que esté LISTO.`,
          proyectoId: proyectoExistente._id.toString(),
          proyectoNumero: proyectoExistente.numero,
        };
      }
    }

    const itemsDescontados: { codigo: string; origen: string; cantidad: number }[] = [];
    const aFabricar: { codigoLuminaria: string; descripcion: string; cantidad: number }[] = [];

    for (const linea of orden.lineas) {
      let pendiente = linea.cantidad;
      for (const origen of PRIORIDAD_ORIGEN) {
        if (pendiente <= 0) break;
        const lum = await Luminaria.findOne({ codigo: linea.codigoLuminaria, origen });
        const disponible = lum?.stockActual ?? 0;
        if (disponible <= 0) continue;
        const tomar = Math.min(pendiente, disponible);
        itemsDescontados.push({ codigo: linea.codigoLuminaria, origen, cantidad: tomar });
        pendiente -= tomar;
      }
      if (pendiente > 0) {
        aFabricar.push({
          codigoLuminaria: linea.codigoLuminaria,
          descripcion: linea.descripcion,
          cantidad: pendiente,
        });
      }
    }

    if (aFabricar.length > 0) {
      const numeroProyecto = await generarNumeroProyecto();
      const items = aFabricar.map((item, idx) => ({
        id: `${numeroProyecto}-${idx + 1}`,
        modelo: item.codigoLuminaria,
        cantidadSolicitada: item.cantidad,
        cantidadCompletada: 0,
      }));

      const proyecto = await Proyecto.create({
        numero: numeroProyecto,
        cliente: orden.razonSocial,
        nombre: `Auto-generado desde OT ${orden.numero}`,
        prioridad: "NORMAL",
        notas: `Generado automáticamente al ejecutar la Orden de Trabajo ${orden.numero}`,
        items,
        ordenTrabajoId: orden._id,
        numeroOrdenTrabajo: orden.numero,
      });

      await OrdenTrabajo.findByIdAndUpdate(id, {
        $set: { proyectoFabricaId: proyecto._id, estado: "EN_FABRICA" },
      });

      revalidatePath("/ordenes");
      revalidatePath(`/ordenes/${id}`);
      return {
        ok: false,
        error: `Falta fabricar. Se generó el proyecto ${proyecto.numero} para el taller.`,
        proyectoId: proyecto._id.toString(),
        proyectoNumero: proyecto.numero,
      };
    }

    await OrdenTrabajo.findByIdAndUpdate(id, {
      $set: {
        ejecutada: true,
        fechaEjecucion: new Date(),
        estado: "EN_PROCESO",
        itemsDescontados,
      },
    });

    revalidatePath("/ordenes");
    revalidatePath(`/ordenes/${id}`);
    return { ok: true, mensaje: "Orden ejecutada. El stock se descontará al confirmar el despacho." };
  } catch (err) {
    console.error("ejecutarOrdenTrabajo error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo ejecutar: ${message}` };
  }
}
