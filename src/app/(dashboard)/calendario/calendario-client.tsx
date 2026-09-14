"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { NOTE_COLORS, type NoteColor } from "@/lib/note-colors";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "./actions";

export type CalendarEventItem = {
  id: string;
  title: string;
  notes?: string;
  startsAtISO: string;
  endsAtISO: string;
  allDay: boolean;
  color: NoteColor;
};

type EventVM = CalendarEventItem & { startsAt: Date; endsAt: Date };

// ---------- helpers de fecha (todo en hora LOCAL del navegador — en
// producción eso es la hora Argentina real de quien lo está mirando) ----------

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeInputValue(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

// Lunes como primer día de la semana (uso habitual en Argentina).
function startOfWeekMonday(d: Date) {
  const day = d.getDay(); // 0=domingo .. 6=sábado
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(startOfDay(d), diff);
}

const WEEKDAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function formatMonthYear(d: Date) {
  const s = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDayNum(d: Date) {
  return d.getDate();
}

function formatWeekRangeLabel(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const startLabel = new Intl.DateTimeFormat("es-AR", { day: "2-digit" }).format(weekStart);
  const endLabel = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: sameMonth ? undefined : "short",
  }).format(weekEnd);
  const monthLabel = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(
    weekEnd
  );
  return `${startLabel} – ${endLabel} de ${monthLabel}`;
}

