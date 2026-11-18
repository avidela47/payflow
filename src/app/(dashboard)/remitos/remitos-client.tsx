"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Plus, Search, Trash2 } from "lucide-react";
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
  REMITO_ESTADOS,
  remitoEstadoLabel,
  remitoEstadoBadgeVariant,
  type RemitoEstado,
} from "@/lib/remito-estados";
import { createRemito, updateRemitoEstado, deleteRemito } from "./actions";

export type LineaRemitoItem = {
  codigo?: string;
  descripcion: string;
  cantidad: number;
  unidad?: string;
};

export type RemitoItem = {
  id: string;
  numero: string;
  fechaISO: string;
  clientId?: string;
  razonSocial: string;
  numeroPresupuesto?: string;
  numeroOrden?: string;
  lineas: LineaRemitoItem[];
  notas?: string;
  estado: RemitoEstado;
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
  lineas: { codigo: string; descripcion: string; cantidad: number }[];
};

const LINEA_VACIA: LineaRemitoItem = { codigo: "", descripcion: "", cantidad: 1, unidad: "unidad" };

// ---------- formulario de creación (contenido del Dialog) ----------
//
// Un remito no se edita después de creado — igual que el original, que
// tampoco tiene pantalla de edición, solo cambia de estado (desplegable
// en la fila) o se borra.

