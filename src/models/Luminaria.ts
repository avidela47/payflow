import mongoose, { Schema, models, model, Model } from "mongoose";
import { LUMINARIA_ORIGENES, type LuminariaOrigen } from "@/lib/luminaria-origen";

// Segundo módulo fusionado desde "Gestión de Luminarias" (ver
// planificacion/fusion-gestion-luminarias.md). Unifica lo que en esa app
// eran dos colecciones (ProductoTerminado + LuminariaComercial) en un solo
// modelo con "origen". "tieneReceta" queda como dato informativo por ahora
// (true para las fabricadas) — todavía no hay Recetas/Fabricar en PayFlow
// (Fase 4 del plan de fusión), cuando se construya ese módulo este campo
// pasa a tener efecto real (stock automático vía BOM).
//
// IMPORTANTE (aclarado por Ariel): el mismo código puede existir a la vez
// como FABRICADA (con receta, pendiente de fabricar) y como NACIONAL (ya
// fabricada, lista en depósito, sale directo sin pasar por Fabricar) — NO
// son el mismo stock duplicado, son dos estados distintos del mismo
// producto. Por eso el código solo no puede ser único: lo único es la
// combinación (código, origen).
export interface ILuminaria {
  _id: mongoose.Types.ObjectId;
  codigo: string;
  descripcion: string;
  origen: LuminariaOrigen;
  stockActual: number;
  stockMinimo: number;
  precio: number;
  proveedor?: string;
  notas?: string;
  tieneReceta: boolean;
  createdAt: Date;
}

const LuminariaSchema = new Schema<ILuminaria>(
  {
    codigo: { type: String, required: true, uppercase: true, trim: true },
    descripcion: { type: String, required: true, trim: true },
    origen: { type: String, required: true, enum: LUMINARIA_ORIGENES },
    stockActual: { type: Number, default: 0 },
    stockMinimo: { type: Number, default: 0 },
    precio: { type: Number, default: 0 },
    proveedor: { type: String, default: "" },
    notas: { type: String, default: "" },
    tieneReceta: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Único por (código, origen) — no por código solo. Ver nota arriba.
LuminariaSchema.index({ codigo: 1, origen: 1 }, { unique: true });

export const Luminaria =
  (models.Luminaria as Model<ILuminaria>) || model<ILuminaria>("Luminaria", LuminariaSchema);