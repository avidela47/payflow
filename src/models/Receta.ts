import mongoose, { Schema, models, model, Model } from "mongoose";

// Recetas (BOM) — sexto módulo fusionado desde "Gestión de Luminarias"
// (Fase 5, Producción, ver planificacion/fusion-gestion-luminarias.md).
// Es la composición de Componentes con la que se arma cada Luminaria
// FABRICADA (el código de la Receta coincide con el de esa Luminaria).
//
// Decisiones respecto del original (confirmado leyendo page.tsx,
// ModalReceta.tsx y app/api/recetas/*):
// - "componentes[].id_componente" del original es el código del Componente
//   como texto suelto, sin relación real en Mongo. Acá se guarda
//   "componenteId" (referencia real a Componente) + un snapshot de
//   código/descripción para no depender de populate al listar — mismo
//   patrón ya usado en MovimientoComponente.
// - "activa" SE MANTIENE como campo de estado real (el propio formulario
//   original ya lo expone como "Activa/Inactiva", independiente de
//   borrar) — no es solo un flag de soft-delete.
// - Borrado: acá se borra de verdad (DELETE), a diferencia del original,
//   que en realidad nunca borraba — su DELETE solo ponía activa:false,
//   indistinguible de que alguien la hubiera marcado "Inactiva" a mano
//   desde el propio formulario, sin forma de verlo ni recuperarlo. Mismo
//   criterio ya fijado para Sensores/Luminarias/Materiales/Proveedores/
//   Clientes. Por ahora nada en PayFlow referencia una Receta (Fabricar
//   todavía no existe) así que no hace falta bloquear el borrado — cuando
//   se construya Fabricar, se revisa si hace falta un bloqueo ahí, mismo
//   patrón que Recibos/pagos y Componentes/movimientos.
// - "version"/"fechaVersion": igual que el original, solo se incrementan
//   cuando cambia el array de componentes (ver actions.ts) — no en
//   cualquier edición.
// - "foto": mismo mecanismo que Componente.foto — archivo subido a
//   public/uploads/recetas/ para las nuevas; las migradas del original
//   mantienen su URL externa tal cual (no se migra ningún archivo).
export interface IRecetaComponente {
  componenteId: mongoose.Types.ObjectId;
  codigoComponente: string;
  descripcionComponente: string;
  cantidad: number;
}

export interface IReceta {
  _id: mongoose.Types.ObjectId;
  codigo: string;
  nombre: string;
  version: number;
  fechaVersion: Date;
  activa: boolean;
  componentes: IRecetaComponente[];
  notas?: string;
  foto?: string;
  createdAt: Date;
}

const RecetaComponenteSchema = new Schema<IRecetaComponente>(
  {
    componenteId: { type: Schema.Types.ObjectId, ref: "Componente", required: true },
    codigoComponente: { type: String, required: true },
    descripcionComponente: { type: String, required: true },
    cantidad: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const RecetaSchema = new Schema<IReceta>(
  {
    codigo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    version: { type: Number, default: 1 },
    fechaVersion: { type: Date, default: Date.now },
    activa: { type: Boolean, default: true },
    componentes: { type: [RecetaComponenteSchema], default: [] },
    notas: { type: String, default: "" },
    foto: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Receta =
  (models.Receta as Model<IReceta>) || model<IReceta>("Receta", RecetaSchema);
