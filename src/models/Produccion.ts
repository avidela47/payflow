import mongoose, { Schema, models, model, Model } from "mongoose";

// Fabricar — séptimo módulo fusionado desde "Gestión de Luminarias" (Fase
// 5, Producción, ver planificacion/fusion-gestion-luminarias.md). No es un
// catálogo editable: es el registro histórico de cada tanda de fabricación
// (quién fabricó qué, cuándo, con qué receta, y qué componentes se
// descontaron) — mismo rol que `MovimientoComponente` para Componentes.
//
// Decisiones respecto del original (confirmado leyendo app/(app)/fabricar/
// page.tsx y app/api/producciones/route.ts):
// - El original SÍ guarda esto (colección `produccions`, con su propio
//   GET /api/producciones) pero nunca lo muestra en ninguna pantalla — ni
//   en el propio formulario de Fabricar ni en otro lado del menú real
//   (confirmado revisando Sidebar.tsx: no hay ítem de menú para esto). Acá
//   se agrega una tabla de historial debajo del formulario de Fabricar —
//   no es un invento de funcionalidad nueva, es mostrar un dato que la app
//   vieja ya calculaba pero dejaba invisible, consistente con que todos
//   los demás módulos de PayFlow sí muestran su propio historial.
// - `id_produccion` del original es `PROD-${año}-${Date.now()}` (puede
//   repetirse si dos fabricaciones caen en el mismo milisegundo, además de
//   no ser prolijo de leer). Acá se reemplaza por el contador atómico
//   `getNextSequence` que ya usa PayFlow para Presupuestos/Clientes, mismo
//   criterio ya aplicado ahí: formato visible parecido, garantía interna
//   más sólida.
// - `operario` se autocompleta de la sesión en vez de texto libre, mismo
//   criterio ya fijado para `MovimientoComponente.usuario`.
// - `componentesDescontados` guarda `componenteId` real (no el string
//   suelto `id_componente` del original) + snapshot de código/descripción/
//   cantidad, mismo patrón ya usado en `Receta.componentes` y en
//   `MovimientoComponente`.
export interface IProduccionComponente {
  componenteId: mongoose.Types.ObjectId;
  codigoComponente: string;
  descripcionComponente: string;
  cantidad: number;
}

export interface IProduccion {
  _id: mongoose.Types.ObjectId;
  numero: string;
  codigoLuminaria: string;
  nombreLuminaria: string;
  versionReceta: number;
  cantidad: number;
  operario: string;
  notas?: string;
  componentesDescontados: IProduccionComponente[];
  createdAt: Date;
}

const ProduccionComponenteSchema = new Schema<IProduccionComponente>(
  {
    componenteId: { type: Schema.Types.ObjectId, ref: "Componente", required: true },
    codigoComponente: { type: String, required: true },
    descripcionComponente: { type: String, required: true },
    cantidad: { type: Number, required: true },
  },
  { _id: false }
);

const ProduccionSchema = new Schema<IProduccion>(
  {
    numero: { type: String, required: true, unique: true },
    codigoLuminaria: { type: String, required: true, uppercase: true, trim: true },
    nombreLuminaria: { type: String, required: true },
    versionReceta: { type: Number, required: true },
    cantidad: { type: Number, required: true, min: 1 },
    operario: { type: String, default: "" },
    notas: { type: String, default: "" },
    componentesDescontados: { type: [ProduccionComponenteSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ProduccionSchema.index({ createdAt: -1 });

export const Produccion =
  (models.Produccion as Model<IProduccion>) || model<IProduccion>("Produccion", ProduccionSchema);
