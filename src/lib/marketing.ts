// Marketing & Task — tipos y lógica pura. Port de las líneas 1057-1507 del
// original (renderMarketingBoard/buildMonthCalendar/buildGenericTask),
// recortado a lo que Ariel confirmó usar de verdad (2026-11-25):
//
//   - Tareas generales (mktasks): checklist simple, con recordatorio propio.
//   - Calendario de contenidos por mes (content): IG/LI/Cande-LI/Blog/News/Otro.
//   - Recordatorios (reminders), scope "marketing" — sistema genérico del
//     original que también usa en Proyectos/Arquitectura/Gestión, pero ahí
//     TODAVÍA no está portado (gap ya disclosed en esos módulos) — acá se
//     arma por primera vez, scopeado a "marketing" únicamente por ahora.
//
// Deliberadamente AFUERA (confirmado con Ariel):
//   - El botón "Cargar plan de redes": en el original importa un JSON
//     hardcodeado con el plan real de contenidos de noviembre 2026 (copys ya
//     escritos, órdenes para Claude). Calcarlo dejaría una carga de un solo
//     mes enterrada para siempre en el código fuente — se carga a mano desde
//     el calendario en su lugar.
//   - "Proyectos de marketing" (mkprojects): existe en el original (modelo,
//     Firestore, hasta la fila de UI armada) pero NUNCA se conecta a
//     ninguna pantalla — código muerto, nunca usado en la app real.
import { dbProyectos } from "./firebase-proyectos";
import { doc, setDoc, deleteDoc } from "firebase/firestore";

export const MN = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const WEEKDAYS_MON_FIRST = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export type Canal = "IG" | "LI" | "CS" | "BLOG" | "NEWS" | "OTRO";
export const CANAL_LABEL: Record<Canal, string> = {
  IG: "Instagram ITELSA",
  LI: "LinkedIn ITELSA",
  CS: "LinkedIn Candelaria",
  BLOG: "Blog",
  NEWS: "Newsletter",
  OTRO: "Otro",
};
export const CANAL_CHIP: Record<Canal, string> = { IG: "IG", LI: "LI", CS: "CANDE", BLOG: "BLOG", NEWS: "NEWS", OTRO: "OTRO" };
// Orden de los chips dentro de un día — igual que RP_ORD del original
// (BLOG/NEWS/OTRO sin prioridad explícita quedan al final).
const CANAL_ORDEN: Partial<Record<Canal, number>> = { IG: 1, LI: 2, CS: 3, BLOG: 4, NEWS: 5 };
export function canalOrden(c?: Canal): number {
  return (c && CANAL_ORDEN[c]) || 9;
}

export const RP_EST = ["Pendiente", "En proceso", "Publicado"] as const;
export type ContentEstado = (typeof RP_EST)[number];
// Acepta también "En producción"/"Listo" (estados viejos del original) para
// no perder publicaciones ya cargadas con esos valores.
export function rpEstIdx(estado?: string): number {
  if (estado === "Publicado") return 2;
  if (estado === "En proceso" || estado === "En producción" || estado === "Listo") return 1;
  return 0;
}

export type ContentItem = {
  id: string;
  canal: Canal;
  date: string; // yyyy-mm-dd
  month: string; // yyyy-mm
  title: string;
  notas?: string;
  programada: boolean;
  estado: string;
  deleted?: boolean;
};

export type MkTask = {
  id: string;
  title: string;
  start?: string;
  end?: string;
  link?: string;
  notas?: string;
  done: boolean;
};

export type Reminder = {
  id: string;
  scope: string;
  projectId?: string | null;
  taskId?: string | null;
  email: string;
  date: string;
  text: string;
  sent: boolean;
  sentAt?: number | null;
};

export function fmtFecha(iso?: string): string {
  if (!iso) return "sin fecha";
  const p = String(iso).split("-");
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return String(iso);
}

export function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

// Meses restantes del año actual (incluido el actual) — igual que
// getRemainingMonths del original: el calendario no muestra meses pasados.
export function getRemainingMonths(): Date[] {
  const today = new Date();
  const y = today.getFullYear();
  const months: Date[] = [];
  for (let m = today.getMonth(); m <= 11; m++) months.push(new Date(y, m, 1));
  if (!months.length) months.push(new Date(y, 11, 1));
  return months;
}

export function monthKeyOf(d: Date): string {
  const m = d.getMonth() + 1;
  return `${d.getFullYear()}-${m < 10 ? "0" + m : m}`;
}

export function monthLabelOf(d: Date): string {
  return `${MN[d.getMonth()]} ${d.getFullYear()}`;
}

// Días del mes como grilla con relleno (lunes primero) — mismo criterio de
// buildMonthCalendar del original, pero devuelve datos en vez de armar DOM.
export function buildMonthDays(monthDate: Date): (string | null)[] {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const firstDay = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7; // 0 = lunes
  const out: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) out.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const mk = monthKeyOf(monthDate);
    out.push(`${mk}-${day < 10 ? "0" + day : day}`);
  }
  return out;
}

// ── Firestore — mismas colecciones que el original (db compartida con
// proyectos-itelsa.itelsasas.com): "content", "mktasks", "reminders".
export function saveContentItem(it: ContentItem): Promise<void> {
  return setDoc(doc(dbProyectos, "content", it.id), it).then(() => undefined);
}
export function deleteContentItem(id: string): Promise<void> {
  return deleteDoc(doc(dbProyectos, "content", id)).then(() => undefined);
}
export function saveGenericTask(t: MkTask): Promise<void> {
  return setDoc(doc(dbProyectos, "mktasks", t.id), t).then(() => undefined);
}
export function deleteGenericTask(id: string): Promise<void> {
  return deleteDoc(doc(dbProyectos, "mktasks", id)).then(() => undefined);
}
export function saveReminder(r: Reminder): Promise<void> {
  return setDoc(doc(dbProyectos, "reminders", r.id), r).then(() => undefined);
}
export function deleteReminder(id: string): Promise<void> {
  return deleteDoc(doc(dbProyectos, "reminders", id)).then(() => undefined);
}
// Recordatorios vencidos y listos para disparar — port de checkReminders:
// solo cuando está completo (mail+fecha+texto) para no mandarlo a mitad de
// carga, y solo si la fecha ya llegó.
export function recordatoriosVencidos(reminders: Reminder[]): Reminder[] {
  const today = hoy();
  return reminders.filter((r) => !r.sent && r.email && r.date && r.text && r.text.trim() && r.date <= today);
}
