"use client";

// Simulador de viajes — botón + modal que vive al lado de "Nuevo viaje" en
// Viajes (Finanzas). Port de la idea del papel de Ariel (proveedor / fecha
// de compra / fecha de factura / neto / IVA / forma de pago / fecha de
// pago) pero resuelto con el mismo motor que el resto de Viáticos (Mongoose
// + server actions + formulario con Guardar explícito), no con el motor de
// Firestore/autosave que usa la familia Proyectos — son subsistemas
// distintos dentro de PayFlow y este botón vive en el de Viáticos.
//
// Decisiones ya charladas con Ariel (2026-11-25): las simulaciones SE
// GUARDAN (para volver a verlas/compararlas), siempre en pesos (sin
// conversión a USD), y además del total general calculan el total por
// forma de pago y un calendario de pagos por fecha de pago. El estado
// pagado/parcial de cada ítem usa el mismo mecanismo que los pagos
// parciales de empleados en Viatico (pagos[] con monto+fecha, saldo =
// total - pagado).
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Calculator, Plus, Trash2, X, CalendarDays, Wallet, FileWarning, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  listSimuladores,
  getSimulador,
  createSimulador,
  updateSimulador,
  deleteSimulador,
  type SimuladorListItem,
  type SimuladorFormInput,
} from "./simulador-actions";
import { SIM_PAYMENT_MODES, type SimPaymentMode } from "@/models/SimuladorViaje";
import { nextIva } from "@/lib/iva";

const PAYMENT_MODE_OPTIONS: { value: SimPaymentMode; label: string }[] = [
  { value: "TARJETA", label: "Tarjeta" },
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "DEBITO", label: "Débito" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "ECHEQ", label: "E-Cheq" },
];

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return keySeq;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// 2026-11-25 (Ariel): cada pago ahora lleva su propia forma de pago — un
// mismo proveedor se puede desglosar en varios pagos con métodos distintos
// (parte efectivo, parte e-cheq...), en vez de un único método por ítem.
// `emitido` solo aplica cuando formaPago === "ECHEQ".
type PagoRow = { _key: number; monto: number; fechaISO: string; formaPago?: SimPaymentMode; emitido?: boolean };
type ItemRow = {
  _key: number;
  proveedor: string;
  fechaCompraISO: string;
  fechaFacturaISO: string;
  neto: number;
  iva: number;
  // Forma de pago PLANEADA/principal del ítem — se usa en el resumen por
  // forma de pago mientras no haya ningún pago real cargado todavía.
  formaPago?: SimPaymentMode;
  fechaPagoISO: string;
  pagos: PagoRow[];
};

function emptyItemRow(): ItemRow {
  return { _key: nextKey(), proveedor: "", fechaCompraISO: todayISO(), fechaFacturaISO: "", neto: 0, iva: 0, fechaPagoISO: "", pagos: [] };
}
// Pre-carga la forma de pago del nuevo pago con la del ítem (planeada), para
// no tener que elegirla de nuevo cuando coincide — sigue siendo editable.
function emptyPagoRow(formaPagoDefault?: SimPaymentMode): PagoRow {
  return { _key: nextKey(), monto: 0, fechaISO: todayISO(), formaPago: formaPagoDefault };
}

function totalItem(it: { neto: number; iva: number }): number {
  return (it.neto || 0) + (it.iva || 0);
}
// Un e-cheq SIN emitir todavía no es plata efectivamente pagada — no debe
// mover el estado a Parcial/Pagado hasta que se marque como emitido.
function pagoCuentaComoPagado(p: { formaPago?: SimPaymentMode; emitido?: boolean }): boolean {
  return !(p.formaPago === "ECHEQ" && !p.emitido);
}
function saldoItem(it: { neto: number; iva: number; pagos: { monto: number; formaPago?: SimPaymentMode; emitido?: boolean }[] }): number {
  const pagado = it.pagos.filter(pagoCuentaComoPagado).reduce((s, p) => s + p.monto, 0);
  return totalItem(it) - pagado;
}
function pagadoItem(it: { pagos: { monto: number; formaPago?: SimPaymentMode; emitido?: boolean }[] }): number {
  return it.pagos.filter(pagoCuentaComoPagado).reduce((s, p) => s + p.monto, 0);
}

