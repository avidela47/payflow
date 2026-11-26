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
  // Si honorarioType === "TRABAJO": monto NETO total del viaje para ese
  // empleado. Si honorarioType === "DIA": monto NETO por día — se
  // multiplica por `dias`.
  monto: number;
  // IVA sobre `monto` (mismo criterio: por día si honorarioType === "DIA",
  // se multiplica junto con `monto` x `dias`) — 2026-11-26, Ariel: todos
  // los montos de Viajes discriminan neto/IVA, honorarios incluidos.
  // Se autocompleta al 21% del neto en el cliente, pero queda editable.
  iva?: number;
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
  // IVA por día sobre `costoPorDia` — ver nota en IViaticoEmpleado.iva.
  ivaPorDia?: number;
  cantidadDias?: number;
  // Igual que paidBy en Sueldos: texto libre ("ITELSA", "Rubén", etc.)
  paidBy?: string;
}

export interface IViaticoCombustible {
  // Monto NETO pagado a EdenRed (o la empresa de combustible que corresponda).
  monto?: number;
  iva?: number;
  paidBy?: string;
}

export interface IViaticoExtra {
  descripcion: string;
  monto: number;
  iva?: number;
  paymentMode?: ViaticoPaymentMode;
}

export interface IViaticoMaterial {
  descripcion: string;
  cantidad?: number;
  monto: number;
  iva?: number;
  paymentMode?: ViaticoPaymentMode;
}

export interface IViaticoSeguro {
  compania?: string;
  cobertura?: string;
  cantidadDias?: number;
  costo?: number;
  iva?: number;
}

// Un gasto individual descontado del importe de tope asignado a un
// empleado — mismo patrón que materiales/extras (descripción + forma de
// pago).
export interface IViaticoTopeGasto {
  descripcion: string;
  monto: number;
  iva?: number;
  paymentMode?: ViaticoPaymentMode;
}

// Forma de pago de los viáticos pactados con el/los empleado(s) que viajan
// — distinta de paymentMode de IViaticoEmpleado (que es cómo se le paga el
// HONORARIO ya calculado): acá es la condición charlada antes del viaje.
export const VIATICO_CONDICIONES_PAYMENT_MODES = ["TARJETA", "EFECTIVO"] as const;
export type ViaticoCondicionesPaymentMode = (typeof VIATICO_CONDICIONES_PAYMENT_MODES)[number];

// "Condiciones de viaje" — ficha de lo acordado ANTES de viajar (papel de
// Ariel, 2026-11-25), separada a propósito de `empleados` (que son los
// honorarios ya liquidados, atados a un Employee real): acá los nombres
// son texto libre porque puede viajar gente sin honorario cargado todavía,
// o ni siquiera estar en el padrón de Empleados. Vive dentro del Viatico
// al que corresponde (no es una lista propia como el Simulador).
export interface IViaticoCondiciones {
  empleadosNombres: string[];
  // Texto libre: lo que se acordó de viáticos (monto, qué cubre, etc.) —
  // no se fuerza a número porque "pactado" en el papel no siempre es un
  // monto limpio (puede ser "cubre hotel y comida", etc.).
  viaticosPactados?: string;
  llevanInsumos?: boolean;
  tieneVale?: boolean;
  numeroVale?: string; // solo tiene sentido si tieneVale === true
  formaPago?: ViaticoCondicionesPaymentMode;
  // Monto que se lleva en efectivo — solo tiene sentido si formaPago ===
  // "EFECTIVO" (2026-11-25, Ariel: faltaba "si es efectivo, cuánto").
  montoEfectivo?: number;
}

// Documentos adjuntos del viaje (comprobantes, facturas escaneadas,
// reservas...) — mismo mecanismo que IEmployeeDocumento en Employee.ts:
// cada uno se identifica por su `path` (único por el UUID del nombre de
// archivo en disco), sin _id propio porque no hace falta. 2026-11-25,
// pedido de Ariel: poder subir PDF/JPG/PNG por viaje, con su propio botón
// antes de "Condiciones".
export interface IViaticoDocumento {
  nombre: string;
  path: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
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
  iva?: number;
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
  // Antes era una sola `fecha` — ahora rango, para poder mostrar cuánto
  // duró el viaje en el reporte.
  fechaInicio: Date;
  fechaFin: Date;
  empleados: IViaticoEmpleado[];
  condiciones?: IViaticoCondiciones;
  documentos: IViaticoDocumento[];
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
    iva: Number,
    dias: Number,
    paymentMode: { type: String, enum: VIATICO_EMPLOYEE_PAYMENT_MODES },
    pagos: { type: [ViaticoPagoSchema], default: [] },
  },
  { _id: false }
);

const ViaticoCondicionesSchema = new Schema<IViaticoCondiciones>(
  {
    empleadosNombres: { type: [String], default: [] },
    viaticosPactados: String,
    llevanInsumos: Boolean,
    tieneVale: Boolean,
    numeroVale: String,
    formaPago: { type: String, enum: VIATICO_CONDICIONES_PAYMENT_MODES },
    montoEfectivo: Number,
  },
  { _id: false }
);

const ViaticoDocumentoSchema = new Schema<IViaticoDocumento>(
  {
    nombre: { type: String, required: true },
    path: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ViaticoHospedajeSchema = new Schema<IViaticoHospedaje>(
  {
    lugar: String,
    checkIn: Date,
    checkOut: Date,
    costoPorDia: Number,
    ivaPorDia: Number,
    cantidadDias: Number,
    paidBy: String,
  },
  { _id: false }
);

const ViaticoCombustibleSchema = new Schema<IViaticoCombustible>(
  {
    monto: Number,
    iva: Number,
    paidBy: String,
  },
  { _id: false }
);

const ViaticoExtraSchema = new Schema<IViaticoExtra>(
  {
    descripcion: { type: String, required: true },
    monto: { type: Number, required: true },
    iva: Number,
    paymentMode: { type: String, enum: VIATICO_PAYMENT_MODES },
  },
  { _id: false }
);

const ViaticoMaterialSchema = new Schema<IViaticoMaterial>(
  {
    descripcion: { type: String, required: true },
    cantidad: Number,
    monto: { type: Number, required: true },
    iva: Number,
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
    iva: Number,
  },
  { _id: false }
);

const ViaticoTopeGastoSchema = new Schema<IViaticoTopeGasto>(
  {
    descripcion: { type: String, required: true },
    monto: { type: Number, required: true },
    iva: Number,
    paymentMode: { type: String, enum: VIATICO_PAYMENT_MODES },
  },
  { _id: false }
);

const ViaticoTopeDiarioSchema = new Schema<IViaticoTopeDiario>(
  {
    employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    monto: { type: Number, required: true },
    iva: Number,
    gastos: { type: [ViaticoTopeGastoSchema], default: [] },
  },
  { _id: false }
);

const ViaticoSchema = new Schema<IViatico>({
  nombre: { type: String, required: true },
  paidBy: String,
  fechaInicio: { type: Date, required: true },
  fechaFin: { type: Date, required: true },
  empleados: { type: [ViaticoEmpleadoSchema], default: [] },
  condiciones: ViaticoCondicionesSchema,
  documentos: { type: [ViaticoDocumentoSchema], default: [] },
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

ViaticoSchema.index({ fechaInicio: -1 });

export const Viatico =
  (models.Viatico as Model<IViatico>) || model<IViatico>("Viatico", ViaticoSchema);