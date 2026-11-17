import mongoose, { Schema, models, model, Model } from "mongoose";
import { SENSOR_FUENTE_TIPOS, type SensorFuenteTipo } from "@/lib/sensor-fuente-tipos";

// Primer módulo portado de "Gestión de Luminarias" (app de producción/stock
// de ITELSA que se está fusionando acá, ver planificacion/fusion-gestion-
// luminarias.md en el proyecto). Mismo esquema de datos que el original
// (codigo/descripcion/tipo/stock/precio/proveedor), pero reconstruido con
// las convenciones de PayFlow: camelCase, server actions, sin "activo"
// (acá se borra de verdad, igual que Proveedores/Clientes).
export interface ISensorFuente {
  _id: mongoose.Types.ObjectId;
  codigo: string;
  descripcion: string;
  tipo: SensorFuenteTipo;
  stockActual: number;
  stockMinimo: number;
  precio: number;
  proveedor?: string;
  notas?: string;
  createdAt: Date;
}

const SensorFuenteSchema = new Schema<ISensorFuente>(
  {
    codigo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    descripcion: { type: String, required: true, trim: true },
    tipo: { type: String, required: true, enum: SENSOR_FUENTE_TIPOS },
    stockActual: { type: Number, default: 0 },
    stockMinimo: { type: Number, default: 0 },
    precio: { type: Number, default: 0 },
    proveedor: { type: String, default: "" },
    notas: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SensorFuenteSchema.index({ tipo: 1, codigo: 1 });

export const SensorFuente =
  (models.SensorFuente as Model<ISensorFuente>) ||
  model<ISensorFuente>("SensorFuente", SensorFuenteSchema);