import mongoose, { Schema, models, model, Model } from "mongoose";
import { IVA_CONDITIONS, type IvaCondition } from "@/lib/iva-conditions";

// Base de datos de proveedores — mismo criterio que Clientes: código
// correlativo autogenerado (PROV-001, PROV-002, ...) y nombre único, para
// evitar cargar el mismo proveedor dos veces con distinta tipeada.
export interface IProvider {
  _id: mongoose.Types.ObjectId;
  codigo: string;
  nombre: string;
  razonSocial?: string;
  cuit?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  localidad?: string;
  provincia?: string;
  contacto?: string;
  condicionIva?: IvaCondition;
  notas?: string;
  createdAt: Date;
}

const ProviderSchema = new Schema<IProvider>(
  {
    codigo: { type: String, required: true, unique: true },
    nombre: { type: String, required: true, unique: true },
    razonSocial: String,
    cuit: String,
    telefono: String,
    email: String,
    direccion: String,
    localidad: String,
    provincia: String,
    contacto: String,
    condicionIva: { type: String, enum: IVA_CONDITIONS },
    notas: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Provider =
  (models.Provider as Model<IProvider>) || model<IProvider>("Provider", ProviderSchema);