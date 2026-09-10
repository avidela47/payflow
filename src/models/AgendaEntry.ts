import mongoose, { Schema, models, model, Model } from "mongoose";

// Recordatorios cargados a mano. El mail diario los combina con los
// vencimientos de Cheques y Costos Fijos que caen ese mismo día — ver
// src/lib/agenda-digest.ts. "sent" evita que un recordatorio ya avisado
// se vuelva a mandar si el cron corre más de una vez el mismo día.
export interface IAgendaEntry {
  _id: mongoose.Types.ObjectId;
  title: string;
  date: Date;
  notes?: string;
  sent: boolean;
  sentAt?: Date;
  createdAt: Date;
}

const AgendaEntrySchema = new Schema<IAgendaEntry>({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  notes: String,
  sent: { type: Boolean, default: false },
  sentAt: Date,
  createdAt: { type: Date, default: Date.now },
});

AgendaEntrySchema.index({ date: 1 });

export const AgendaEntry =
  (models.AgendaEntry as Model<IAgendaEntry>) ||
  model<IAgendaEntry>("AgendaEntry", AgendaEntrySchema);