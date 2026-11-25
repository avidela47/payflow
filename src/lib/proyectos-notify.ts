// Notificaciones por email de la pestaña "Proyectos" — portado tal cual de
// sendEmailNotif/sendNewProjectNotification/notifyEstadoFinal/emailsInvolucrados
// en /tmp/protectos-itelsa/index.html (líneas 1683-1865), confirmado leyendo el
// código real, no adivinado. Usa el mismo EMAILJS_SERVICE/TEMPLATE/KEY y los
// mismos nombres de campo de la plantilla (to_email, asunto, titulo, mensaje,
// detalle, quien, fecha, link_app + los 3 campos de compatibilidad con la
// plantilla vieja).
//
// Diferencia a propósito con el original: ahí `currentUser` es una variable
// global; acá se recibe como parámetro (quienSosId) porque React no tiene esa
// bolsa de estado global.
//
// Riesgo conocido: si el EmailJS de Ariel tiene restricción de dominio
// (whitelist de orígenes permitidos en el dashboard de EmailJS), los envíos
// desde payflow.itelsasas.com pueden fallar silenciosamente aunque el código
// esté bien. Si no llegan los mails, revisar esa whitelist primero.
import { TEAM, TEAM_EMAILS, EMAILJS_SERVICE, EMAILJS_TEMPLATE, EMAILJS_KEY } from "./proyectos-team";
import type { ProyectoDoc } from "@/app/(dashboard)/pipeline/pipeline-client";

const APP_URL = "https://payflow.itelsasas.com/pipeline";
const OBRA_NOTIFY_EMAIL = "liopalencia35@gmail.com";
const ADMIN_EMAIL = "admin@itelsasas.com";

// Mismo `getDept(section).label` del original (DEPTS) — solo las 3 áreas que
// hoy escriben en esta colección compartida desde PayFlow. "gestion" queda
// listo para cuando se construya Gestión de Proyectos (1b).
function deptLabel(section: string): string {
  switch (section) {
    case "proyectos":
      return "ARQUITECTURA";
    case "gestion":
      return "GESTION DE PROYECTOS";
    case "pipeline":
    default:
      return "PROYECTOS";
  }
}

type EmailEvent = {
  asunto: string;
  titulo?: string;
  mensaje?: string;
  detalle: string[];
};

function fmtFecha(iso?: string): string {
  if (!iso) return "sin fecha";
  const p = String(iso).split("-");
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return String(iso);
}