export function SimuladorViajesButton() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "form">("list");
  const [simuladores, setSimuladores] = useState<SimuladorListItem[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function refreshList() {
    setLoadingList(true);
    try {
      const data = await listSimuladores();
      setSimuladores(data);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo cargar la lista de simulaciones.");
    } finally {
      setLoadingList(false);
    }
  }

  function abrirModal() {
    setOpen(true);
    setView("list");
    void refreshList();
  }

  function nuevaSimulacion() {
    setEditingId(null);
    setNombre("");
    setNotes("");
    setItems([emptyItemRow()]);
    setView("form");
  }

  async function abrirSimulacion(id: string) {
    try {
      const d = await getSimulador(id);
      if (!d) {
        toast.error("No se encontró la simulación.");
        return;
      }
      setEditingId(d.id);
      setNombre(d.nombre);
      setNotes(d.notes ?? "");
      setItems(
        d.items.map((it) => ({
          _key: nextKey(),
          proveedor: it.proveedor,
          fechaCompraISO: it.fechaCompraISO ?? "",
          fechaFacturaISO: it.fechaFacturaISO ?? "",
          neto: it.neto,
          iva: it.iva,
          formaPago: it.formaPago,
          fechaPagoISO: it.fechaPagoISO ?? "",
          pagos: it.pagos.map((p) => ({ _key: nextKey(), monto: p.monto, fechaISO: p.fechaISO, formaPago: p.formaPago, emitido: p.emitido })),
        }))
      );
      setView("form");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo abrir la simulación.");
    }
  }

  async function guardar() {
    if (!nombre.trim()) {
      toast.error("Ponele un nombre a la simulación.");
      return;
    }
    const input: SimuladorFormInput = {
      nombre: nombre.trim(),
      notes: notes.trim() || undefined,
      items: items
        .filter((it) => it.proveedor.trim())
        .map((it) => ({
          proveedor: it.proveedor.trim(),
          fechaCompra: it.fechaCompraISO || undefined,
          fechaFactura: it.fechaFacturaISO || undefined,
          neto: it.neto || 0,
          iva: it.iva || 0,
          formaPago: it.formaPago,
          fechaPago: it.fechaPagoISO || undefined,
          pagos: it.pagos.filter((p) => p.monto > 0).map((p) => ({ monto: p.monto, fecha: p.fechaISO, formaPago: p.formaPago, emitido: p.emitido })),
        })),
    };
    setSaving(true);
    try {
      const res = editingId ? await updateSimulador(editingId, input) : await createSimulador(input);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar.");
        return;
      }
      toast.success("Simulación guardada.");
      setView("list");
      void refreshList();
    } finally {
      setSaving(false);
    }
  }

  async function borrar(id: string) {
    try {
      const res = await deleteSimulador(id);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo borrar.");
        return;
      }
      toast.success("Simulación borrada.");
      setConfirmDeleteId(null);
      if (editingId === id) setView("list");
      void refreshList();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo borrar.");
    }
  }

  function patchItem(key: number, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  const totalGeneral = items.reduce((s, it) => s + totalItem(it), 0);

  // Por forma de pago: si el ítem ya tiene pagos cargados, se desglosa por
  // el método de CADA pago (puede ser más de uno distinto); si todavía no
  // tiene ningún pago, cuenta el total completo bajo la forma de pago
  // PLANEADA del ítem (si la cargó) — así el resumen sirve tanto para lo ya
  // pagado como para lo que todavía está solo proyectado.
  const porFormaPagoMap = new Map<SimPaymentMode, number>();
  items.forEach((it) => {
    if (it.pagos.length > 0) {
      it.pagos.forEach((p) => {
        const metodo = p.formaPago ?? it.formaPago;
        if (!metodo || !(p.monto > 0)) return;
        porFormaPagoMap.set(metodo, (porFormaPagoMap.get(metodo) ?? 0) + p.monto);
      });
    } else if (it.formaPago) {
      porFormaPagoMap.set(it.formaPago, (porFormaPagoMap.get(it.formaPago) ?? 0) + totalItem(it));
    }
  });
  const porFormaPago = PAYMENT_MODE_OPTIONS.map((opt) => ({ label: opt.label, total: porFormaPagoMap.get(opt.value) ?? 0 })).filter((g) => g.total > 0);

  const echeqsSinEmitir = items.flatMap((it) => it.pagos).filter((p) => p.formaPago === "ECHEQ" && !p.emitido && p.monto > 0);

  const calendario = Object.entries(
    items
      .filter((it) => it.fechaPagoISO)
      .reduce<Record<string, number>>((acc, it) => {
        acc[it.fechaPagoISO] = (acc[it.fechaPagoISO] ?? 0) + totalItem(it);
        return acc;
      }, {})
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fechaISO, total]) => ({ fechaISO, total }));

  return (
    <>
      <Button type="button" variant="outline" onClick={abrirModal}>
        <Calculator className="mr-1.5 h-4 w-4" />
        Simulador de viajes
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setView("list");
        }}
        title={view === "list" ? "Simulador de viajes" : editingId ? "Editar simulación" : "Nueva simulación"}
        className="max-w-3xl"
      >
        {view === "list" ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Simulá los gastos con distintos proveedores antes de cerrar el viaje — no toca los viajes ya cargados.
              </p>
              <Button type="button" onClick={nuevaSimulacion}>
                <Plus className="mr-1.5 h-4 w-4" />
                Nueva simulación
              </Button>
            </div>

            {loadingList && <p className="text-sm text-muted-foreground">Cargando…</p>}
            {!loadingList && simuladores?.length === 0 && (
              <p className="text-sm text-muted-foreground">Todavía no hay simulaciones guardadas.</p>
            )}
            {!loadingList && simuladores && simuladores.length > 0 && (
              <div className="flex flex-col gap-2">
                {simuladores.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                    <div className="min-w-0 flex-1">
                      <button className="truncate text-sm font-medium hover:underline" onClick={() => void abrirSimulacion(s.id)}>
                        {s.nombre}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.createdAtISO).toLocaleDateString("es-AR")} · {s.itemsCount} ítem(s)
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">{formatCurrency(s.total)}</p>
                    <div className="flex shrink-0 gap-2">
                      <Link href={`/imprimir/simulador-viajes/${s.id}`} target="_blank">
                        <Button type="button" size="sm" variant="outline" title="Vista de impresión">
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button type="button" size="sm" variant="edit" onClick={() => void abrirSimulacion(s.id)}>
                        Abrir
                      </Button>
                      <Button type="button" size="sm" variant="delete" onClick={() => setConfirmDeleteId(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre de la simulación</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Córdoba - cotizando vuelos" />
            </div>

            <div className="flex flex-col gap-3">
              {items.map((it) => (
                <div key={it._key} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                      <Input placeholder="Proveedor" value={it.proveedor} onChange={(e) => patchItem(it._key, { proveedor: e.target.value })} />
                      <Select value={it.formaPago ?? ""} onChange={(e) => patchItem(it._key, { formaPago: (e.target.value || undefined) as SimPaymentMode | undefined })} title="Forma de pago prevista, mientras no se cargue ningún pago real">
                        <option value="">Forma de pago prevista...</option>
                        {PAYMENT_MODE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Button type="button" size="sm" variant="delete" onClick={() => setItems((rows) => rows.filter((r) => r._key !== it._key))}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Fecha de compra</Label>
                      <Input type="date" value={it.fechaCompraISO} onChange={(e) => patchItem(it._key, { fechaCompraISO: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Fecha de factura</Label>
                      <Input type="date" value={it.fechaFacturaISO} onChange={(e) => patchItem(it._key, { fechaFacturaISO: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Monto neto</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.neto || ""}
                        onChange={(e) => {
                          const newNeto = Number(e.target.value);
                          patchItem(it._key, { neto: newNeto, iva: nextIva(it.neto, it.iva, newNeto) });
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">IVA (21%)</Label>
                      <Input type="number" step="0.01" min="0" value={it.iva || ""} onChange={(e) => patchItem(it._key, { iva: Number(e.target.value) })} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 sm:max-w-xs">
                    <Label className="text-xs">Fecha de pago</Label>
                    <Input type="date" value={it.fechaPagoISO} onChange={(e) => patchItem(it._key, { fechaPagoISO: e.target.value })} />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total del ítem</span>
                    <span className="font-medium">{formatCurrency(totalItem(it))}</span>
                  </div>

                  {/* Pagos parciales — mismo mecanismo que empleados.pagos en Viatico */}
                  <div className="flex flex-col gap-2 rounded-md bg-background p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Pagos registrados</span>
                      <Button type="button" size="sm" variant="outline" onClick={() => patchItem(it._key, { pagos: [...it.pagos, emptyPagoRow(it.formaPago)] })}>
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Agregar pago
                      </Button>
                    </div>
                    {it.pagos.length === 0 && <p className="text-xs text-muted-foreground">Sin pagos registrados.</p>}
                    {it.pagos.map((pago) => {
                      function patchPago(patch: Partial<PagoRow>) {
                        patchItem(it._key, { pagos: it.pagos.map((p) => (p._key === pago._key ? { ...p, ...patch } : p)) });
                      }
                      return (
                        <div key={pago._key} className="flex flex-col gap-2 rounded-md bg-muted/20 p-2">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                            <Input type="number" step="0.01" min="0" placeholder="Monto pagado" value={pago.monto || ""} onChange={(e) => patchPago({ monto: Number(e.target.value) })} />
                            <Input type="date" value={pago.fechaISO} onChange={(e) => patchPago({ fechaISO: e.target.value })} />
                            <Select
                              value={pago.formaPago ?? ""}
                              onChange={(e) => patchPago({ formaPago: (e.target.value || undefined) as SimPaymentMode | undefined, emitido: e.target.value === "ECHEQ" ? pago.emitido ?? false : undefined })}
                            >
                              <option value="">Forma de pago...</option>
                              {PAYMENT_MODE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </Select>
                            <Button type="button" size="sm" variant="delete" onClick={() => patchItem(it._key, { pagos: it.pagos.filter((p) => p._key !== pago._key) })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {pago.formaPago === "ECHEQ" && (
                            <button
                              type="button"
                              onClick={() => patchPago({ emitido: !pago.emitido })}
                              className={`flex items-center gap-1.5 self-start rounded-full border px-3 py-1 text-xs ${pago.emitido ? "border-success text-success" : "border-warning text-warning"}`}
                            >
                              <FileWarning className="h-3.5 w-3.5" /> {pago.emitido ? "E-cheq emitido" : "E-cheq sin emitir todavía"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <p className="text-xs">
                      {totalItem(it) > 0 && saldoItem(it) <= 0 ? (
                        <Badge variant="success">Pagado</Badge>
                      ) : pagadoItem(it) > 0 ? (
                        <>
                          <Badge variant="warning">Parcial</Badge>{" "}
                          <span className="text-muted-foreground">Saldo pendiente: </span>
                          <span className="font-medium">{formatCurrency(saldoItem(it))}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Pendiente de pago.</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={() => setItems((rows) => [...rows, emptyItemRow()])}>
                <Plus className="mr-1.5 h-4 w-4" />
                Agregar proveedor
              </Button>
            </div>

            {/* Resumen: total general, por forma de pago, calendario de pagos */}
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Total general</span>
                <span>{formatCurrency(totalGeneral)}</span>
              </div>

              {echeqsSinEmitir.length > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-warning">
                  <FileWarning className="h-3.5 w-3.5" />
                  {echeqsSinEmitir.length} e-cheq(s) sin emitir todavía — {formatCurrency(echeqsSinEmitir.reduce((s, p) => s + p.monto, 0))}
                </p>
              )}

              {porFormaPago.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" /> Por forma de pago
                  </p>
                  {porFormaPago.map((g) => (
                    <div key={g.label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{g.label}</span>
                      <span>{formatCurrency(g.total)}</span>
                    </div>
                  ))}
                </div>
              )}

              {calendario.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" /> Calendario de pagos
                  </p>
                  {calendario.map((c) => (
                    <div key={c.fechaISO} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{formatDate(c.fechaISO)}</span>
                      <span>{formatCurrency(c.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Notas</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones de la simulación..." />
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
              {editingId ? (
                <Button type="button" variant="delete" onClick={() => setConfirmDeleteId(editingId)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Borrar
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                {editingId ? (
                  <Link href={`/imprimir/simulador-viajes/${editingId}`} target="_blank">
                    <Button type="button" variant="outline" title="Vista de impresión, con neto e IVA discriminados">
                      <Printer className="mr-1.5 h-3.5 w-3.5" />
                      Imprimir
                    </Button>
                  </Link>
                ) : (
                  <Button type="button" variant="outline" disabled title="Guardá la simulación primero para poder imprimirla">
                    <Printer className="mr-1.5 h-3.5 w-3.5" />
                    Imprimir
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => setView("list")}>
                  Volver
                </Button>
                <Button type="button" disabled={saving} onClick={() => void guardar()}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={confirmDeleteId !== null} onOpenChange={(o) => !o && setConfirmDeleteId(null)} title="Confirmar borrado">
        <div className="flex flex-col gap-4">
          <p className="text-sm">¿Borrar esta simulación? No se puede deshacer.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="delete" onClick={() => confirmDeleteId && void borrar(confirmDeleteId)}>
              Sí, borrar
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
