import mongoose, { Schema, models, model, Model } from "mongoose";

export type PayrollModality = "REGISTRADO" | "INFORMAL";

export interface IPayrollEntry {
  _id: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  period: Date; // primer día del mes-año, ej. 2026-08-01
  modality: PayrollModality;
  amount: number;
  paidBy?: string;
  paid: boolean;
  paidAt?: Date;
  notes?: string;
  createdAt: Date;
}

const PayrollEntrySchema = new Schema<IPayrollEntry>({
  employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
  period: { type: Date, required: true },
  modality: { type: String, enum: ["REGISTRADO", "INFORMAL"], default: "REGISTRADO" },
  amount: { type: Number, required: true },
  paidBy: String,
  paid: { type: Boolean, default: false },
  paidAt: Date,
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

// Un empleado puede tener HASTA UNA liquidación "registrado" y HASTA UNA
// "informal" por período — no una sola en total (ej. parte del sueldo en
// blanco, parte en negro, mismo mes). Por eso la modalidad entra en la
// clave única, no solo empleado+período.
PayrollEntrySchema.index({ employee: 1, period: 1, modality: 1 }, { unique: true });

export const PayrollEntry =
  (models.PayrollEntry as Model<IPayrollEntry>) ||
  model<IPayrollEntry>("PayrollEntry", PayrollEntrySchema);