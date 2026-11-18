import mongoose, { Schema, models, model, Model } from "mongoose";
import { PRESUPUESTO_ESTADOS, type PresupuestoEstado } from "@/lib/presupuesto-estados";

// Primer módulo de "Comercial" en la fusión con Gestión de Luminarias
// (ver planificacion/fusion-gestion-luminarias.md). Snapshot de los datos
// del cliente (razonSocial, cuit, dirección, etc.) copiados al crear —
// igual que el original: un presupuesto impreso/enviado tiene que seguir
// mostrando los datos tal como eran ese día, aunque el cliente cambie de
// dirección o condición de IVA después. clientId queda como referencia
// para filtrar/prellenar, no reemplaza el snapshot.
export interface ILineaPresupuesto {
  codigo: string;
  descripcion: string;
  cantidad: number;
  bonificacion: number;
  precioUnitario: number;
  precioTotal: number;
  plazoEntregaLinea?: string;
}

export interface IPresupuesto {
  _id: mongoose.Types.ObjectId;
  numero: string;
  fecha: Date;
  validezDias: number;
  vendedor: string;
  clientId?: mongoose.Types.ObjectId;
  razonSocial: string;
  cuit?: string;
  direccion?: string;
  localidad?: string;
  telefono?: string;
  email?: string;
  atencion?: string;
  condicionIva?: string;
  lineas: ILineaPresupuesto[];
  moneda: string;
  subtotal: number;
  iva: number;
  total: number;
  formaPago?: string;
  plazoEntrega?: string;
  cotizacion?: string;
  comentario?: string;
  estado: PresupuestoEstado;
  notas?: string;
  createdAt: Date;
}

const LineaPresupuestoSchema = new Schema<ILineaPresupuesto>(
  {
    codigo: { type: String, default: "" },
    descripcion: { type: String, required: true },
    cantidad: { type: Number, required: true, min: 1 },
    bonificacion: { type: Number, default: 0 },
    precioUnitario: { type: Number, required: true },
    precioTotal: { type: Number, required: true },
    plazoEntregaLinea: { type: String, default: "" },
  },
  { _id: false }
);

const PresupuestoSchema = new Schema<IPresupuesto>(
  {
    numero: { type: String, required: true, unique: true },
    fecha: { type: Date, default: Date.now },
    validezDias: { type: Number, default: 5 },
    vendedor: { type: String, default: "" },
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
    razonSocial: { type: String, required: true },
    cuit: { type: String, default: "" },
    direccion: { type: String, default: "" },
    localidad: { type: String, default: "" },
    telefono: { type: String, default: "" },
    email: { type: String, default: "" },
    atencion: { type: String, default: "" },
    condicionIva: { type: String, default: "" },
    lineas: { type: [LineaPresupuestoSchema], default: [] },
    moneda: { type: String, default: "U$D" },
    subtotal: { type: Number, default: 0 },
    iva: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    formaPago: { type: String, default: "" },
    plazoEntrega: { type: String, default: "" },
    cotizacion: { type: String, default: "" },
    comentario: { type: String, default: "" },
    estado: { type: String, enum: PRESUPUESTO_ESTADOS, default: "BORRADOR" },
    notas: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Presupuesto =
  (models.Presupuesto as Model<IPresupuesto>) ||
  model<IPresupuesto>("Presupuesto", PresupuestoSchema);