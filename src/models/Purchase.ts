import mongoose, { Schema, models, model, Model } from "mongoose";

// Estados de recepción de la mercadería — independiente del estado de
// pago. Se cicla con un click en Compras: EN_CURSO → RECIBIDA_PARCIAL →
// RECIBIDA_TOTAL → EN_CURSO (ver PURCHASE_RECEIPT_STATUS_CYCLE en
// compras-client.tsx).
export const PURCHASE_RECEIPT_STATUSES = [
  "EN_CURSO",
  "RECIBIDA_PARCIAL",
  "RECIBIDA_TOTAL",
] as const;
export type PurchaseReceiptStatus = (typeof PURCHASE_RECEIPT_STATUSES)[number];

export interface IPurchase {
  _id: mongoose.Types.ObjectId;
  provider: mongoose.Types.ObjectId;
  purchaseDate: Date;
  paymentMethod?: string;
  // Fecha en la que se espera pagar — igual que expectedCollectionDate en
  // Ventas: se carga a mano, no se calcula sola. Es lo que permite decidir
  // si una compra está "Vencida".
  expectedPaymentDate?: Date;
  paid: boolean;
  paidDate?: Date;
  // Estado de recepción de la mercadería — por defecto "en curso" al
  // cargar la compra, se cambia después a mano.
  receiptStatus: PurchaseReceiptStatus;
  // Igual que en Ventas/Costos Fijos: `amount` siempre en pesos. Si la
  // compra se cargó en dólares, se guarda también el monto en USD y la
  // cotización usada.
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

const PurchaseSchema = new Schema<IPurchase>({
  provider: { type: Schema.Types.ObjectId, ref: "Provider", required: true },
  purchaseDate: { type: Date, required: true },
  paymentMethod: String,
  expectedPaymentDate: Date,
  paid: { type: Boolean, default: false },
  paidDate: Date,
  receiptStatus: {
    type: String,
    enum: PURCHASE_RECEIPT_STATUSES,
    default: "EN_CURSO",
  },
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

PurchaseSchema.index({ purchaseDate: -1 });
PurchaseSchema.index({ provider: 1 });

export const Purchase =
  (models.Purchase as Model<IPurchase>) || model<IPurchase>("Purchase", PurchaseSchema);