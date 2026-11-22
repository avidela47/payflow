import mongoose, { Schema, models, model, Model } from "mongoose";
import {
  MOVIMIENTO_COMPONENTE_TIPOS,
  type MovimientoComponenteTipo,
} from "@/lib/movimiento-componente-tipos";

// Ledger de movimientos de Componentes, portado de "Gestión de Luminarias"
// (ver planificacion/fusion-gestion-luminarias.md). Igual criterio que
// MovimientoMaterial: el stock de Componente NO se edita a mano, solo se
// mueve registrando acá (ver actions.ts, registrarMovimientoComponente) —
// queda historial completo de cada entrada/salida/ajuste.
export interface IMovimientoComponente {
  _id: mongoose.Types.ObjectId;
  componenteId: mongoose.Types.ObjectId;
  codigoComponente: string;
  descripcionComponente: string;
  tipo: MovimientoComponenteTipo;
  cantidad: number;
  stockResultante: number;
  referencia?: string;
  notas?: string;
  usuario: string;
  createdAt: Date;
}

const MovimientoComponenteSchema = new Schema<IMovimientoComponente>(
  {
    componenteId: { type: Schema.Types.ObjectId, ref: "Componente", required: true },
    codigoComponente: { type: String, required: true },
    descripcionComponente: { type: String, required: true },
    tipo: { type: String, required: true, enum: MOVIMIENTO_COMPONENTE_TIPOS },
    cantidad: { type: Number, required: true },
    stockResultante: { type: Number, required: true },
    referencia: { type: String, default: "" },
    notas: { type: String, default: "" },
    usuario: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MovimientoComponenteSchema.index({ componenteId: 1, createdAt: -1 });

export const MovimientoComponente =
  (models.MovimientoComponente as Model<IMovimientoComponente>) ||
  model<IMovimientoComponente>("MovimientoComponente", MovimientoComponenteSchema);