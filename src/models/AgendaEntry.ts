import mongoose, { Schema, models, model, Model } from "mongoose";

// Recordatorios cargados a mano, privados por usuario (cada uno ve y
// administra solo los suyos — mismo criterio que Notas, ver Note.ts). El
// mail diario de las 8am sigue siendo uno solo combinando los recordatorios
// de TODOS los usuarios (no hay email real cargado para todos, así que no
// se puede mandar un digest personalizado por persona) — ver
// src/lib/agenda-digest.ts, que a propósito no filtra por `user`.
// "sent" evita que un recordatorio ya avisado se vuelva a mandar si el
// cron corre más de una vez el mismo día.
export interface IAgendaEntry {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  title: string;
  date: Date;
  notes?: string;
  sent: boolean;
  sentAt?: Date;
  createdAt: Date;
}

const AgendaEntrySchema = new Schema<IAgendaEntry>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  date: { type: Date, required: true },
  notes: String,
  sent: { type: Boolean, default: false },
  sentAt: Date,
  createdAt: { type: Date, default: Date.now },
});

AgendaEntrySchema.index({ date: 1 });
AgendaEntrySchema.index({ user: 1, date: -1 });

export const AgendaEntry =
  (models.AgendaEntry as Model<IAgendaEntry>) ||
  model<IAgendaEntry>("AgendaEntry", AgendaEntrySchema);