function RemitoForm({
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
  const [numeroOrden, setNumeroOrden] = useState("");
  const [lineas, setLineas] = useState<LineaRemitoItem[]>([]);

  const presupuestosFiltrados = clientId
    ? presupuestos.filter((p) => p.clientId === clientId)
    : presupuestos;

  function seleccionarCliente(id: string) {
    setClientId(id);
    const c = clientes.find((cl) => cl.id === id);
    setRazonSocial(c ? c.razonSocial || c.nombre : "");
    setPresupuestoId("");
    setNumeroPresupuesto("");
    setLineas([]);
  }

  function seleccionarPresupuesto(id: string) {
    setPresupuestoId(id);
    const p = presupuestos.find((pr) => pr.id === id);
    setNumeroPresupuesto(p?.numero ?? "");
    if (p) {
      setLineas(
        p.lineas.map((l) => ({ codigo: l.codigo, descripcion: l.descripcion, cantidad: l.cantidad, unidad: "unidad" }))
      );
    }
  }

  function actualizarLinea(index: number, campo: keyof LineaRemitoItem, valor: string | number) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, [campo]: valor } : l)));
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, { ...LINEA_VACIA }]);
  }

  function quitarLinea(index: number) {
    setLineas((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientId) {
      toast.error("Seleccioná un cliente.");
      return;
    }
    if (lineas.length === 0) {
      toast.error("Agregá al menos un ítem.");
      return;
    }
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set("lineasJson", JSON.stringify(lineas));
    const result = await createRemito(formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Remito creado.");
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="presupuestoSelect">Presupuesto (opcional)</Label>
          <Select
            id="presupuestoSelect"
            value={presupuestoId}
            onChange={(e) => seleccionarPresupuesto(e.target.value)}
          >
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
          <Label htmlFor="numeroOrden">
            Número de OT (opcional, todavía no hay módulo de Órdenes de Trabajo)
          </Label>
          <Input
            id="numeroOrden"
            name="numeroOrden"
            value={numeroOrden}
            onChange={(e) => setNumeroOrden(e.target.value)}
            placeholder="Ej: OT-0042"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Detalle de mercadería</Label>
          <Button type="button" size="sm" variant="outline" onClick={agregarLinea}>
            <Plus className="h-3.5 w-3.5" />
            Agregar ítem
          </Button>
        </div>
        {lineas.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Seleccioná un presupuesto o agregá ítems manualmente.
          </p>
        ) : (
          <div className="flex flex-col gap-2 rounded-md border border-border p-2">
            {lineas.map((linea, index) => (
              <div
                key={index}
                className="grid grid-cols-2 gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0 sm:grid-cols-12"
              >
                <Input
                  className="sm:col-span-2"
                  placeholder="Código"
                  value={linea.codigo}
                  onChange={(e) => actualizarLinea(index, "codigo", e.target.value)}
                />
                <Input
                  className="sm:col-span-6"
                  placeholder="Descripción"
                  value={linea.descripcion}
                  onChange={(e) => actualizarLinea(index, "descripcion", e.target.value)}
                />
                <Input
                  className="sm:col-span-1"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Cant."
                  value={linea.cantidad}
                  onChange={(e) => actualizarLinea(index, "cantidad", Number(e.target.value))}
                />
                <Input
                  className="sm:col-span-2"
                  placeholder="Unidad"
                  value={linea.unidad}
                  onChange={(e) => actualizarLinea(index, "unidad", e.target.value)}
                />
                <div className="flex items-center justify-end sm:col-span-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => quitarLinea(index)}
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
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" name="notas" rows={2} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Crear remito"}
        </Button>
      </div>
    </form>
  );
}

// ---------- componente principal ----------

export function RemitosClient({
  items,
  clientes,
  presupuestos,
}: {
  items: RemitoItem[];
  clientes: ClienteOption[];
  presupuestos: PresupuestoOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<RemitoItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RemitoItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.numero, item.razonSocial, remitoEstadoLabel(item.estado)].some((f) =>
        f?.toLowerCase().includes(q)
      )
    );
  }, [items, search]);

  async function cambiarEstado(item: RemitoItem, estado: RemitoEstado) {
    setCambiandoEstadoId(item.id);
    const result = await updateRemitoEstado(item.id, estado);
    setCambiandoEstadoId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Estado actualizado.");
    router.refresh();
  }

  async function performDelete(item: RemitoItem) {
    setDeletingId(item.id);
    const result = await deleteRemito(item.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Remito borrado.");
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
          Nuevo remito
        </Button>
      </div>

      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Número</TableHead>
            <TableHead className="whitespace-nowrap">Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Referencia</TableHead>
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
                  ? "Todavía no hay remitos cargados."
                  : "No se encontró ningún remito con esa búsqueda."}
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
              <TableCell className="max-w-[160px] text-xs text-muted-foreground">
                {item.numeroPresupuesto && <p>Pres: {item.numeroPresupuesto}</p>}
                {item.numeroOrden && <p>OT: {item.numeroOrden}</p>}
                {!item.numeroPresupuesto && !item.numeroOrden && "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {item.lineas.length} item{item.lineas.length === 1 ? "" : "s"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Select
                  className="h-8 py-0 text-xs"
                  value={item.estado}
                  disabled={cambiandoEstadoId === item.id}
                  onChange={(e) => cambiarEstado(item, e.target.value as RemitoEstado)}
                >
                  {REMITO_ESTADOS.map((estado) => (
                    <option key={estado} value={estado}>
                      {remitoEstadoLabel(estado)}
                    </option>
                  ))}
                </Select>
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
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    title="Borrar"
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
        title={viewTarget ? `Remito ${viewTarget.numero}` : ""}
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
              </div>
              <Badge variant={remitoEstadoBadgeVariant(viewTarget.estado)}>
                {remitoEstadoLabel(viewTarget.estado)}
              </Badge>
            </div>

            {(viewTarget.numeroPresupuesto || viewTarget.numeroOrden) && (
              <p className="text-xs text-muted-foreground">
                {viewTarget.numeroPresupuesto && <>Presupuesto {viewTarget.numeroPresupuesto} </>}
                {viewTarget.numeroOrden && <>— OT {viewTarget.numeroOrden}</>}
              </p>
            )}

            <Table compact>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Cant.</TableHead>
                  <TableHead className="whitespace-nowrap">Unidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewTarget.lineas.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">{l.codigo || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{l.descripcion}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{l.cantidad}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.unidad || "unidad"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {viewTarget.notas && <p className="text-muted-foreground">{viewTarget.notas}</p>}

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setViewTarget(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={creatingOpen} onOpenChange={setCreatingOpen} title="Nuevo remito" className="max-w-2xl">
        <RemitoForm clientes={clientes} presupuestos={presupuestos} onDone={() => setCreatingOpen(false)} />
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Borrar remito"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar el remito{" "}
              <span className="font-medium text-foreground">{deleteTarget.numero}</span> de{" "}
              {deleteTarget.razonSocial}? No se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deletingId === deleteTarget.id}
                onClick={() => performDelete(deleteTarget)}
              >
                {deletingId === deleteTarget.id ? "Borrando..." : "Sí, borrar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}