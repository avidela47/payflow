import mongoose, { Schema, models, model, Model } from "mongoose";

export type Role = "OWNER" | "ACCOUNTANT";

// Claves de módulo, calcadas de los href del sidebar (sin la barra inicial).
// Se usan para restringir el acceso de un usuario puntual a módulos
// concretos, aparte del control por rol (ver lib/auth.ts).
// "viaticos" faltaba acá (bug encontrado 2026-11-25 al crear el primer
// usuario con permisos acotados): sidebar.tsx ya le pone moduleKey
// "viaticos" a Viajes, pero como no estaba en este enum nunca se podía
// restringir — quedaba visible para cualquier usuario sin importar su
// restrictedModules.
export const RESTRICTABLE_MODULES = [
  "empleados",
  "sueldos",
  "costos-fijos",
  "cheques",
  "licitaciones",
  "reportes",
  "vault",
  "caja-chica",
  "pagos",
  "sensores",
  "luminarias",
  "herramientas",
  "materiales",
  "componentes",
  "recetas",
  "fabricar",
  "movimientos-componentes",
  "proyectos",
  "pipeline",
  "arquitectura",
  "gestion-de-proyectos",
  "weeklys",
  "accesos",
  "computo-privado",
  "computos",
  "marketing",
  "viaticos",
  "presupuestos",
  "ordenes",
  "reparaciones",
  "remitos",
  "despachos",
  "recibos",
  "vales",
  // 2026-11-26, Ariel: antes Clientes/Proveedores/Ventas/Compras (sección
  // COMERCIAL) no tenían moduleKey y quedaban siempre visibles para
  // cualquier usuario autenticado, sin importar restrictedModules — pidió
  // poder sacarle ese acceso puntualmente a varios usuarios, así que ahora
  // sí son restringibles.
  "clientes",
  "proveedores",
  "ventas",
  "compras",
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
  // Foto del avatar para cuentas SIN legajo de Empleados (ej. Candelaria,
  // Melina, Fabio, Cristian, Pajarito — login sin ficha completa) —
  // 2026-11-26, pedido de Ariel: que se vea la foto al loguearse sin
  // necesidad de cargar una ficha entera. Si `employeeId` está seteado,
  // la foto de Empleados tiene prioridad sobre esta.
  foto?: string;
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
  foto: String,
  createdAt: { type: Date, default: Date.now },
});

// El patrón `models.X || model(...)` evita el error "Cannot overwrite model"
// que tira Mongoose con el hot-reload de Next.js en desarrollo.
export const User = (models.User as Model<IUser>) || model<IUser>("User", UserSchema);