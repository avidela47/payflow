import { Schema, models, model, Model } from "mongoose";

// Colección chica para generar códigos correlativos (ej. CLI-001, CLI-002,
// ...) sin duplicados ni saltos por condiciones de carrera: cada llamada a
// getNextSequence hace un $inc atómico sobre un único documento contador,
// así que dos altas simultáneas nunca pueden terminar con el mismo número
// (a diferencia de "contar cuántos hay y sumar 1", que sí se puede
// duplicar si dos personas guardan casi al mismo tiempo).
export interface ICounter {
  _id: string; // nombre del contador, ej. "client"
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter =
  (models.Counter as Model<ICounter>) || model<ICounter>("Counter", CounterSchema);

export async function getNextSequence(name: string): Promise<number> {
  const result = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return result!.seq;
}