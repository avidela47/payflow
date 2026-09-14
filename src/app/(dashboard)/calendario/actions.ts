"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CalendarEvent } from "@/models/CalendarEvent";
import { NOTE_COLORS } from "@/lib/note-colors";

// Compartido entre OWNER y ACCOUNTANT — cualquiera de los dos puede
// crear/editar/borrar cualquier evento, no hay dueño individual (a
// diferencia de Notas, que es privado por usuario).

const eventSchema = z
  .object({
    title: z.string().min(1, "Falta el título."),
    notes: z.string().optional(),
    date: z.string().min(1, "Falta la fecha."), // "YYYY-MM-DD"
    allDay: z.coerce.boolean().default(false),
    startTime: z.string().optional(), // "HH:MM", solo si !allDay
    endTime: z.string().optional(), // "HH:MM", solo si !allDay
    color: z.enum(NOTE_COLORS).default("blue"),
  })
  .transform((data) => ({ ...data, allDay: !!data.allDay }));

// Argentina es UTC-3 fijo (sin horario de verano) — mismo criterio que
// src/lib/agenda-digest.ts. Construimos el instante en UTC a mano en vez
// de usar `new Date(y, m, d, h, min)`, porque ese constructor toma la
// zona horaria del entorno donde corre el código — en Vercel corre en
// UTC, así que "09:00" terminaría guardado como las 6am hora Argentina.
const ARGENTINA_OFFSET_HOURS = 3;

function buildDateTime(dateStr: string, timeStr: string | undefined, fallbackHour: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  let hour = fallbackHour;
  let minute = 0;
  if (timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    hour = h;
    minute = m;
  }
  return new Date(Date.UTC(year, month - 1, day, hour + ARGENTINA_OFFSET_HOURS, minute, 0));
}

function parseEventForm(formData: FormData) {
  return eventSchema.safeParse({
    title: formData.get("title"),
    notes: formData.get("notes") || undefined,
    date: formData.get("date"),
    allDay: formData.get("allDay") === "on" || formData.get("allDay") === "true",
    startTime: formData.get("startTime") || undefined,
    endTime: formData.get("endTime") || undefined,
    color: formData.get("color") || "blue",
  });
}

// Resuelve inicio/fin reales según sea evento con horario o "todo el día".
// Si el horario de fin quedó antes o igual al de inicio, lo empujamos 1
// hora para no guardar un evento con duración negativa o cero.
function resolveRange(data: z.infer<typeof eventSchema>) {
  if (data.allDay) {
    const startsAt = buildDateTime(data.date, undefined, 0);
    // Fin de ese mismo día: medianoche + casi 24hs, en milisegundos puros
    // (evitamos setMinutes/setHours locales acá para no depender de
    // ninguna zona horaria de por medio).
    const endsAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { startsAt, endsAt };
  }

  const startsAt = buildDateTime(data.date, data.startTime, 9);
  let endsAt = buildDateTime(data.date, data.endTime, 10);
  if (endsAt.getTime() <= startsAt.getTime()) {
    endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  }
  return { startsAt, endsAt };
}

export async function createCalendarEvent(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseEventForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { startsAt, endsAt } = resolveRange(parsed.data);

  try {
    await connectDB();
    await CalendarEvent.create({
      title: parsed.data.title,
      notes: parsed.data.notes,
      startsAt,
      endsAt,
      allDay: parsed.data.allDay,
      color: parsed.data.color,
    });
  } catch (err) {
    console.error("createCalendarEvent error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear el evento: ${message}` };
  }

  revalidatePath("/calendario");
  return { ok: true };
}

export async function updateCalendarEvent(eventId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseEventForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { startsAt, endsAt } = resolveRange(parsed.data);

  try {
    await connectDB();
    await CalendarEvent.findByIdAndUpdate(eventId, {
      title: parsed.data.title,
      notes: parsed.data.notes,
      startsAt,
      endsAt,
      allDay: parsed.data.allDay,
      color: parsed.data.color,
    });
  } catch (err) {
    console.error("updateCalendarEvent error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo editar el evento: ${message}` };
  }

  revalidatePath("/calendario");
  return { ok: true };
}

export async function deleteCalendarEvent(eventId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    await CalendarEvent.findByIdAndDelete(eventId);
  } catch (err) {
    console.error("deleteCalendarEvent error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar el evento: ${message}` };
  }

  revalidatePath("/calendario");
  return { ok: true };
}