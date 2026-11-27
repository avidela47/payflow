import { connectDB } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { Check } from "@/models/Check";
import { FixedCostEntry } from "@/models/FixedCost";
import { User } from "@/models/User";
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

  const globalRecipient = process.env.AGENDA_RECIPIENT_EMAIL;
  if (!globalRecipient) {
    throw new Error("Falta AGENDA_RECIPIENT_EMAIL en las variables de entorno.");
  }

  // 2026-11-27, pedido de Ariel: cada usuario con `notificationEmail`
  // cargado (ver User.ts — se va completando de a poco con
  // scripts/set-notification-emails.ts) recibe en SU mail solo SUS
  // propios eventos de hoy. El mail global de siempre
  // (AGENDA_RECIPIENT_EMAIL) sigue existiendo para cheques/costos fijos
  // (no son de ningún usuario puntual) y como red de contención para los
  // eventos de quien todavía no tiene notificationEmail cargado — así
  // nunca se pierde un aviso por faltar ese dato.
  const userIds = [...new Set(calendarItems.map((item) => item.user?.toString()).filter((id): id is string => Boolean(id)))];
  const users =
    userIds.length > 0 ? await User.find({ _id: { $in: userIds } }).select("notificationEmail").lean() : [];
  const notificationEmailById = new Map(users.map((u) => [u._id.toString(), u.notificationEmail]));

  type CalendarItem = (typeof calendarItems)[number];
  const eventsByUserEmail = new Map<string, CalendarItem[]>();
  const eventsSinMailPropio: CalendarItem[] = [];

  for (const item of calendarItems) {
    const mail = item.user ? notificationEmailById.get(item.user.toString()) : undefined;
    if (mail) {
      const list = eventsByUserEmail.get(mail) ?? [];
      list.push(item);
      eventsByUserEmail.set(mail, list);
    } else {
      eventsSinMailPropio.push(item);
    }
  }

  let sentCount = 0;

  // Un mail por usuario con notificationEmail propio, solo con sus eventos.
  for (const [mail, userItems] of eventsByUserEmail) {
    const lines = ["Calendario de hoy:"];
    for (const item of userItems) {
      lines.push(`- ${item.title}${item.notes ? ` — ${item.notes}` : ""}`);
    }
    const text = lines.join("\n");
    const html = `<pre style="font-family: inherit; white-space: pre-wrap; font-size: 14px;">${lines
      .map(escapeHtml)
      .join("\n")}</pre>`;

    await sendMail({
      to: mail,
      subject: `PayFlow — Tu agenda del ${formatDate(today)}`,
      text,
      html,
    });
    sentCount += userItems.length;
  }

  // Mail global de siempre: eventos de quien no tiene notificationEmail
  // todavía + cheques + costos fijos (mismo formato que antes de este
  // cambio).
  const globalLines: string[] = [];

  if (eventsSinMailPropio.length > 0) {
    globalLines.push("Calendario de hoy:");
    for (const item of eventsSinMailPropio) {
      globalLines.push(`- ${item.title}${item.notes ? ` — ${item.notes}` : ""}`);
    }
  }

  if (checks.length > 0) {
    if (globalLines.length > 0) globalLines.push("");
    globalLines.push("Cheques que vencen hoy:");
    for (const check of checks) {
      const typeLabel = check.type === "ELECTRONICO" ? "E-cheq" : "Físico";
      globalLines.push(
        `- ${check.issuerName} — ${formatCurrency(check.amount)} (${typeLabel} ${check.checkNumber})`
      );
    }
  }

  if (fixedCosts.length > 0) {
    if (globalLines.length > 0) globalLines.push("");
    globalLines.push("Costos fijos que vencen hoy:");
    for (const cost of fixedCosts) {
      const categoryDoc =
        cost.category && typeof cost.category === "object" && "name" in cost.category
          ? (cost.category as unknown as { name: string })
          : null;
      globalLines.push(
        `- ${categoryDoc ? categoryDoc.name : "Categoría eliminada"} — ${formatCurrency(cost.amount)}`
      );
    }
  }

  if (globalLines.length > 0) {
    const text = globalLines.join("\n");
    const html = `<pre style="font-family: inherit; white-space: pre-wrap; font-size: 14px;">${globalLines
      .map(escapeHtml)
      .join("\n")}</pre>`;

    await sendMail({
      to: globalRecipient,
      subject: `PayFlow — Agenda del ${formatDate(today)}`,
      text,
      html,
    });
    sentCount += eventsSinMailPropio.length + checks.length + fixedCosts.length;
  }

  if (calendarItems.length > 0) {
    await CalendarEvent.updateMany(
      { _id: { $in: calendarItems.map((item) => item._id) } },
      { sent: true, sentAt: new Date() }
    );
  }

  return { sent: sentCount > 0, count: sentCount };
}