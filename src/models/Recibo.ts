import mongoose, { Schema, models, model, Model } from "mongoose";
import { RECIBO_ESTADOS, FORMAS_PAGO, type ReciboEstado, type FormaPago } from "@/lib/recibo-estados";

// Cuarto y último módulo de "Comercial Planta" (ver planificacion/fusion-
// gestion-luminarias.md), cierra la Fase 4. Cobro a cliente en U$S, con
// pagos parciales y su propio tipo de cambio a pesos cada uno (igual que
// el original: cada línea de "pagos" guarda el tipo de cambio del día en
// que se cobró, no uno global del recibo).
//
// numeroOrden queda como texto libre, igual criterio que Remito: todavía
// no existe un módulo real de Órdenes de Trabajo en PayFlow.
//
// A diferencia de Despacho/Remito, Recibo no mueve stock ni tiene un flujo
// de aprobación — es simplemente un registro de cobro. No tiene "anular":
// el original tampoco lo tiene, solo permite borrar (ver actions.ts para
// la decisión sobre si eso debería restringirse habiendo pagos).
export interface IPagoRecibo {
  _id: mongoose.Types.ObjectId;
  fecha: Date;
  montoUsd: number;
  tipoCambio: number;
  montoPesos: number;
  formaPago: FormaPago;
  notas?: string;
}

export interface ILineaRecibo {
  descripcion: string;
  montoUsd: number;
}

export interface IRecibo {
  _id: mongoose.Types.ObjectId;
  numero: string;
  fecha: Date;
  clientId?: mongoose.Types.ObjectId;
  razonSocial: string;
  presupuestoId?: mongoose.Types.ObjectId;
  numeroPresupuesto?: string;
  numeroOrden?: string;
  concepto: string;
  lineas: ILineaRecibo[];
  totalUsd: number;
  pagos: IPagoRecibo[];
  totalPagadoUsd: number;
  saldoUsd: number;
  estado: ReciboEstado;
  notas?: string;
  createdAt: Date;
}

const PagoReciboSchema = new Schema<IPagoRecibo>(
  {
    fecha: { type: Date, default: Date.now },
    montoUsd: { type: Number, required: true },
    tipoCambio: { type: Number, required: true },
    montoPesos: { type: Number, required: true },
    formaPago: { type: String, required: true, enum: FORMAS_PAGO },
    notas: { type: String, default: "" },
  },
  { _id: true }
);

const LineaReciboSchema = new Schema<ILineaRecibo>(
  {
    descripcion: { type: String, required: true },
    montoUsd: { type: Number, required: true },
  },
  { _id: false }
);

const ReciboSchema = new Schema<IRecibo>(
  {
    numero: { type: String, required: true, unique: true },
    fecha: { type: Date, default: Date.now },
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
    razonSocial: { type: String, required: true },
    presupuestoId: { type: Schema.Types.ObjectId, ref: "Presupuesto" },
    numeroPresupuesto: { type: String, default: "" },
    numeroOrden: { type: String, default: "" },
    concepto: { type: String, required: true },
    lineas: { type: [LineaReciboSchema], default: [] },
    totalUsd: { type: Number, required: true },
    pagos: { type: [PagoReciboSchema], default: [] },
    totalPagadoUsd: { type: Number, default: 0 },
    saldoUsd: { type: Number, default: 0 },
    estado: { type: String, enum: RECIBO_ESTADOS, default: "PENDIENTE" },
    notas: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Recibo =
  (models.Recibo as Model<IRecibo>) || model<IRecibo>("Recibo", ReciboSchema);