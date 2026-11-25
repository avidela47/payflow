// Weeklys — prioridades macro de la empresa (administración, proyectos,
// fábrica, compras, procesos...) y meets con líderes de área. Port de las
// líneas 3707-4144 de /tmp/protectos-itelsa/index.html (var WK_AREAS/WK_PRI/
// WK_EST, wkToday/wkMonday/wkAddDays/wkWeekLabel/wkPri/wkVencida en
// adelante). Colección Firestore propia "weeklys" (no "projects" — no
// comparte nada con Proyectos/Arquitectura/Gestión), con dos tipos de
// documento discriminados por `kind`:
//  - "item": una prioridad (titulo, area, prioridad, estado, responsable,
//    lider, limite, detalle, seguimiento[], alarma, resolución...).
//  - "meet": un meet con un líder de área (fecha, area, lider,
//    participantes, notas).
// Las personas (responsable, creadoPor, seguimiento.by, alarma.ids) son ids
// de TEAM (proyectos-team.ts) — la misma identidad "quién sos" que ya usa
// toda esta pestaña, no Empleados.

export const WK_AREAS = [
  "Administracion",
  "Compras",
  "Proyectos",
  "Fabrica",
  "Procesos",
  "Comercial",
  "Marketing",
  "Calidad",
  "RRHH",
  "Otra",
] as const;

export type WkPrioridad = "critica" | "alta" | "media" | "baja";
export const WK_PRI: { k: WkPrioridad; l: string; c: string }[] = [
  { k: "critica", l: "Crítica", c: "#DC2626" },
  { k: "alta", l: "Alta", c: "#EA580C" },
  { k: "media", l: "Media", c: "#CA8A04" },
  { k: "baja", l: "Baja", c: "#64748B" },
];

export type WkEstado = "pendiente" | "en-curso" | "bloqueada" | "resuelta";
export const WK_EST: [Exclude<WkEstado, "resuelta">, string][] = [
  ["pendiente", "Pendiente"],
  ["en-curso", "En curso"],
  ["bloqueada", "Bloqueada"],
];

export type WkSeguimiento = { ts: number; by: string; texto: string };
export type WkAlarma = { fecha: string; ids: string[]; repetir: "no" | "semanal"; enviada?: string; enviadaTs?: number };

export type WeeklyItem = {
  id: string;
  kind: "item";
  titulo: string;
  area: string;
  prioridad: WkPrioridad;
  estado: WkEstado;
  responsable?: string;
  lider?: string;
  limite?: string;
  detalle?: string;
  seguimiento?: WkSeguimiento[];
  alarma?: WkAlarma;
  resolucion?: string;
  resueltoTs?: number;
  resueltoPor?: string;
  avisoVencido?: string;
  meetId?: string;
  semana?: string;
  creadoPor?: string;
  creado?: string;
  ts?: number;
};

export type WeeklyMeet = {
  id: string;
  kind: "meet";
  fecha: string;
  area: string;
  lider?: string;
  participantes?: string;
  notas?: string;
  creadoPor?: string;
  ts?: number;
};

export type WeeklyDoc = WeeklyItem | WeeklyMeet;

export function fmtFecha(iso?: string): string {
  if (!iso) return "sin fecha";
  const p = String(iso).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(iso);
}

export function wkToday(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function wkMonday(iso?: string): string {
  const d = iso ? new Date(`${iso}T12:00:00`) : new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function wkAddDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function wkWeekLabel(mon: string): string {
  return `Semana del ${fmtFecha(mon).slice(0, 5)} al ${fmtFecha(wkAddDays(mon, 6))}`;
}

export function wkPri(k: WkPrioridad): { k: WkPrioridad; l: string; c: string } {
  return WK_PRI.find((p) => p.k === k) ?? WK_PRI[2];
}

export function wkVencida(it: WeeklyItem): boolean {
  return !!it.limite && it.estado !== "resuelta" && it.limite < wkToday();
}

export function wkItems(docs: WeeklyDoc[]): WeeklyItem[] {
  return docs.filter((x): x is WeeklyItem => x.kind === "item");
}

export function wkMeets(docs: WeeklyDoc[]): WeeklyMeet[] {
  return docs.filter((x): x is WeeklyMeet => x.kind === "meet");
}
