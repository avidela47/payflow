import mongoose, { Schema, models, model, Model } from "mongoose";
import { NOTE_COLORS, type NoteColor } from "@/lib/note-colors";

// Calendario tipo Google Calendar, privado por usuario (cada uno ve y
// administra solo sus propios eventos — mismo criterio que Notas, ver
// Note.ts; antes era compartido entre OWNER y ACCOUNTANT, dejó de serlo).
// Reusa la misma paleta de 6 colores que Notas (@/lib/note-colors) para no
// duplicar el lookup.
// 2026-11-25, pedido de Ariel: el digest de las 8am dejó de tomar sus
// fechas de Agenda (ver AgendaEntry) y ahora las toma de acá — por eso
// suma `sent`/`sentAt`, mismo mecanismo que tenía AgendaEntry, para que un
// evento ya avisado no se vuelva a mandar si el cron corre más de una vez
// el mismo día (ver src/lib/agenda-digest.ts).
export interface ICalendarEvent {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  title: string;
  notes?: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  color: NoteColor;
  sent: boolean;
  sentAt?: Date;
  createdAt: Date;
}

const CalendarEventSchema = new Schema<ICalendarEvent>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    notes: String,
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    color: { type: String, enum: NOTE_COLORS, default: "blue" },
    sent: { type: Boolean, default: false },
    sentAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CalendarEventSchema.index({ startsAt: 1 });
CalendarEventSchema.index({ user: 1, startsAt: 1 });

export const CalendarEvent =
  (models.CalendarEvent as Model<ICalendarEvent>) ||
  model<ICalendarEvent>("CalendarEvent", CalendarEventSchema);