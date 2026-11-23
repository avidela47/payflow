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
// "numeroOrden" ahora es el snapshot de texto de una Orden de Trabajo
// real (ref OrdenTrabajo vía ordenTrabajoId), mismo patrón que
// presupuestoId/numeroPresupuesto en Despacho/Remito/Recibo — conectado
// el 2026-11-23, una vez que el módulo de Órdenes de Trabajo existe
// (Fase 5 del plan de fusión). ordenTrabajoId queda opcional: un
// movimiento también puede no estar atado a ninguna OT.
export interface IMovimientoMaterial {
  _id: mongoose.Types.ObjectId;
  materialId: mongoose.Types.ObjectId;
  codigoMaterial: string;
  descripcionMaterial: string;
  tipo: MovimientoMaterialTipo;
  cantidad: number;
  stockResultante: number;
  ordenTrabajoId?: mongoose.Types.ObjectId;
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
    ordenTrabajoId: { type: Schema.Types.ObjectId, ref: "OrdenTrabajo" },
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