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

// Antes esto era siempre un cheque real. 2026-11-25, pedido de Ariel: el
// desplegable de "Forma de pago" del modal de Pagos suma Efectivo y
// Transferencia — esas dos no generan un Check (no tiene sentido un cheque
// sin número de cheque, y además ensuciaría el conteo del módulo Cheques).
// Por eso cada línea ahora guarda type/amount/paymentDate/bank/checkNumber
// directamente, y `check` queda opcional (solo está para FISICO/ELECTRONICO,
// que sí crean un Check real referenciado desde acá).
export const PAYMENT_LINE_TYPES = ["FISICO", "ELECTRONICO", "EFECTIVO", "TRANSFERENCIA"] as const;
export type PaymentLineType = (typeof PAYMENT_LINE_TYPES)[number];

export interface IPaymentCheckLine {
  // Ausente en pagos guardados antes de este cambio (todas las líneas eran
  // cheque) — ver pagos/page.tsx, que ahí cae al Check poblado.
  type?: PaymentLineType;
  check?: mongoose.Types.ObjectId;
  amount?: number;
  paymentDate?: Date;
  bank?: string;
  checkNumber?: string;
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
        type: { type: String, enum: PAYMENT_LINE_TYPES },
        check: { type: Schema.Types.ObjectId, ref: "Check" },
        amount: Number,
        paymentDate: Date,
        bank: String,
        checkNumber: String,
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