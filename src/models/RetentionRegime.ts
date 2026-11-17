import mongoose, { Schema, models, model, Model } from "mongoose";

// Catálogo EDITABLE de regímenes de retención de Ganancias (RG 830/ARCA) —
// a propósito no son constantes hardcodeadas en el código. AFIP cambia
// estos porcentajes y mínimos por resolución de tanto en tanto, y la
// calculadora oficial (servicioscf.afip.gob.ar/calc-rg830) no expone sus
// valores para leerlos por código. Mejor que la contadora pueda corregir
// un número acá adentro cuando haga falta, sin depender de un redeploy.
//
// Sembrado inicial (ver README/VPS): código 78 "Compra de bienes", 2%
// inscripto / 10% no inscripto, mínimo no sujeto a retención $224.000 —
// tomado de fuentes públicas al momento de crear este módulo. VERIFICAR
// contra la calculadora oficial antes de confiar en él para un pago real.
export interface IRetentionRegime {
  _id: mongoose.Types.ObjectId;
  codigo: string;
  concepto: string;
  // Porcentajes como número (2 = 2%), no fracción.
  alicuotaInscripto: number;
  alicuotaNoInscripto: number;
  // Monto no sujeto a retención, acumulado por mes/proveedor. Solo aplica
  // a inscriptos — a un no inscripto se le retiene sobre el total.
  montoNoImponible: number;
  activo: boolean;
  createdAt: Date;
}

const RetentionRegimeSchema = new Schema<IRetentionRegime>(
  {
    codigo: { type: String, required: true, unique: true },
    concepto: { type: String, required: true },
    alicuotaInscripto: { type: Number, required: true },
    alicuotaNoInscripto: { type: Number, required: true },
    montoNoImponible: { type: Number, required: true, default: 0 },
    activo: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const RetentionRegime =
  (models.RetentionRegime as Model<IRetentionRegime>) ||
  model<IRetentionRegime>("RetentionRegime", RetentionRegimeSchema);