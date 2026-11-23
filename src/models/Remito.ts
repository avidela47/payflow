import mongoose, { Schema, models, model, Model } from "mongoose";
import { REMITO_ESTADOS, type RemitoEstado } from "@/lib/remito-estados";

// Segundo módulo de "Comercial Planta" (ver planificacion/fusion-gestion-
// luminarias.md). Documento de entrega pura — nunca mueve stock (eso lo
// hace Despacho) ni tiene montos (es papelería, no factura), igual que el
// original. No es editable después de creado: solo cambia de estado o se
// borra, igual que el original (que tampoco tiene una pantalla de editar
// remito).
//
// numeroOrden ahora es el snapshot de texto de una Orden de Trabajo real
// (ref OrdenTrabajo vía ordenTrabajoId), conectado el 2026-11-23 — mismo
// patrón que presupuestoId/numeroPresupuesto.
//
// numeroReparacion: mismo patrón, agregado el mismo día — Ariel confirmó
// que Reparación sigue el mismo circuito que OT/Fabricar y termina en
// Remito/Despacho. NO es excluyente con ordenTrabajoId: un mismo Remito
// puede llevar unidades reparadas y unidades nuevas de una OT mezcladas
// (ejemplo real de Ariel: "mandan a reparar 5, 3 tienen reparación y 2 se
// las harán de nuevas" — todo sale junto).
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
  ordenTrabajoId?: mongoose.Types.ObjectId;
  numeroOrden?: string;
  reparacionId?: mongoose.Types.ObjectId;
  numeroReparacion?: string;
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
    ordenTrabajoId: { type: Schema.Types.ObjectId, ref: "OrdenTrabajo" },
    numeroOrden: { type: String, default: "" },
    reparacionId: { type: Schema.Types.ObjectId, ref: "Reparacion" },
    numeroReparacion: { type: String, default: "" },
    lineas: { type: [LineaRemitoSchema], default: [] },
    notas: { type: String, default: "" },
    estado: { type: String, enum: REMITO_ESTADOS, default: "BORRADOR" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Remito =
  (models.Remito as Model<IRemito>) || model<IRemito>("Remito", RemitoSchema);