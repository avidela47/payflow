import mongoose, { Schema, models, model, Model } from "mongoose";
import {
  MOVIMIENTO_MATERIAL_TIPOS,
  type MovimientoMaterialTipo,
} from "@/lib/movimiento-material-tipos";

// Ledger de movimientos de Materiales de Obra, portado de "Gestión de
// Luminarias" (ver planificacion/fusion-gestion-luminarias.md). A
// diferencia de Sensores/Luminarias, acá el stock de Materiales NO se
// edita solo a mano: cada entrada/salida/devolución queda registrada acá
// y ajusta Material.stockActual (ver actions.ts, registrarMovimientoMaterial).
//
// "numeroOrden" es texto libre por ahora — en la app original se elige de
// un select contra Órdenes de Trabajo reales, pero ese módulo todavía no
// existe en PayFlow (Fase 5 del plan de fusión). Cuando exista, esto pasa
// a ser una referencia real en vez de texto suelto.
export interface IMovimientoMaterial {
  _id: mongoose.Types.ObjectId;
  materialId: mongoose.Types.ObjectId;
  codigoMaterial: string;
  descripcionMaterial: string;
  tipo: MovimientoMaterialTipo;
  cantidad: number;
  stockResultante: number;
  numeroOrden?: string;
  notas?: string;
  usuario: string;
  createdAt: Date;
}

const MovimientoMaterialSchema = new Schema<IMovimientoMaterial>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
    codigoMaterial: { type: String, required: true },
    descripcionMaterial: { type: String, required: true },
    tipo: { type: String, required: true, enum: MOVIMIENTO_MATERIAL_TIPOS },
    cantidad: { type: Number, required: true },
    stockResultante: { type: Number, required: true },
    numeroOrden: { type: String, default: "" },
    notas: { type: String, default: "" },
    usuario: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MovimientoMaterialSchema.index({ materialId: 1, createdAt: -1 });

export const MovimientoMaterial =
  (models.MovimientoMaterial as Model<IMovimientoMaterial>) ||
  model<IMovimientoMaterial>("MovimientoMaterial", MovimientoMaterialSchema);