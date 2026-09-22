import mongoose, { Schema, models, model, Model } from "mongoose";
import { IVA_CONDITIONS, type IvaCondition } from "@/lib/iva-conditions";

// Base de datos de clientes de ITELSA — compartida entre OWNER y
// ACCOUNTANT (igual que Empleados/Cheques/Agenda), sin código manual: el
// _id de Mongo alcanza como identificador interno.
export interface IClient {
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

const ClientSchema = new Schema<IClient>(
  {
    // Código correlativo autogenerado (CLI-001, CLI-002, ...) — ver
    // getNextSequence en @/models/Counter. Nunca se edita desde el
    // formulario: es una referencia fija que no cambia aunque el nombre
    // se corrija más adelante.
    codigo: { type: String, required: true, unique: true },
    // `unique: true` acá (no solo validado en la action) porque la
    // garantía real tiene que vivir en la base — dos altas casi
    // simultáneas podrían pasar la validación de la action antes de que
    // cualquiera de las dos llegue a insertarse. `nombre` siempre se
    // normaliza a MAYÚSCULA en clientes/actions.ts antes de guardar, así
    // que este índice ya cubre variantes de mayúscula/minúscula sin
    // necesitar una collation especial.
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

// (No hace falta un ClientSchema.index({ nombre: 1 }) aparte: el
// `unique: true` de arriba ya crea ese índice.)

export const Client =
  (models.Client as Model<IClient>) || model<IClient>("Client", ClientSchema);