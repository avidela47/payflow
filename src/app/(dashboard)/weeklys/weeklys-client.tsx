"use client";

// Weeklys — prioridades macro de la empresa y meets con líderes de área.
// Port completo de renderWeeklys y todo lo que arma (wkCard, wkCardBody,
// wkMeetCard, wkResRow, wkItemForm, wkMeetForm — líneas 3810-4142 del
// original). Pantalla propia, no parametriza pipeline-client.tsx: la
// colección "weeklys" no tiene nada que ver con "projects".
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { collection, doc, onSnapshot, setDoc, deleteDoc, deleteField } from "firebase/firestore";
import { dbProyectos } from "@/lib/firebase-proyectos";
import { Target, Users, Plus, Bell, Trash2, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TEAM } from "@/lib/proyectos-team";
import { logActivity } from "@/lib/proyectos-activity";
import { notificarPrioridadAsignada, notificarPrioridadResuelta, checkearAlarmasWeeklys } from "@/lib/weeklys-notify";
import {
  WK_AREAS,
  WK_PRI,
  WK_EST,
  fmtFecha,
  wkToday,
  wkMonday,
  wkAddDays,
  wkWeekLabel,
  wkPri,
  wkVencida,
  wkItems,
  wkMeets,
  type WeeklyDoc,
  type WeeklyItem,
  type WeeklyMeet,
  type WkPrioridad,
} from "@/lib/weeklys";
import { useQuienSos, QuienSos } from "../pipeline/quien-sos";

function nid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function wkName(id?: string): string {
  return TEAM.find((m) => m.id === id)?.name ?? "";
}

async function wkSave(doc_: WeeklyDoc): Promise<void> {
  try {
    await setDoc(doc(dbProyectos, "weeklys", doc_.id), { ...doc_, ts: Date.now() });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "No se pudo guardar en Weeklys.");
  }
}

async function wkPatch(id: string, patch: Record<string, unknown>): Promise<void> {
  try {
    await setDoc(doc(dbProyectos, "weeklys", id), { ...patch, ts: Date.now() }, { merge: true });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "No se pudo guardar en Weeklys.");
  }
}

async function wkDel(id: string): Promise<void> {
  try {
    await deleteDoc(doc(dbProyectos, "weeklys", id));
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
  }
}

type ItemFormState = {
  titulo: string;
  area: string;
  prioridad: WkPrioridad;
  responsable: string;
  lider: string;
  limite: string;
  detalle: string;
  meetId: string;
};
type MeetFormState = { fecha: string; area: string; lider: string; participantes: string; notas: string };

