import mongoose, { Schema, models, model, Model } from "mongoose";
import {
  PROYECTO_PRIORIDADES,
  type ProyectoPrioridad,
  PROYECTO_ESTADOS,
  type ProyectoEstado,
} from "@/lib/proyecto-estados";

// Proyecto de fábrica — se genera automáticamente al ejecutar una Orden de
// Trabajo que necesita fabricar algo (ver lib/fabricacion.ts), o se crea a
// mano para producir stock sin una OT detrás (adelantarse a la demanda).
// Lo usa principalmente el taller, desde la pantalla kiosco
// /fabrica-proyectos (ver fabrica-proyectos/fabrica-proyectos-client.tsx).
//
// Decisiones respecto del original (confirmado leyendo app/(app)/
// proyectos/*, app/fabrica-proyectos/page.tsx y app/api/proyectos/*):
// - Se eliminan los campos "alerta_activa"/"alerta_revision"/
//   "alerta_cambios"/"alerta_confirmada_por" del original. Se los escribe
//   el PUT /api/proyectos/[id] del original al editar prioridad/ítems/
//   notas — pero ESE PUT nunca se llama desde ningún lugar de la UI real
//   (ni /proyectos ni /proyectos/[id] tienen un botón "editar"), y el
//   valor de esos 4 campos tampoco se lee ni se muestra en ningún lado
//   (ni en /proyectos/[id] ni en la pantalla de taller). Es
//   funcionalidad a medio construir en el original: la mitad que falta
//   (confirmar que un operario vio el cambio) nunca se completó. No se
//   replica — si en el futuro hace falta notificar cambios de un
//   proyecto en curso, se construye entera, no a medias.
// - La alerta sonora de "proyecto nuevo" en la pantalla de taller SÍ está
//   realmente conectada (polling + beep) y se replica tal cual.
// - "tomadoPor" ahora es un operario elegido de Empleados activos (no un
//   nombre hardcodeado en el código como en el original: 'Fabio',
//   'Cristian', 'Pajarito') — instrucción explícita de Ariel (2026-11-23).
// - "ordenTrabajoId" es un ObjectId real con `ref: OrdenTrabajo`, mismo
//   criterio que el resto de las referencias nuevas en esta fase.
export interface IProyectoItem {
  id: string;
  modelo: string;
  cantidadSolicitada: number;
  cantidadCompletada: number;
}

export interface IProyecto {
  _id: mongoose.Types.ObjectId;
  numero: string;
  cliente: string;
  nombre?: string;
  fechaObjetivo?: Date;
  prioridad: ProyectoPrioridad;
  notas?: string;
  estado: ProyectoEstado;
  items: IProyectoItem[];
  tomadoPor?: string;
  fechaTomado?: Date;
  fechaListo?: Date;
  ordenTrabajoId?: mongoose.Types.ObjectId;
  numeroOrdenTrabajo?: string;
  createdAt: Date;
}

const ProyectoItemSchema = new Schema<IProyectoItem>(
  {
    id: { type: String, required: true },
    modelo: { type: String, required: true },
    cantidadSolicitada: { type: Number, required: true, min: 1 },
    cantidadCompletada: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const ProyectoSchema = new Schema<IProyecto>(
  {
    numero: { type: String, required: true, unique: true },
    cliente: { type: String, required: true },
    nombre: { type: String, default: "" },
    fechaObjetivo: { type: Date },
    prioridad: { type: String, enum: PROYECTO_PRIORIDADES, default: "NORMAL" },
    notas: { type: String, default: "" },
    estado: { type: String, enum: PROYECTO_ESTADOS, default: "NUEVO" },
    items: { type: [ProyectoItemSchema], default: [] },
    tomadoPor: { type: String, default: "" },
    fechaTomado: { type: Date },
    fechaListo: { type: Date },
    ordenTrabajoId: { type: Schema.Types.ObjectId, ref: "OrdenTrabajo" },
    numeroOrdenTrabajo: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Proyecto =
  (models.Proyecto as Model<IProyecto>) || model<IProyecto>("Proyecto", ProyectoSchema);
