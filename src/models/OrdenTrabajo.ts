import mongoose, { Schema, models, model, Model } from "mongoose";
import { ORDEN_TRABAJO_ESTADOS, type OrdenTrabajoEstado } from "@/lib/orden-trabajo-estados";

// Órdenes de Trabajo — octavo módulo fusionado desde "Gestión de
// Luminarias" (Fase 5, Producción, ver planificacion/fusion-gestion-
// luminarias.md). Se construye junto con Proyecto/ProyectoAvance por el
// acoplamiento real que tiene con Producción: su acción "ejecutar" revisa
// stock por línea y, si falta fabricar algo, genera automáticamente un
// Proyecto de fábrica (ver lib/fabricacion.ts y proyectos/actions.ts).
//
// Decisiones respecto del original (confirmado leyendo page.tsx/crear/
// [id] y app/api/ordenes/*):
// - "estado" en mayúsculas (PENDIENTE/EN_FABRICA/EN_PROCESO) en vez de
//   'Pendiente'/'En fábrica'/'En proceso' — mismo criterio ya aplicado en
//   Presupuesto/Despacho (APROBADO, DESPACHADO, etc.). El original tiene
//   además 'Completada'/'Cancelada' en el enum pero NINGÚN código los
//   asigna nunca — no se replican, son valores muertos.
// - "clienteId" es un ObjectId real con `ref: Client` + snapshot de
//   razonSocial, igual patrón que Despacho/Remito/Recibo — el original usa
//   un "id_cliente" de texto suelto (su propia clave de negocio, no un
//   _id de Mongo).
// - "presupuestoId" es un ObjectId real con `ref: Presupuesto`, mismo
//   criterio.
// - "vendedor" se autocompleta de la sesión al crear (snapshot, no se
//   recalcula después) en vez de una constante fija (`EMPRESA.
//   vendedor_default` en el original) — mismo criterio ya aplicado a
//   "usuario"/"operario" en Componentes/Fabricar.
// - "itemsDescontados" es un snapshot informativo de lo que se tomaría de
//   stock al ejecutar (no descuenta nada realmente — el descuento de
//   verdad pasa a existir en PayFlow al confirmar un Despacho, ver
//   despachos/actions.ts). Mismo rol que "items_descontados" en el
//   original.
// - Borrado: SOLO permitido en PENDIENTE (igual que el original, que
//   además intenta "devolver stock" al borrar una OT ya ejecutada —
//   leyendo bien el código, ese bloque es inalcanzable: la UI nunca
//   muestra el botón "Eliminar" para una OT ejecutada, y además el stock
//   nunca se descontó al ejecutar en primer lugar, así que esa rama
//   hubiera inflado stock de la nada si alguna vez se llamaba. No se
//   replica — ver nota en ordenes/actions.ts).
export interface ILineaOrdenTrabajo {
  codigoLuminaria: string;
  descripcion: string;
  cantidad: number;
}

export interface IItemDescontadoOT {
  codigo: string;
  origen: string;
  cantidad: number;
}

export interface IOrdenTrabajo {
  _id: mongoose.Types.ObjectId;
  numero: string;
  fecha: Date;
  fechaEntrega?: Date;
  clienteId?: mongoose.Types.ObjectId;
  razonSocial: string;
  presupuestoId?: mongoose.Types.ObjectId;
  numeroPresupuesto?: string;
  vendedor: string;
  lineas: ILineaOrdenTrabajo[];
  estado: OrdenTrabajoEstado;
  notas?: string;
  ejecutada: boolean;
  fechaEjecucion?: Date;
  itemsDescontados: IItemDescontadoOT[];
  proyectoFabricaId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const LineaOrdenTrabajoSchema = new Schema<ILineaOrdenTrabajo>(
  {
    codigoLuminaria: { type: String, required: true, uppercase: true, trim: true },
    descripcion: { type: String, required: true },
    cantidad: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const ItemDescontadoOTSchema = new Schema<IItemDescontadoOT>(
  {
    codigo: { type: String, required: true },
    origen: { type: String, required: true },
    cantidad: { type: Number, required: true },
  },
  { _id: false }
);

const OrdenTrabajoSchema = new Schema<IOrdenTrabajo>(
  {
    numero: { type: String, required: true, unique: true },
    fecha: { type: Date, default: Date.now },
    fechaEntrega: { type: Date },
    clienteId: { type: Schema.Types.ObjectId, ref: "Client" },
    razonSocial: { type: String, required: true },
    presupuestoId: { type: Schema.Types.ObjectId, ref: "Presupuesto" },
    numeroPresupuesto: { type: String, default: "" },
    vendedor: { type: String, default: "" },
    lineas: { type: [LineaOrdenTrabajoSchema], default: [] },
    estado: { type: String, enum: ORDEN_TRABAJO_ESTADOS, default: "PENDIENTE" },
    notas: { type: String, default: "" },
    ejecutada: { type: Boolean, default: false },
    fechaEjecucion: { type: Date },
    itemsDescontados: { type: [ItemDescontadoOTSchema], default: [] },
    proyectoFabricaId: { type: Schema.Types.ObjectId, ref: "Proyecto" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const OrdenTrabajo =
  (models.OrdenTrabajo as Model<IOrdenTrabajo>) ||
  model<IOrdenTrabajo>("OrdenTrabajo", OrdenTrabajoSchema);
