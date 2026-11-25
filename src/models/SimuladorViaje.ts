import mongoose, { Schema, models, model, Model } from "mongoose";

// Simulador de viajes — distinto del Viatico (que registra el viaje ya
// decidido: honorarios, hospedaje, extras...). Acá se simulan las COMPRAS/
// FACTURAS de proveedores antes de cerrar el viaje (vuelos, hospedaje,
// seguros...), para comparar opciones y ver cuánto y cuándo hay que pagar.
// No se linkea a un Viatico puntual a propósito (2026-11-25, Ariel): es una
// lista propia de simulaciones, independiente de los viajes ya cargados.
//
// Mismo patrón de "pagos parciales" que IViaticoEmpleado.pagos: cada ítem
// tiene su propia lista de pagos a cuenta del total (neto + iva), y el
// saldo (total - pagado) define el estado — Pendiente / Parcial / Pagado.
export const SIM_PAYMENT_MODES = ["TARJETA", "EFECTIVO", "DEBITO", "TRANSFERENCIA"] as const;
export type SimPaymentMode = (typeof SIM_PAYMENT_MODES)[number];

export interface ISimPago {
  monto: number;
  fecha: Date;
}

export interface ISimItem {
  proveedor: string;
  fechaCompra?: Date;
  fechaFactura?: Date;
  neto: number;
  iva: number;
  formaPago?: SimPaymentMode;
  fechaPago?: Date;
  // Pagos parciales hechos a cuenta del total (neto + iva) de este ítem.
  pagos: ISimPago[];
}

export interface ISimuladorViaje {
  _id: mongoose.Types.ObjectId;
  // Nombre/etiqueta de la simulación — ej: "Córdoba - cotizando vuelos".
  nombre: string;
  items: ISimItem[];
  notes?: string;
  createdAt: Date;
}

const SimPagoSchema = new Schema<ISimPago>(
  {
    monto: { type: Number, required: true },
    fecha: { type: Date, required: true },
  },
  { _id: false }
);

const SimItemSchema = new Schema<ISimItem>(
  {
    proveedor: { type: String, required: true },
    fechaCompra: Date,
    fechaFactura: Date,
    neto: { type: Number, required: true, default: 0 },
    iva: { type: Number, required: true, default: 0 },
    formaPago: { type: String, enum: SIM_PAYMENT_MODES },
    fechaPago: Date,
    pagos: { type: [SimPagoSchema], default: [] },
  },
  { _id: false }
);

const SimuladorViajeSchema = new Schema<ISimuladorViaje>({
  nombre: { type: String, required: true },
  items: { type: [SimItemSchema], default: [] },
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

SimuladorViajeSchema.index({ createdAt: -1 });

export const SimuladorViaje =
  (models.SimuladorViaje as Model<ISimuladorViaje>) || model<ISimuladorViaje>("SimuladorViaje", SimuladorViajeSchema);
