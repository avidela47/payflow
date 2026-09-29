import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { AgendaEntry } from "@/models/AgendaEntry";
import { AgendaClient, type AgendaEntryItem } from "./agenda-client";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    date
  );
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AgendaPage() {
  const session = await getSession();
  await connectDB();

  // Privado por usuario (ver AgendaEntry.ts) — el mail de las 8am sigue
  // combinando los recordatorios de todos, pero acá en pantalla cada uno
  // ve y administra solo los suyos.
  const entries = session?.user
    ? await AgendaEntry.find({ user: session.user.id }).sort({ date: -1 }).limit(200).lean()
    : [];

  const entryItems: AgendaEntryItem[] = entries.map((entry) => ({
    id: entry._id.toString(),
    title: entry.title,
    dateISO: toDateInputValue(entry.date),
    dateLabel: formatDate(entry.date),
    notes: entry.notes,
    sent: entry.sent,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          Recordatorios con aviso por mail el día agendado — más los vencimientos de Cheques y
          Costos Fijos de ese mismo día.
        </p>
      </div>

      <AgendaClient entries={entryItems} role={session?.user?.role ?? ""} />
    </div>
  );
}