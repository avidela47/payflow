import mongoose, { Schema, models, model, Model } from "mongoose";

// Tipo de honorario por viático, por empleado — distinto del sueldo fijo:
// "TRABAJO" = un monto único por el viaje entero; "DIA" = un monto por
// día, multiplicado por `dias` al calcular el total.
export const VIATICO_HONORARIO_TYPES = ["TRABAJO", "DIA"] as const;
export type ViaticoHonorarioType = (typeof VIATICO_HONORARIO_TYPES)[number];

// Forma de pago de un gasto individual (material, extra o tope) —
// distinto de `paidBy` (quién paga, texto libre) de hospedaje/combustible.
export const VIATICO_PAYMENT_MODES = ["TARJETA", "EFECTIVO", "DEBITO"] as const;
export type ViaticoPaymentMode = (typeof VIATICO_PAYMENT_MODES)[number];

// Forma de pago AL EMPLEADO (honorario) — distinta del set anterior: a un
// empleado se le paga por transferencia o en efectivo, no con tarjeta/débito.
export const VIATICO_EMPLOYEE_PAYMENT_MODES = ["TRANSFERENCIA", "EFECTIVO"] as const;
export type ViaticoEmployeePaymentMode = (typeof VIATICO_EMPLOYEE_PAYMENT_MODES)[number];

// Un pago individual hecho a un empleado, a cuenta del monto que se le
// debe por el viaje. La suma de `pagos` se resta del monto total (monto, o
// monto x días si es por día) para obtener el saldo pendiente.
export interface IViaticoPago {
  monto: number;
  fecha: Date;
}

export interface IViaticoEmpleado {
  employee: mongoose.Types.ObjectId;
  honorarioType: ViaticoHonorarioType;
  // Si honorarioType === "TRABAJO": monto total del viaje para ese empleado.
  // Si honorarioType === "DIA": monto por día — se multiplica por `dias`.
  monto: number;
  dias?: number; // solo aplica con honorarioType === "DIA"
  paymentMode?: ViaticoEmployeePaymentMode;
  // Lista de pagos parciales hechos a este empleado — ver IViaticoPago.
  pagos: IViaticoPago[];
}

export interface IViaticoHospedaje {
  lugar?: string;
  checkIn?: Date;
  checkOut?: Date;
  costoPorDia?: number;
  cantidadDias?: number;
  // Igual que paidBy en Sueldos: texto libre ("ITELSA", "Rubén", etc.)
  paidBy?: string;
}

export interface IViaticoCombustible {
  // Monto pagado a EdenRed (o la empresa de combustible que corresponda).
  monto?: number;
  paidBy?: string;
}

export interface IViaticoExtra {
  descripcion: string;
  monto: number;
  paymentMode?: ViaticoPaymentMode;
}

export interface IViaticoMaterial {
  descripcion: string;
  cantidad?: number;
  monto: number;
  paymentMode?: ViaticoPaymentMode;
}

export interface IViaticoSeguro {
  compania?: string;
  cobertura?: string;
  cantidadDias?: number;
  costo?: number;
}

// Un gasto individual descontado del importe de tope asignado a un
// empleado — mismo patrón que materiales/extras (descripción + forma de
// pago).
export interface IViaticoTopeGasto {
  descripcion: string;
  monto: number;
  paymentMode?: ViaticoPaymentMode;
}

// Tope diario de viático, ahora POR EMPLEADO (antes era un único monto
// global para todo el viaje). `monto` es el importe/tope por día asignado
// al empleado — si el monto por día de un empleado con honorarioType
// "DIA" lo supera, la diferencia x días se guarda en `excedente`.
// `gastos` discrimina qué se gastó de ese importe y cómo se pagó cada
// cosa (en vez de tener que repetir una fila por empleado por cada
// gasto).
export interface IViaticoTopeDiario {
  employee: mongoose.Types.ObjectId;
  monto: number;
  gastos: IViaticoTopeGasto[];
}

