// Email de un recordatorio vencido — port de sendReminderEmail (líneas
// 3067-3083 del original). "Quien" es literal "Tablero ITELSA" en vez de
// resolverse de currentUser: el disparo es automático (checkReminders corre
// solo, no lo activa una persona puntual) — mismo criterio ya usado en
// weeklys-notify.ts para las alarmas de Weeklys.
import { sendEmailNotifAs, type EmailEvent } from "./proyectos-notify";
import { fmtFecha, type Reminder } from "./marketing";

export function enviarRecordatorioEmail(r: Reminder, sobre: string): void {
  const detalle: string[] = [`Vence el: ${fmtFecha(r.date)}`, "Área: Marketing & Task"];
  if (sobre) detalle.push(`Tarea: ${sobre}`);
  if (r.text) detalle.push(`Nota: ${r.text}`);
  const ev: EmailEvent = {
    asunto: `Recordatorio para el ${fmtFecha(r.date)}: ${sobre || "Marketing"}`,
    titulo: "Recordatorio",
    mensaje: `Recordatorio sobre "${sobre || "Marketing"}" para el ${fmtFecha(r.date)}${r.text ? `: ${r.text}` : "."}`,
    detalle,
  };
  void sendEmailNotifAs(r.email, ev, "Tablero ITELSA");
}
