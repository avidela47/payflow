import mongoose, { Schema, models, model, Model } from "mongoose";
import {
  PIPELINE_TAREA_ESTADOS,
  type PipelineTareaEstado,
  PIPELINE_PRIORIDADES,
  type PipelinePrioridad,
} from "@/lib/pipeline-estados";

// Tareas del Kanban de un PipelineProyecto (ver PipelineProyecto.ts).
// "responsable" es un snapshot de texto del nombre del Empleado elegido
// (mismo criterio que tomadoPor en Reparacion/Proyecto de fábrica), no
// un ObjectId — no hace falta populate para mostrar el Kanban.
export interface IPipelineTarea {
  _id: mongoose.Types.ObjectId;
  proyectoId: mongoose.Types.ObjectId;
  titulo: string;
  descripcion?: string;
  responsable?: string;
  prioridad: PipelinePrioridad;
  estado: PipelineTareaEstado;
  vencimiento?: Date;
  createdAt: Date;
}

const PipelineTareaSchema = new Schema<IPipelineTarea>(
  {
    proyectoId: { type: Schema.Types.ObjectId, ref: "PipelineProyecto", required: true },
    titulo: { type: String, required: true, trim: true },
    descripcion: { type: String, default: "" },
    responsable: { type: String, default: "" },
    prioridad: { type: String, enum: PIPELINE_PRIORIDADES, default: "MEDIA" },
    estado: { type: String, enum: PIPELINE_TAREA_ESTADOS, default: "PENDIENTE" },
    vencimiento: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PipelineTareaSchema.index({ proyectoId: 1 });

export const PipelineTarea =
  (models.PipelineTarea as Model<IPipelineTarea>) ||
  model<IPipelineTarea>("PipelineTarea", PipelineTareaSchema);