function formatDayHeaderLabel(d: Date) {
  const s = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatHM(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ---------- colores (strings completas y literales, para que el scanner
// de Tailwind las encuentre — mismo criterio que en Notas) ----------

const COLOR_STYLES: Record<NoteColor, { chip: string; block: string; swatch: string; ring: string }> = {
  yellow: {
    chip: "bg-yellow-100 text-yellow-800 border border-yellow-300",
    block: "bg-yellow-200 border-l-4 border-yellow-500 text-yellow-900",
    swatch: "bg-yellow-400",
    ring: "ring-yellow-500",
  },
  pink: {
    chip: "bg-pink-100 text-pink-800 border border-pink-300",
    block: "bg-pink-200 border-l-4 border-pink-500 text-pink-900",
    swatch: "bg-pink-400",
    ring: "ring-pink-500",
  },
  blue: {
    chip: "bg-blue-100 text-blue-800 border border-blue-300",
    block: "bg-blue-200 border-l-4 border-blue-500 text-blue-900",
    swatch: "bg-blue-400",
    ring: "ring-blue-500",
  },
  green: {
    chip: "bg-green-100 text-green-800 border border-green-300",
    block: "bg-green-200 border-l-4 border-green-500 text-green-900",
    swatch: "bg-green-400",
    ring: "ring-green-500",
  },
  purple: {
    chip: "bg-purple-100 text-purple-800 border border-purple-300",
    block: "bg-purple-200 border-l-4 border-purple-500 text-purple-900",
    swatch: "bg-purple-400",
    ring: "ring-purple-500",
  },
  orange: {
    chip: "bg-orange-100 text-orange-800 border border-orange-300",
    block: "bg-orange-200 border-l-4 border-orange-500 text-orange-900",
    swatch: "bg-orange-400",
    ring: "ring-orange-500",
  },
};

const HOUR_HEIGHT = 48; // px por hora, en la vista semana/día

// ---------- selector de color (reutilizado en el form de crear/editar) ----------

function ColorPicker({ name, defaultValue }: { name: string; defaultValue: NoteColor }) {
  const [selected, setSelected] = useState<NoteColor>(defaultValue);
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Color</Label>
      <input type="hidden" name={name} value={selected} />
      <div className="flex gap-2">
        {NOTE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            onClick={() => setSelected(color)}
            className={`h-7 w-7 rounded-full border ${COLOR_STYLES[color].swatch} ${
              selected === color ? `ring-2 ring-offset-2 ${COLOR_STYLES[color].ring}` : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ---------- formulario de crear/editar (contenido del Dialog) ----------

function EventForm({
  mode,
  eventId,
  defaultDate,
  defaultValues,
  onDone,
}: {
  mode: "create" | "edit";
  eventId?: string;
  defaultDate: Date;
  defaultValues?: EventVM;
  onDone: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [allDay, setAllDay] = useState(defaultValues?.allDay ?? false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const result =
      mode === "create"
        ? await createCalendarEvent(formData)
        : await updateCalendarEvent(eventId as string, formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success(mode === "create" ? "Evento creado." : "Evento actualizado.");
    router.refresh();
    onDone();
  }

  const dateValue = defaultValues ? toDateKey(defaultValues.startsAt) : toDateKey(defaultDate);
  const startTimeValue = defaultValues ? toTimeInputValue(defaultValues.startsAt) : "09:00";
  const endTimeValue = defaultValues ? toTimeInputValue(defaultValues.endsAt) : "10:00";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          name="title"
          required
          placeholder="Ej: Reunión con el banco"
          defaultValue={defaultValues?.title}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="date">Fecha</Label>
        <Input id="date" name="date" type="date" required defaultValue={dateValue} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="allDay"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          className="h-4 w-4"
        />
        Todo el día
      </label>

      {!allDay && (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startTime">Desde</Label>
            <Input id="startTime" name="startTime" type="time" defaultValue={startTimeValue} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endTime">Hasta</Label>
            <Input id="endTime" name="endTime" type="time" defaultValue={endTimeValue} />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={defaultValues?.notes} />
      </div>

      <ColorPicker name="color" defaultValue={defaultValues?.color ?? "blue"} />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : mode === "create" ? "Crear evento" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

// ---------- vista Mes ----------

function MonthView({
  anchor,
  eventsByDay,
  onDayClick,
  onEventClick,
}: {
  anchor: Date;
  eventsByDay: Map<string, EventVM[]>;
  onDayClick: (day: Date) => void;
  onEventClick: (event: EventVM) => void;
}) {
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeekMonday(monthStart);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = toDateKey(new Date());

  return (
    <div className="flex flex-col rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-7 bg-muted text-xs font-medium text-muted-foreground">
        {WEEKDAY_SHORT.map((label) => (
          <div key={label} className="px-2 py-2 text-center">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = toDateKey(day);
          const inMonth = day.getMonth() === anchor.getMonth();
          const isToday = key === today;
          const dayEvents = (eventsByDay.get(key) ?? []).slice().sort((a, b) => {
            if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
            return a.startsAt.getTime() - b.startsAt.getTime();
          });
          const visible = dayEvents.slice(0, 3);
          const extra = dayEvents.length - visible.length;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onDayClick(day)}
              className={`flex min-h-[88px] flex-col items-stretch gap-1 border-b border-r border-border p-1 text-left align-top sm:min-h-[110px] ${
                inMonth ? "bg-background" : "bg-muted/40 text-muted-foreground"
              }`}
            >
              <span
                className={`self-start rounded-full px-1.5 text-xs font-medium ${
                  isToday ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {formatDayNum(day)}
              </span>
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                {visible.map((event) => (
                  <span
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    className={`truncate rounded px-1 py-0.5 text-[11px] ${COLOR_STYLES[event.color].chip}`}
                  >
                    {event.allDay ? "" : `${formatHM(event.startsAt)} `}
                    {event.title}
                  </span>
                ))}
                {extra > 0 && (
                  <span className="px-1 text-[11px] text-muted-foreground">+{extra} más</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- vista Semana / Día (grilla horaria compartida) ----------

function TimeGridView({
  days,
  eventsByDay,
  onSlotClick,
  onEventClick,
}: {
  days: Date[];
  eventsByDay: Map<string, EventVM[]>;
  onSlotClick: (day: Date) => void;
  onEventClick: (event: EventVM) => void;
}) {
  const today = toDateKey(new Date());
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col rounded-lg border border-border overflow-hidden">
      {/* Encabezado con el día y los eventos de "todo el día" */}
      <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <div className="border-b border-r border-border" />
        {days.map((day) => {
          const key = toDateKey(day);
          const isToday = key === today;
          const allDayEvents = (eventsByDay.get(key) ?? []).filter((e) => e.allDay);
          return (
            <div key={key} className="flex flex-col border-b border-r border-border p-1">
              <button
                type="button"
                onClick={() => onSlotClick(day)}
                className={`self-center rounded px-2 py-0.5 text-xs font-medium ${
                  isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {WEEKDAY_SHORT[(day.getDay() + 6) % 7]} {formatDayNum(day)}
              </button>
              {allDayEvents.map((event) => (
                <span
                  key={event.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(event);
                  }}
                  className={`mt-1 truncate rounded px-1 py-0.5 text-[11px] ${COLOR_STYLES[event.color].chip}`}
                >
                  {event.title}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {/* Grilla horaria con scroll propio */}
      <div ref={scrollRef} className="max-h-[560px] overflow-y-auto">
        <div
          className="grid"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
        >
          {/* Columna de horas */}
          <div className="border-r border-border">
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT }}
                className="border-b border-border px-1 pt-0.5 text-right text-[11px] text-muted-foreground"
              >
                {pad2(h)}:00
              </div>
            ))}
          </div>

          {/* Una columna por día, con los eventos con horario posicionados */}
          {days.map((day) => {
            const key = toDateKey(day);
            const timedEvents = (eventsByDay.get(key) ?? []).filter((e) => !e.allDay);
            return (
              <div
                key={key}
                className="relative border-r border-border"
                style={{ height: HOUR_HEIGHT * 24 }}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    onClick={() => onSlotClick(day)}
                    style={{ height: HOUR_HEIGHT }}
                    className="cursor-pointer border-b border-border hover:bg-muted/40"
                  />
                ))}
                {timedEvents.map((event) => {
                  const startMinutes = event.startsAt.getHours() * 60 + event.startsAt.getMinutes();
                  const durationMinutes = Math.max(
                    15,
                    (event.endsAt.getTime() - event.startsAt.getTime()) / 60000
                  );
                  const top = (startMinutes / 60) * HOUR_HEIGHT;
                  const height = (durationMinutes / 60) * HOUR_HEIGHT;
                  return (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                      style={{ top, height }}
                      className={`absolute left-0.5 right-0.5 overflow-hidden rounded px-1 py-0.5 text-[11px] shadow-sm ${COLOR_STYLES[event.color].block}`}
                    >
                      <div className="truncate font-medium">{event.title}</div>
                      <div className="truncate">
                        {formatHM(event.startsAt)}–{formatHM(event.endsAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- componente principal ----------

type View = "month" | "week" | "day";

type FormState = { mode: "create"; defaultDate: Date } | { mode: "edit"; event: EventVM };

export function CalendarClient({ events }: { events: CalendarEventItem[] }) {
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState<Date>(startOfDay(new Date()));
  const [formState, setFormState] = useState<FormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventVM | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const eventVMs: EventVM[] = useMemo(
    () =>
      events.map((e) => ({
        ...e,
        startsAt: new Date(e.startsAtISO),
        endsAt: new Date(e.endsAtISO),
      })),
    [events]
  );

  // Un evento "de varios días" aparece en cada día que ocupa — para no
  // complicar el cálculo, lo repetimos en el mapa por cada día entre
  // startsAt y endsAt (la inmensa mayoría de los eventos son de un día).
  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventVM[]>();
    for (const event of eventVMs) {
      let cursor = startOfDay(event.startsAt);
      const last = startOfDay(event.endsAt);
      while (cursor.getTime() <= last.getTime()) {
        const key = toDateKey(cursor);
        const list = map.get(key) ?? [];
        list.push(event);
        map.set(key, list);
        cursor = addDays(cursor, 1);
      }
    }
    return map;
  }, [eventVMs]);

  function goPrev() {
    setAnchor((prev) =>
      view === "month" ? addMonths(prev, -1) : view === "week" ? addDays(prev, -7) : addDays(prev, -1)
    );
  }

  function goNext() {
    setAnchor((prev) =>
      view === "month" ? addMonths(prev, 1) : view === "week" ? addDays(prev, 7) : addDays(prev, 1)
    );
  }

  function goToday() {
    setAnchor(startOfDay(new Date()));
  }

  function openCreate(day: Date) {
    setFormState({ mode: "create", defaultDate: day });
  }

  function openEdit(event: EventVM) {
    setFormState({ mode: "edit", event });
  }

  async function performDelete(event: EventVM) {
    setDeleting(true);
    const result = await deleteCalendarEvent(event.id);
    setDeleting(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Evento borrado.");
    setDeleteTarget(null);
    router.refresh();
  }

  const weekStart = startOfWeekMonday(anchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  let headerLabel = "";
  if (view === "month") headerLabel = formatMonthYear(anchor);
  else if (view === "week") headerLabel = formatWeekRangeLabel(weekStart);
  else headerLabel = formatDayHeaderLabel(anchor);

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={goToday}>
            Hoy
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={goPrev} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={goNext} aria-label="Siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium capitalize">{headerLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border">
            {(["month", "week", "day"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium ${
                  view === v
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {v === "month" ? "Mes" : v === "week" ? "Semana" : "Día"}
              </button>
            ))}
          </div>
          <Button type="button" size="sm" onClick={() => openCreate(anchor)}>
            <Plus className="h-4 w-4" />
            Nuevo evento
          </Button>
        </div>
      </div>

      {view === "month" && (
        <MonthView
          anchor={anchor}
          eventsByDay={eventsByDay}
          onDayClick={openCreate}
          onEventClick={openEdit}
        />
      )}
      {view === "week" && (
        <TimeGridView
          days={weekDays}
          eventsByDay={eventsByDay}
          onSlotClick={openCreate}
          onEventClick={openEdit}
        />
      )}
      {view === "day" && (
        <TimeGridView
          days={[anchor]}
          eventsByDay={eventsByDay}
          onSlotClick={openCreate}
          onEventClick={openEdit}
        />
      )}

      <Dialog
        open={formState !== null}
        onOpenChange={(open) => {
          if (!open) setFormState(null);
        }}
        title={formState?.mode === "edit" ? "Editar evento" : "Nuevo evento"}
        className="max-w-md"
      >
        {formState && (
          <EventForm
            mode={formState.mode}
            eventId={formState.mode === "edit" ? formState.event.id : undefined}
            defaultDate={formState.mode === "create" ? formState.defaultDate : formState.event.startsAt}
            defaultValues={formState.mode === "edit" ? formState.event : undefined}
            onDone={() => setFormState(null)}
          />
        )}
        {formState?.mode === "edit" && (
          <div className="mt-2 border-t border-border pt-3 text-right">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => {
                setDeleteTarget(formState.event);
                setFormState(null);
              }}
            >
              Borrar evento
            </Button>
          </div>
        )}
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Borrar evento"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar{" "}
              <span className="font-medium text-foreground">{deleteTarget.title}</span>? No se
              puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" disabled={deleting} onClick={() => performDelete(deleteTarget)}>
                {deleting ? "Borrando..." : "Sí, borrar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}