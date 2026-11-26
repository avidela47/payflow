import { connectDB } from "@/lib/db";
import { Licitacion, type LicitacionEstado } from "@/models/Licitacion";
import { sendMail } from "@/lib/mail";

function estadoLabel(estado: LicitacionEstado): string {
  switch (estado) {
    case "INSCRIPTO":
      return "Inscripto";
    case "EN_TRAMITE":
      return "En trámite";
    case "NO_INSCRIPTO":
    default:
      return "No inscripto";
  }
}

function escapeHtml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Resumen SEMANAL del registro completo de Licitaciones. A diferencia del
// digest diario de Agenda/Calendario (que solo avisa lo de HOY y se
// "consume" marcando sent=true), este manda TODO el registro tal cual
// está cada vez que corre — confirmado con Ariel: "resumen de todo", no
// solo lo pendiente. Por eso no hay flag de "ya avisado" acá: es un
// snapshot completo, no un conjunto de pendientes que se vacía.
export async function runLicitacionesDigest() {
  await connectDB();

  const entidades = await Licitacion.find({}).sort({ entidad: 1 }).lean();
  if (entidades.length === 0) {
    return { sent: false, count: 0 };
  }

  const recipient = process.env.AGENDA_RECIPIENT_EMAIL;
  if (!recipient) {
    throw new Error("Falta AGENDA_RECIPIENT_EMAIL en las variables de entorno.");
  }

  const lines: string[] = [];
  for (const e of entidades) {
    if (lines.length > 0) lines.push("");
    lines.push(
      `${e.entidad} — ${estadoLabel(e.estado)}${
        e.numeroProveedor ? ` (N° proveedor ${e.numeroProveedor})` : ""
      }`
    );
    for (const item of e.licitaciones ?? []) {
      lines.push(`  · Licitación ${item.numero} — ${estadoLabel(item.estado)}`);
    }
    if (e.observaciones) {
      lines.push(`  Obs: ${e.observaciones}`);
    }
  }

  const text = lines.join("\n");
  const html = `<pre style="font-family: inherit; white-space: pre-wrap; font-size: 14px;">${lines
    .map(escapeHtml)
    .join("\n")}</pre>`;

  await sendMail({
    to: recipient,
    subject: `PayFlow — Resumen semanal de Licitaciones (${entidades.length} entidad${
      entidades.length === 1 ? "" : "es"
    })`,
    text,
    html,
  });

  return { sent: true, count: entidades.length };
}
