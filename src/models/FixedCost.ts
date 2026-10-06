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
  amount: number; // siempre en pesos — lo que usan reportes y dashboard
  // Si el costo se cargó en dólares, guardamos el monto en USD y la
  // cotización usada, además del equivalente en pesos ya calculado en
  // `amount`. Así se puede ver/editar después sin perder el dato original.
  currency: "ARS" | "USD";
  usdAmount?: number;
  exchangeRate?: number;
  // true solo cuando currency="USD" y se cargó "sin conversión": `amount`
  // queda en 0 (no se calcula equivalente en pesos) y no hay `exchangeRate`.
  // Es un gasto aparte, en dólares puros — no suma al total en pesos de
  // Reportes/Dashboard (ver getFixedCostReport en reports.ts).
  noConversion?: boolean;
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
  currency: { type: String, enum: ["ARS", "USD"], default: "ARS" },
  usdAmount: Number,
  exchangeRate: Number,
  noConversion: { type: Boolean, default: false },
  paymentMode: String,
  dueDate: Date,
  paid: { type: Boolean, default: false },
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

// Antes era category+período únicamente (un solo costo por categoría y
// mes). Se amplía con la moneda para poder cargar, por ejemplo, el
// alquiler en dos partes el mismo mes: una en pesos y otra en dólares
// (con o sin conversión) — cada combinación moneda+categoría+período
// sigue siendo única, así que no se puede cargar el mismo par dos veces.
FixedCostEntrySchema.index({ category: 1, period: 1, currency: 1 }, { unique: true });

export const FixedCostEntry =
  (models.FixedCostEntry as Model<IFixedCostEntry>) ||
  model<IFixedCostEntry>("FixedCostEntry", FixedCostEntrySchema);