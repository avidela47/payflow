"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Plus, Printer, Search, Trash2 } from "lucide-react";
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
  despachoEstadoLabel,
  despachoEstadoBadgeVariant,
  type DespachoEstado,
} from "@/lib/despacho-estados";
import { luminariaOrigenLabel, type LuminariaOrigen } from "@/lib/luminaria-origen";
import { createDespacho, confirmarDespacho, anularDespacho, deleteDespacho } from "./actions";

export type ItemDespachoForm = {
  codigo: string;
  descripcion: string;
  origen: LuminariaOrigen;
  cantidad: number;
  precioUnitario?: number;
  // Se fabrica/consigue en el momento — no está en el catálogo de
  // Luminaria. No participa del control de stock al confirmar/anular.
  fueraDeCatalogo?: boolean;
};

export type DespachoItem = {
  id: string;
  numero: string;
  fechaISO: string;
  clientId?: string;
  razonSocial: string;
  numeroPresupuesto?: string;
  numeroReparacion?: string;
  items: ItemDespachoForm[];
  observaciones?: string;
  estado: DespachoEstado;
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
  lineas: { codigo: string; descripcion: string; cantidad: number; precioUnitario?: number }[];
};

export type LuminariaOption = {
  codigo: string;
  descripcion: string;
  origen: LuminariaOrigen;
  stockActual: number;
  precio: number;
};

export type ReparacionOption = {
  id: string;
  numero: string;
  razonSocial: string;
  lineas: { codigoLuminaria?: string; descripcion: string; cantidad: number }[];
};

// ---------- formulario de creación (contenido del Dialog) ----------
//
// Crear el despacho NO descuenta stock todavía — queda "Pendiente" hasta
// que se confirma la entrega (ver actions.ts). Acá solo se arma el
// detalle de ítems.

