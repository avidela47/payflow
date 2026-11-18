import mongoose, { Schema, models, model, Model } from "mongoose";
import { MATERIAL_UNIDADES, type MaterialUnidad } from "@/lib/material-unidades";

// Cuarto módulo fusionado desde "Gestión de Luminarias" (ver
// planificacion/fusion-gestion-luminarias.md en el proyecto). Mismo
// esquema que SensorFuente (stock + mínimo + precio + proveedor), con
// "unidad" en vez de "tipo" y precio en USD (confirmado por Ariel,
// mismo criterio que el resto del stock de planta).
export interface IMaterial {
  _id: mongoose.Types.ObjectId;
  codigo: string;
  descripcion: string;
  unidad: MaterialUnidad;
  stockActual: number;
  stockMinimo: number;
  precio: number;
  proveedor?: string;
  notas?: string;
  createdAt: Date;
}

const MaterialSchema = new Schema<IMaterial>(
  {
    codigo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    descripcion: { type: String, required: true, trim: true },
    unidad: { type: String, required: true, enum: MATERIAL_UNIDADES, default: "UNIDAD" },
    stockActual: { type: Number, default: 0 },
    stockMinimo: { type: Number, default: 0 },
    precio: { type: Number, default: 0 },
    proveedor: { type: String, default: "" },
    notas: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Material =
  (models.Material as Model<IMaterial>) || model<IMaterial>("Material", MaterialSchema);