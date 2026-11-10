import mongoose, { Schema, models, model, Model } from "mongoose";

export type Role = "OWNER" | "ACCOUNTANT";

// Claves de módulo, calcadas de los href del sidebar (sin la barra inicial).
// Se usan para restringir el acceso de un usuario puntual a módulos
// concretos, aparte del control por rol (ver lib/auth.ts).
export const RESTRICTABLE_MODULES = [
  "empleados",
  "sueldos",
  "costos-fijos",
  "cheques",
  "reportes",
  "vault",
  "caja-chica",
] as const;
export type RestrictableModule = (typeof RESTRICTABLE_MODULES)[number];

export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  restrictedModules: RestrictableModule[];
  // Opcional: liga esta cuenta de login con su legajo en Empleados, solo
  // para poder mostrar su foto real (Employee.foto) como avatar en el
  // Dashboard en vez de un círculo con iniciales. No tiene nada que ver
  // con permisos — un usuario sin este campo sigue funcionando igual.
  employeeId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["OWNER", "ACCOUNTANT"], default: "ACCOUNTANT" },
  active: { type: Boolean, default: true },
  restrictedModules: {
    type: [String],
    enum: RESTRICTABLE_MODULES,
    default: [],
  },
  employeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
  createdAt: { type: Date, default: Date.now },
});

// El patrón `models.X || model(...)` evita el error "Cannot overwrite model"
// que tira Mongoose con el hot-reload de Next.js en desarrollo.
export const User = (models.User as Model<IUser>) || model<IUser>("User", UserSchema);