export interface IViatico {
  _id: mongoose.Types.ObjectId;
  // Nombre del viaje/obra — ej: "Morón".
  nombre: string;
  // Quién paga el viático en general — mismo patrón que paidBy en Sueldos
  // (texto libre: "ITELSA", "Rubén", etc.), independiente de paidBy en
  // hospedaje/combustible que puede ser otro.
  paidBy?: string;
  fecha: Date;
  empleados: IViaticoEmpleado[];
  hospedaje?: IViaticoHospedaje;
  combustible?: IViaticoCombustible;
  extras: IViaticoExtra[];
  materiales: IViaticoMaterial[];
  seguro?: IViaticoSeguro;
  topesDiarios: IViaticoTopeDiario[];
  excedente: number;
  notes?: string;
  createdAt: Date;
}

const ViaticoPagoSchema = new Schema<IViaticoPago>(
  {
    monto: { type: Number, required: true },
    fecha: { type: Date, required: true },
  },
  { _id: false }
);

const ViaticoEmpleadoSchema = new Schema<IViaticoEmpleado>(
  {
    employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    honorarioType: { type: String, enum: VIATICO_HONORARIO_TYPES, required: true },
    monto: { type: Number, required: true },
    dias: Number,
    paymentMode: { type: String, enum: VIATICO_EMPLOYEE_PAYMENT_MODES },
    pagos: { type: [ViaticoPagoSchema], default: [] },
  },
  { _id: false }
);

const ViaticoHospedajeSchema = new Schema<IViaticoHospedaje>(
  {
    lugar: String,
    checkIn: Date,
    checkOut: Date,
    costoPorDia: Number,
    cantidadDias: Number,
    paidBy: String,
  },
  { _id: false }
);

const ViaticoCombustibleSchema = new Schema<IViaticoCombustible>(
  {
    monto: Number,
    paidBy: String,
  },
  { _id: false }
);

const ViaticoExtraSchema = new Schema<IViaticoExtra>(
  {
    descripcion: { type: String, required: true },
    monto: { type: Number, required: true },
    paymentMode: { type: String, enum: VIATICO_PAYMENT_MODES },
  },
  { _id: false }
);

const ViaticoMaterialSchema = new Schema<IViaticoMaterial>(
  {
    descripcion: { type: String, required: true },
    cantidad: Number,
    monto: { type: Number, required: true },
    paymentMode: { type: String, enum: VIATICO_PAYMENT_MODES },
  },
  { _id: false }
);

const ViaticoSeguroSchema = new Schema<IViaticoSeguro>(
  {
    compania: String,
    cobertura: String,
    cantidadDias: Number,
    costo: Number,
  },
  { _id: false }
);

const ViaticoTopeGastoSchema = new Schema<IViaticoTopeGasto>(
  {
    descripcion: { type: String, required: true },
    monto: { type: Number, required: true },
    paymentMode: { type: String, enum: VIATICO_PAYMENT_MODES },
  },
  { _id: false }
);

const ViaticoTopeDiarioSchema = new Schema<IViaticoTopeDiario>(
  {
    employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    monto: { type: Number, required: true },
    gastos: { type: [ViaticoTopeGastoSchema], default: [] },
  },
  { _id: false }
);

const ViaticoSchema = new Schema<IViatico>({
  nombre: { type: String, required: true },
  paidBy: String,
  fecha: { type: Date, required: true },
  empleados: { type: [ViaticoEmpleadoSchema], default: [] },
  hospedaje: ViaticoHospedajeSchema,
  combustible: ViaticoCombustibleSchema,
  extras: { type: [ViaticoExtraSchema], default: [] },
  materiales: { type: [ViaticoMaterialSchema], default: [] },
  seguro: ViaticoSeguroSchema,
  topesDiarios: { type: [ViaticoTopeDiarioSchema], default: [] },
  excedente: { type: Number, default: 0 },
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

ViaticoSchema.index({ fecha: -1 });

export const Viatico =
  (models.Viatico as Model<IViatico>) || model<IViatico>("Viatico", ViaticoSchema);