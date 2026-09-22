import mongoose, { Schema, models, model, Model } from "mongoose";

export interface ISale {
  _id: mongoose.Types.ObjectId;
  client: mongoose.Types.ObjectId;
  saleDate: Date;
  paymentMethod?: string;
  // Fecha en la que se espera cobrar — se carga a mano (no se calcula
  // sola a partir de la forma de pago, porque los plazos reales pueden
  // variar caso a caso). Editable siempre.
  expectedCollectionDate?: Date;
  collected: boolean;
  collectedDate?: Date;
  // Igual que en Costos Fijos: `amount` siempre en pesos (lo que usan
  // reportes y dashboard). Si la venta se cargó en dólares, se guarda
  // también el monto en USD y la cotización usada.
  amount: number;
  currency: "ARS" | "USD";
  usdAmount?: number;
  exchangeRate?: number;
  remitoNumber?: string;
  invoiceNumber?: string;
  purchaseOrderNumber?: string;
  notes?: string;
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
  createdAt: { type: Date, default: Date.now },
});

SaleSchema.index({ saleDate: -1 });
SaleSchema.index({ client: 1 });

export const Sale = (models.Sale as Model<ISale>) || model<ISale>("Sale", SaleSchema);