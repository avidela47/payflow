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

  // Mismo buzón que el resto de las alertas de PayFlow (ver AGENDA_RECIPIENT_EMAIL
  // en Agenda/Calendario) — Ariel confirmó el destino explícitamente acá,
  // 2026-11-26, así que admin@itelsasas.com queda como default aunque esa
  // variable de entorno no esté seteada.
  const recipient = process.env.AGENDA_RECIPIENT_EMAIL || "admin@itelsasas.com";

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
