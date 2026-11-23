import mongoose, { Schema, models, model, Model } from "mongoose";
import { REPARACION_ESTADOS, type ReparacionEstado } from "@/lib/reparacion-estados";

// Módulo nuevo, pedido por Ariel el 2026-11-23 — NO existe en "Gestión de
// Luminarias" (no está en la lista de colecciones reales de Mongo del
// original, ver planificacion/fusion-gestion-luminarias.md), así que no
// hay página de referencia que mirrorear. Diseño acordado con Ariel antes
// de escribir código:
//
// - Se carga el Cliente, se hace un Presupuesto, y al aprobarse se crea
//   una Reparación — mismo circuito que Orden de Trabajo (de ahí que sea
//   un modelo PROPIO que funciona igual, no una reutilización de
//   OrdenTrabajo con un campo "tipo": Ariel pidió explícitamente un
//   modelo aparte llamado "Reparacion").
// - La luminaria que entra a reparar es DEL CLIENTE, no es stock de
//   ITELSA — por eso, a diferencia de OrdenTrabajo, "lineas" no matchea
//   contra el catálogo de Luminaria (no hay chequeo de stock ni
//   generación de Proyecto de fábrica) y nunca se descuenta/suma stock
//   de Luminaria en ningún momento del circuito.
// - Lo único que de verdad se descuenta es Componentes, y a mano: Ariel
//   confirmó que NO es por Receta (no todas las reparaciones de una
//   misma luminaria gastan lo mismo) — se elige caso por caso al
//   ejecutar (ver actions.ts, ejecutarReparacion). Se registra en
//   MovimientoComponente con tipo "SALIDA_REPARACION" (agregado a
//   movimiento-componente-tipos.ts), mismo criterio que "SALIDA_PRODUCCION"
//   para Fabricar: reservado para esta lógica, no elegible a mano desde
//   el formulario de Movimientos de Componentes.
// - "estado" en mayúsculas (PENDIENTE/EN_PROCESO) — mismo criterio que el
//   resto de la fusión. Sin "EN_FABRICA": no aplica, no hay Proyecto de
//   fábrica en este circuito.
// - "clienteId"/"presupuestoId" son ObjectId reales con `ref`, mismo
//   patrón que OrdenTrabajo/Despacho/Remito/Recibo.
// - Numeración propia `REP-AAAA-NNNN` vía un segundo contador atómico
//   ("reparacion"), mismo criterio que Fabricar con "PROD-".
// - Borrado: solo en PENDIENTE, sin ejecutar — mismo criterio que
//   OrdenTrabajo.
export interface ILineaReparacion {
  codigoLuminaria?: string;
  descripcion: string;
  cantidad: number;
}

export interface IComponenteDescontadoReparacion {
  componenteId: mongoose.Types.ObjectId;
  codigoComponente: string;
  descripcionComponente: string;
  cantidad: number;
}

export interface IReparacion {
  _id: mongoose.Types.ObjectId;
  numero: string;
  fecha: Date;
  fechaEntrega?: Date;
  clienteId?: mongoose.Types.ObjectId;
  razonSocial: string;
  presupuestoId?: mongoose.Types.ObjectId;
  numeroPresupuesto?: string;
  vendedor: string;
  lineas: ILineaReparacion[];
  estado: ReparacionEstado;
  notas?: string;
  ejecutada: boolean;
  fechaEjecucion?: Date;
  componentesDescontados: IComponenteDescontadoReparacion[];
  createdAt: Date;
}

const LineaReparacionSchema = new Schema<ILineaReparacion>(
  {
    codigoLuminaria: { type: String, trim: true, default: "" },
    descripcion: { type: String, required: true },
    cantidad: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const ComponenteDescontadoReparacionSchema = new Schema<IComponenteDescontadoReparacion>(
  {
    componenteId: { type: Schema.Types.ObjectId, ref: "Componente", required: true },
    codigoComponente: { type: String, required: true },
    descripcionComponente: { type: String, required: true },
    cantidad: { type: Number, required: true },
  },
  { _id: false }
);

const ReparacionSchema = new Schema<IReparacion>(
  {
    numero: { type: String, required: true, unique: true },
    fecha: { type: Date, default: Date.now },
    fechaEntrega: { type: Date },
    clienteId: { type: Schema.Types.ObjectId, ref: "Client" },
    razonSocial: { type: String, required: true },
    presupuestoId: { type: Schema.Types.ObjectId, ref: "Presupuesto" },
    numeroPresupuesto: { type: String, default: "" },
    vendedor: { type: String, default: "" },
    lineas: { type: [LineaReparacionSchema], default: [] },
    estado: { type: String, enum: REPARACION_ESTADOS, default: "PENDIENTE" },
    notas: { type: String, default: "" },
    ejecutada: { type: Boolean, default: false },
    fechaEjecucion: { type: Date },
    componentesDescontados: { type: [ComponenteDescontadoReparacionSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Reparacion =
  (models.Reparacion as Model<IReparacion>) || model<IReparacion>("Reparacion", ReparacionSchema);
