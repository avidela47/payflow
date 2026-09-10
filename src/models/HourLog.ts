import mongoose, { Schema, models, model, Model } from "mongoose";

export interface IHourLog {
  _id: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  hours: number;
  hourlyRate: number;
  total: number;
  notes?: string;
  createdAt: Date;
}

const HourLogSchema = new Schema<IHourLog>({
  employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  hours: { type: Number, required: true },
  hourlyRate: { type: Number, required: true },
  total: { type: Number, required: true },
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

HourLogSchema.index({ employee: 1 });

export const HourLog =
  (models.HourLog as Model<IHourLog>) || model<IHourLog>("HourLog", HourLogSchema);
