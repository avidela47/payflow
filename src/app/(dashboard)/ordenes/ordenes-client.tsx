"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
  ordenTrabajoEstadoLabel,
  ordenTrabajoEstadoBadgeVariant,
  type OrdenTrabajoEstado,
} from "@/lib/orden-trabajo-estados";
import { createOrdenTrabajo, deleteOrdenTrabajo } from "./actions";

export type OrdenItem = {
  id: string;
  numero: string;
  fechaISO: string;
  clienteId?: string;
  razonSocial: string;
  numeroPresupuesto?: string;
  lineas: { codigoLuminaria: string; descripcion: string; cantidad: number }[];
  estado: OrdenTrabajoEstado;
  ejecutada: boolean;
  proyectoFabricaId?: string;
  notas?: string;
};

export type ClienteOption = { id: string; nombre: string; razonSocial: string };

export type PresupuestoOption = {
  id: string;
  numero: string;
  clienteId?: string;
  razonSocial: string;
  lineas: { codigo: string; descripcion: string; cantidad: number }[];
};

type LineaForm = { codigoLuminaria: string; descripcion: string; cantidad: number };

function emptyLinea(): LineaForm {
  return { codigoLuminaria: "", descripcion: "", cantidad: 1 };
}

// ---------- formulario de creación (contenido del Dialog) ----------

function OrdenForm({
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
  const [lineas, setLineas] = useState<LineaForm[]>([emptyLinea()]);

  function seleccionarCliente(id: string) {
    setClientId(id);
    const c = clientes.find((cl) => cl.id === id);
    setRazonSocial(c ? c.razonSocial || c.nombre : "");
  }

  function seleccionarPresupuesto(id: string) {
    setPresupuestoId(id);
    const p = presupuestos.find((pr) => pr.id === id);
    setNumeroPresupuesto(p?.numero ?? "");
    if (p) {
      if (p.clienteId) setClientId(p.clienteId);
      setRazonSocial(p.razonSocial);
      setLineas(
        p.lineas.length > 0
          ? p.lineas.map((l) => ({
              codigoLuminaria: l.codigo.toUpperCase(),
              descripcion: l.descripcion,
              cantidad: l.cantidad,
            }))
          : [emptyLinea()]
      );
    }
  }

  function actualizarLinea(index: number, patch: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, emptyLinea()]);
  }

  function quitarLinea(index: number) {
    setLineas((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!razonSocial.trim()) {
      toast.error("Falta el cliente.");
      return;
    }
    const lineasValidas = lineas.filter((l) => l.codigoLuminaria.trim() && l.descripcion.trim());
    if (lineasValidas.length === 0) {
      toast.error("Agregá al menos una línea.");
      return;
    }

    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set("lineasJson", JSON.stringify(lineasValidas));
    const result = await createOrdenTrabajo(formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Orden de trabajo creada.");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="presupuestoSelect">Presupuesto aprobado (opcional)</Label>
        <Select
          id="presupuestoSelect"
          value={presupuestoId}
          onChange={(e) => seleccionarPresupuesto(e.target.value)}
        >
          <option value="">Sin presupuesto</option>
          {presupuestos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.numero} — {p.razonSocial}
            </option>
          ))}
        </Select>
        <input type="hidden" name="presupuestoId" value={presupuestoId} />
        <input type="hidden" name="numeroPresupuesto" value={numeroPresupuesto} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clientSelect">Cliente registrado (opcional)</Label>
        <Select id="clientSelect" value={clientId} onChange={(e) => seleccionarCliente(e.target.value)}>
          <option value="">Sin cliente registrado</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <input type="hidden" name="clientId" value={clientId} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="razonSocial">Razón social</Label>
        <Input
          id="razonSocial"
          name="razonSocial"
          value={razonSocial}
          onChange={(e) => setRazonSocial(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fechaEntrega">Fecha de entrega (opcional)</Label>
        <Input id="fechaEntrega" name="fechaEntrega" type="date" />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Líneas</Label>
        <div className="flex flex-col gap-2 rounded-md border border-border p-2">
          {lineas.map((l, index) => (
            <div
              key={index}
              className="grid grid-cols-2 items-center gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0 sm:grid-cols-12"
            >
              <Input
                className="sm:col-span-3"
                placeholder="Código"
                value={l.codigoLuminaria}
                onChange={(e) => actualizarLinea(index, { codigoLuminaria: e.target.value })}
              />
              <Input
                className="sm:col-span-6"
                placeholder="Descripción"
                value={l.descripcion}
                onChange={(e) => actualizarLinea(index, { descripcion: e.target.value })}
              />
              <Input
                className="sm:col-span-2"
                type="number"
                min={1}
                step={1}
                value={l.cantidad}
                onChange={(e) => actualizarLinea(index, { cantidad: Number(e.target.value) })}
              />
              <div className="flex items-center justify-end sm:col-span-1">
                <Button type="button" size="sm" variant="delete" onClick={() => quitarLinea(index)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={agregarLinea}>
          <Plus className="h-3.5 w-3.5" />
          Agregar línea
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notas">Notas (opcional)</Label>
        <Textarea id="notas" name="notas" rows={2} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Creando..." : "Crear orden"}
        </Button>
      </div>
    </form>
  );
}

// ---------- componente principal ----------

export function OrdenesClient({
  items,
  clientes,
  presupuestos,
}: {
  items: OrdenItem[];
  clientes: ClienteOption[];
  presupuestos: PresupuestoOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OrdenItem | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      [it.numero, it.razonSocial, it.numeroPresupuesto ?? ""].some((f) =>
        f.toLowerCase().includes(q)
      )
    );
  }, [items, search]);

  async function performDelete(item: OrdenItem) {
    setProcessingId(item.id);
    const result = await deleteOrdenTrabajo(item.id);
    setProcessingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Orden borrada.");
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
            placeholder="Buscar por número, cliente o presupuesto..."
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCreatingOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva orden
        </Button>
      </div>

      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Número</TableHead>
            <TableHead className="whitespace-nowrap">Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="whitespace-nowrap">Presupuesto</TableHead>
            <TableHead className="whitespace-nowrap">Estado</TableHead>
            <TableHead className="whitespace-nowrap text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                {items.length === 0
                  ? "Todavía no hay órdenes de trabajo cargadas."
                  : "No se encontró ninguna orden con esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((it) => (
            <TableRow key={it.id}>
              <TableCell className="whitespace-nowrap font-medium">{it.numero}</TableCell>
              <TableCell className="whitespace-nowrap">
                {new Date(it.fechaISO).toLocaleDateString("es-AR")}
              </TableCell>
              <TableCell className="max-w-[200px] truncate">{it.razonSocial}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {it.numeroPresupuesto || "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant={ordenTrabajoEstadoBadgeVariant(it.estado)}>
                  {ordenTrabajoEstadoLabel(it.estado)}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="flex items-center justify-end gap-1">
                  <Link href={`/ordenes/${it.id}`}>
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:bg-muted" title="Ver">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="delete"
                    disabled={it.ejecutada || it.estado !== "PENDIENTE"}
                    title={
                      !it.ejecutada && it.estado === "PENDIENTE"
                        ? "Borrar"
                        : "Solo se puede borrar una orden pendiente, sin ejecutar."
                    }
                    onClick={() => setDeleteTarget(it)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={creatingOpen} onOpenChange={setCreatingOpen} title="Nueva orden de trabajo" className="max-w-2xl">
        <OrdenForm clientes={clientes} presupuestos={presupuestos} onDone={() => setCreatingOpen(false)} />
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Borrar orden de trabajo"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar la orden{" "}
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
