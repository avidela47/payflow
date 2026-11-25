"use client";

// Marketing & Task — port recortado de renderMarketingBoard (líneas 1057-
// 1368 del original), a lo que Ariel confirmó usar de verdad (2026-11-25):
// Tareas generales + calendario de contenidos por mes + Recordatorios.
// Afuera a propósito: el botón "Cargar plan de redes" (importaba un plan
// de noviembre 2026 con copys hardcodeados — no tiene sentido calcarlo al
// código fuente) y "Proyectos de marketing" (mkprojects: existía en el
// original pero nunca estuvo conectado a ninguna pantalla, código muerto).
//
// Mismo motor que el resto de la familia Proyectos: Firestore compartido
// (dbProyectos), identidad "¿Quién sos?" (useQuienSos/TEAM), logActivity.
//
// Simplificación disclosed: el chequeo de recordatorios vencidos
// (checkReminders en el original) corre en un setInterval GLOBAL mientras
// la app está abierta, para cualquier pestaña. Acá corre page-scoped (solo
// mientras esta pantalla está abierta) — mismo criterio ya usado y
// disclosed en Weeklys para las alarmas.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { collection, onSnapshot } from "firebase/firestore";
import { dbProyectos } from "@/lib/firebase-proyectos";
import { logActivity } from "@/lib/proyectos-activity";
import { useQuienSos, QuienSos } from "../pipeline/quien-sos";
import { TEAM, TEAM_EMAILS } from "@/lib/proyectos-team";
import {
  MN,
  WEEKDAYS_MON_FIRST,
  CANAL_LABEL,
  CANAL_CHIP,
  canalOrden,
  RP_EST,
  rpEstIdx,
  fmtFecha,
  hoy,
  getRemainingMonths,
  monthKeyOf,
  monthLabelOf,
  buildMonthDays,
  saveContentItem,
  deleteContentItem,
  saveGenericTask,
  deleteGenericTask,
  saveReminder,
  deleteReminder,
  recordatoriosVencidos,
  type Canal,
  type ContentItem,
  type MkTask,
  type Reminder,
} from "@/lib/marketing";
import { enviarRecordatorioEmail } from "@/lib/marketing-notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ChevronDown, CircleCheck, CalendarCheck, Bell, Megaphone } from "lucide-react";

const CANALES: Canal[] = ["IG", "LI", "CS", "BLOG", "NEWS", "OTRO"];

function nid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function estadoColor(idx: number): string {
  return idx === 2 ? "bg-success/15 text-success border-success/30" : idx === 1 ? "bg-primary/15 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border";
}

// ── Recordatorios — genérico (scope "marketing"), port de buildRemindersBlock/buildReminderRow ──

function ReminderRow({ r, onChange, onDelete }: { r: Reminder; onChange: (patch: Partial<Reminder>) => void; onDelete: () => void }) {
  const emailOptions = TEAM.map((m) => ({ id: m.id, name: m.name, email: TEAM_EMAILS[m.id] || "" })).filter((m) => m.email);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/30 p-2">
      <Select className="min-w-36 flex-1" value={r.email} disabled={r.sent} onChange={(e) => onChange({ email: e.target.value })}>
        <option value="">Elegir mail...</option>
        {emailOptions.map((m) => (
          <option key={m.id} value={m.email}>
            {m.name} ({m.email})
          </option>
        ))}
      </Select>
      <Input type="date" className="w-40" disabled={r.sent} value={r.date || ""} onChange={(e) => onChange({ date: e.target.value, sent: false })} />
      <Input className="min-w-40 flex-[2]" placeholder="Texto del recordatorio" disabled={r.sent} value={r.text || ""} onChange={(e) => onChange({ text: e.target.value })} />
      {r.sent && <Badge variant="success">Enviado</Badge>}
      <button type="button" title="Quitar" onClick={onDelete} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function RemindersBlock({ reminders, taskId, onAdd, onChange, onDelete }: { reminders: Reminder[]; taskId?: string; onAdd: () => void; onChange: (id: string, patch: Partial<Reminder>) => void; onDelete: (id: string) => void }) {
  const list = reminders.filter((r) => r.scope === "marketing" && (taskId ? r.taskId === taskId : !r.taskId));
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-background p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
        <Bell className="h-3.5 w-3.5" /> Recordatorios
      </p>
      {list.map((r) => (
        <ReminderRow key={r.id} r={r} onChange={(patch) => onChange(r.id, patch)} onDelete={() => onDelete(r.id)} />
      ))}
      <Button type="button" size="sm" variant="outline" onClick={onAdd} className="self-start">
        <Plus className="mr-1 h-3.5 w-3.5" /> Agregar recordatorio
      </Button>
    </div>
  );
}