function DespachoForm({
  clientes,
  presupuestos,
  luminarias,
  reparaciones,
  onDone,
}: {
  clientes: ClienteOption[];
  presupuestos: PresupuestoOption[];
  luminarias: LuminariaOption[];
  reparaciones: ReparacionOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [presupuestoId, setPresupuestoId] = useState("");
  const [numeroPresupuesto, setNumeroPresupuesto] = useState("");
  const [reparacionId, setReparacionId] = useState("");
  const [items, setItems] = useState<ItemDespachoForm[]>([]);
  const [busquedaCatalogo, setBusquedaCatalogo] = useState("");
  const [manualAbierto, setManualAbierto] = useState(false);
  const [manualCodigo, setManualCodigo] = useState("");
  const [manualDescripcion, setManualDescripcion] = useState("");
  const [manualOrigen, setManualOrigen] = useState<LuminariaOrigen>("FABRICADA");
  const [manualCantidad, setManualCantidad] = useState(1);

  // Los presupuestos migrados desde Gestión de Luminarias no tienen
  // clientId (los Clientes de esa app se descartaron, ver planificacion/
  // fusion-gestion-luminarias.md) — si solo filtrara por clientId exacto,
  // quedarían invisibles en este combo apenas se elige un cliente. Como
  // respaldo, si un presupuesto no tiene clientId, se lo relaciona por
  // razón social (coincide con el snapshot que guardó al migrarse).
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
    setItems([]);
  }

  function seleccionarPresupuesto(id: string) {
    setPresupuestoId(id);
    const p = presupuestos.find((pr) => pr.id === id);
    setNumeroPresupuesto(p?.numero ?? "");
    if (p) {
      setItems(
        p.lineas.map((l) => {
          const lum = luminarias.find((lm) => lm.codigo === l.codigo.toUpperCase());
          return {
            codigo: l.codigo.toUpperCase(),
            descripcion: l.descripcion,
            origen: lum?.origen ?? "NACIONAL",
            cantidad: l.cantidad,
            precioUnitario: l.precioUnitario ?? lum?.precio ?? 0,
          };
        })
      );
    }
  }

  // Reparación: a diferencia del presupuesto, NO reemplaza los ítems ya
  // armados — los AGREGA. Ariel confirmó que un mismo despacho puede
  // llevar unidades reparadas y unidades nuevas de una OT mezcladas (caso
  // real: mandan 5 a reparar, 3 vuelven reparadas y 2 se fabrican de
  // nuevo, todo sale junto). Las líneas de la Reparación entran como
  // fueraDeCatalogo=true: no son stock de Luminaria, nunca deben
  // descontar ni bloquear por falta de stock.
  function seleccionarReparacion(id: string) {
    setReparacionId(id);
    const r = reparaciones.find((rep) => rep.id === id);
    if (!r) return;
    setItems((prev) => [
      ...prev,
      ...r.lineas.map((l) => ({
        codigo: l.codigoLuminaria?.trim() ? l.codigoLuminaria.toUpperCase() : "REPARADA",
        descripcion: l.descripcion,
        origen: "FABRICADA" as LuminariaOrigen,
        cantidad: l.cantidad,
        fueraDeCatalogo: true,
      })),
    ]);
  }

  function actualizarItem(index: number, campo: "cantidad" | "origen", valor: string | number) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [campo]: valor } : it)));
  }

  function quitarItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function agregarDesdeCatalogo(lum: LuminariaOption) {
    setItems((prev) => [
      ...prev,
      {
        codigo: lum.codigo,
        descripcion: lum.descripcion,
        origen: lum.origen,
        cantidad: 1,
        precioUnitario: lum.precio,
      },
    ]);
    setBusquedaCatalogo("");
  }

  // Ítem que se fabrica/consigue en el momento (no está en el catálogo de
  // Luminaria) — Ariel, 2026-11-20: "a veces son productos que se hacen
  // en el momento". No participa del control de stock.
  function agregarFueraDeCatalogo() {
    if (!manualCodigo.trim() || !manualDescripcion.trim()) {
      toast.error("Completá código y descripción del ítem.");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        codigo: manualCodigo.trim().toUpperCase(),
        descripcion: manualDescripcion.trim(),
        origen: manualOrigen,
        cantidad: manualCantidad,
        fueraDeCatalogo: true,
      },
    ]);
    setManualCodigo("");
    setManualDescripcion("");
    setManualCantidad(1);
    setManualAbierto(false);
  }

  const catalogoFiltrado = useMemo(() => {
    const q = busquedaCatalogo.trim().toLowerCase();
    if (!q) return [];
    return luminarias
      .filter((l) => l.codigo.toLowerCase().includes(q) || l.descripcion.toLowerCase().includes(q))
      .slice(0, 8);
  }, [busquedaCatalogo, luminarias]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientId) {
      toast.error("Seleccioná un cliente.");
      return;
    }
    if (items.length === 0) {
      toast.error("Agregá al menos un ítem.");
      return;
    }
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set("itemsJson", JSON.stringify(items));
    const result = await createDespacho(formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Despacho creado como pendiente.");
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="presupuestoSelect">Presupuesto aprobado (opcional)</Label>
        <Select id="presupuestoSelect" value={presupuestoId} onChange={(e) => seleccionarPresupuesto(e.target.value)}>
          <option value="">Sin presupuesto</option>
          {presupuestosFiltrados.map((p) => (
            <option key={p.id} value={p.id}>
              {p.numero}
            </option>
          ))}
        </Select>
        <input type="hidden" name="presupuestoId" value={presupuestoId} />
        <input type="hidden" name="numeroPresupuesto" value={numeroPresupuesto} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reparacionSelect">Agregar unidades de una Reparación (opcional)</Label>
        <Select
          id="reparacionSelect"
          value={reparacionId}
          onChange={(e) => seleccionarReparacion(e.target.value)}
        >
          <option value="">Sin reparación</option>
          {reparaciones.map((r) => (
            <option key={r.id} value={r.id}>
              {r.numero} — {r.razonSocial}
            </option>
          ))}
        </Select>
        <input type="hidden" name="reparacionId" value={reparacionId} />
        <p className="text-xs text-muted-foreground">
          Agrega las líneas de la reparación elegida como ítems &quot;fuera de catálogo&quot; — no
          descuentan stock de Luminaria. Podés combinarlas con ítems de catálogo (unidades nuevas).
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Ítems a despachar</Label>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busquedaCatalogo}
            onChange={(e) => setBusquedaCatalogo(e.target.value)}
            placeholder="Buscar luminaria por código o descripción para agregar..."
            className="pl-9"
          />
          {catalogoFiltrado.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-background shadow-md">
              {catalogoFiltrado.map((lum) => (
                <button
                  type="button"
                  key={`${lum.codigo}-${lum.origen}`}
                  onClick={() => agregarDesdeCatalogo(lum)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span>
                    <span className="font-medium">{lum.codigo}</span>{" "}
                    <span className="text-muted-foreground">({luminariaOrigenLabel(lum.origen)})</span> —{" "}
                    {lum.descripcion}
                  </span>
                  <span className="whitespace-nowrap pl-2 text-xs text-muted-foreground">
                    Stock: {lum.stockActual}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => setManualAbierto((v) => !v)}
          >
            {manualAbierto ? "Cancelar ítem fuera de catálogo" : "+ Agregar ítem fuera de catálogo (hecho en el momento)"}
          </Button>
          {manualAbierto && (
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-12">
              <Input
                className="sm:col-span-3"
                placeholder="Código"
                value={manualCodigo}
                onChange={(e) => setManualCodigo(e.target.value)}
              />
              <Input
                className="sm:col-span-4"
                placeholder="Descripción"
                value={manualDescripcion}
                onChange={(e) => setManualDescripcion(e.target.value)}
              />
              <Select
                className="h-8 py-0 text-xs sm:col-span-3"
                value={manualOrigen}
                onChange={(e) => setManualOrigen(e.target.value as LuminariaOrigen)}
              >
                <option value="FABRICADA">Fabricada</option>
                <option value="NACIONAL">Nacional</option>
                <option value="IMPORTADA">Importada</option>
              </Select>
              <Input
                className="sm:col-span-1"
                type="number"
                min={1}
                step={1}
                value={manualCantidad}
                onChange={(e) => setManualCantidad(Number(e.target.value))}
              />
              <Button type="button" size="sm" className="sm:col-span-1" onClick={agregarFueraDeCatalogo}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Seleccioná un presupuesto aprobado o buscá luminarias arriba para agregarlas.
          </p>
        ) : (
          <div className="flex flex-col gap-2 rounded-md border border-border p-2">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-2 items-center gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0 sm:grid-cols-12"
              >
                <div className="sm:col-span-6">
                  <p className="text-sm font-medium">
                    {item.codigo}
                    {item.fueraDeCatalogo && (
                      <Badge variant="default" className="ml-2 align-middle text-[10px]">
                        Fuera de catálogo
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{item.descripcion}</p>
                </div>
                <Select
                  className="h-8 py-0 text-xs sm:col-span-3"
                  value={item.origen}
                  onChange={(e) => actualizarItem(index, "origen", e.target.value)}
                >
                  <option value="FABRICADA">Fabricada</option>
                  <option value="NACIONAL">Nacional</option>
                  <option value="IMPORTADA">Importada</option>
                </Select>
                <Input
                  className="sm:col-span-2"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Cant."
                  value={item.cantidad}
                  onChange={(e) => actualizarItem(index, "cantidad", Number(e.target.value))}
                />
                <div className="flex items-center justify-end sm:col-span-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="delete"
                    onClick={() => quitarItem(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="observaciones">Observaciones</Label>
        <Textarea id="observaciones" name="observaciones" rows={2} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Crear despacho"}
        </Button>
      </div>
    </form>
  );
}

// ---------- componente principal ----------

export function DespachosClient({
  items,
  clientes,
  presupuestos,
  luminarias,
  reparaciones,
}: {
  items: DespachoItem[];
  clientes: ClienteOption[];
  presupuestos: PresupuestoOption[];
  luminarias: LuminariaOption[];
  reparaciones: ReparacionOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<DespachoItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DespachoItem | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.numero, item.razonSocial, despachoEstadoLabel(item.estado)].some((f) =>
        f?.toLowerCase().includes(q)
      )
    );
  }, [items, search]);

  async function handleConfirmar(item: DespachoItem) {
    setProcessingId(item.id);
    const result = await confirmarDespacho(item.id);
    setProcessingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Despacho confirmado — stock descontado.");
    setViewTarget(null);
    router.refresh();
  }

  async function handleAnular(item: DespachoItem) {
    setProcessingId(item.id);
    const result = await anularDespacho(item.id);
    setProcessingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Despacho anulado — stock restaurado.");
    setViewTarget(null);
    router.refresh();
  }

  async function performDelete(item: DespachoItem) {
    setProcessingId(item.id);
    const result = await deleteDespacho(item.id);
    setProcessingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Despacho borrado.");
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
          Nuevo despacho
        </Button>
      </div>

      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Número</TableHead>
            <TableHead className="whitespace-nowrap">Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Presupuesto</TableHead>
            <TableHead className="whitespace-nowrap">Items</TableHead>
            <TableHead className="whitespace-nowrap">Estado</TableHead>
            <TableHead className="whitespace-nowrap text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {items.length === 0
                  ? "Todavía no hay despachos cargados."
                  : "No se encontró ningún despacho con esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="whitespace-nowrap font-medium">{item.numero}</TableCell>
              <TableCell className="whitespace-nowrap">
                {new Date(item.fechaISO).toLocaleDateString("es-AR")}
              </TableCell>
              <TableCell className="max-w-[200px] truncate">{item.razonSocial}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {item.numeroPresupuesto && <div>Pres: {item.numeroPresupuesto}</div>}
                {item.numeroReparacion && <div>Rep: {item.numeroReparacion}</div>}
                {!item.numeroPresupuesto && !item.numeroReparacion && "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {item.items.length} item{item.items.length === 1 ? "" : "s"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant={despachoEstadoBadgeVariant(item.estado)}>
                  {despachoEstadoLabel(item.estado)}
                </Badge>
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
                    disabled={item.estado !== "PENDIENTE"}
                    title={
                      item.estado === "PENDIENTE"
                        ? "Borrar"
                        : "No se puede borrar: un despacho confirmado se anula, no se borra."
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

      <Dialog
        open={viewTarget !== null}
        onOpenChange={(open) => {
          if (!open) setViewTarget(null);
        }}
        title={viewTarget ? `Despacho ${viewTarget.numero}` : ""}
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
                {(viewTarget.numeroPresupuesto || viewTarget.numeroReparacion) && (
                  <p className="text-xs text-muted-foreground">
                    {viewTarget.numeroPresupuesto && <>Presupuesto: {viewTarget.numeroPresupuesto} </>}
                    {viewTarget.numeroReparacion && <>— Reparación: {viewTarget.numeroReparacion}</>}
                  </p>
                )}
              </div>
              <Badge variant={despachoEstadoBadgeVariant(viewTarget.estado)}>
                {despachoEstadoLabel(viewTarget.estado)}
              </Badge>
            </div>

            <Table compact>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="whitespace-nowrap">Origen</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Cant.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewTarget.items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">{item.codigo}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{item.descripcion}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {item.fueraDeCatalogo ? (
                        <Badge variant="default" className="text-[10px]">
                          Fuera de catálogo
                        </Badge>
                      ) : (
                        luminariaOrigenLabel(item.origen)
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">{item.cantidad}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {viewTarget.observaciones && <p className="text-muted-foreground">{viewTarget.observaciones}</p>}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setViewTarget(null)}>
                Cerrar
              </Button>
              <Link href={`/imprimir/despachos/${viewTarget.id}`} target="_blank">
                <Button type="button" variant="outline">
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
              </Link>
              {viewTarget.estado === "PENDIENTE" && (
                <Button
                  disabled={processingId === viewTarget.id}
                  onClick={() => handleConfirmar(viewTarget)}
                >
                  {processingId === viewTarget.id ? "Procesando..." : "Confirmar despacho"}
                </Button>
              )}
              {viewTarget.estado === "DESPACHADO" && (
                <Button
                  variant="destructive"
                  disabled={processingId === viewTarget.id}
                  onClick={() => handleAnular(viewTarget)}
                >
                  {processingId === viewTarget.id ? "Procesando..." : "Anular despacho"}
                </Button>
              )}
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={creatingOpen} onOpenChange={setCreatingOpen} title="Nuevo despacho" className="max-w-2xl">
        <DespachoForm
          clientes={clientes}
          presupuestos={presupuestos}
          luminarias={luminarias}
          reparaciones={reparaciones}
          onDone={() => setCreatingOpen(false)}
        />
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Borrar despacho"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar el despacho{" "}
              <span className="font-medium text-foreground">{deleteTarget.numero}</span> de{" "}
              {deleteTarget.razonSocial}? No se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={processingId === deleteTarget.id}
                onClick={() => performDelete(deleteTarget)}
              >
                {processingId === deleteTarget.id ? "Borrando..." : "Sí, borrar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}