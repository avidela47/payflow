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

// Documento adjunto de una licitación puntual (pliego, constancia, lo que
// sea) — pedido de Ariel, 2026-11-26: "permitime subir doc, sea pdf jpg
// png". A diferencia de los "documentos" de Empleados/Viáticos (lista que
// se sube con su propia action porque cuelga de un registro que ya existe),
// acá cada licitación puede no existir todavía en la base cuando el
// usuario la está cargando en el modal — así que el archivo viaja con el
// resto del formulario (mismo criterio que la foto de Empleados) y se
// resuelve recién al guardar la entidad completa.
export interface IDocumentoLicitacion {
  nombre: string;
  path: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

// Una licitación puntual dentro de una entidad — "Licitaciones N°" del
// papel, con su propio estado (no hereda el de la entidad: se puede estar
// Inscripto en la entidad en general y, aun así, No inscripto en una
// licitación puntual de esa entidad).
export interface ILicitacionItem {
  numero: string;
  estado: LicitacionEstado;
  documento?: IDocumentoLicitacion;
}

export interface ILicitacion {
  _id: mongoose.Types.ObjectId;
  entidad: string;
  estado: LicitacionEstado;
  numeroProveedor?: string;
  licitaciones: ILicitacionItem[];
  // Documentación general de la entidad (constancia de inscripción, CUIT,
  // lo que sirva), sin atarse a ninguna licitación puntual — pedido de
  // Ariel, 2026-11-26: "diferenciado del número de licitación". Mismo
  // mecanismo de archivo que `documento` de cada item, pero como lista.
  otrosDocumentos: IDocumentoLicitacion[];
  observaciones?: string;
  createdAt: Date;
}

const DocumentoLicitacionSchema = new Schema<IDocumentoLicitacion>(
  {
    nombre: { type: String, required: true },
    path: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, required: true },
  },
  { _id: false }
);

const LicitacionItemSchema = new Schema<ILicitacionItem>(
  {
    numero: { type: String, required: true },
    estado: { type: String, enum: LICITACION_ESTADOS, required: true, default: "EN_TRAMITE" },
    documento: { type: DocumentoLicitacionSchema, required: false },
  },
  { _id: false }
);

const LicitacionSchema = new Schema<ILicitacion>({
  entidad: { type: String, required: true },
  estado: { type: String, enum: LICITACION_ESTADOS, required: true, default: "NO_INSCRIPTO" },
  numeroProveedor: String,
  licitaciones: { type: [LicitacionItemSchema], default: [] },
  otrosDocumentos: { type: [DocumentoLicitacionSchema], default: [] },
  observaciones: String,
  createdAt: { type: Date, default: Date.now },
});

LicitacionSchema.index({ entidad: 1 });

export const Licitacion =
  (models.Licitacion as Model<ILicitacion>) || model<ILicitacion>("Licitacion", LicitacionSchema);
