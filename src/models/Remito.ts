import mongoose, { Schema, models, model, Model } from "mongoose";
import { REMITO_ESTADOS, type RemitoEstado } from "@/lib/remito-estados";

// Segundo módulo de "Comercial Planta" (ver planificacion/fusion-gestion-
// luminarias.md). Documento de entrega pura — nunca mueve stock (eso lo
// hace Despacho) ni tiene montos (es papelería, no factura), igual que el
// original. No es editable después de creado: solo cambia de estado o se
// borra, igual que el original (que tampoco tiene una pantalla de editar
// remito).
//
// numeroOrden queda como texto libre: todavía no existe un módulo real de
// Órdenes de Trabajo en PayFlow (pendiente, se construye junto con
// Producción). Cuando exista, esto pasa a ser una referencia real como
// presupuestoId/numeroPresupuesto.
export interface ILineaRemito {
  codigo?: string;
  descripcion: string;
  cantidad: number;
  unidad?: string;
}

export interface IRemito {
  _id: mongoose.Types.ObjectId;
  numero: string;
  fecha: Date;
  clientId?: mongoose.Types.ObjectId;
  razonSocial: string;
  presupuestoId?: mongoose.Types.ObjectId;
  numeroPresupuesto?: string;
  numeroOrden?: string;
  lineas: ILineaRemito[];
  notas?: string;
  estado: RemitoEstado;
  createdAt: Date;
}

const LineaRemitoSchema = new Schema<ILineaRemito>(
  {
    codigo: { type: String, default: "" },
    descripcion: { type: String, required: true },
    cantidad: { type: Number, required: true, min: 1 },
    unidad: { type: String, default: "unidad" },
  },
  { _id: false }
);

const RemitoSchema = new Schema<IRemito>(
  {
    numero: { type: String, required: true, unique: true },
    fecha: { type: Date, default: Date.now },
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
    razonSocial: { type: String, required: true },
    presupuestoId: { type: Schema.Types.ObjectId, ref: "Presupuesto" },
    numeroPresupuesto: { type: String, default: "" },
    numeroOrden: { type: String, default: "" },
    lineas: { type: [LineaRemitoSchema], default: [] },
    notas: { type: String, default: "" },
    estado: { type: String, enum: REMITO_ESTADOS, default: "BORRADOR" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Remito =
  (models.Remito as Model<IRemito>) || model<IRemito>("Remito", RemitoSchema);