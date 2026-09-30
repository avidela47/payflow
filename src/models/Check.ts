import mongoose, { Schema, models, model, Model } from "mongoose";

export type CheckType = "ELECTRONICO" | "FISICO";
export type CheckStatus = "ACTIVO" | "COBRADO" | "ENDOSADO" | "DEPOSITADO" | "CADUCADO" | "OTRO";
// Nuevo (navegación estilo app del banco): separa los cheques que ITELSA
// recibió de un cliente de los que ITELSA misma emitió para pagarle a
// alguien. Es independiente del estado (`status`) — un RECIBIDO puede
// estar "Endosado" (se lo pasamos a un tercero en vez de depositarlo); un
// EMITIDO normalmente no.
export type CheckDirection = "RECIBIDO" | "EMITIDO";

export interface ICheck {
  _id: mongoose.Types.ObjectId;
  type: CheckType;
  direction: CheckDirection;
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
  direction: { type: String, enum: ["RECIBIDO", "EMITIDO"], required: true, default: "RECIBIDO" },
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
CheckSchema.index({ type: 1, direction: 1, status: 1 });

export const Check = (models.Check as Model<ICheck>) || model<ICheck>("Check", CheckSchema);