import { connectDB } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { CalendarClient, type CalendarEventItem } from "./calendario-client";

// Traemos una ventana amplia (6 meses atrás / 6 adelante) y el resto de
// la navegación entre mes/semana/día se hace en el cliente, sin volver a
// pedirle nada al servidor — para un calendario de uso interno esto es de
// sobra y evita tener que paginar por vista.
export default async function CalendarioPage() {
  await connectDB();

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 7, 0);

  const events = await CalendarEvent.find({ startsAt: { $gte: from, $lte: to } })
    .sort({ startsAt: 1 })
    .limit(1000)
    .lean();

  const eventItems: CalendarEventItem[] = events.map((event) => ({
    id: event._id.toString(),
    title: event.title,
    notes: event.notes,
    startsAtISO: event.startsAt.toISOString(),
    endsAtISO: event.endsAt.toISOString(),
    allDay: event.allDay,
    color: event.color,
  }));

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Calendario</h1>
        <p className="text-sm text-muted-foreground">
          Vista mes / semana / día — solo visual, no manda mail (para avisos por mail usá Agenda).
        </p>
      </div>

      <CalendarClient events={eventItems} />
    </div>
  );
}