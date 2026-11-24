import mongoose, { Schema, models, model, Model } from "mongoose";
import {
  PIPELINE_PROYECTO_ESTADOS,
  type PipelineProyectoEstado,
  PIPELINE_PRIORIDADES,
  type PipelinePrioridad,
} from "@/lib/pipeline-estados";

// Módulo "Proyectos" (sidebar) — ver comentario largo en
// lib/pipeline-estados.ts sobre por qué el modelo se llama
// "PipelineProyecto" y no "Proyecto" (ese nombre ya lo usa el proyecto
// de FÁBRICA en src/models/Proyecto.ts, concepto distinto).
//
// Portado del pipeline comercial de "proyectos-itelsa" (Firebase). Ahí
// "cliente" era texto suelto; acá, a pedido explícito de Ariel
// (2026-11-24), es el Cliente YA CARGADO en PayFlow — clienteId real con
// `ref`, más un snapshot de nombre para no depender de populate al
// listar (mismo patrón que razonSocial en Reparacion.ts). Es opcional:
// no todo proyecto nace de un cliente ya cargado (puede ser interno).
//
// "miembros"/"responsable" (en Tarea) son snapshots de texto del nombre
// del Empleado elegido, no ObjectId — mismo criterio que "tomadoPor" en
// Reparacion/Proyecto de fábrica (se elige de Empleados activos en el
// formulario, pero lo que se guarda es el nombre).
//
// Se deja afuera de esta primera versión (Ariel: "lo hago que lo
// prueben y vemos qué agregar y qué sacar"): log de actividad y
// notificaciones por email del original (EmailJS) — se agrega después
// si hace falta, no tiene sentido construirlo a ciegas.
export interface IPipelineProyecto {
  _id: mongoose.Types.ObjectId;
  nombre: string;
  clienteId?: mongoose.Types.ObjectId;
  clienteNombre?: string;
  color: string;
  miembros: string[];
  fechaInicio?: Date;
  fechaFin?: Date;
  prioridad: PipelinePrioridad;
  estado: PipelineProyectoEstado;
  fechaVenta?: Date;
  notas?: string;
  createdAt: Date;
}

const PipelineProyectoSchema = new Schema<IPipelineProyecto>(
  {
    nombre: { type: String, required: true, trim: true },
    clienteId: { type: Schema.Types.ObjectId, ref: "Client" },
    clienteNombre: { type: String, default: "" },
    color: { type: String, default: "#e8720c" },
    miembros: { type: [String], default: [] },
    fechaInicio: { type: Date },
    fechaFin: { type: Date },
    prioridad: { type: String, enum: PIPELINE_PRIORIDADES, default: "MEDIA" },
    estado: { type: String, enum: PIPELINE_PROYECTO_ESTADOS, default: "EN_CURSO" },
    fechaVenta: { type: Date },
    notas: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const PipelineProyecto =
  (models.PipelineProyecto as Model<IPipelineProyecto>) ||
  model<IPipelineProyecto>("PipelineProyecto", PipelineProyectoSchema);
