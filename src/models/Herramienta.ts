import mongoose, { Schema, models, model, Model } from "mongoose";
import { HERRAMIENTA_ESTADOS, type HerramientaEstado } from "@/lib/herramienta-estados";

// Tercer módulo fusionado desde "Gestión de Luminarias" (ver
// planificacion/fusion-gestion-luminarias.md en el proyecto). Arranca sin
// datos para migrar (0 docs en la colección original) pero igual se
// construye con CRUD completo porque se va a usar desde ya. A diferencia
// de Sensores/Luminarias/Materiales, acá el stock no es "cuánto hay" sino
// "cuántas están prestadas" — cantidadTotal vs cantidadDisponible — y un
// estado manual (sin automatismo de préstamo/devolución todavía).
export interface IHerramienta {
  _id: mongoose.Types.ObjectId;
  codigo: string;
  nombre: string;
  descripcion?: string;
  cantidadTotal: number;
  cantidadDisponible: number;
  estado: HerramientaEstado;
  ubicacion?: string;
  notas?: string;
  createdAt: Date;
}

const HerramientaSchema = new Schema<IHerramienta>(
  {
    codigo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, default: "" },
    cantidadTotal: { type: Number, default: 1 },
    cantidadDisponible: { type: Number, default: 1 },
    estado: { type: String, required: true, enum: HERRAMIENTA_ESTADOS, default: "DISPONIBLE" },
    ubicacion: { type: String, default: "" },
    notas: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Herramienta =
  (models.Herramienta as Model<IHerramienta>) ||
  model<IHerramienta>("Herramienta", HerramientaSchema);