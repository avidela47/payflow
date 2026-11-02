import mongoose, { Schema, models, model, Model } from "mongoose";

export interface ISale {
  _id: mongoose.Types.ObjectId;
  client: mongoose.Types.ObjectId;
  saleDate: Date;
  paymentMethod?: string;
  expectedCollectionDate?: Date;
  collected: boolean;
  collectedDate?: Date;
  amount: number;
  currency: "ARS" | "USD";
  usdAmount?: number;
  exchangeRate?: number;
  remitoNumber?: string;
  invoiceNumber?: string;
  purchaseOrderNumber?: string;
  notes?: string;
  // Canal de venta: define qué desglose aplica. Es informativo — no
  // modifica `amount`, que sigue siendo el precio de venta real.
  channel: "OFICINA" | "MERCADO_LIBRE";
  // Mercado Libre — montos fijos deducidos del precio de venta.
  mlCommission?: number;
  mlShipping?: number;
  mlTaxes?: number;
  // Oficina — porcentajes aplicados sobre `amount` (suma directa, no en
  // cascada) para llegar a un "costo neto" informativo.
  profitPct?: number;
  iibbPct?: number;
  ivaPct?: number;
  otherPct?: number;
  createdAt: Date;
}

const SaleSchema = new Schema<ISale>({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  saleDate: { type: Date, required: true },
  paymentMethod: String,
  expectedCollectionDate: Date,
  collected: { type: Boolean, default: false },
  collectedDate: Date,
  amount: { type: Number, required: true },
  currency: { type: String, enum: ["ARS", "USD"], default: "ARS" },
  usdAmount: Number,
  exchangeRate: Number,
  remitoNumber: String,
  invoiceNumber: String,
  purchaseOrderNumber: String,
  notes: String,
  channel: { type: String, enum: ["OFICINA", "MERCADO_LIBRE"], default: "OFICINA" },
  mlCommission: Number,
  mlShipping: Number,
  mlTaxes: Number,
  profitPct: Number,
  iibbPct: Number,
  ivaPct: Number,
  otherPct: Number,
  createdAt: { type: Date, default: Date.now },
});

SaleSchema.index({ saleDate: -1 });
SaleSchema.index({ client: 1 });

export const Sale = (models.Sale as Model<ISale>) || model<ISale>("Sale", SaleSchema);