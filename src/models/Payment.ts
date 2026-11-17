import mongoose, { Schema, models, model, Model } from "mongoose";
import { GANANCIAS_CONDITIONS, type GananciasCondition } from "@/lib/ganancias-conditions";

// Pago a proveedor (módulo Pagos) — liquida una o varias Compras pendientes
// de un mismo proveedor en una sola operación semanal, con el detalle de
// la retención de Ganancias (RG 830) y los cheques que cubren el neto.
// Ver src/models/RetentionRegime.ts para por qué los % y el mínimo no
// están hardcodeados acá.
export interface IPaymentPurchaseLine {
  purchase: mongoose.Types.ObjectId;
  amount: number;
}

export interface IPaymentCheckLine {
  check: mongoose.Types.ObjectId;
}

export interface IPayment {
  _id: mongoose.Types.ObjectId;
  provider: mongoose.Types.ObjectId;
  paymentDate: Date;
  purchases: IPaymentPurchaseLine[];
  // Base sobre la que se calcula la retención (normalmente la suma de
  // `purchases`, pero queda editable por si la contadora necesita ajustarla).
  grossAmount: number;
  regimeCode: string;
  // Snapshot de la condición del proveedor al momento del pago — si el
  // proveedor cambia de condición después, este pago no cambia retroactivo.
  condicionGanancias?: GananciasCondition;
  retentionGanancias: {
    nonTaxableAmountUsed: number;
    rateUsed: number;
    priorMonthGross: number;
    priorMonthWithheld: number;
    withheldAmount: number;
  };
  // Manuales — IIBB varía por jurisdicción/padrón, no se calcula acá.
  retentionIIBB: number;
  retentionOther: number;
  voucherNumber?: string;
  paymentOrderNumber?: string;
  checks: IPaymentCheckLine[];
  notes?: string;
  createdAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    provider: { type: Schema.Types.ObjectId, ref: "Provider", required: true },
    paymentDate: { type: Date, required: true },
    purchases: [
      {
        purchase: { type: Schema.Types.ObjectId, ref: "Purchase", required: true },
        amount: { type: Number, required: true },
        _id: false,
      },
    ],
    grossAmount: { type: Number, required: true },
    regimeCode: { type: String, required: true },
    condicionGanancias: { type: String, enum: GANANCIAS_CONDITIONS },
    retentionGanancias: {
      nonTaxableAmountUsed: { type: Number, default: 0 },
      rateUsed: { type: Number, default: 0 },
      priorMonthGross: { type: Number, default: 0 },
      priorMonthWithheld: { type: Number, default: 0 },
      withheldAmount: { type: Number, default: 0 },
    },
    retentionIIBB: { type: Number, default: 0 },
    retentionOther: { type: Number, default: 0 },
    voucherNumber: String,
    paymentOrderNumber: String,
    checks: [
      {
        check: { type: Schema.Types.ObjectId, ref: "Check", required: true },
        _id: false,
      },
    ],
    notes: String,
    createdAt: { type: Date, default: Date.now },
  }
);

PaymentSchema.index({ provider: 1, paymentDate: -1 });
PaymentSchema.index({ provider: 1, regimeCode: 1, paymentDate: -1 });

export const Payment =
  (models.Payment as Model<IPayment>) || model<IPayment>("Payment", PaymentSchema);