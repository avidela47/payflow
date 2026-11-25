"use client";

// Cómputo Privado — planilla valorizada (con precios) armada a partir de un
// cómputo CERRADO del Generador de Cómputos. Port de renderCotiz/czRenderList/
// czRenderSheet/czNuevoDesde/czSincronizar/czPdf (líneas 4145-4461 del
// original). Pestaña con PIN propio (no el de Accesos — ver computo-privado-
// crypto.ts): cada doc de la colección "cotizaciones" guarda la planilla
// ENTERA cifrada como un único blob {id, iv, ct, ts}; sin el PIN no se puede
// leer ni un precio.
//
// Misma identidad "¿Quién sos?" que el resto de Proyectos (useQuienSos).
//
// Simplificación consciente respecto del original: el original evita
// re-renderizar la planilla mientras hay un input enfocado dentro de ella
// (czRefresh chequea document.activeElement). Acá, en vez de eso, la
// planilla abierta ("sheet") se edita como una copia local en memoria que
// NO se vuelve a sincronizar con lo que llega de Firestore mientras está
// abierta — solo se recarga desde la lista al abrir/cambiar de planilla o
// tras una sincronización explícita. Mismo objetivo (no perder lo que se
// está tipeando), mecanismo más simple.
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { dbProyectos } from "@/lib/firebase-proyectos";
import { logActivity } from "@/lib/proyectos-activity";
import { useQuienSos, QuienSos } from "../pipeline/quien-sos";
import { teamMemberById } from "@/lib/proyectos-team";
import type { ComputoDoc } from "../computos/computos-client";
import {
  czNum,
  czFmt,
  czFmtN,
  czTotal,
  czCompCambio,
  buildValorizadoDesde,
  diffSincronizar,
  type ComputoValorizado,
  type CzItem,
} from "@/lib/computo-privado";
import { czUnlock, czDescifrarTexto, czCifrarTexto } from "@/lib/computo-privado-crypto";
import { czPdf } from "@/lib/computo-privado-pdf";
import { czExcel } from "@/lib/computo-privado-excel";
import { Lock, BadgeDollarSign, ArrowLeft, RefreshCw, Download, Trash2, Plus, X, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CzRaw = { id: string; iv: string; ct: string; ts?: number };

function nid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtFecha(iso?: string): string {
  if (!iso) return "sin fecha";
  const p = String(iso).split("-");
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return String(iso);
}

function PinLock({ onUnlock }: { onUnlock: (pin: string) => Promise<void> }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function intentar() {
    if (!pin.trim()) return;
    setLoading(true);
    setErr("");
    try {
      await onUnlock(pin.trim());
    } catch {
      setErr("Contraseña incorrecta.");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center">
      <Lock className="h-8 w-8 text-muted-foreground" />
      <h2 className="text-sm font-semibold">Cómputo privado</h2>
      <p className="text-xs text-muted-foreground">Ingresá la contraseña para ver y cargar precios.</p>
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Contraseña"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void intentar()}
        className="text-center"
      />
      {err && <p className="text-xs text-destructive">{err}</p>}
      <Button className="w-full" disabled={loading} onClick={() => void intentar()}>
        {loading ? "Verificando..." : "Entrar"}
      </Button>
    </div>
  );
}

function CzRow({
  item,
  idx,
  blank,
  onEdit,
  onPromote,
  onRemove,
}: {
  item: CzItem | null;
  idx: number;
  blank: boolean;
  onEdit: (uid: string, patch: Partial<CzItem>) => void;
  onPromote: (draft: CzItem) => void;
  onRemove: (uid: string) => void;
}) {
  const [draft, setDraft] = useState<{ desc: string; det: string; cant: string; pu: string }>({ desc: "", det: "", cant: "", pu: "" });
  const data = item ?? draft;

  function field(key: "desc" | "det" | "cant" | "pu", value: string) {
    if (item) {
      onEdit(item.uid, { [key]: value });
      return;
    }
    const next = { ...draft, [key]: value };
    setDraft(next);
    onPromote({ uid: nid("zi"), tipo: "extra", desc: next.desc, det: next.det, cant: next.cant, pu: next.pu });
    setDraft({ desc: "", det: "", cant: "", pu: "" });
  }

  function blurPu() {
    if (item && item.pu.trim()) onEdit(item.uid, { pu: czFmtN(czNum(item.pu)) });
  }

  const sub = czNum(data.cant) * czNum(data.pu);
  const subTxt = String(data.pu || "").trim() ? czFmtN(sub) : "";

  return (
    <tr className={blank ? "opacity-60" : item?.tipo === "lum" ? "bg-muted/30" : ""}>
      <td className="w-8 px-1 py-1 text-center text-xs text-muted-foreground">{blank ? "" : idx + 1}</td>
      <td className="px-1 py-1">
        <Input className="h-8 text-sm" value={data.desc} placeholder={blank ? "Agregar item..." : ""} onChange={(e) => field("desc", e.target.value)} />
      </td>
      <td className="px-1 py-1">
        <Textarea className="min-h-8 resize-y text-xs" rows={1} value={data.det} onChange={(e) => field("det", e.target.value)} />
      </td>
      <td className="w-20 px-1 py-1">
        <Input className="h-8 text-right text-sm" value={data.cant} placeholder={blank ? "" : "0"} onChange={(e) => field("cant", e.target.value)} />
      </td>
      <td className="w-36 px-1 py-1">
        <Input className="h-8 text-right text-sm" value={data.pu} placeholder={blank ? "" : "0,00"} onChange={(e) => field("pu", e.target.value)} onBlur={blurPu} />
      </td>
      <td className="w-36 px-2 py-1 text-right text-sm tabular-nums">{subTxt}</td>
      <td className="w-8 px-1 py-1 text-center">
        {!blank && item && (
          <button type="button" title="Quitar fila" onClick={() => onRemove(item.uid)} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

export function ComputoPrivadoClient() {
  const [czKey, setCzKey] = useState<CryptoKey | null>(null);
  const [raw, setRaw] = useState<CzRaw[] | null>(null);
  const [compgen, setCompgen] = useState<ComputoDoc[] | null>(null);
  const [list, setList] = useState<ComputoValorizado[] | null>(null);
  const [curId, setCurId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<ComputoValorizado | null>(null);
  const [blankRows, setBlankRows] = useState(3);
  const [pick, setPick] = useState("");
  const { quienSos, elegir } = useQuienSos();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(dbProyectos, "cotizaciones"),
      (snap) => setRaw(snap.docs.map((d) => d.data() as CzRaw)),
      (err) => {
        console.error(err);
        toast.error("No se pudo conectar con la base de Cómputo privado.");
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(dbProyectos, "computosGen"),
      (snap) =>
        setCompgen(
          snap.docs.map((d) => {
            const data = d.data() as ComputoDoc;
            return { ...data, id: data.id || d.id };
          })
        ),
      (err) => console.error(err)
    );
    return () => unsub();
  }, []);

  // Descifra todo cuando hay clave y cuando cambian los datos crudos — cache
  // simple por versión de `raw`, igual criterio que Accesos.
  useEffect(() => {
    if (!czKey || !raw) {
      setList(null);
      return;
    }
    let activo = true;
    (async () => {
      const out: ComputoValorizado[] = [];
      for (const d of raw) {
        try {
          const txt = await czDescifrarTexto(czKey, d.iv, d.ct);
          out.push(JSON.parse(txt) as ComputoValorizado);
        } catch {
          // entrada ilegible (PIN distinto al que la cifró, dato corrupto) — se omite de la lista
        }
      }
      out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      if (activo) setList(out);
    })();
    return () => {
      activo = false;
    };
  }, [czKey, raw]);

  // Se vuelve a bloquear si cambia "quién sos" — mismo criterio que Accesos.
  useEffect(() => {
    setCzKey(null);
    setCurId(null);
    setSheet(null);
  }, [quienSos]);

  const cerrados = useMemo(() => (compgen || []).filter((c) => c.estado === "cerrado").sort((a, b) => (b.ts || 0) - (a.ts || 0)), [compgen]);

  function compDe(z: ComputoValorizado | null): ComputoDoc | undefined {
    if (!z?.compId) return undefined;
    return (compgen || []).find((c) => c.id === z.compId);
  }

  async function desbloquear(pin: string) {
    const key = await czUnlock(pin);
    setCzKey(key);
    if (quienSos) logActivity("entro a Computo privado", "Computo privado", quienSos);
  }

  function bloquear() {
    setCzKey(null);
    setCurId(null);
    setSheet(null);
  }

  async function persistir(z: ComputoValorizado) {
    if (!czKey) return;
    const z2 = { ...z, ts: Date.now() };
    try {
      const enc = await czCifrarTexto(czKey, JSON.stringify(z2));
      await setDoc(doc(dbProyectos, "cotizaciones", z2.id), { id: z2.id, iv: enc.iv, ct: enc.ct, ts: z2.ts });
    } catch (err) {
      console.error(err);
      toast.error("No se pudo guardar el cómputo privado.");
    }
  }

  function programarGuardado(z: ComputoValorizado) {
    setSheet(z);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persistir(z), 600);
  }

  function crearDesde(compId: string) {
    const c = (compgen || []).find((x) => x.id === compId);
    if (!c || !quienSos) return;
    const z = buildValorizadoDesde(c, { id: nid("cz"), fecha: hoy(), creadoPor: quienSos, nid: () => nid("zi") });
    setCurId(z.id);
    setSheet(z);
    setBlankRows(3);
    void persistir(z);
    logActivity(`creo un computo privado de ${c.proyecto}`, "Computo privado", quienSos);
  }

  function abrir(id: string) {
    const z = (list || []).find((x) => x.id === id);
    if (!z) return;
    setCurId(id);
    setSheet(z);
    setBlankRows(3);
  }

  function volver() {
    setCurId(null);
    setSheet(null);
  }

  function sincronizar() {
    if (!sheet) return;
    const c = compDe(sheet);
    if (!c) {
      alert("No se encontró el cómputo original (puede haberse eliminado).");
      return;
    }
    const { items, quitados, nuevos } = diffSincronizar(sheet, c, () => nid("zi"));
    let finalItems = items;
    if (quitados.length) {
      const sacar = confirm(
        `Estas luminarias ya no están en el cómputo original:\n- ${quitados.map((r) => r.desc).join("\n- ")}\n\n¿Quitarlas de la planilla? (Cancelar = dejarlas)`
      );
      if (sacar) finalItems = items.filter((r) => !quitados.some((q) => q.uid === r.uid));
    }
    const z2: ComputoValorizado = { ...sheet, items: finalItems, compTs: c.ts || Date.now(), compFecha: c.cerrado || c.creado || sheet.compFecha };
    setSheet(z2);
    void persistir(z2);
    alert(`Planilla actualizada desde el cómputo.${nuevos ? ` Se agregaron ${nuevos} luminaria(s) nueva(s) sin precio.` : ""} Los precios cargados se mantuvieron.`);
  }

  async function eliminar(z: ComputoValorizado) {
    if (!confirm(`¿Eliminar el cómputo privado de "${z.proyecto}"?`)) return;
    try {
      await deleteDoc(doc(dbProyectos, "cotizaciones", z.id));
      if (curId === z.id) volver();
      toast.success("Eliminado.");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo eliminar.");
    }
  }

  function editItem(uid: string, patch: Partial<CzItem>) {
    if (!sheet) return;
    const items = sheet.items.map((r) => (r.uid === uid ? { ...r, ...patch } : r));
    programarGuardado({ ...sheet, items });
  }

  function promoteItem(draft: CzItem) {
    if (!sheet) return;
    programarGuardado({ ...sheet, items: [...sheet.items, draft] });
  }

  function removeItem(uid: string) {
    if (!sheet) return;
    const z2 = { ...sheet, items: sheet.items.filter((r) => r.uid !== uid) };
    setSheet(z2);
    void persistir(z2);
  }

  function setCampo<K extends keyof ComputoValorizado>(key: K, value: ComputoValorizado[K]) {
    if (!sheet) return;
    programarGuardado({ ...sheet, [key]: value });
  }

  function setMoneda(m: "USD" | "ARS") {
    if (!sheet) return;
    const z2 = { ...sheet, moneda: m };
    setSheet(z2);
    void persistir(z2);
  }

  if (quienSos === undefined) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!quienSos) {
    return <QuienSos onElegir={elegir} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <BadgeDollarSign className="h-5 w-5 text-primary" /> Cómputo privado
        </h1>
        {czKey && (
          <div className="flex items-center gap-2">
            {sheet && (
              <>
                <Button variant="outline" onClick={volver}>
                  <ArrowLeft className="h-4 w-4" /> Todos
                </Button>
                {sheet.compId && (
                  <Button variant="outline" onClick={sincronizar} title="Trae cantidades, especificaciones y luminarias nuevas del cómputo original, manteniendo los precios">
                    <RefreshCw className="h-4 w-4" /> Actualizar desde el cómputo
                  </Button>
                )}
                <Button variant="outline" onClick={() => void czPdf(sheet)}>
                  <Download className="h-4 w-4" /> Descargar PDF
                </Button>
                <Button variant="outline" onClick={() => void czExcel(sheet)}>
                  <FileSpreadsheet className="h-4 w-4" /> Descargar Excel
                </Button>
              </>
            )}
            <Button variant="outline" onClick={bloquear}>
              <Lock className="h-4 w-4" /> Bloquear
            </Button>
          </div>
        )}
      </div>

      {!czKey ? (
        <PinLock onUnlock={desbloquear} />
      ) : !sheet ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium">Nuevo cómputo valorizado</p>
            <div className="flex flex-wrap gap-2">
              <select className="h-9 min-w-72 rounded-md border border-input bg-background px-3 text-sm" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">{cerrados.length ? "Elegir un cómputo cerrado..." : "No hay cómputos cerrados todavía"}</option>
                {cerrados.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.proyecto} · cerrado el {fmtFecha(c.cerrado)} · {(c.items || []).length} tipos de luminaria
                  </option>
                ))}
              </select>
              <Button disabled={!pick} onClick={() => crearDesde(pick)}>
                Crear planilla
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Copia las luminarias con sus especificaciones y cantidades, y la mano de obra y el elevador si el cómputo los incluye. Después se cargan los precios.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">Cómputos valorizados</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{list === null ? "…" : list.length}</span>
          </div>
          {list === null ? (
            <p className="text-sm text-muted-foreground">Descifrando…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay cómputos valorizados.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {list.map((z) => (
                <div key={z.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{z.proyecto || "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground">
                      Creado el {fmtFecha(z.fecha)}
                      {z.creadoPor ? ` por ${teamMemberById(z.creadoPor)?.name ?? z.creadoPor}` : ""} · {(z.items || []).length} items
                    </p>
                    {czCompCambio(z, compDe(z)) && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> El cómputo original cambió: abrila y tocá &quot;Actualizar desde el cómputo&quot;.
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{czFmt(czTotal(z), z.moneda)}</p>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" onClick={() => abrir(z.id)}>
                      Abrir / editar
                    </Button>
                    <Button variant="outline" onClick={() => void czPdf(z)}>
                      <Download className="h-3.5 w-3.5" /> PDF
                    </Button>
                    <Button variant="outline" onClick={() => void czExcel(z)}>
                      <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                    </Button>
                    <Button variant="delete" onClick={() => void eliminar(z)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>Proyecto</Label>
              <Input value={sheet.proyecto || ""} onChange={(e) => setCampo("proyecto", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={sheet.fecha || ""} onChange={(e) => setCampo("fecha", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Moneda</Label>
              <div className="flex gap-1">
                <Button type="button" variant={sheet.moneda === "USD" ? "default" : "outline"} onClick={() => setMoneda("USD")}>
                  Dólares (US$)
                </Button>
                <Button type="button" variant={sheet.moneda === "ARS" ? "default" : "outline"} onClick={() => setMoneda("ARS")}>
                  Pesos ($)
                </Button>
              </div>
            </div>
          </div>

          {czCompCambio(sheet, compDe(sheet)) && (
            <p className="flex items-center gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" /> El cómputo original se modificó después de armar esta planilla. Usá <b>Actualizar desde el cómputo</b> para traer los cambios (los precios
              se mantienen).
            </p>
          )}
          {sheet.compId && (
            <p className="text-xs text-muted-foreground">
              Basado en el cómputo cerrado de {sheet.proyecto}
              {sheet.compFecha ? ` (${fmtFecha(sheet.compFecha)})` : ""}. Los cambios acá no modifican el cómputo original.
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                  <th className="px-1 py-2 text-left">#</th>
                  <th className="px-1 py-2 text-left">Item</th>
                  <th className="px-1 py-2 text-left">Detalle</th>
                  <th className="px-1 py-2 text-right">Cant.</th>
                  <th className="px-1 py-2 text-right">Precio unit.</th>
                  <th className="px-2 py-2 text-right">Subtotal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sheet.items.map((it, i) => (
                  <CzRow key={it.uid} item={it} idx={i} blank={false} onEdit={editItem} onPromote={promoteItem} onRemove={removeItem} />
                ))}
                {Array.from({ length: blankRows }).map((_, i) => (
                  <CzRow key={`blank-${i}`} item={null} idx={0} blank onEdit={editItem} onPromote={promoteItem} onRemove={removeItem} />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td colSpan={5} className="px-2 py-2">
                    TOTAL {sheet.moneda === "ARS" ? "EN PESOS" : "EN DÓLARES"}
                  </td>
                  <td className="px-2 py-2 text-right">{czFmt(czTotal(sheet), sheet.moneda)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <div>
            <Button variant="outline" onClick={() => setBlankRows((n) => n + 3)}>
              <Plus className="h-3.5 w-3.5" /> Agregar filas
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Cargá el precio por unidad: el subtotal se calcula solo con la cantidad. Las filas vacías de abajo se convierten en items cuando escribís en ellas.</p>

          <div className="flex flex-col gap-1.5">
            <Label>Notas / condiciones (salen en el PDF)</Label>
            <Textarea rows={3} value={sheet.notas || ""} placeholder="Validez de la oferta, forma de pago, plazo de entrega, tipo de cambio..." onChange={(e) => setCampo("notas", e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}