function ahoraTexto(): string {
  const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const d = new Date();
  return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()} a las ${z(d.getHours())}:${z(d.getMinutes())}`;
}

function currentUserName(quienSosId: string): string {
  return TEAM.find((m) => m.id === quienSosId)?.name ?? "";
}

function nombresDeIds(ids: string[]): string {
  return ids
    .map((id) => TEAM.find((m) => m.id === id)?.name)
    .filter(Boolean)
    .join(", ");
}

async function sendEmailNotif(toEmail: string, ev: EmailEvent, quienSosId: string): Promise<void> {
  const detalleTxt = ev.detalle.join("\n");
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE,
        template_id: EMAILJS_TEMPLATE,
        user_id: EMAILJS_KEY,
        template_params: {
          to_email: toEmail,
          asunto: ev.asunto,
          titulo: ev.titulo || ev.asunto,
          mensaje: ev.mensaje || "",
          detalle: detalleTxt,
          quien: currentUserName(quienSosId),
          fecha: ahoraTexto(),
          link_app: APP_URL,
          proyecto_nombre: ev.asunto,
          proyecto_seccion: ev.mensaje || "",
          proyecto_prioridad: detalleTxt.replace(/\n/g, " | "),
        },
      }),
    });
    if (!res.ok) console.warn("EmailJS error:", await res.text());
  } catch (err) {
    console.warn("EmailJS error:", err);
  }
}

function sendToList(list: string[], ev: EmailEvent, quienSosId: string): void {
  const seen = new Set<string>();
  list.forEach((e) => {
    if (!e) return;
    const k = e.trim().toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    void sendEmailNotif(e.trim(), ev, quienSosId);
  });
}

// Todo el equipo con email conocido, salvo quienSos y los ids en excludeIds.
function teamEmails(excludeIds: string[], quienSosId: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  TEAM.forEach((m) => {
    if (m.id === quienSosId || excludeIds.includes(m.id)) return;
    const e = TEAM_EMAILS[m.id];
    if (e && !seen.has(e.toLowerCase())) {
      seen.add(e.toLowerCase());
      out.push(e);
    }
  });
  return out;
}

function proyectoResumen(p: ProyectoDoc): string[] {
  const det = [
    `Proyecto: ${p.name}`,
    `Area: ${deptLabel(p.section)}`,
    `Prioridad: ${p.priority || "media"}`,
    `Fecha de inicio: ${fmtFecha(p.start)}`,
    `Fecha de fin: ${fmtFecha(p.end)}`,
  ];
  const obra = p.obra as { start?: string; end?: string } | undefined;
  if (obra && (obra.start || obra.end)) {
    det.push(`Inicio de obra: ${fmtFecha(obra.start)}`);
    det.push(`Fin de obra: ${fmtFecha(obra.end)}`);
  }
  det.push(`Equipo asignado: ${nombresDeIds(p.members) || "todavía sin asignar"}`);
  return det;
}

// Regla original: proyecto nuevo -> todo el equipo menos quien lo creó y
// menos Flor ("t7", admin) — confirmado en el código (sendNewProjectNotification).
export function notificarProyectoNuevo(p: ProyectoDoc, quienSosId: string): void {
  const dept = deptLabel(p.section);
  sendToList(teamEmails(["t7"], quienSosId), {
    asunto: `Nuevo proyecto: ${p.name}`,
    titulo: "Se creó un proyecto nuevo",
    mensaje: `${currentUserName(quienSosId)} creó el proyecto "${p.name}" en ${dept}, con prioridad ${p.priority || "media"}.`,
    detalle: [
      `Proyecto: ${p.name}`,
      `Area: ${dept}`,
      `Prioridad: ${p.priority || "media"}`,
      `Fecha de inicio: ${fmtFecha(p.start)}`,
      `Fecha de fin: ${fmtFecha(p.end)}`,
      `Equipo asignado: ${nombresDeIds(p.members) || "todavía sin asignar"}`,
    ],
  }, quienSosId);
}

// Regla original: vendido/finalizado -> todo el equipo menos quien hizo el
// cambio (notifyEstadoFinal). "Terminado" en vez de "Finalizado" para
// Arquitectura (section "proyectos"), igual texto que el original. Si pasa a
// vendido, además se avisa al email de obra — pero solo para `pipeline`
// (Arquitectura nunca pasa a vendido, el original tampoco lo permite ahí).
export function notificarEstadoFinal(p: ProyectoDoc, status: "vendido" | "finalizado", quienSosId: string): void {
  const lbl = status === "vendido" ? "vendido" : p.section === "proyectos" ? "terminado" : "finalizado";
  const lista = teamEmails([], quienSosId);
  if (status === "vendido" && p.section === "pipeline") lista.push(OBRA_NOTIFY_EMAIL);
  sendToList(lista, {
    asunto: `Proyecto ${lbl}: ${p.name}`,
    titulo: `Un proyecto pasó a ${lbl}`,
    mensaje: `${currentUserName(quienSosId)} marcó el proyecto "${p.name}" como ${lbl}.`,
    detalle: proyectoResumen(p),
  }, quienSosId);
}

// Botón "Enviar a administración" del bloque Seguros (Gestión de Proyectos).
// Port de sendSegurosEmail (líneas 3527-3542 del original) — ahí `personas`
// salía de EMPLEADOS (hardcodeado); acá ya viene resuelta desde Empleados
// real + "otros" (ver SegurosBlock en gestion-blocks.tsx), por eso se recibe
// como parámetro en vez de volver a buscarla acá.
export function notificarSeguros(
  p: ProyectoDoc,
  personas: { nombre: string; dni?: string; nac?: string }[],
  quienSosId: string
): void {
  const seguros = p.seguros as { desde?: string; hasta?: string; datos?: string } | undefined;
  const det = [
    `Obra: ${p.name}`,
    `Cobertura: del ${fmtFecha(seguros?.desde || p.start)} al ${fmtFecha(seguros?.hasta || p.end)}`,
    "",
    "Personal a asegurar:",
    ...personas.map((x) => `- ${x.nombre} | DNI ${x.dni || "sin cargar"} | Nac. ${fmtFecha(x.nac)}`),
  ];
  if (seguros?.datos?.trim()) {
    det.push("", "Tipo de seguro y datos extra:", seguros.datos.trim());
  }
  sendEmailNotif(ADMIN_EMAIL, {
    asunto: `Solicitud de seguros: ${p.name}`,
    titulo: "Solicitud de seguros para obra",
    mensaje: `${currentUserName(quienSosId)} pide sacar seguros para ${personas.length} persona(s) en la obra "${p.name}".`,
    detalle: det,
  }, quienSosId);
}

// Botón "Notificar" manual: a los miembros del proyecto (+ extra opcional),
// nunca a quien lo manda. Si no tiene miembros cargados, avisa a todo el
// equipo (misma regla que emailsInvolucrados del original).
export function notificarManual(
  p: ProyectoDoc,
  asunto: string,
  mensaje: string,
  quienSosId: string,
  extraEmails: string[] = [],
  incluirResumen = false
): void {
  const ids = p.members && p.members.length > 0 ? p.members : TEAM.map((m) => m.id);
  const emails = new Set<string>();
  ids.forEach((id) => {
    if (id === quienSosId) return;
    const e = TEAM_EMAILS[id];
    if (e) emails.add(e.toLowerCase());
  });
  extraEmails.forEach((e) => e.trim() && emails.add(e.trim().toLowerCase()));
  sendToList(Array.from(emails), {
    asunto,
    titulo: asunto,
    mensaje,
    detalle: incluirResumen ? proyectoResumen(p) : [],
  }, quienSosId);
}
