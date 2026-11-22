"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import {
  reciboEstadoLabel,
  reciboEstadoBadgeVariant,
  FORMAS_PAGO,
  formaPagoLabel,
  type ReciboEstado,
  type FormaPago,
} from "@/lib/recibo-estados";
import { createRecibo, registrarPago, updateRecibo, deleteRecibo } from "./actions";

export type LineaReciboForm = {
  descripcion: string;
  montoUsd: number;
};

export type PagoRecibo = {
  id: string;
  fechaISO: string;
  montoUsd: number;
  tipoCambio: number;
  montoPesos: number;
  formaPago: FormaPago;
  notas?: string;
};

export type ReciboItem = {
  id: string;
  numero: string;
  fechaISO: string;
  clientId?: string;
  razonSocial: string;
  numeroPresupuesto?: string;
  numeroOrden?: string;
  concepto: string;
  lineas: LineaReciboForm[];
  totalUsd: number;
  totalPagadoUsd: number;
  saldoUsd: number;
  estado: ReciboEstado;
  notas?: string;
  pagos: PagoRecibo[];
};

export type ClienteOption = {
  id: string;
  nombre: string;
  razonSocial?: string;
};

export type PresupuestoOption = {
  id: string;
  numero: string;
  clientId?: string;
  razonSocial: string;
  total: number;
};

const money = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2 });

