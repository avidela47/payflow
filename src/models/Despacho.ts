import mongoose, { Schema, models, model, Model } from "mongoose";
import { DESPACHO_ESTADOS, type DespachoEstado } from "@/lib/despacho-estados";
import { LUMINARIA_ORIGENES, type LuminariaOrigen } from "@/lib/luminaria-origen";

// Tercer módulo de "Comercial Planta" (ver planificacion/fusion-gestion-
// luminarias.md). Despacho SÍ mueve stock — a diferencia de Remito, que es
// pura papelería de entrega — pero solo de Luminarias (Fabricada/Nacional/
// Importada): Ariel confirmó que no interviene Sensores y Fuentes.
//
// Momento del descuento (confirmado por Ariel 2026-11-18, corrige la
// decisión anterior): NO se descuenta al crear (queda "PENDIENTE"), se
// descuenta recién al confirmar la entrega ("DESPACHADO") y se restaura
// al anular. El original tenía un bug acá (descontaba al crear, de forma
// incompleta, y "anular" en los hechos no restauraba nada real porque
// solo tocaba un tipo de ítem que la UI nunca generaba) — la lógica de
// descuento/restauración vive en actions.ts, no acá.
//
// "origen" reemplaza el "tipo" (fabricada/comercial/deposito) del
// original: como Fabricada/Nacional/Importada ya están unificadas en el
// modelo Luminaria (Fase 2), cada ítem de despacho referencia
// directamente ese mismo campo.
//
// reparacionId/numeroReparacion (2026-11-23): Despacho nunca tuvo un
// vínculo a OrdenTrabajo tampoco — a diferencia de Remito/Recibo, el
// vínculo real de Despacho con lo que se fabricó es implícito (los
// códigos de Luminaria ya identifican el stock). Para Reparación se
// agrega este campo igual para trazabilidad, pero las LÍNEAS de una
// unidad reparada no son stock de Luminaria — nunca deben descontar
// nada. Por eso una unidad reparada entra como ítem con
// fueraDeCatalogo=true (mecanismo que ya existía para "se hizo en el
// momento, no está en el catálogo"): confirmarDespacho/anularDespacho ya
// las saltan por completo. Confirmado por Ariel con un caso real: manda
// a reparar 5 unidades, 3 vuelven reparadas (fueraDeCatalogo) y 2 se
// fabrican de nuevo (ítems de catálogo normales, posiblemente de una OT)
// — todo sale junto en el mismo Despacho.
export interface IItemDespacho {
  codigo: string;
  descripcion: string;
  origen: LuminariaOrigen;
  cantidad: number;
  precioUnitario?: number;
  // Ariel (2026-11-20): a veces se despacha algo que se hizo "en el
  // momento" — no está en el catálogo de Luminaria (fue el caso real de
  // CHAP-E en DESP-2026-0005, migrado antes de que existiera esta
  // bandera). Un ítem con fueraDeCatalogo=true no participa del control
  // de stock: confirmarDespacho/anularDespacho lo saltan por completo
  // (ni bloquea por "stock insuficiente" ni mueve nada de Luminaria).
  fueraDeCatalogo?: boolean;
}

export interface IDespacho {
  _id: mongoose.Types.ObjectId;
  numero: string;
  fecha: Date;
  clientId?: mongoose.Types.ObjectId;
  razonSocial: string;
  presupuestoId?: mongoose.Types.ObjectId;
  numeroPresupuesto?: string;
  reparacionId?: mongoose.Types.ObjectId;
  numeroReparacion?: string;
  items: IItemDespacho[];
  observaciones?: string;
  estado: DespachoEstado;
  createdAt: Date;
}

const ItemDespachoSchema = new Schema<IItemDespacho>(
  {
    codigo: { type: String, required: true, uppercase: true, trim: true },
    descripcion: { type: String, required: true },
    origen: { type: String, required: true, enum: LUMINARIA_ORIGENES },
    cantidad: { type: Number, required: true, min: 1 },
    precioUnitario: { type: Number, default: 0 },
    fueraDeCatalogo: { type: Boolean, default: false },
  },
  { _id: false }
);

const DespachoSchema = new Schema<IDespacho>(
  {
    numero: { type: String, required: true, unique: true },
    fecha: { type: Date, default: Date.now },
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
    razonSocial: { type: String, required: true },
    presupuestoId: { type: Schema.Types.ObjectId, ref: "Presupuesto" },
    numeroPresupuesto: { type: String, default: "" },
    reparacionId: { type: Schema.Types.ObjectId, ref: "Reparacion" },
    numeroReparacion: { type: String, default: "" },
    items: { type: [ItemDespachoSchema], default: [] },
    observaciones: { type: String, default: "" },
    estado: { type: String, enum: DESPACHO_ESTADOS, default: "PENDIENTE" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Despacho =
  (models.Despacho as Model<IDespacho>) || model<IDespacho>("Despacho", DespachoSchema);