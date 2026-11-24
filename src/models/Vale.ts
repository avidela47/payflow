import mongoose, { Schema, models, model, Model } from "mongoose";
import { VALE_ESTADOS, VALE_ITEM_TIPOS, type ValeEstado, type ValeItemTipo } from "@/lib/vale-estados";

// Vale — préstamo interno de herramientas/stock/otros ítems, último
// módulo de Fase 6 (ver planificacion/fusion-gestion-luminarias.md).
// Confirmado por Ariel con captura de sistema-fabrica.itelsasas.com/vales:
// pertenece a Producción, no a Comercial.
//
// Decisión tomada con Ariel antes de escribir código (preguntada porque el
// original tiene acá una lógica real de negocio, no solo presentación): el
// original, al registrar una devolución, intenta descontar stock de
// Componente buscándolo por coincidencia de TEXTO LIBRE contra la
// descripción del ítem (no por código real) — y si hay varias devoluciones
// parciales del mismo vale, lo vuelve a descontar cada vez sin chequear si
// ya lo había hecho antes (bug real de doble descuento). Ariel eligió NO
// replicar esa lógica: acá Vale es una ficha de control pura — registra
// salida, devolución parcial/total y qué faltó, pero no mueve stock de
// ningún catálogo. Si algo no vuelve y hay que reponerlo de verdad, se
// ajusta a mano desde Movimientos de Componentes, como cualquier otro
// ajuste real.
//
// "items[].descripcion" sigue siendo texto libre, igual que el original:
// un Vale no referencia un Componente/Herramienta/Luminaria real por
// _id — "tipo" es solo una etiqueta informativa para saber a qué
// catálogo pertenecía lo prestado, no una referencia.
//
// "estado" se recalcula solo a partir de los ítems (ver actions.ts,
// registrarDevolucionVale) — nunca se setea a mano: ABIERTO (nada
// devuelto) → DEVOLUCION_PARCIAL (algo devuelto, no todo) → CERRADO (todo
// devuelto). Es monótono: una vez que algo se devolvió, no puede volver a
// ABIERTO.
export interface IItemVale {
  descripcion: string;
  cantidadSalida: number;
  cantidadDevuelta: number;
  tipo: ValeItemTipo;
  notas?: string;
}

export interface IVale {
  _id: mongoose.Types.ObjectId;
  numero: string;
  fechaSalida: Date;
  fechaDevolucion?: Date;
  responsable: string;
  emitidoPor: string;
  estado: ValeEstado;
  items: IItemVale[];
  observacionesSalida?: string;
  observacionesDevolucion?: string;
  createdAt: Date;
}

const ItemValeSchema = new Schema<IItemVale>(
  {
    descripcion: { type: String, required: true, trim: true },
    cantidadSalida: { type: Number, required: true, min: 1 },
    cantidadDevuelta: { type: Number, default: 0, min: 0 },
    tipo: { type: String, enum: VALE_ITEM_TIPOS, default: "OTRO" },
    notas: { type: String, default: "" },
  },
  { _id: false }
);

const ValeSchema = new Schema<IVale>(
  {
    numero: { type: String, required: true, unique: true },
    fechaSalida: { type: Date, default: Date.now },
    fechaDevolucion: { type: Date },
    responsable: { type: String, required: true, trim: true },
    emitidoPor: { type: String, default: "" },
    estado: { type: String, enum: VALE_ESTADOS, default: "ABIERTO" },
    items: { type: [ItemValeSchema], default: [] },
    observacionesSalida: { type: String, default: "" },
    observacionesDevolucion: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Vale = (models.Vale as Model<IVale>) || model<IVale>("Vale", ValeSchema);
