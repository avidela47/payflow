// Cómputo Privado (valorizado) — tipos y lógica pura, port de las líneas
// 4204-4258 del original (czNum/czFmt/czFmtN/czTotal/czSpecs/czNuevoDesde/
// czSincronizar/czCompCambio). El cifrado y el I/O de Firestore quedan
// afuera (computo-privado-crypto.ts y el client component) — acá solo la
// parte que no depende de criptografía ni de React, para poder testear/leer
// sin todo eso alrededor.
//
// Toma un cómputo CERRADO del Generador de Cómputos (computosGen) y arma una
// planilla tipo Excel con precio unitario por ítem — la planilla entera
// (este tipo completo) viaja cifrada como un único blob en la colección
// "cotizaciones" (ver computo-privado-crypto.ts).
import type { ComputoDoc, ComputoItem } from "@/app/(dashboard)/computos/computos-client";
import { specsTxt } from "./computos-specs";

export type CzItemTipo = "lum" | "mo" | "elev" | "extra";

export type CzItem = {
  uid: string;
  tipo: CzItemTipo;
  src?: string; // uid del item en el cómputo original (solo tipo "lum") — para re-matchear al sincronizar
  desc: string;
  det: string;
  cant: string; // texto libre a propósito (no number): se carga como viene del cómputo y se puede editar a mano
  pu: string; // precio unitario, también texto libre — se parsea con czNum recién al calcular
};

export type ComputoValorizado = {
  id: string;
  compId?: string;
  proyecto: string;
  fecha: string;
  moneda: "USD" | "ARS";
  items: CzItem[];
  notas?: string;
  compFecha?: string;
  compTs?: number;
  creadoPor?: string;
  ts?: number;
};

// Números: acepta "1.234,50" (Argentino), "1234.5" (plano), "$ 1.234" (con
// prefijo de moneda) — calcado de czNum.
export function czNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  let s = String(v).replace(/[^\d,.\-]/g, "");
  if (!s) return 0;
  if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function czFmtN(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function czFmt(n: number, mon: "USD" | "ARS"): string {
  return (mon === "ARS" ? "$ " : "US$ ") + czFmtN(n);
}

export function czTotal(z: ComputoValorizado): number {
  return (z.items || []).reduce((s, it) => s + czNum(it.cant) * czNum(it.pu), 0);
}

// "det" de un ítem de luminaria del cómputo original: specsTxt ya arma
// "potencia · ángulo · temperatura · protocolo · tensión" (mismas 5 claves,
// mismo separador " · " que czSpecs) pero NO agrega el comentario — eso lo
// hace czSpecs del original con esta misma lógica de separador condicional,
// así que se suma acá en vez de duplicar specsTxt entero.
export function czDet(it: ComputoItem): string {
  const base = specsTxt(it);
  if (!it.comentario) return base;
  return base + (it.potencia || it.angulo ? " · " : "") + it.comentario;
}

function descLum(it: ComputoItem): string {
  return (it.codigo ? it.codigo + " - " : "") + (it.nombre || "");
}

// Arma una planilla nueva a partir de un cómputo cerrado — port de
// czNuevoDesde. El id y la fecha de creación los decide el caller (nid()/
// hoy() están en el client component, no acá, para no duplicar esos
// generadores en cada archivo).
export function buildValorizadoDesde(c: ComputoDoc, opts: { id: string; fecha: string; creadoPor: string; nid: () => string }): ComputoValorizado {
  const items: CzItem[] = (c.items || []).map((it) => ({
    uid: opts.nid(),
    tipo: "lum",
    src: it.uid || "",
    desc: descLum(it),
    det: czDet(it),
    cant: String(it.cant || ""),
    pu: "",
  }));
  if (c.mo === "si") items.push({ uid: opts.nid(), tipo: "mo", desc: "Mano de obra", det: (c.moEsp || "").trim(), cant: "1", pu: "" });
  if (c.elev === "si") items.push({ uid: opts.nid(), tipo: "elev", desc: "Elevador", det: (c.elevEsp || "").trim(), cant: "1", pu: "" });
  return {
    id: opts.id,
    compId: c.id,
    proyecto: c.proyecto,
    fecha: opts.fecha,
    moneda: "USD",
    items,
    notas: (c.obs || "").trim(),
    compFecha: c.cerrado || c.creado || "",
    compTs: c.ts || 0,
    creadoPor: opts.creadoPor,
  };
}

// Re-sincroniza una planilla existente contra su cómputo original: trae
// cantidades/especificaciones actualizadas y luminarias nuevas, detecta las
// que ya no están (para que el caller pregunte si sacarlas — igual que el
// confirm() del original, que acá no puede ir adentro de esta función pura)
// y nunca toca precios ya cargados ni ítems agregados a mano. Port de
// czSincronizar, separado en dos pasos porque el original resuelve el
// confirm() de forma síncrona en el medio.
export function diffSincronizar(z: ComputoValorizado, c: ComputoDoc, nid: () => string): { items: CzItem[]; quitados: CzItem[]; nuevos: number } {
  const items = z.items.map((r) => ({ ...r }));
  const usados: Record<string, boolean> = {};
  let nuevos = 0;

  (c.items || []).forEach((it) => {
    const row = items.find((r) => r.tipo === "lum" && !usados[r.uid] && ((it.uid && r.src === it.uid) || r.desc === descLum(it)));
    if (row) {
      row.src = it.uid || row.src;
      row.desc = descLum(it);
      row.det = czDet(it);
      row.cant = String(it.cant || "");
      usados[row.uid] = true;
    } else {
      const nr: CzItem = { uid: nid(), tipo: "lum", src: it.uid || "", desc: descLum(it), det: czDet(it), cant: String(it.cant || ""), pu: "" };
      usados[nr.uid] = true;
      let lastLum = -1;
      items.forEach((r, i) => {
        if (r.tipo === "lum") lastLum = i;
      });
      items.splice(lastLum + 1, 0, nr);
      nuevos++;
    }
  });

  const quitados = items.filter((r) => r.tipo === "lum" && !usados[r.uid]);

  (["mo", "elev"] as const).forEach((k) => {
    const label = k === "mo" ? "Mano de obra" : "Elevador";
    const espKey = k === "mo" ? c.moEsp : c.elevEsp;
    const row = items.find((r) => r.tipo === k);
    const activo = k === "mo" ? c.mo === "si" : c.elev === "si";
    if (activo) {
      const det = (espKey || "").trim();
      if (row) row.det = det;
      else items.push({ uid: nid(), tipo: k, desc: label, det, cant: "1", pu: "" });
    }
  });

  return { items, quitados, nuevos };
}

export function czCompCambio(z: ComputoValorizado, c: ComputoDoc | undefined): boolean {
  return !!(c && z.compTs && (c.ts || 0) > z.compTs);
}
