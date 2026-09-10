import mongoose, { Schema, models, model, Model } from "mongoose";

export type CheckType = "ELECTRONICO" | "FISICO";
export type CheckStatus = "ACTIVO" | "COBRADO" | "ENDOSADO" | "DEPOSITADO" | "CADUCADO" | "OTRO";

export interface ICheck {
  _id: mongoose.Types.ObjectId;
  type: CheckType;
  issueDate: Date;
  paymentDate: Date;
  checkNumber: string;
  echeqId?: string;
  issuerName: string;
  issuerCuit?: string;
  issuingBank?: string;
  amount: number;
  status: CheckStatus;
  currentHolder?: string;
  requestedBy?: string;
  notes?: string;
  createdAt: Date;
}

const CheckSchema = new Schema<ICheck>({
  type: { type: String, enum: ["ELECTRONICO", "FISICO"], required: true },
  issueDate: { type: Date, required: true },
  paymentDate: { type: Date, required: true },
  checkNumber: { type: String, required: true },
  echeqId: String,
  issuerName: { type: String, required: true },
  issuerCuit: String,
  issuingBank: String,
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["ACTIVO", "COBRADO", "ENDOSADO", "DEPOSITADO", "CADUCADO", "OTRO"],
    default: "ACTIVO",
  },
  currentHolder: String,
  requestedBy: String,
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

CheckSchema.index({ status: 1 });
CheckSchema.index({ paymentDate: 1 });

export const Check = (models.Check as Model<ICheck>) || model<ICheck>("Check", CheckSchema);
