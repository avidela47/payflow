import mongoose, { Schema, models, model, Model } from "mongoose";
import { NOTE_COLORS, type NoteColor } from "@/lib/note-colors";

// Calendario tipo Google Calendar, compartido (lo ven OWNER y ACCOUNTANT
// por igual, a diferencia de Notas que es privado por usuario) — no manda
// mail, es puramente visual (a diferencia de Agenda, que sí manda el
// digest de las 8am). Reusa la misma paleta de 6 colores que Notas
// (@/lib/note-colors) para no duplicar el lookup.
export interface ICalendarEvent {
  _id: mongoose.Types.ObjectId;
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

export const CalendarEvent =
  (models.CalendarEvent as Model<ICalendarEvent>) ||
  model<ICalendarEvent>("CalendarEvent", CalendarEventSchema);