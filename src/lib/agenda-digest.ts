import { connectDB } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { Check } from "@/models/Check";
import { FixedCostEntry } from "@/models/FixedCost";
import { sendMail } from "@/lib/mail";

// Argentina es UTC-3 fijo, sin horario de verano — no hace falta una
// librería de timezones para esto.
const ARGENTINA_OFFSET_HOURS = 3;

function todayInArgentina(): Date {
  const now = new Date();
  const shifted = new Date(now.getTime() - ARGENTINA_OFFSET_HOURS * 60 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

// A diferencia de todayInArgentina() (que da una fecha "pelada", sin hora,
// solo para comparar/mostrar el día — mismo truco que usaba AgendaEntry.date),
// acá necesitamos el instante UTC real de la medianoche en Argentina, porque
// CalendarEvent.startsAt SÍ guarda hora real (ver buildDateTime en
// calendario/actions.ts, que sly suma 3hs para convertir de hora Argentina a
// UTC). Sin este ajuste, un evento cargado a las 23hs Argentina quedaría
// fuera del rango de "hoy".
function todayArgentinaRange(): { start: Date; end: Date } {
  const now = new Date();
  const shifted = new Date(now.getTime() - ARGENTINA_OFFSET_HOURS * 60 * 60 * 1000);
  const start = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), ARGENTINA_OFFSET_HOURS, 0, 0)
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    date
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function escapeHtml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Arma y manda el mail del día: eventos del Calendario de hoy + cheques
// activos que vencen hoy + costos fijos pendientes que vencen hoy. Se usa
// tanto desde el cron como desde el botón "Enviar ahora" (para poder
// probarlo en desarrollo, donde el cron no corre).
// 2026-11-25, pedido de Ariel: antes "los recordatorios" salían de Agenda
// (AgendaEntry) — ahora salen del Calendario (CalendarEvent) en su lugar.
// Agenda sigue existiendo como lista aparte, pero ya no dispara mails.
export async function runAgendaDigest() {
  await connectDB();
  const today = todayInArgentina();
  const { start: todayStart, end: todayEnd } = todayArgentinaRange();

  const [calendarItems, checks, fixedCosts] = await Promise.all([
    CalendarEvent.find({ startsAt: { $gte: todayStart, $lt: todayEnd }, sent: { $ne: true } }).lean(),
    Check.find({ status: "ACTIVO", paymentDate: today }).lean(),
    FixedCostEntry.find({ paid: false, dueDate: today }).populate("category").lean(),
  ]);

  const totalItems = calendarItems.length + checks.length + fixedCosts.length;
  if (totalItems === 0) {
    return { sent: false, count: 0 };
  }

  const recipient = process.env.AGENDA_RECIPIENT_EMAIL;
  if (!recipient) {
    throw new Error("Falta AGENDA_RECIPIENT_EMAIL en las variables de entorno.");
  }

  const lines: string[] = [];

  if (calendarItems.length > 0) {
    lines.push("Calendario de hoy:");
    for (const item of calendarItems) {
      lines.push(`- ${item.title}${item.notes ? ` — ${item.notes}` : ""}`);
    }
  }

  if (checks.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("Cheques que vencen hoy:");
    for (const check of checks) {
      const typeLabel = check.type === "ELECTRONICO" ? "E-cheq" : "Físico";
      lines.push(
        `- ${check.issuerName} — ${formatCurrency(check.amount)} (${typeLabel} ${check.checkNumber})`
      );
    }
  }

  if (fixedCosts.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("Costos fijos que vencen hoy:");
    for (const cost of fixedCosts) {
      const categoryDoc =
        cost.category && typeof cost.category === "object" && "name" in cost.category
          ? (cost.category as unknown as { name: string })
          : null;
      lines.push(`- ${categoryDoc ? categoryDoc.name : "Categoría eliminada"} — ${formatCurrency(cost.amount)}`);
    }
  }

  const text = lines.join("\n");
  const html = `<pre style="font-family: inherit; white-space: pre-wrap; font-size: 14px;">${lines
    .map(escapeHtml)
    .join("\n")}</pre>`;

  await sendMail({
    to: recipient,
    subject: `PayFlow — Agenda del ${formatDate(today)}`,
    text,
    html,
  });

  if (calendarItems.length > 0) {
    await CalendarEvent.updateMany(
      { _id: { $in: calendarItems.map((item) => item._id) } },
      { sent: true, sentAt: new Date() }
    );
  }

  return { sent: true, count: totalItems };
}