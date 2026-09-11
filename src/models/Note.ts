import mongoose, { Schema, models, model, Model } from "mongoose";
import { NOTE_COLORS, type NoteColor } from "@/lib/note-colors";

// Notas tipo post-it, privadas por usuario — cada uno ve y administra solo
// las suyas (ver actions.ts: todas las queries/mutaciones filtran por
// `user: session.user.id`, nunca se expone una nota de otro usuario).
// El array de colores vive en @/lib/note-colors (no acá) para que los
// componentes cliente lo puedan importar sin arrastrar mongoose al bundle
// del browser — ver ese archivo para el detalle.
export { NOTE_COLORS };
export type { NoteColor };

export interface INote {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  title?: string;
  content: string;
  color: NoteColor;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema<INote>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: String,
    content: { type: String, required: true },
    color: { type: String, enum: NOTE_COLORS, default: "yellow" },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NoteSchema.index({ user: 1, pinned: -1, updatedAt: -1 });

export const Note = (models.Note as Model<INote>) || model<INote>("Note", NoteSchema);