function LineasEditor({
  lineas,
  onChange,
}: {
  lineas: LineaReciboForm[];
  onChange: (lineas: LineaReciboForm[]) => void;
}) {
  function actualizar(i: number, campo: keyof LineaReciboForm, valor: string | number) {
    onChange(lineas.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  }
  function agregar() {
    onChange([...lineas, { descripcion: "", montoUsd: 0 }]);
  }
  function quitar(i: number) {
    onChange(lineas.filter((_, idx) => idx !== i));
  }
  const total = lineas.reduce((acc, l) => acc + (Number(l.montoUsd) || 0), 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>Detalle</Label>
        <Button type="button" size="sm" variant="ghost" onClick={agregar} className="h-7 gap-1 px-2 text-primary">
          <Plus className="h-3.5 w-3.5" />
          Agregar línea
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {lineas.map((l, i) => (
          <div key={i} className="grid grid-cols-12 items-center gap-2">
            <Input
              className="col-span-8"
              placeholder="Descripción"
              value={l.descripcion}
              onChange={(e) => actualizar(i, "descripcion", e.target.value)}
            />
            <Input
              className="col-span-3"
              type="number"
              min={0}
              step={0.01}
              placeholder="U$S"
              value={l.montoUsd}
              onChange={(e) => actualizar(i, "montoUsd", Number(e.target.value))}
            />
            <div className="col-span-1 flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="delete"
                disabled={lineas.length === 1}
                onClick={() => quitar(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end border-t border-border pt-2 text-sm font-semibold">
        Total: U$S {money(total)}
      </div>
    </div>
  );
}

// ---------- formulario de creación ----------

function ReciboForm({
  clientes,
  presupuestos,
  onDone,
}: {
  clientes: ClienteOption[];
  presupuestos: PresupuestoOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [presupuestoId, setPresupuestoId] = useState("");
  const [numeroPresupuesto, setNumeroPresupuesto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [lineas, setLineas] = useState<LineaReciboForm[]>([{ descripcion: "", montoUsd: 0 }]);

  // Mismo respaldo que Despachos/Remitos: los presupuestos migrados desde
  // Gestión de Luminarias no tienen clientId, se relacionan por razón
  // social cuando no lo tienen.
  const presupuestosFiltrados = clientId
    ? presupuestos.filter(
        (p) =>
          p.clientId === clientId ||
          (!p.clientId &&
            razonSocial.trim().length > 0 &&
            p.razonSocial.trim().toLowerCase() === razonSocial.trim().toLowerCase())
      )
    : presupuestos;

  function seleccionarCliente(id: string) {
    setClientId(id);
    const c = clientes.find((cl) => cl.id === id);
    setRazonSocial(c ? c.razonSocial || c.nombre : "");
    setPresupuestoId("");
    setNumeroPresupuesto("");
    setConcepto("");
    setLineas([{ descripcion: "", montoUsd: 0 }]);
  }

  function seleccionarPresupuesto(id: string) {
    setPresupuestoId(id);
    const p = presupuestos.find((pr) => pr.id === id);
    setNumeroPresupuesto(p?.numero ?? "");
    if (p) {
      setConcepto(`Según presupuesto ${p.numero}`);
      setLineas([{ descripcion: `Presupuesto ${p.numero}`, montoUsd: p.total }]);
    } else {
      setConcepto("");
      setLineas([{ descripcion: "", montoUsd: 0 }]);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientId) {
      toast.error("Seleccioná un cliente.");
      return;
    }
    if (!concepto.trim()) {
      toast.error("El concepto es obligatorio.");
      return;
    }
    const total = lineas.reduce((acc, l) => acc + (Number(l.montoUsd) || 0), 0);
    if (total <= 0) {
      toast.error("El total debe ser mayor a 0.");
      return;
    }
    if (lineas.some((l) => !l.descripcion.trim())) {
      toast.error("Completá la descripción en todas las líneas.");
      return;
    }

    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set("lineasJson", JSON.stringify(lineas));
    const result = await createRecibo(formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Recibo creado.");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fecha">Fecha</Label>
        <Input id="fecha" name="fecha" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clientSelect">Cliente</Label>
        <Select id="clientSelect" value={clientId} onChange={(e) => seleccionarCliente(e.target.value)}>
          <option value="">Seleccionar cliente...</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="razonSocial" value={razonSocial} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="presupuestoSelect">Presupuesto (opcional)</Label>
          <Select id="presupuestoSelect" value={presupuestoId} onChange={(e) => seleccionarPresupuesto(e.target.value)}>
            <option value="">Sin presupuesto</option>
            {presupuestosFiltrados.map((p) => (
              <option key={p.id} value={p.id}>
                {p.numero} — U$S {money(p.total)}
              </option>
            ))}
          </Select>
          <input type="hidden" name="presupuestoId" value={presupuestoId} />
          <input type="hidden" name="numeroPresupuesto" value={numeroPresupuesto} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="numeroOrden">Número de OT (opcional, todavía no hay módulo de Órdenes de Trabajo)</Label>
          <Input id="numeroOrden" name="numeroOrden" placeholder="Ej: OT-2026-003" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="concepto">Concepto</Label>
        <Input
          id="concepto"
          name="concepto"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="Ej: Luminarias SYP323 según presupuesto 0001-00010001"
        />
      </div>

      <LineasEditor lineas={lineas} onChange={setLineas} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notas">Observaciones</Label>
        <Textarea id="notas" name="notas" rows={2} placeholder="Observaciones internas o para el cliente" />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Crear recibo"}
        </Button>
      </div>
    </form>
  );
}

// ---------- componente principal ----------

export function RecibosClient({
  items,
  clientes,
  presupuestos,
}: {
  items: ReciboItem[];
  clientes: ClienteOption[];
  presupuestos: PresupuestoOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<ReciboItem | null>(null);
  const [editTarget, setEditTarget] = useState<ReciboItem | null>(null);
  const [pagoTarget, setPagoTarget] = useState<ReciboItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReciboItem | null>(null);
  const [processing, setProcessing] = useState(false);

  const [editConcepto, setEditConcepto] = useState("");
  const [editLineas, setEditLineas] = useState<LineaReciboForm[]>([]);

  const [pagoMontoUsd, setPagoMontoUsd] = useState(0);
  const [pagoTipoCambio, setPagoTipoCambio] = useState(0);
  const [pagoFormaPago, setPagoFormaPago] = useState<FormaPago>("TRANSFERENCIA");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.numero, item.razonSocial, reciboEstadoLabel(item.estado)].some((f) =>
        f?.toLowerCase().includes(q)
      )
    );
  }, [items, search]);

  function abrirEditar(item: ReciboItem) {
    setViewTarget(null);
    setEditConcepto(item.concepto);
    setEditLineas(item.lineas.length ? item.lineas : [{ descripcion: "", montoUsd: 0 }]);
    setEditTarget(item);
  }

  function abrirPago(item: ReciboItem) {
    setViewTarget(null);
    setPagoMontoUsd(0);
    setPagoTipoCambio(0);
    setPagoFormaPago("TRANSFERENCIA");
    setPagoTarget(item);
  }

  async function handleGuardarEdicion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTarget) return;
    if (!editConcepto.trim()) {
      toast.error("El concepto es obligatorio.");
      return;
    }
    if (editLineas.some((l) => !l.descripcion.trim())) {
      toast.error("Completá la descripción en todas las líneas.");
      return;
    }
    setProcessing(true);
    const formData = new FormData();
    formData.set("concepto", editConcepto);
    formData.set("lineasJson", JSON.stringify(editLineas));
    const result = await updateRecibo(editTarget.id, formData);
    setProcessing(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Recibo actualizado.");
    setEditTarget(null);
    router.refresh();
  }

  async function handleRegistrarPago(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pagoTarget) return;
    if (!pagoMontoUsd || pagoMontoUsd <= 0) {
      toast.error("El monto debe ser mayor a 0.");
      return;
    }
    if (!pagoTipoCambio || pagoTipoCambio <= 0) {
      toast.error("El tipo de cambio es obligatorio.");
      return;
    }
    setProcessing(true);
    const formData = new FormData(e.currentTarget);
    const result = await registrarPago(pagoTarget.id, formData);
    setProcessing(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Pago registrado.");
    setPagoTarget(null);
    router.refresh();
  }

  async function performDelete(item: ReciboItem) {
    setProcessing(true);
    const result = await deleteRecibo(item.id);
    setProcessing(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Recibo borrado.");
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, cliente o estado..."
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCreatingOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo recibo
        </Button>
      </div>

      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Número</TableHead>
            <TableHead className="whitespace-nowrap">Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Referencia</TableHead>
            <TableHead className="whitespace-nowrap text-right">Total U$S</TableHead>
            <TableHead className="whitespace-nowrap text-right">Pagado U$S</TableHead>
            <TableHead className="whitespace-nowrap text-right">Saldo U$S</TableHead>
            <TableHead className="whitespace-nowrap">Estado</TableHead>
            <TableHead className="whitespace-nowrap text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                {items.length === 0
                  ? "Todavía no hay recibos cargados."
                  : "No se encontró ningún recibo con esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="whitespace-nowrap font-medium">{item.numero}</TableCell>
              <TableCell className="whitespace-nowrap">
                {new Date(item.fechaISO).toLocaleDateString("es-AR")}
              </TableCell>
              <TableCell className="max-w-[180px] truncate">{item.razonSocial}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {item.numeroPresupuesto && <div>Pres: {item.numeroPresupuesto}</div>}
                {item.numeroOrden && <div>OT: {item.numeroOrden}</div>}
                {!item.numeroPresupuesto && !item.numeroOrden && "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">{money(item.totalUsd)}</TableCell>
              <TableCell className="whitespace-nowrap text-right text-success">
                {money(item.totalPagadoUsd)}
              </TableCell>
              <TableCell
                className={`whitespace-nowrap text-right font-medium ${
                  item.saldoUsd > 0 ? "text-destructive" : "text-success"
                }`}
              >
                {money(item.saldoUsd)}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant={reciboEstadoBadgeVariant(item.estado)}>{reciboEstadoLabel(item.estado)}</Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:bg-muted"
                    title="Ver"
                    onClick={() => setViewTarget(item)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="delete"
                    disabled={item.pagos.length > 0}
                    title={
                      item.pagos.length === 0
                        ? "Borrar"
                        : "No se puede borrar: tiene pagos registrados — queda como historial."
                    }
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Ver recibo */}
      <Dialog
        open={viewTarget !== null}
        onOpenChange={(open) => {
          if (!open) setViewTarget(null);
        }}
        title={viewTarget ? `Recibo ${viewTarget.numero}` : ""}
        className="max-w-xl"
      >
        {viewTarget && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{viewTarget.razonSocial}</p>
                <p className="text-muted-foreground">
                  {new Date(viewTarget.fechaISO).toLocaleDateString("es-AR")}
                </p>
                {(viewTarget.numeroPresupuesto || viewTarget.numeroOrden) && (
                  <p className="text-xs text-muted-foreground">
                    {viewTarget.numeroPresupuesto && <>Presupuesto {viewTarget.numeroPresupuesto} </>}
                    {viewTarget.numeroOrden && <>— OT {viewTarget.numeroOrden}</>}
                  </p>
                )}
              </div>
              <Badge variant={reciboEstadoBadgeVariant(viewTarget.estado)}>
                {reciboEstadoLabel(viewTarget.estado)}
              </Badge>
            </div>

            <p className="font-medium">{viewTarget.concepto}</p>

            <Table compact>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Monto U$S</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewTarget.lineas.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>{l.descripcion}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{money(l.montoUsd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end">
              <div className="w-56 text-right">
                <div className="flex justify-between border-b border-border py-1">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-semibold">U$S {money(viewTarget.totalUsd)}</span>
                </div>
                <div className="flex justify-between border-b border-border py-1">
                  <span className="text-muted-foreground">Pagado:</span>
                  <span className="font-semibold text-success">U$S {money(viewTarget.totalPagadoUsd)}</span>
                </div>
                <div className="flex justify-between py-1 text-base font-semibold">
                  <span>Saldo:</span>
                  <span className={viewTarget.saldoUsd > 0 ? "text-destructive" : "text-success"}>
                    U$S {money(viewTarget.saldoUsd)}
                  </span>
                </div>
              </div>
            </div>

            {viewTarget.pagos.length > 0 && (
              <div className="flex flex-col gap-1">
                <Label>Historial de pagos</Label>
                <Table compact>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Fecha</TableHead>
                      <TableHead className="whitespace-nowrap text-right">U$S</TableHead>
                      <TableHead className="whitespace-nowrap text-right">T.Cambio</TableHead>
                      <TableHead className="whitespace-nowrap text-right">$</TableHead>
                      <TableHead className="whitespace-nowrap">Forma</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewTarget.pagos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(p.fechaISO).toLocaleDateString("es-AR")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">{money(p.montoUsd)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">{money(p.tipoCambio)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">{money(p.montoPesos)}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{formaPagoLabel(p.formaPago)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {viewTarget.notas && <p className="text-muted-foreground">{viewTarget.notas}</p>}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setViewTarget(null)}>
                Cerrar
              </Button>
              <Link href={`/imprimir/recibos/${viewTarget.id}`} target="_blank">
                <Button type="button" variant="outline">
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
              </Link>
              <Button variant="edit" onClick={() => abrirEditar(viewTarget)}>
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
              {viewTarget.estado !== "PAGADO" && (
                <Button onClick={() => abrirPago(viewTarget)}>
                  <Plus className="h-4 w-4" />
                  Registrar pago
                </Button>
              )}
            </div>
          </div>
        )}
      </Dialog>

      {/* Nuevo recibo */}
      <Dialog open={creatingOpen} onOpenChange={setCreatingOpen} title="Nuevo recibo" className="max-w-2xl">
        <ReciboForm clientes={clientes} presupuestos={presupuestos} onDone={() => setCreatingOpen(false)} />
      </Dialog>

      {/* Editar recibo */}
      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title={editTarget ? `Editar recibo ${editTarget.numero}` : ""}
        className="max-w-xl"
      >
        {editTarget && (
          <form onSubmit={handleGuardarEdicion} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editConcepto">Concepto</Label>
              <Input id="editConcepto" value={editConcepto} onChange={(e) => setEditConcepto(e.target.value)} />
            </div>
            <LineasEditor lineas={editLineas} onChange={setEditLineas} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={processing}>
                {processing ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Registrar pago */}
      <Dialog
        open={pagoTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPagoTarget(null);
        }}
        title="Registrar pago"
        className="max-w-md"
      >
        {pagoTarget && (
          <form onSubmit={handleRegistrarPago} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Saldo pendiente: <span className="font-semibold text-foreground">U$S {money(pagoTarget.saldoUsd)}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="montoUsd">Monto U$S</Label>
                <Input
                  id="montoUsd"
                  name="montoUsd"
                  type="number"
                  min={0}
                  step={0.01}
                  value={pagoMontoUsd}
                  onChange={(e) => setPagoMontoUsd(Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tipoCambio">Tipo de cambio</Label>
                <Input
                  id="tipoCambio"
                  name="tipoCambio"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Ej: 1250"
                  value={pagoTipoCambio}
                  onChange={(e) => setPagoTipoCambio(Number(e.target.value))}
                />
              </div>
            </div>

            {pagoMontoUsd > 0 && pagoTipoCambio > 0 && (
              <p className="rounded-md bg-success/10 px-3 py-2 text-sm font-medium text-success">
                = $ {money(pagoMontoUsd * pagoTipoCambio)} pesos
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="formaPago">Forma de pago</Label>
              <Select
                id="formaPago"
                name="formaPago"
                value={pagoFormaPago}
                onChange={(e) => setPagoFormaPago(e.target.value as FormaPago)}
              >
                {FORMAS_PAGO.map((f) => (
                  <option key={f} value={f}>
                    {formaPagoLabel(f)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pagoNotas">Notas</Label>
              <Input id="pagoNotas" name="notas" placeholder="Observaciones del pago" />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPagoTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={processing}>
                {processing ? "Guardando..." : "Confirmar pago"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Borrar recibo */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Borrar recibo"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar el recibo{" "}
              <span className="font-medium text-foreground">{deleteTarget.numero}</span> de{" "}
              {deleteTarget.razonSocial}? No se puede deshacer. (Un recibo con pagos registrados no se puede
              borrar — queda como historial.)
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" disabled={processing} onClick={() => performDelete(deleteTarget)}>
                {processing ? "Borrando..." : "Sí, borrar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}