// ── Formulario "Nueva prioridad" ──
function ItemForm({
  form,
  meets,
  quienSos,
  onCancel,
  onSaved,
}: {
  form: ItemFormState;
  meets: WeeklyMeet[];
  quienSos: string;
  onCancel: () => void;
  onSaved: (keepMeet: string) => void;
}) {
  const [F, setF] = useState(form);
  const meetsOpts = meets.slice(0, 20);

  async function guardar() {
    if (!F.titulo.trim()) return;
    if (!F.area) return;
    const it: WeeklyItem = {
      id: nid("wk"),
      kind: "item",
      titulo: F.titulo.trim(),
      area: F.area,
      prioridad: F.prioridad,
      estado: "pendiente",
      // Strings vacíos, no undefined — Firestore rechaza `undefined` en un
      // setDoc sin merge (y el original tampoco omite estos campos, los
      // guarda siempre, vacíos o no).
      responsable: F.responsable,
      lider: F.lider.trim(),
      limite: F.limite,
      detalle: F.detalle.trim(),
      meetId: F.meetId || "",
      seguimiento: [],
      semana: wkMonday(),
      creadoPor: quienSos,
      creado: wkToday(),
    };
    await wkSave(it);
    logActivity(`cargo una prioridad en Weeklys: ${it.titulo}`, "Weeklys", quienSos);
    notificarPrioridadAsignada(it, quienSos);
    onSaved(F.meetId);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Nueva prioridad</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          className="sm:col-span-2 lg:col-span-4"
          placeholder="Qué hay que resolver (ej.: Definir proveedor de chapa para gabinetes)"
          value={F.titulo}
          onChange={(e) => setF({ ...F, titulo: e.target.value })}
        />
        <Select value={F.area} onChange={(e) => setF({ ...F, area: e.target.value })}>
          <option value="">Elegir área...</option>
          {WK_AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Select value={F.prioridad} onChange={(e) => setF({ ...F, prioridad: e.target.value as WkPrioridad })}>
          {WK_PRI.map((p) => (
            <option key={p.k} value={p.k}>
              {p.l}
            </option>
          ))}
        </Select>
        <Select value={F.responsable} onChange={(e) => setF({ ...F, responsable: e.target.value })}>
          <option value="">Sin asignar</option>
          {TEAM.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <Input type="date" value={F.limite} onChange={(e) => setF({ ...F, limite: e.target.value })} />
        <Input
          className="sm:col-span-2"
          placeholder="Líder o referente del área"
          value={F.lider}
          onChange={(e) => setF({ ...F, lider: e.target.value })}
        />
        <Select className="sm:col-span-2" value={F.meetId} onChange={(e) => setF({ ...F, meetId: e.target.value })}>
          <option value="">Sin meet</option>
          {meetsOpts.map((m) => (
            <option key={m.id} value={m.id}>
              {fmtFecha(m.fecha)} · {m.area || ""}
              {m.lider ? ` · ${m.lider}` : ""}
            </option>
          ))}
        </Select>
        <Textarea
          className="sm:col-span-2 lg:col-span-4"
          rows={2}
          placeholder="Contexto, qué se necesita, de quién depende..."
          value={F.detalle}
          onChange={(e) => setF({ ...F, detalle: e.target.value })}
        />
      </div>
      {F.meetId && (
        <p className="mt-2 text-xs text-muted-foreground">
          Cargá las prioridades que surgieron de este meet: el formulario queda abierto para cargar varias seguidas. Cancelar para cerrarlo.
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" onClick={guardar}>
          <Check className="h-3.5 w-3.5" /> Guardar prioridad
        </Button>
      </div>
    </div>
  );
}

// ── Formulario "Registrar meet" ──
function MeetFormBlock({
  form,
  quienSos,
  onCancel,
  onSaved,
}: {
  form: MeetFormState;
  quienSos: string;
  onCancel: () => void;
  onSaved: (meet: WeeklyMeet) => void;
}) {
  const [F, setF] = useState(form);

  async function guardar() {
    if (!F.area) return;
    const m: WeeklyMeet = {
      id: nid("wm"),
      kind: "meet",
      fecha: F.fecha || wkToday(),
      area: F.area,
      lider: F.lider.trim(),
      participantes: F.participantes.trim(),
      notas: F.notas.trim(),
      creadoPor: quienSos,
    };
    await wkSave(m);
    logActivity(`registro un meet de Weeklys (${m.area})`, "Weeklys", quienSos);
    onSaved(m);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Registrar meet con líder de área</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input type="date" value={F.fecha} onChange={(e) => setF({ ...F, fecha: e.target.value })} />
        <Select value={F.area} onChange={(e) => setF({ ...F, area: e.target.value })}>
          <option value="">Elegir área...</option>
          {WK_AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Input className="sm:col-span-2" placeholder="Nombre del líder" value={F.lider} onChange={(e) => setF({ ...F, lider: e.target.value })} />
        <Input
          className="sm:col-span-2 lg:col-span-4"
          placeholder="Quiénes participaron"
          value={F.participantes}
          onChange={(e) => setF({ ...F, participantes: e.target.value })}
        />
        <Textarea
          className="sm:col-span-2 lg:col-span-4"
          rows={3}
          placeholder="Temas tratados, acuerdos, bloqueos..."
          value={F.notas}
          onChange={(e) => setF({ ...F, notas: e.target.value })}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" onClick={guardar}>
          <Check className="h-3.5 w-3.5" /> Guardar y cargar prioridades
        </Button>
      </div>
    </div>
  );
}

// ── Tarjeta de una prioridad abierta ──
function WeeklyCard({
  it,
  open,
  resolving,
  quienSos,
  onToggle,
  onResolve,
}: {
  it: WeeklyItem;
  open: boolean;
  resolving: boolean;
  quienSos: string;
  onToggle: () => void;
  onResolve: (resolving: boolean) => void;
}) {
  const p = wkPri(it.prioridad);
  const est = WK_EST.find((e) => e[0] === it.estado) ?? WK_EST[0];
  const last = (it.seguimiento ?? []).slice(-1)[0];

  return (
    <div className="rounded-lg border border-border bg-card" style={{ borderLeftWidth: 4, borderLeftColor: p.c }}>
      <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-3 p-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{it.titulo}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge>{it.area || "Sin área"}</Badge>
            <Badge variant={it.estado === "resuelta" ? "success" : "default"}>{it.estado === "resuelta" ? "Resuelta" : est[1]}</Badge>
            {it.responsable && <span>Resp.: {wkName(it.responsable)}</span>}
            {it.lider && <span>Líder: {it.lider}</span>}
            {it.limite && (
              <span className={wkVencida(it) ? "font-medium text-destructive" : ""}>
                {wkVencida(it) ? "Vencida el " : "Límite: "}
                {fmtFecha(it.limite)}
              </span>
            )}
            {it.alarma?.fecha && (
              <span className="inline-flex items-center gap-1">
                <Bell className="h-3 w-3" /> {fmtFecha(it.alarma.fecha)}
                {it.alarma.repetir === "semanal" ? " (semanal)" : ""}
              </span>
            )}
          </div>
          {last && <p className="mt-1 text-xs text-muted-foreground">Último seguimiento: {last.texto}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ color: p.c, backgroundColor: `${p.c}1A` }}>
            {p.l}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {open && <WeeklyCardBody it={it} resolving={resolving} quienSos={quienSos} onResolve={onResolve} onToggle={onToggle} />}
    </div>
  );
}

function WeeklyCardBody({
  it,
  resolving,
  quienSos,
  onResolve,
  onToggle,
}: {
  it: WeeklyItem;
  resolving: boolean;
  quienSos: string;
  onResolve: (resolving: boolean) => void;
  onToggle: () => void;
}) {
  const [nuevoSeg, setNuevoSeg] = useState("");
  const [resolucionTxt, setResolucionTxt] = useState("");
  const A = it.alarma ?? { fecha: "", ids: [it.responsable, quienSos].filter((x): x is string => !!x), repetir: "no" as const };
  const [alarmaFecha, setAlarmaFecha] = useState(A.fecha);
  const [alarmaRepetir, setAlarmaRepetir] = useState<"no" | "semanal">(A.repetir);
  const [alarmaIds, setAlarmaIds] = useState<string[]>(A.ids);

  async function addSeguimiento() {
    const t = nuevoSeg.trim();
    if (!t) return;
    const seguimiento = [...(it.seguimiento ?? []), { ts: Date.now(), by: quienSos, texto: t }];
    await wkPatch(it.id, { seguimiento, estado: it.estado === "pendiente" ? "en-curso" : it.estado });
    setNuevoSeg("");
  }

  async function guardarAlarma() {
    if (!alarmaFecha) return;
    if (!alarmaIds.length) {
      toast.error("Elegí al menos una persona para el mail.");
      return;
    }
    await wkPatch(it.id, {
      alarma: { fecha: alarmaFecha, ids: alarmaIds, repetir: alarmaRepetir, enviada: it.alarma?.fecha === alarmaFecha ? it.alarma?.enviada ?? "" : "" },
    });
    toast.success(it.alarma ? "Alarma actualizada." : "Alarma programada.");
  }

  // deleteField(), no `alarma: undefined` — Firestore rechaza `undefined`
  // como valor de campo.
  async function quitarAlarma() {
    await setDoc(doc(dbProyectos, "weeklys", it.id), { alarma: deleteField(), ts: Date.now() }, { merge: true });
  }

  async function confirmarResuelta() {
    const patch = { estado: "resuelta" as const, resolucion: resolucionTxt.trim(), resueltoTs: Date.now(), resueltoPor: quienSos };
    await wkPatch(it.id, patch);
    onResolve(false);
    onToggle();
    logActivity(`resolvio en Weeklys: ${it.titulo}`, "Weeklys", quienSos);
    notificarPrioridadResuelta({ ...it, ...patch }, quienSos);
  }

  function toggleAlarmaId(id: string) {
    setAlarmaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="flex flex-col gap-4 border-t border-border p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          className="sm:col-span-2 lg:col-span-4"
          defaultValue={it.titulo}
          onBlur={(e) => wkPatch(it.id, { titulo: e.target.value })}
        />
        <Select defaultValue={it.area} onChange={(e) => wkPatch(it.id, { area: e.target.value })}>
          {WK_AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Select defaultValue={it.prioridad} onChange={(e) => wkPatch(it.id, { prioridad: e.target.value })}>
          {WK_PRI.map((p) => (
            <option key={p.k} value={p.k}>
              {p.l}
            </option>
          ))}
        </Select>
        {/* A propósito SIN opción "Resuelta" acá — en el original ese select
            solo tiene pendiente/en-curso/bloqueada (línea 3997); resolver
            es únicamente por el botón "Marcar como resuelta" de abajo, que
            pide el texto de resolución y dispara la notificación. */}
        <Select defaultValue={it.estado === "resuelta" ? "pendiente" : it.estado} onChange={(e) => wkPatch(it.id, { estado: e.target.value })}>
          {WK_EST.map((e) => (
            <option key={e[0]} value={e[0]}>
              {e[1]}
            </option>
          ))}
        </Select>
        <Input type="date" defaultValue={it.limite ?? ""} onChange={(e) => wkPatch(it.id, { limite: e.target.value })} />
        <Select defaultValue={it.responsable ?? ""} onChange={(e) => wkPatch(it.id, { responsable: e.target.value })}>
          <option value="">Sin asignar</option>
          {TEAM.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <Input className="sm:col-span-2" placeholder="Líder o referente" defaultValue={it.lider ?? ""} onBlur={(e) => wkPatch(it.id, { lider: e.target.value })} />
        <Textarea
          className="sm:col-span-2 lg:col-span-4"
          rows={2}
          placeholder="Detalle"
          defaultValue={it.detalle ?? ""}
          onBlur={(e) => wkPatch(it.id, { detalle: e.target.value })}
        />
      </div>

      {/* Seguimiento */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">Seguimiento</h3>
        <div className="flex flex-col gap-1.5">
          {(it.seguimiento ?? []).length === 0 && <p className="text-xs text-muted-foreground">Sin novedades cargadas.</p>}
          {(it.seguimiento ?? []).map((e, i) => (
            <div key={i} className="rounded-md border border-border p-2 text-sm">
              <p className="text-xs text-muted-foreground">
                {new Date(e.ts).toLocaleDateString("es-AR")} · {wkName(e.by)}
              </p>
              <p>{e.texto}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            className="flex-1"
            placeholder="Novedad, avance o bloqueo..."
            value={nuevoSeg}
            onChange={(e) => setNuevoSeg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSeguimiento()}
          />
          <Button size="sm" onClick={addSeguimiento}>
            Agregar
          </Button>
        </div>
      </div>

      {/* Alarma por mail */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Bell className="h-3.5 w-3.5" /> Alarma por mail
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Enviar el</span>
          <Input type="date" className="w-44" value={alarmaFecha} onChange={(e) => setAlarmaFecha(e.target.value)} />
          <Select className="w-auto" value={alarmaRepetir} onChange={(e) => setAlarmaRepetir(e.target.value as "no" | "semanal")}>
            <option value="no">Una sola vez</option>
            <option value="semanal">Repetir cada semana hasta resolver</option>
          </Select>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TEAM.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleAlarmaId(m.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                alarmaIds.includes(m.id) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={guardarAlarma}>
            {it.alarma ? "Actualizar alarma" : "Programar alarma"}
          </Button>
          {it.alarma && (
            <Button size="sm" variant="delete" onClick={quitarAlarma}>
              Quitar alarma
            </Button>
          )}
          {it.alarma?.enviadaTs && (
            <span className="text-xs text-muted-foreground">Último envío: {new Date(it.alarma.enviadaTs).toLocaleDateString("es-AR")}</span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Además, si pasa la fecha límite sin resolverse, se avisa automáticamente al responsable, a quien la cargó y a Sofía.
        </p>
      </div>

      {/* Resolver / eliminar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <Button
          size="sm"
          variant="delete"
          onClick={() => {
            if (confirm("¿Eliminar esta prioridad? Si ya se resolvió, conviene marcarla como resuelta para que quede registrada.")) void wkDel(it.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Eliminar
        </Button>
        {resolving ? (
          <div className="flex min-w-[260px] flex-1 flex-col gap-2">
            <Textarea rows={2} placeholder="Cómo se resolvió (queda registrado)" value={resolucionTxt} onChange={(e) => setResolucionTxt(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => onResolve(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={confirmarResuelta}>
                <Check className="h-3.5 w-3.5" /> Confirmar resuelta
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" onClick={() => onResolve(true)}>
            <Check className="h-3.5 w-3.5" /> Marcar como resuelta
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Tarjeta de meet ──
function MeetCard({ m, open, vinc, onToggle, onNuevaPrioridad }: { m: WeeklyMeet; open: boolean; vinc: WeeklyItem[]; onToggle: () => void; onNuevaPrioridad: () => void }) {
  const [notas, setNotas] = useState(m.notas ?? "");

  return (
    <div className="rounded-lg border border-border bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 p-3 text-left text-sm">
        <span className="font-medium">{fmtFecha(m.fecha)}</span>
        <Badge>{m.area || "-"}</Badge>
        {m.lider && <span className="text-xs text-muted-foreground">con {m.lider}</span>}
        {vinc.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {vinc.length} prioridad{vinc.length > 1 ? "es" : ""}
          </span>
        )}
        <span className="flex-1" />
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-border p-3">
          {m.participantes && <p className="text-xs text-muted-foreground">Participantes: {m.participantes}</p>}
          <Textarea rows={3} placeholder="Minuta / notas" value={notas} onChange={(e) => setNotas(e.target.value)} onBlur={() => wkPatch(m.id, { notas })} />
          {vinc.length > 0 && (
            <div className="flex flex-col gap-1">
              {vinc.map((i) => (
                <p key={i.id} className="text-xs text-muted-foreground">
                  {i.estado === "resuelta" ? "Resuelta · " : "Abierta · "}
                  {i.titulo}
                </p>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={onNuevaPrioridad}>
              <Plus className="h-3.5 w-3.5" /> Prioridad de este meet
            </Button>
            <Button
              size="sm"
              variant="delete"
              onClick={() => {
                if (confirm("¿Eliminar este meet? Las prioridades que surgieron de él se mantienen.")) void wkDel(m.id);
              }}
            >
              Eliminar meet
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResRow({ it, onReabrir }: { it: WeeklyItem; onReabrir: () => void }) {
  const p = wkPri(it.prioridad);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{it.titulo}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge>{it.area || "-"}</Badge>
          <span style={{ color: p.c }}>{p.l}</span>
          <span>
            Resuelta el {it.resueltoTs ? new Date(it.resueltoTs).toLocaleDateString("es-AR") : "-"}
            {it.resueltoPor ? ` por ${wkName(it.resueltoPor)}` : ""}
          </span>
          {it.responsable && <span>Resp.: {wkName(it.responsable)}</span>}
          {(it.seguimiento ?? []).length > 0 && (
            <span>
              {it.seguimiento!.length} seguimiento{it.seguimiento!.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {it.resolucion && <p className="mt-1 text-xs text-muted-foreground">{it.resolucion}</p>}
      </div>
      <Button size="sm" variant="outline" onClick={onReabrir}>
        Reabrir
      </Button>
    </div>
  );
}

export function WeeklysClient() {
  const [docs, setDocs] = useState<WeeklyDoc[] | null>(null);
  const [wkForm, setWkForm] = useState<ItemFormState | null>(null);
  const [wkFormMeet, setWkFormMeet] = useState<MeetFormState | null>(null);
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [openMeets, setOpenMeets] = useState<Record<string, boolean>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [filtroArea, setFiltroArea] = useState("");
  const [filtroResp, setFiltroResp] = useState("");
  const [showAllMeets, setShowAllMeets] = useState(false);
  const [showAllRes, setShowAllRes] = useState(false);
  const { quienSos, elegir } = useQuienSos();

  useEffect(() => {
    const unsub = onSnapshot(
      collection(dbProyectos, "weeklys"),
      (snap) => setDocs(snap.docs.map((d) => d.data() as WeeklyDoc)),
      (err) => {
        console.error(err);
        toast.error("No se pudo conectar con la base de Weeklys.");
      }
    );
    return () => unsub();
  }, []);

  // Alarmas/avisos de vencida — corre cada vez que cambian los datos,
  // mientras esta pantalla esté abierta (ver nota en weeklys-notify.ts).
  useEffect(() => {
    if (!docs) return;
    const items = wkItems(docs);
    const resultados = checkearAlarmasWeeklys(items);
    resultados.forEach(({ id, patch }) => void wkPatch(id, patch));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs]);

  if (quienSos === undefined) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!quienSos) {
    return <QuienSos onElegir={elegir} />;
  }
  if (docs === null) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  const items = wkItems(docs);
  const meets = wkMeets(docs);
  const abiertas = items.filter((i) => i.estado !== "resuelta");
  const resueltas = items.filter((i) => i.estado === "resuelta");
  const mon = wkMonday();

  const pasaFiltro = (i: WeeklyItem) => (!filtroArea || i.area === filtroArea) && (!filtroResp || i.responsable === filtroResp);
  const ab = abiertas.filter(pasaFiltro);
  const areasUsadas = WK_AREAS.filter((a) => items.some((i) => i.area === a));

  const meetsOrdenados = [...meets].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const resueltasFiltradas = resueltas.filter(pasaFiltro).sort((a, b) => (b.resueltoTs ?? 0) - (a.resueltoTs ?? 0));

  const kpis: [number, string, string][] = [
    [abiertas.length, "Abiertas", ""],
    [abiertas.filter((i) => i.prioridad === "critica" || i.prioridad === "alta").length, "Críticas y altas", "text-warning"],
    [abiertas.filter(wkVencida).length, "Vencidas", "text-destructive"],
    [
      resueltas.filter((i) => i.resueltoTs && wkMonday(new Date(i.resueltoTs - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)) === mon).length,
      "Resueltas esta semana",
      "text-success",
    ],
  ];

  let lastWeek = "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Target className="h-5 w-5 text-primary" /> Weeklys
          </h1>
          <p className="text-sm text-muted-foreground">
            {wkWeekLabel(mon)} · Prioridades de la empresa: administración, proyectos, fábrica, compras, procesos...
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setWkFormMeet(wkFormMeet ? null : { fecha: wkToday(), area: "", lider: "", participantes: "", notas: "" });
              setWkForm(null);
            }}
          >
            <Users className="h-4 w-4" /> Registrar meet
          </Button>
          <Button
            onClick={() => {
              setWkForm(wkForm ? null : { titulo: "", area: "", prioridad: "alta", responsable: "", lider: "", limite: "", detalle: "", meetId: "" });
              setWkFormMeet(null);
            }}
          >
            <Plus className="h-4 w-4" /> Nueva prioridad
          </Button>
        </div>
      </div>

      {wkFormMeet && (
        <MeetFormBlock
          form={wkFormMeet}
          quienSos={quienSos}
          onCancel={() => setWkFormMeet(null)}
          onSaved={(m) => {
            setWkFormMeet(null);
            setWkForm({ titulo: "", area: m.area, prioridad: "alta", responsable: "", lider: m.lider ?? "", limite: "", detalle: "", meetId: m.id });
          }}
        />
      )}
      {wkForm && (
        <ItemForm
          form={wkForm}
          meets={meetsOrdenados}
          quienSos={quienSos}
          onCancel={() => setWkForm(null)}
          onSaved={(keepMeet) =>
            setWkForm(keepMeet ? { titulo: "", area: wkForm.area, prioridad: "alta", responsable: "", lider: wkForm.lider, limite: "", detalle: "", meetId: keepMeet } : null)
          }
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map(([n, l, cls], i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-3 text-center">
            <p className={`text-2xl font-semibold ${cls}`}>{n}</p>
            <p className="text-xs text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[["", "Todas las áreas"] as const, ...areasUsadas.map((a) => [a, a] as const)].map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setFiltroArea(val)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filtroArea === val ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
        <Select className="w-auto" value={filtroResp} onChange={(e) => setFiltroResp(e.target.value)}>
          <option value="">Todos los responsables</option>
          {TEAM.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Prioridades abiertas</h2>
          <Badge>{ab.length}</Badge>
        </div>
        {ab.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {abiertas.length ? "No hay prioridades abiertas con este filtro." : 'Todavía no hay prioridades cargadas. Usá "Nueva prioridad" o registrá un meet.'}
          </p>
        )}
        <div className="flex flex-col gap-4">
          {WK_PRI.map((p) => {
            const grp = ab.filter((i) => (i.prioridad || "media") === p.k).sort((a, b) => (a.limite || "9999").localeCompare(b.limite || "9999"));
            if (!grp.length) return null;
            return (
              <div key={p.k} className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: p.c }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.c }} />
                  {p.l} · {grp.length}
                </div>
                {grp.map((it) => (
                  <WeeklyCard
                    key={it.id}
                    it={it}
                    open={!!openItems[it.id]}
                    resolving={resolvingId === it.id}
                    quienSos={quienSos}
                    onToggle={() => setOpenItems((prev) => ({ ...prev, [it.id]: !prev[it.id] }))}
                    onResolve={(r) => setResolvingId(r ? it.id : null)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Meets con líderes de área</h2>
          <Badge>{meetsOrdenados.length}</Badge>
        </div>
        {meetsOrdenados.length === 0 && <p className="text-sm text-muted-foreground">Todavía no registraste meets.</p>}
        <div className="flex flex-col gap-2">
          {(showAllMeets ? meetsOrdenados : meetsOrdenados.slice(0, 6)).map((m) => (
            <MeetCard
              key={m.id}
              m={m}
              open={!!openMeets[m.id]}
              vinc={items.filter((i) => i.meetId === m.id)}
              onToggle={() => setOpenMeets((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
              onNuevaPrioridad={() => {
                setWkForm({ titulo: "", area: m.area, prioridad: "alta", responsable: "", lider: m.lider ?? "", limite: "", detalle: "", meetId: m.id });
                setWkFormMeet(null);
              }}
            />
          ))}
        </div>
        {meetsOrdenados.length > 6 && (
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowAllMeets(!showAllMeets)}>
            {showAllMeets ? "Ver menos" : `Ver todos los meets (${meetsOrdenados.length})`}
          </Button>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Resueltas</h2>
          <Badge>{resueltasFiltradas.length}</Badge>
        </div>
        {resueltasFiltradas.length === 0 && <p className="text-sm text-muted-foreground">Lo que se vaya resolviendo queda registrado acá.</p>}
        <div className="flex flex-col gap-2">
          {(showAllRes ? resueltasFiltradas : resueltasFiltradas.slice(0, 15)).map((it) => {
            const wk = it.resueltoTs ? wkMonday(new Date(it.resueltoTs - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)) : "";
            const showWeek = wk !== lastWeek;
            lastWeek = wk;
            return (
              <div key={it.id} className="flex flex-col gap-2">
                {showWeek && <p className="text-xs font-medium text-muted-foreground">{wk ? wkWeekLabel(wk) : "Sin fecha"}</p>}
                <ResRow
                  it={it}
                  onReabrir={async () => {
                    const seguimiento = [...(it.seguimiento ?? []), { ts: Date.now(), by: quienSos, texto: `Reabierta${it.resolucion ? ` (resolución anterior: ${it.resolucion})` : ""}` }];
                    // deleteField(), no `campo: undefined` — Firestore rechaza `undefined`.
                    await setDoc(
                      doc(dbProyectos, "weeklys", it.id),
                      { estado: "en-curso", seguimiento, resueltoTs: deleteField(), resueltoPor: deleteField(), resolucion: "", ts: Date.now() },
                      { merge: true }
                    );
                    setOpenItems((prev) => ({ ...prev, [it.id]: true }));
                  }}
                />
              </div>
            );
          })}
        </div>
        {resueltasFiltradas.length > 15 && (
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowAllRes(!showAllRes)}>
            {showAllRes ? "Ver menos" : `Ver todas las resueltas (${resueltasFiltradas.length})`}
          </Button>
        )}
      </div>
    </div>
  );
}
