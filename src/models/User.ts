import mongoose, { Schema, models, model, Model } from "mongoose";

export type Role = "OWNER" | "ACCOUNTANT";

export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["OWNER", "ACCOUNTANT"], default: "ACCOUNTANT" },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// El patrón `models.X || model(...)` evita el error "Cannot overwrite model"
// que tira Mongoose con el hot-reload de Next.js en desarrollo.
export const User = (models.User as Model<IUser>) || model<IUser>("User", UserSchema);
