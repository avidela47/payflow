import mongoose, { Schema, models, model, Model } from "mongoose";

// Categoría impositiva/laboral de fondo.
export type EmployeeCategory = "MONOTRIBUTISTA" | "EMPLEADO";

// Forma de cálculo del pago. Solo tiene sentido dentro de EMPLEADO — un
// Monotributista factura un monto, no "horas".
export type PaymentType = "FIJO" | "POR_HORA";

export interface IEmployee {
  _id: mongoose.Types.ObjectId;
  nombre: string;
  apellido: string;
  dni?: string;
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
  active: boolean;
  createdAt: Date;
}

// Nota: acá NO va si se le paga en blanco/negro. Eso no es un atributo fijo
// de la persona — es del pago puntual (ver PayrollEntry.modality), porque
// en la práctica un mismo empleado suele tener las dos partes en el mismo
// período.
const EmployeeSchema = new Schema<IEmployee>({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  dni: String,
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
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export const Employee =
  (models.Employee as Model<IEmployee>) || model<IEmployee>("Employee", EmployeeSchema);