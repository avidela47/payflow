import mongoose, { Schema, models, model, Model } from "mongoose";

export interface IFixedCostCategory {
  _id: mongoose.Types.ObjectId;
  name: string; // IIBB, COM E INDUSTRIA, IVA, SICORE, F931, MONOTRIBUTO, AUTONOMOS, etc.
  kind?: string; // "impuesto" | "seguro" | "alquiler" | "servicio"
  notes?: string;
}

const FixedCostCategorySchema = new Schema<IFixedCostCategory>({
  name: { type: String, required: true, unique: true },
  kind: String,
  notes: String,
});

export const FixedCostCategory =
  (models.FixedCostCategory as Model<IFixedCostCategory>) ||
  model<IFixedCostCategory>("FixedCostCategory", FixedCostCategorySchema);

export interface IFixedCostEntry {
  _id: mongoose.Types.ObjectId;
  category: mongoose.Types.ObjectId;
  period: Date;
  amount: number;
  paymentMode?: string; // "VEP" | "Tarjeta" | "Débito automático" | ...
  dueDate?: Date;
  paid: boolean;
  notes?: string;
  createdAt: Date;
}

const FixedCostEntrySchema = new Schema<IFixedCostEntry>({
  category: { type: Schema.Types.ObjectId, ref: "FixedCostCategory", required: true },
  period: { type: Date, required: true },
  amount: { type: Number, required: true },
  paymentMode: String,
  dueDate: Date,
  paid: { type: Boolean, default: false },
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

FixedCostEntrySchema.index({ category: 1, period: 1 }, { unique: true });

export const FixedCostEntry =
  (models.FixedCostEntry as Model<IFixedCostEntry>) ||
  model<IFixedCostEntry>("FixedCostEntry", FixedCostEntrySchema);
