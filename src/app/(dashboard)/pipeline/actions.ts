"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PipelineProyecto } from "@/models/PipelineProyecto";
import { PipelineTarea } from "@/models/PipelineTarea";
import {
  PIPELINE_PROYECTO_ESTADOS,
  PIPELINE_TAREA_ESTADOS,
  PIPELINE_PRIORIDADES,
} from "@/lib/pipeline-estados";

const proyectoSchema = z.object({
  nombre: z.string().min(1, "Falta el nombre del proyecto."),
  clienteId: z.string().optional(),
  clienteNombre: z.string().optional(),
  color: z.string().optional(),
  miembrosJson: z.string().optional(),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  prioridad: z.enum(PIPELINE_PRIORIDADES).optional(),
  notas: z.string().optional(),
});

export async function createPipelineProyecto(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = proyectoSchema.safeParse({
    nombre: formData.get("nombre"),
    clienteId: formData.get("clienteId") || undefined,
    clienteNombre: formData.get("clienteNombre") || undefined,
    color: formData.get("color") || undefined,
    miembrosJson: formData.get("miembrosJson") || undefined,
    fechaInicio: formData.get("fechaInicio") || undefined,
    fechaFin: formData.get("fechaFin") || undefined,
    prioridad: formData.get("prioridad") || undefined,
    notas: formData.get("notas") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  let miembros: string[] = [];
  if (parsed.data.miembrosJson) {
    try {
      const raw = JSON.parse(parsed.data.miembrosJson);
      if (Array.isArray(raw)) miembros = raw.filter((m) => typeof m === "string" && m.trim());
    } catch {
      return { ok: false, error: "Miembros inválidos." };
    }
  }

  try {
    await connectDB();
    await PipelineProyecto.create({
      nombre: parsed.data.nombre,
      clienteId: parsed.data.clienteId || undefined,
      clienteNombre: parsed.data.clienteNombre || "",
      color: parsed.data.color || "#e8720c",
      miembros,
      fechaInicio: parsed.data.fechaInicio ? new Date(parsed.data.fechaInicio) : undefined,
      fechaFin: parsed.data.fechaFin ? new Date(parsed.data.fechaFin) : undefined,
      prioridad: parsed.data.prioridad || "MEDIA",
      notas: parsed.data.notas || "",
    });
  } catch (err) {
    console.error("createPipelineProyecto error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath("/pipeline");
  return { ok: true };
}

const estadoProyectoSchema = z.enum(PIPELINE_PROYECTO_ESTADOS);

export async function updatePipelineProyectoEstado(id: string, estado: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }
  const parsedEstado = estadoProyectoSchema.safeParse(estado);
  if (!parsedEstado.success) {
    return { ok: false, error: "Estado inválido." };
  }

  try {
    await connectDB();
    const proyecto = await PipelineProyecto.findById(id);
    if (!proyecto) {
      return { ok: false, error: "El proyecto ya no existe." };
    }
    const set: Record<string, unknown> = { estado: parsedEstado.data };
    // La fecha de venta se fija la primera vez que entra a VENDIDO — si
    // después se mueve a otro estado y vuelve, no se pisa.
    if (parsedEstado.data === "VENDIDO" && !proyecto.fechaVenta) {
      set.fechaVenta = new Date();
    }
    await PipelineProyecto.findByIdAndUpdate(id, { $set: set });
  } catch (err) {
    console.error("updatePipelineProyectoEstado error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar: ${message}` };
  }

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${id}`);
  return { ok: true };
}

export async function deletePipelineProyecto(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const tareas = await PipelineTarea.countDocuments({ proyectoId: id });
    if (tareas > 0) {
      return {
        ok: false,
        error: "Este proyecto tiene tareas cargadas — borralas primero (o movelo a Cancelado).",
      };
    }
    await PipelineProyecto.findByIdAndDelete(id);
  } catch (err) {
    console.error("deletePipelineProyecto error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath("/pipeline");
  return { ok: true };
}

const tareaSchema = z.object({
  proyectoId: z.string().min(1),
  titulo: z.string().min(1, "Falta el título de la tarea."),
  descripcion: z.string().optional(),
  responsable: z.string().optional(),
  prioridad: z.enum(PIPELINE_PRIORIDADES).optional(),
  vencimiento: z.string().optional(),
});

export async function createPipelineTarea(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = tareaSchema.safeParse({
    proyectoId: formData.get("proyectoId"),
    titulo: formData.get("titulo"),
    descripcion: formData.get("descripcion") || undefined,
    responsable: formData.get("responsable") || undefined,
    prioridad: formData.get("prioridad") || undefined,
    vencimiento: formData.get("vencimiento") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const proyecto = await PipelineProyecto.findById(parsed.data.proyectoId);
    if (!proyecto) {
      return { ok: false, error: "El proyecto ya no existe." };
    }
    await PipelineTarea.create({
      proyectoId: parsed.data.proyectoId,
      titulo: parsed.data.titulo,
      descripcion: parsed.data.descripcion || "",
      responsable: parsed.data.responsable || "",
      prioridad: parsed.data.prioridad || "MEDIA",
      vencimiento: parsed.data.vencimiento ? new Date(parsed.data.vencimiento) : undefined,
    });
  } catch (err) {
    console.error("createPipelineTarea error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath(`/pipeline/${parsed.data.proyectoId}`);
  return { ok: true };
}

const estadoTareaSchema = z.enum(PIPELINE_TAREA_ESTADOS);

export async function updatePipelineTareaEstado(id: string, proyectoId: string, estado: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }
  const parsedEstado = estadoTareaSchema.safeParse(estado);
  if (!parsedEstado.success) {
    return { ok: false, error: "Estado inválido." };
  }

  try {
    await connectDB();
    await PipelineTarea.findByIdAndUpdate(id, { $set: { estado: parsedEstado.data } });
  } catch (err) {
    console.error("updatePipelineTareaEstado error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar: ${message}` };
  }

  revalidatePath(`/pipeline/${proyectoId}`);
  return { ok: true };
}

export async function deletePipelineTarea(id: string, proyectoId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await PipelineTarea.findByIdAndDelete(id);
  } catch (err) {
    console.error("deletePipelineTarea error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath(`/pipeline/${proyectoId}`);
  return { ok: true };
}