// ── Tareas generales — port de buildGenericTask ──

function GenericTaskRow({
  t,
  open,
  onToggleOpen,
  onPatch,
  onDelete,
  reminders,
  onAddReminder,
  onChangeReminder,
  onDeleteReminder,
}: {
  t: MkTask;
  open: boolean;
  onToggleOpen: () => void;
  onPatch: (patch: Partial<MkTask>) => void;
  onDelete: () => void;
  reminders: Reminder[];
  onAddReminder: () => void;
  onChangeReminder: (id: string, patch: Partial<Reminder>) => void;
  onDeleteReminder: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex cursor-pointer items-center gap-2 p-2.5" onClick={onToggleOpen}>
        <button
          type="button"
          title={t.done ? "Marcar como pendiente" : "Marcar como terminada"}
          onClick={(e) => {
            e.stopPropagation();
            onPatch({ done: !t.done });
          }}
          className={t.done ? "text-success" : "text-muted-foreground hover:text-success"}
        >
          <CircleCheck className="h-4 w-4" />
        </button>
        <span className={`flex-1 truncate text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title || "Nueva tarea"}</span>
        {t.end && !t.done && <span className="shrink-0 text-xs text-muted-foreground">{t.end.slice(5).replace("-", "/")}</span>}
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="flex flex-col gap-2 border-t border-border p-3" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <Input placeholder="Tarea a realizar..." value={t.title} onChange={(e) => onPatch({ title: e.target.value })} />
            <Input type="date" value={t.start || ""} onChange={(e) => onPatch({ start: e.target.value })} title="Inicio" />
            <Input type="date" value={t.end || ""} onChange={(e) => onPatch({ end: e.target.value })} title="Fin" />
            <Button type="button" variant="delete" size="sm" onClick={onDelete}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Input type="url" placeholder="Link necesario (opcional)" value={t.link || ""} onChange={(e) => onPatch({ link: e.target.value })} />
          <Textarea rows={2} placeholder="Notas..." value={t.notas || ""} onChange={(e) => onPatch({ notas: e.target.value })} />
          <RemindersBlock reminders={reminders} taskId={t.id} onAdd={onAddReminder} onChange={onChangeReminder} onDelete={onDeleteReminder} />
        </div>
      )}
    </div>
  );
}

// ── Modal de publicación de un día puntual — port de openDayTask/saveDayTaskModal ──

function DayTaskDialog({
  open,
  dateISO,
  item,
  defaultCanal,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  dateISO: string;
  item: ContentItem | null;
  defaultCanal: Canal | "Todos";
  onClose: () => void;
  onSave: (data: { date: string; canal: Canal; title: string; notas: string; estado: string; programada: boolean }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [date, setDate] = useState(dateISO);
  const [canal, setCanal] = useState<Canal>("IG");
  const [title, setTitle] = useState("");
  const [notas, setNotas] = useState("");
  const [estIdx, setEstIdx] = useState(0);
  const [programada, setProgramada] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(dateISO);
    setCanal(item?.canal ?? (defaultCanal !== "Todos" ? defaultCanal : "IG"));
    setTitle(item?.title ?? "");
    setNotas(item?.notas ?? "");
    setEstIdx(rpEstIdx(item?.estado));
    setProgramada(item?.programada ?? false);
  }, [open, dateISO, item, defaultCanal]);

  async function guardar() {
    if (!title.trim()) {
      toast.error("Ponele un título a la publicación.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ date, canal, title: title.trim(), notas, estado: RP_EST[estIdx], programada });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={item ? "Editar publicación" : "Nueva publicación"} className="max-w-lg">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Canal</Label>
            <Select value={canal} onChange={(e) => setCanal(e.target.value as Canal)}>
              {CANALES.map((c) => (
                <option key={c} value={c}>
                  {CANAL_LABEL[c]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título o idea de la publicación" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Notas</Label>
          <Textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Estado</Label>
          <div className="flex gap-1.5">
            {RP_EST.map((e, i) => (
              <Button key={e} type="button" size="sm" variant={estIdx === i ? "default" : "outline"} onClick={() => setEstIdx(i)}>
                {e}
              </Button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setProgramada((p) => !p)}
          className={`flex items-center gap-1.5 self-start rounded-full border px-3 py-1 text-xs ${programada ? "border-success text-success" : "border-border text-muted-foreground"}`}
        >
          <CalendarCheck className="h-3.5 w-3.5" /> {programada ? "Programada" : "Sin programar"}
        </button>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          {item ? (
            <Button type="button" variant="delete" onClick={() => void onDelete()}>
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving} onClick={() => void guardar()}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

export function MarketingClient() {
  const [content, setContent] = useState<ContentItem[] | null>(null);
  const [mktasks, setMktasks] = useState<MkTask[] | null>(null);
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [rpCanal, setRpCanal] = useState<Canal | "Todos">("Todos");
  const [openTaskIds, setOpenTaskIds] = useState<Record<string, boolean>>({});
  const [dayDialog, setDayDialog] = useState<{ date: string; item: ContentItem | null } | null>(null);
  const { quienSos, elegir } = useQuienSos();

  useEffect(() => {
    const unsub = onSnapshot(collection(dbProyectos, "content"), (snap) => setContent(snap.docs.map((d) => d.data() as ContentItem)), console.error);
    return () => unsub();
  }, []);
  useEffect(() => {
    const unsub = onSnapshot(collection(dbProyectos, "mktasks"), (snap) => setMktasks(snap.docs.map((d) => d.data() as MkTask)), console.error);
    return () => unsub();
  }, []);
  useEffect(() => {
    const unsub = onSnapshot(collection(dbProyectos, "reminders"), (snap) => setReminders(snap.docs.map((d) => d.data() as Reminder)), console.error);
    return () => unsub();
  }, []);

  // Chequeo de recordatorios vencidos — page-scoped (ver nota arriba del
  // archivo): re-corre cada 60s (vía `tick`) mientras esta pantalla está
  // abierta, igual intervalo que el setInterval global del original.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!reminders) return;
    const marketingReminders = reminders.filter((r) => r.scope === "marketing");
    const vencidos = recordatoriosVencidos(marketingReminders);
    vencidos.forEach((r) => {
      const sobre = r.taskId ? (mktasks || []).find((t) => t.id === r.taskId)?.title || "Marketing" : "Marketing";
      enviarRecordatorioEmail(r, sobre);
      void saveReminder({ ...r, sent: true, sentAt: Date.now() });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminders, mktasks, tick]);

  const pendingTasks = useMemo(() => (mktasks || []).filter((t) => !t.done), [mktasks]);
  const doneTasks = useMemo(() => (mktasks || []).filter((t) => t.done), [mktasks]);
  const months = useMemo(() => getRemainingMonths(), []);

  function patchReminder(id: string, patch: Partial<Reminder>) {
    const r = (reminders || []).find((x) => x.id === id);
    if (!r) return;
    void saveReminder({ ...r, ...patch });
  }
  function addReminder(taskId?: string) {
    if (!quienSos) return;
    void saveReminder({ id: nid("rm"), scope: "marketing", projectId: null, taskId: taskId ?? null, email: "", date: "", text: "", sent: false, sentAt: null });
  }
  function removeReminder(id: string) {
    void deleteReminder(id);
  }

  function patchTask(t: MkTask, patch: Partial<MkTask>) {
    void saveGenericTask({ ...t, ...patch });
  }
  function addTask() {
    const t: MkTask = { id: nid("mkt"), title: "", start: "", end: "", link: "", notas: "", done: false };
    void saveGenericTask(t);
    setOpenTaskIds((p) => ({ ...p, [t.id]: true }));
  }
  function removeTask(id: string) {
    if (!confirm("¿Eliminar esta tarea general?")) return;
    void deleteGenericTask(id);
  }

  async function guardarPublicacion(data: { date: string; canal: Canal; title: string; notas: string; estado: string; programada: boolean }) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      toast.error("Elegí una fecha válida.");
      return;
    }
    const id = dayDialog?.item?.id ?? nid("ct");
    const it: ContentItem = { id, canal: data.canal, date: data.date, month: data.date.slice(0, 7), title: data.title, notas: data.notas, estado: data.estado, programada: data.programada };
    await saveContentItem(it);
    if (quienSos) logActivity(`${dayDialog?.item ? "edito" : "agrego"} una publicacion: ${data.title}`, "Marketing", quienSos);
  }
  async function borrarPublicacion() {
    if (!dayDialog?.item) return;
    if (!confirm("¿Eliminar esta publicación del calendario?")) return;
    await deleteContentItem(dayDialog.item.id);
    setDayDialog(null);
  }

  if (quienSos === undefined) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!quienSos) {
    return <QuienSos onElegir={elegir} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <Megaphone className="h-5 w-5 text-primary" /> Marketing &amp; Task
      </h1>

      {/* Tareas generales */}
      <section id="mk-tareas-generales" className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold">Tareas generales</h2>
          <p className="text-xs text-muted-foreground">Tareas que no son de contenido: entregar cosas, completar campos, links necesarios, etc. La fecha de fin se replica en el calendario de abajo.</p>
        </div>
        {mktasks === null && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {mktasks !== null && pendingTasks.length === 0 && <p className="text-sm text-muted-foreground">Sin tareas generales todavía.</p>}
        <div className="flex flex-col gap-2">
          {pendingTasks.map((t) => (
            <GenericTaskRow
              key={t.id}
              t={t}
              open={!!openTaskIds[t.id]}
              onToggleOpen={() => setOpenTaskIds((p) => ({ ...p, [t.id]: !p[t.id] }))}
              onPatch={(patch) => patchTask(t, patch)}
              onDelete={() => removeTask(t.id)}
              reminders={reminders || []}
              onAddReminder={() => addReminder(t.id)}
              onChangeReminder={patchReminder}
              onDeleteReminder={removeReminder}
            />
          ))}
        </div>
        <Button type="button" variant="outline" onClick={addTask} className="self-start">
          <Plus className="mr-1.5 h-4 w-4" /> Agregar tarea
        </Button>
      </section>

      {/* Calendario de contenidos por mes */}
      {months.map((m) => {
        const monthKey = monthKeyOf(m);
        const monthItems = (content || []).filter((c) => !c.deleted && (c.month === monthKey || (c.date || "").slice(0, 7) === monthKey));
        const cnt = [0, 0, 0];
        monthItems.forEach((c) => cnt[rpEstIdx(c.estado)]++);
        const days = buildMonthDays(m);
        return (
          <section key={monthKey} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">{monthLabelOf(m)}</h2>
            {monthItems.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Publicaciones del mes: {monthItems.length} · {RP_EST.map((e, i) => `${e} ${cnt[i]}`).join(" · ")}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setRpCanal("Todos")}
                className={`rounded-full border px-2.5 py-1 text-xs ${rpCanal === "Todos" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
              >
                Todos los canales
              </button>
              {CANALES.slice(0, 5).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setRpCanal(c)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${rpCanal === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                >
                  {CANAL_LABEL[c]}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-7 bg-muted text-xs font-medium text-muted-foreground">
                  {WEEKDAYS_MON_FIRST.map((d) => (
                    <div key={d} className="px-2 py-1.5 text-center">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {days.map((dateStr, i) => {
                    if (!dateStr) return <div key={`pad-${i}`} className="min-h-[92px] border-b border-r border-border bg-muted/30" />;
                    const isToday = dateStr === hoy();
                    const items = monthItems
                      .filter((it) => it.date === dateStr && (rpCanal === "Todos" || it.canal === rpCanal))
                      .sort((a, b) => canalOrden(a.canal) - canalOrden(b.canal));
                    const tareasDelDia = pendingTasks.filter((t) => t.end === dateStr);
                    return (
                      <div key={dateStr} className="flex min-h-[92px] flex-col gap-1 border-b border-r border-border p-1">
                        <div className="flex items-center justify-between">
                          <span className={`rounded-full px-1.5 text-xs font-medium ${isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{Number(dateStr.slice(8))}</span>
                          <button type="button" title="Agregar publicación" onClick={() => setDayDialog({ date: dateStr, item: null })} className="rounded p-0.5 text-muted-foreground hover:bg-muted">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        {items.map((it) => (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => setDayDialog({ date: it.date, item: it })}
                            title={`${RP_EST[rpEstIdx(it.estado)]}${it.programada ? " · Programada" : ""} · ${it.title}`}
                            className={`truncate rounded border px-1 py-0.5 text-left text-[11px] ${estadoColor(rpEstIdx(it.estado))}`}
                          >
                            {it.programada && <CalendarCheck className="mr-0.5 inline h-2.5 w-2.5" />}
                            <span className="font-medium">{CANAL_CHIP[it.canal]}</span> {it.title || "(sin título)"}
                          </button>
                        ))}
                        {tareasDelDia.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setOpenTaskIds((p) => ({ ...p, [t.id]: true }));
                              document.getElementById("mk-tareas-generales")?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }}
                            title={t.notas || t.title}
                            className="truncate rounded border border-dashed border-border px-1 py-0.5 text-left text-[11px] text-muted-foreground"
                          >
                            ✓ {t.title || "(sin nombre)"}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        );
      })}

      {/* Recordatorios generales */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Recordatorios</h2>
        <RemindersBlock reminders={reminders || []} onAdd={() => addReminder()} onChange={patchReminder} onDelete={removeReminder} />
      </section>

      {/* Finalizado */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Finalizado</h2>
        {mktasks !== null && doneTasks.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay tareas generales finalizadas.</p>}
        <div className="flex flex-col gap-2">
          {doneTasks.map((t) => (
            <GenericTaskRow
              key={t.id}
              t={t}
              open={!!openTaskIds[t.id]}
              onToggleOpen={() => setOpenTaskIds((p) => ({ ...p, [t.id]: !p[t.id] }))}
              onPatch={(patch) => patchTask(t, patch)}
              onDelete={() => removeTask(t.id)}
              reminders={reminders || []}
              onAddReminder={() => addReminder(t.id)}
              onChangeReminder={patchReminder}
              onDeleteReminder={removeReminder}
            />
          ))}
        </div>
      </section>

      <DayTaskDialog
        open={dayDialog !== null}
        dateISO={dayDialog?.date ?? hoy()}
        item={dayDialog?.item ?? null}
        defaultCanal={rpCanal}
        onClose={() => setDayDialog(null)}
        onSave={guardarPublicacion}
        onDelete={borrarPublicacion}
      />
    </div>
  );
}
