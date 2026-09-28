import mongoose, { Schema, models, model, Model } from "mongoose";

// Caja Chica: efectivo aparte, no concilia con Costos Fijos ni Gastos. Un
// solo saldo corriente que surge de sumar todos los movimientos — no se
// guarda un "balance" como campo propio para que nunca se desincronice del
// historial real (ver el cálculo por agregación en page.tsx y actions.ts).
export interface IPettyCashMovement {
  _id: mongoose.Types.ObjectId;
  date: Date;
  concept: string;
  amount: number; // siempre positivo — el signo lo da `type`
  type: "ingreso" | "egreso";
  createdAt: Date;
}

const PettyCashMovementSchema = new Schema<IPettyCashMovement>({
  date: { type: Date, required: true },
  concept: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  type: { type: String, enum: ["ingreso", "egreso"], required: true },
  createdAt: { type: Date, default: Date.now },
});

PettyCashMovementSchema.index({ date: -1 });

export const PettyCashMovement =
  (models.PettyCashMovement as Model<IPettyCashMovement>) ||
  model<IPettyCashMovement>("PettyCashMovement", PettyCashMovementSchema);