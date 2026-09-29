import mongoose, { Schema, models, model, Model } from "mongoose";
import { NOTE_COLORS, type NoteColor } from "@/lib/note-colors";

// Calendario tipo Google Calendar, privado por usuario (cada uno ve y
// administra solo sus propios eventos — mismo criterio que Notas, ver
// Note.ts; antes era compartido entre OWNER y ACCOUNTANT, dejó de serlo).
// No manda mail, es puramente visual (a diferencia de Agenda, que sí manda
// el digest de las 8am). Reusa la misma paleta de 6 colores que Notas
// (@/lib/note-colors) para no duplicar el lookup.
export interface ICalendarEvent {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  title: string;
  notes?: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  color: NoteColor;
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
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CalendarEventSchema.index({ startsAt: 1 });
CalendarEventSchema.index({ user: 1, startsAt: 1 });

export const CalendarEvent =
  (models.CalendarEvent as Model<ICalendarEvent>) ||
  model<ICalendarEvent>("CalendarEvent", CalendarEventSchema);