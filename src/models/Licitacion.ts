import mongoose, { Schema, models, model, Model } from "mongoose";

// Módulo "Licitaciones" (Finanzas) — registro de inscripción de ITELSA
// como proveedor ante distintos organismos/entidades licitantes. Papel de
// Ariel, 2026-11-26: cada ENTIDAD tiene un estado de inscripción propio
// (Inscripto / No inscripto / En trámite), un N° de Proveedor que le
// asignó esa entidad, y puede tener varias Licitaciones puntuales
// adentro — cada una con su propio número y estado (confirmado con Ariel:
// "lista de licitaciones por entidad, cada una con su propio N° y
// Estado"). Alimenta además un resumen semanal por mail con todo el
// registro (ver lib/licitaciones-digest.ts) — mismo mecanismo que el
// digest diario de Agenda/Calendario, pero semanal y sin filtro: manda
// todo tal cual está, no solo lo pendiente.
export const LICITACION_ESTADOS = ["INSCRIPTO", "NO_INSCRIPTO", "EN_TRAMITE"] as const;
export type LicitacionEstado = (typeof LICITACION_ESTADOS)[number];

// Una licitación puntual dentro de una entidad — "Licitaciones N°" del
// papel, con su propio estado (no hereda el de la entidad: se puede estar
// Inscripto en la entidad en general y, aun así, No inscripto en una
// licitación puntual de esa entidad).
export interface ILicitacionItem {
  numero: string;
  estado: LicitacionEstado;
}

export interface ILicitacion {
  _id: mongoose.Types.ObjectId;
  entidad: string;
  estado: LicitacionEstado;
  numeroProveedor?: string;
  licitaciones: ILicitacionItem[];
  observaciones?: string;
  createdAt: Date;
}

const LicitacionItemSchema = new Schema<ILicitacionItem>(
  {
    numero: { type: String, required: true },
    estado: { type: String, enum: LICITACION_ESTADOS, required: true, default: "EN_TRAMITE" },
  },
  { _id: false }
);

const LicitacionSchema = new Schema<ILicitacion>({
  entidad: { type: String, required: true },
  estado: { type: String, enum: LICITACION_ESTADOS, required: true, default: "NO_INSCRIPTO" },
  numeroProveedor: String,
  licitaciones: { type: [LicitacionItemSchema], default: [] },
  observaciones: String,
  createdAt: { type: Date, default: Date.now },
});

LicitacionSchema.index({ entidad: 1 });

export const Licitacion =
  (models.Licitacion as Model<ILicitacion>) || model<ILicitacion>("Licitacion", LicitacionSchema);
