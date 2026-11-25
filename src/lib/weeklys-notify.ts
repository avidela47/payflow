// Emails de Weeklys. Port de wkEmailsOf/wkDetalle/wkCheckAlarms y los 3 avisos
// embebidos en wkItemForm/wkCardBody (líneas 3741-3789, 3919-3924, 4075-4080
// del original). Reutiliza el mismo EmailJS que el resto de Proyectos
// (sendToListAs/currentUserName, exportados desde proyectos-notify.ts).
//
// Diferencia a propósito con el original: ahí wkCheckAlarms corre en CADA
// snapshot del listener global de "weeklys", que en esa app está montado
// siempre (sin importar qué pestaña tenga abierta cada usuario) — por eso
// el comentario original dice "se disparan desde el navegador de quien
// tenga el tablero abierto ese día". Acá el listener solo existe mientras
// alguien tiene la pantalla /weeklys montada (arquitectura de páginas de
// Next.js, no un listener global de toda la app). Si nadie abre Weeklys en
// todo el día, esas alarmas no se disparan ese día — se disparan la
// próxima vez que alguien entre. Aceptado como costo conocido, no silencioso.
import { TEAM, TEAM_EMAILS } from "./proyectos-team";
import { sendToListAs, currentUserName, type EmailEvent } from "./proyectos-notify";
import { fmtFecha, wkAddDays, wkPri, wkToday, WK_EST, type WeeklyItem } from "./weeklys";

const SISTEMA = "Tablero ITELSA";

function wkName(id: string | undefined): string {
  return TEAM.find((m) => m.id === id)?.name ?? "";
}

function wkEmailsOf(ids: (string | undefined)[]): string[] {
  const out: string[] = [];
  ids.forEach((id) => {
    const e = id ? TEAM_EMAILS[id] : undefined;
    if (e && !out.includes(e)) out.push(e);
  });
  return out;
}

function wkDetalle(it: WeeklyItem): string[] {
  const d = [`Prioridad: ${wkPri(it.prioridad).l}`, `Area: ${it.area || "-"}`];
  if (it.responsable) d.push(`Responsable: ${wkName(it.responsable)}`);
  if (it.lider) d.push(`Lider / referente: ${it.lider}`);
  d.push(`Fecha limite: ${it.limite ? fmtFecha(it.limite) : "sin fecha"}`);
  const est = WK_EST.find((e) => e[0] === it.estado);
  d.push(`Estado: ${it.estado === "resuelta" ? "Resuelta" : est ? est[1] : "Pendiente"}`);
  if (it.detalle) d.push(`Detalle: ${it.detalle}`);
  const last = (it.seguimiento ?? []).slice(-1)[0];
  if (last) d.push(`Ultimo seguimiento (${new Date(last.ts).toLocaleDateString("es-AR")}): ${last.texto}`);
  return d;
}

// Botón "Guardar prioridad" — avisa al responsable si no es quien la cargó.
export function notificarPrioridadAsignada(it: WeeklyItem, quienSosId: string): void {
  if (!it.responsable || it.responsable === quienSosId) return;
  sendToListAs(wkEmailsOf([it.responsable]), {
    asunto: `Nueva prioridad semanal: ${it.titulo}`,
    titulo: "Te asignaron una prioridad de la semana",
    mensaje: `${currentUserName(quienSosId)} cargó la prioridad "${it.titulo}" en Weeklys y te dejó como responsable.`,
    detalle: wkDetalle(it),
  }, currentUserName(quienSosId));
}

// Botón "Confirmar resuelta".
export function notificarPrioridadResuelta(it: WeeklyItem, quienSosId: string): void {
  const dest = wkEmailsOf([it.responsable, it.creadoPor].filter((x) => x && x !== quienSosId));
  if (!dest.length) return;
  sendToListAs(dest, {
    asunto: `Weekly resuelta: ${it.titulo}`,
    titulo: "Se resolvió una prioridad de la semana",
    mensaje: `${currentUserName(quienSosId)} marcó como resuelta "${it.titulo}".${it.resolucion ? ` ${it.resolucion}` : ""}`,
    detalle: wkDetalle(it),
  }, currentUserName(quienSosId));
}

export type AlarmCheckResult = { id: string; patch: Partial<WeeklyItem> };

// Port de wkCheckAlarms: recorre las prioridades abiertas y manda (1) el
// recordatorio de la alarma programada si venció (con repetición semanal
// opcional) y (2) el aviso automático de vencida sin resolver (al
// responsable, a quien la cargó y a Sofia — "t1", igual que el original).
// Devuelve los patches a guardar en Firestore; el llamador decide cómo
// persistirlos (evita acoplar esta lib a firebase/firestore directamente).
export function checkearAlarmasWeeklys(items: WeeklyItem[]): AlarmCheckResult[] {
  const today = wkToday();
  const out: AlarmCheckResult[] = [];
  items.forEach((it) => {
    if (it.estado === "resuelta") return;
    const patch: Partial<WeeklyItem> = {};
    let changed = false;
    const a = it.alarma;
    if (a && a.fecha && a.fecha <= today && a.enviada !== a.fecha) {
      const dest = wkEmailsOf((a.ids && a.ids.length ? a.ids : [it.responsable, it.creadoPor]));
      sendToListAs(dest, {
        asunto: `Recordatorio Weekly: ${it.titulo}`,
        titulo: "Prioridad pendiente de resolver",
        mensaje: `Recordatorio de la prioridad "${it.titulo}" (${it.area || ""}), que sigue sin resolverse. Entrá al tablero, pestaña Weeklys, para cargar el seguimiento o marcarla como resuelta.`,
        detalle: wkDetalle(it),
      } satisfies EmailEvent, SISTEMA);
      let fecha = a.fecha;
      if (a.repetir === "semanal") {
        while (fecha <= today) fecha = wkAddDays(fecha, 7);
      }
      patch.alarma = { ...a, enviada: a.fecha, enviadaTs: Date.now(), fecha };
      changed = true;
    }
    if (it.limite && it.limite < today && it.avisoVencido !== it.limite) {
      const dest = wkEmailsOf([it.responsable, it.creadoPor, "t1"]);
      sendToListAs(dest, {
        asunto: `Weekly vencida: ${it.titulo}`,
        titulo: "Una prioridad se venció sin resolver",
        mensaje: `La prioridad "${it.titulo}" tenía fecha límite el ${fmtFecha(it.limite)} y todavía no está resuelta.`,
        detalle: wkDetalle(it),
      } satisfies EmailEvent, SISTEMA);
      patch.avisoVencido = it.limite;
      changed = true;
    }
    if (changed) out.push({ id: it.id, patch });
  });
  return out;
}
