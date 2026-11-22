import mongoose, { Schema, models, model, Model } from "mongoose";
import { COMPONENTE_UNIDADES, type ComponenteUnidad } from "@/lib/componente-unidades";

// Quinto módulo fusionado desde "Gestión de Luminarias" (Fase 5 —
// Producción, ver planificacion/fusion-gestion-luminarias.md). Son las
// piezas con las que se fabrican las Luminarias (a diferencia de
// Materiales de Obra, que es para instalaciones).
//
// Decisiones respecto del original:
// - "nombre" -> "descripcion", para quedar igual al resto de los catálogos
//   de planta (Luminaria, Material, SensorFuente).
// - Sin "activo"/soft-delete: acá se borra de verdad, mismo criterio ya
//   fijado para Sensores/Luminarias/Materiales/Proveedores/Clientes (ver
//   comentario en SensorFuente.ts). El original no borraba nunca de verdad
//   (DELETE era activo:false) porque Componentes se referencia desde
//   Recetas — cuando se construya ese módulo (Fase 5, más adelante), el
//   borrado de un Componente usado en una Receta se bloquea ahí, igual
//   patrón que ya se usó con Recibos (no se puede borrar si tiene pagos).
// - "foto": mismo mecanismo que Employee.foto (archivo subido a
//   public/uploads/componentes/, ver actions.ts).
export interface IComponente {
  _id: mongoose.Types.ObjectId;
  codigo: string;
  descripcion: string;
  unidad: ComponenteUnidad;
  stockActual: number;
  stockMinimo: number;
  proveedor?: string;
  precio: number;
  ubicacion?: string;
  notas?: string;
  foto?: string;
  createdAt: Date;
}

const ComponenteSchema = new Schema<IComponente>(
  {
    codigo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    descripcion: { type: String, required: true, trim: true },
    unidad: { type: String, required: true, enum: COMPONENTE_UNIDADES, default: "UNIDAD" },
    stockActual: { type: Number, default: 0 },
    stockMinimo: { type: Number, default: 0 },
    proveedor: { type: String, default: "" },
    precio: { type: Number, default: 0 },
    ubicacion: { type: String, default: "" },
    notas: { type: String, default: "" },
    foto: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Componente =
  (models.Componente as Model<IComponente>) || model<IComponente>("Componente", ComponenteSchema);