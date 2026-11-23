import mongoose, { Schema, models, model, Model } from "mongoose";

// Historial de avances cargados en un Proyecto de fábrica — quién fabricó
// cuánto de qué modelo y cuándo. Separado de Produccion (que es el
// historial de descuento de Componentes/alta de stock): acá lo que
// importa es el progreso del Proyecto en sí, no el detalle de qué
// Componentes se tocaron (eso ya queda en Produccion.componentesDescontados,
// ver lib/fabricacion.ts). Mismo rol que "ProyectoAvance" en el original.
export interface IProyectoAvance {
  _id: mongoose.Types.ObjectId;
  proyectoId: mongoose.Types.ObjectId;
  numeroProyecto: string;
  itemId: string;
  modelo: string;
  cantidad: number;
  operario: string;
  produccionId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ProyectoAvanceSchema = new Schema<IProyectoAvance>(
  {
    proyectoId: { type: Schema.Types.ObjectId, ref: "Proyecto", required: true },
    numeroProyecto: { type: String, required: true },
    itemId: { type: String, required: true },
    modelo: { type: String, required: true },
    cantidad: { type: Number, required: true },
    operario: { type: String, required: true },
    produccionId: { type: Schema.Types.ObjectId, ref: "Produccion" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ProyectoAvanceSchema.index({ proyectoId: 1, createdAt: -1 });

export const ProyectoAvance =
  (models.ProyectoAvance as Model<IProyectoAvance>) ||
  model<IProyectoAvance>("ProyectoAvance", ProyectoAvanceSchema);
