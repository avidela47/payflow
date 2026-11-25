import mongoose, { Schema, models, model, Model } from "mongoose";

// Categoría impositiva/laboral de fondo.
export type EmployeeCategory = "MONOTRIBUTISTA" | "EMPLEADO";

// Forma de cálculo del pago. Solo tiene sentido dentro de EMPLEADO — un
// Monotributista factura un monto, no "horas".
export type PaymentType = "FIJO" | "POR_HORA";

// Documentos adjuntos de la ficha (DNI, contrato, certificados...) — a
// diferencia de `foto` (un único archivo que se reemplaza), acá se van
// acumulando: cada uno se identifica por su `path` (único, por el UUID del
// nombre de archivo), no tiene su propio _id de Mongo porque no hace falta
// (2026-11-25, pedido de Ariel: poder subir PDF/JPG/PNG por empleado).
export interface IEmployeeDocumento {
  nombre: string; // nombre original del archivo, para mostrarlo en la lista
  path: string; // ruta pública (public/uploads/empleados/documentos/...)
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

export interface IEmployee {
  _id: mongoose.Types.ObjectId;
  nombre: string;
  apellido: string;
  dni?: string;
  fechaNacimiento?: Date; // para el checklist de Seguros de Gestión de Proyectos (pipeline-client.tsx) — opcional, puede faltar en empleados ya cargados
  direccion?: string;
  telefono?: string;
  email?: string;
  fechaIngreso?: Date;
  notas?: string;
  category: EmployeeCategory;
  monotributoCategoria?: string; // solo si category === "MONOTRIBUTISTA" (ej. "Categoría C")
  paymentType?: PaymentType; // solo relevante si category === "EMPLEADO"
  cuit?: string;
  hourlyRate?: number; // solo relevante si paymentType === "POR_HORA"
  banco?: string; // banco o billetera virtual (Mercado Pago, Ualá, etc.)
  cbuAlias?: string; // CBU/CVU o alias para transferir el pago
  area?: string; // texto libre — dónde trabaja dentro de ITELSA
  foto?: string; // ruta al archivo subido (public/uploads/empleados/...)
  documentos: IEmployeeDocumento[];
  active: boolean;
  createdAt: Date;
}

// Nota: acá NO va si se le paga en blanco/negro. Eso no es un atributo fijo
// de la persona — es del pago puntual (ver PayrollEntry.modality), porque
// en la práctica un mismo empleado suele tener las dos partes en el mismo
// período.
const EmployeeDocumentoSchema = new Schema<IEmployeeDocumento>(
  {
    nombre: { type: String, required: true },
    path: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const EmployeeSchema = new Schema<IEmployee>({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  dni: String,
  fechaNacimiento: Date,
  direccion: String,
  telefono: String,
  email: String,
  fechaIngreso: Date,
  notas: String,
  category: { type: String, enum: ["MONOTRIBUTISTA", "EMPLEADO"], required: true },
  monotributoCategoria: String,
  paymentType: { type: String, enum: ["FIJO", "POR_HORA"] },
  cuit: String,
  hourlyRate: Number,
  banco: String,
  cbuAlias: String,
  area: String,
  foto: String,
  documentos: { type: [EmployeeDocumentoSchema], default: [] },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export const Employee =
  (models.Employee as Model<IEmployee>) || model<IEmployee>("Employee", EmployeeSchema);