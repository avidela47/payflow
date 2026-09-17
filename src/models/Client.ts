import mongoose, { Schema, models, model, Model } from "mongoose";
import { IVA_CONDITIONS, type IvaCondition } from "@/lib/iva-conditions";

// Base de datos de clientes de ITELSA — compartida entre OWNER y
// ACCOUNTANT (igual que Empleados/Cheques/Agenda), sin código manual: el
// _id de Mongo alcanza como identificador interno.
export interface IClient {
  _id: mongoose.Types.ObjectId;
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

const ClientSchema = new Schema<IClient>(
  {
    nombre: { type: String, required: true },
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

ClientSchema.index({ nombre: 1 });

export const Client =
  (models.Client as Model<IClient>) || model<IClient>("Client", ClientSchema);