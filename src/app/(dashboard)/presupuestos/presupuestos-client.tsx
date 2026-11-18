"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
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
import { IVA_CONDITIONS } from "@/lib/iva-conditions";
import {
  PRESUPUESTO_ESTADOS,
  presupuestoEstadoLabel,
  presupuestoEstadoBadgeVariant,
  type PresupuestoEstado,
} from "@/lib/presupuesto-estados";
import { createPresupuesto, updatePresupuesto, deletePresupuesto } from "./actions";

function formatMoneda(value: number, moneda: string): string {
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  return `${moneda} ${formatted}`;
}

export type LineaItem = {
  codigo?: string;
  descripcion: string;
  cantidad: number;
  bonificacion: number;
  precioUnitario: number;
  precioTotal: number;
  plazoEntregaLinea?: string;
};

export type PresupuestoItem = {
  id: string;
  numero: string;
  fechaISO: string;
  validezDias: number;
  vendedor?: string;
  clientId?: string;
  razonSocial: string;
  cuit?: string;
  direccion?: string;
  localidad?: string;
  telefono?: string;
  email?: string;
  atencion?: string;
  condicionIva?: string;
  lineas: LineaItem[];
  moneda: string;
  subtotal: number;
  iva: number;
  total: number;
  formaPago?: string;
  plazoEntrega?: string;
  cotizacion?: string;
  comentario?: string;
  estado: PresupuestoEstado;
  notas?: string;
};

export type ClienteOption = {
  id: string;
  nombre: string;
  razonSocial?: string;
  cuit?: string;
  direccion?: string;
  localidad?: string;
  telefono?: string;
  email?: string;
  condicionIva?: string;
};

const LINEA_VACIA: LineaItem = {
  codigo: "",
  descripcion: "",
  cantidad: 1,
  bonificacion: 0,
  precioUnitario: 0,
  precioTotal: 0,
  plazoEntregaLinea: "",
};

// ---------- formulario de crear/editar (contenido del Dialog) ----------

function PresupuestoForm({
  mode,
  itemId,
  defaultValues,
  clientes,
  onDone,
}: {
  mode: "create" | "edit";
  itemId?: string;
  defaultValues?: PresupuestoItem;
  clientes: ClienteOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState(defaultValues?.clientId ?? "");
  const [razonSocial, setRazonSocial] = useState(defaultValues?.razonSocial ?? "");
  const [cuit, setCuit] = useState(defaultValues?.cuit ?? "");
  const [direccion, setDireccion] = useState(defaultValues?.direccion ?? "");
  const [localidad, setLocalidad] = useState(defaultValues?.localidad ?? "");
  const [telefono, setTelefono] = useState(defaultValues?.telefono ?? "");
  const [email, setEmail] = useState(defaultValues?.email ?? "");
  const [condicionIva, setCondicionIva] = useState(defaultValues?.condicionIva ?? "");
  const [moneda, setMoneda] = useState(defaultValues?.moneda ?? "U$D");
  const [ivaMonto, setIvaMonto] = useState(defaultValues?.iva ?? 0);
  const [lineas, setLineas] = useState<LineaItem[]>(
    defaultValues?.lineas?.length ? defaultValues.lineas : [{ ...LINEA_VACIA }]
  );

  function seleccionarCliente(id: string) {
    setClientId(id);
    const c = clientes.find((cl) => cl.id === id);
    if (!c) return;
    setRazonSocial(c.razonSocial || c.nombre);
    setCuit(c.cuit ?? "");
    setDireccion(c.direccion ?? "");
    setLocalidad(c.localidad ?? "");
    setTelefono(c.telefono ?? "");
    setEmail(c.email ?? "");
    setCondicionIva(c.condicionIva ?? "");
  }

  function actualizarLinea(index: number, campo: keyof LineaItem, valor: string | number) {
    setLineas((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const next = { ...l, [campo]: valor };
        const cantidad = Number(next.cantidad) || 0;
        const precioUnitario = Number(next.precioUnitario) || 0;
        const bonificacion = Number(next.bonificacion) || 0;
        next.precioTotal =
          Math.round(cantidad * precioUnitario * (1 - bonificacion / 100) * 100) / 100;
        return next;
      })
    );
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, { ...LINEA_VACIA }]);
  }

  function quitarLinea(index: number) {
    setLineas((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const subtotal = useMemo(
    () => Math.round(lineas.reduce((acc, l) => acc + (l.precioTotal || 0), 0) * 100) / 100,
    [lineas]
  );
  const total = Math.round((subtotal + (Number(ivaMonto) || 0)) * 100) / 100;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set("lineasJson", JSON.stringify(lineas));
    const result =
      mode === "create"
        ? await createPresupuesto(formData)
        : await updatePresupuesto(itemId as string, formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success(mode === "create" ? "Presupuesto creado." : "Presupuesto actualizado.");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fecha">Fecha</Label>
          <Input
            id="fecha"
            name="fecha"
            type="date"
            defaultValue={defaultValues?.fechaISO ?? new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="validezDias">Validez (días)</Label>
          <Input
            id="validezDias"
            name="validezDias"
            type="number"
            min={0}
            step={1}
            defaultValue={defaultValues?.validezDias ?? 5}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vendedor">Vendedor</Label>
          <Input id="vendedor" name="vendedor" defaultValue={defaultValues?.vendedor} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clientSelect">Cliente (prellena los datos de abajo)</Label>
        <Select
          id="clientSelect"
          value={clientId}
          onChange={(e) => seleccionarCliente(e.target.value)}
        >
          <option value="">Sin cliente asociado — cargar a mano</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <input type="hidden" name="clientId" value={clientId} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="razonSocial">Razón social</Label>
          <Input
            id="razonSocial"
            name="razonSocial"
            required
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cuit">CUIT</Label>
          <Input id="cuit" name="cuit" value={cuit} onChange={(e) => setCuit(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="direccion">Dirección</Label>
          <Input
            id="direccion"
            name="direccion"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="localidad">Localidad</Label>
          <Input
            id="localidad"
            name="localidad"
            value={localidad}
            onChange={(e) => setLocalidad(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            id="telefono"
            name="telefono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="atencion">Atención a</Label>
          <Input id="atencion" name="atencion" defaultValue={defaultValues?.atencion} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="condicionIva">Condición de IVA</Label>
          <Select
            id="condicionIva"
            name="condicionIva"
            value={condicionIva}
            onChange={(e) => setCondicionIva(e.target.value)}
          >
            <option value="">Sin especificar</option>
            {IVA_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Líneas</Label>
          <Button type="button" size="sm" variant="outline" onClick={agregarLinea}>
            <Plus className="h-3.5 w-3.5" />
            Agregar línea
          </Button>
        </div>
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
                className="sm:col-span-4"
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
                className="sm:col-span-1"
                type="number"
                min={0}
                max={100}
                placeholder="Bonif. %"
                value={linea.bonificacion}
                onChange={(e) => actualizarLinea(index, "bonificacion", Number(e.target.value))}
              />
              <Input
                className="sm:col-span-2"
                type="number"
                min={0}
                step="0.01"
                placeholder="Precio unit."
                value={linea.precioUnitario}
                onChange={(e) => actualizarLinea(index, "precioUnitario", Number(e.target.value))}
              />
              <div className="flex items-center justify-between gap-2 sm:col-span-2">
                <span className="truncate text-sm font-medium">
                  {formatMoneda(linea.precioTotal, moneda)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => quitarLinea(index)}
                  disabled={lineas.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="moneda">Moneda</Label>
          <Select id="moneda" name="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
            <option value="U$D">U$D</option>
            <option value="ARS">ARS</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ivaMonto">IVA (monto)</Label>
          <Input
            id="ivaMonto"
            name="ivaMonto"
            type="number"
            min={0}
            step="0.01"
            value={ivaMonto}
            onChange={(e) => setIvaMonto(Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Subtotal</Label>
          <p className="flex h-9 items-center text-sm font-medium">
            {formatMoneda(subtotal, moneda)}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Total</Label>
          <p className="flex h-9 items-center text-sm font-semibold text-primary">
            {formatMoneda(total, moneda)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="formaPago">Forma de pago</Label>
          <Input id="formaPago" name="formaPago" defaultValue={defaultValues?.formaPago} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plazoEntrega">Plazo de entrega</Label>
          <Input id="plazoEntrega" name="plazoEntrega" defaultValue={defaultValues?.plazoEntrega} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="estado">Estado</Label>
          <Select id="estado" name="estado" required defaultValue={defaultValues?.estado ?? "BORRADOR"}>
            {PRESUPUESTO_ESTADOS.map((estado) => (
              <option key={estado} value={estado}>
                {presupuestoEstadoLabel(estado)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="comentario">Comentario</Label>
        <Textarea id="comentario" name="comentario" rows={2} defaultValue={defaultValues?.comentario} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notas">Notas internas</Label>
        <Textarea id="notas" name="notas" rows={2} defaultValue={defaultValues?.notas} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : mode === "create" ? "Crear presupuesto" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

// ---------- componente principal ----------

export function PresupuestosClient({
  items,
  clientes,
}: {
  items: PresupuestoItem[];
  clientes: ClienteOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PresupuestoItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PresupuestoItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchSearch =
        !q || [item.numero, item.razonSocial, item.cuit].some((f) => f?.toLowerCase().includes(q));
      const matchEstado = filtroEstado === "todos" || item.estado === filtroEstado;
      return matchSearch && matchEstado;
    });
  }, [items, search, filtroEstado]);

  async function performDelete(item: PresupuestoItem) {
    setDeletingId(item.id);
    const result = await deletePresupuesto(item.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Presupuesto borrado.");
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número, cliente o CUIT..."
              className="pl-9"
            />
          </div>
          <Button onClick={() => setCreatingOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo presupuesto
          </Button>
        </div>
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
          <Button
            type="button"
            size="sm"
            variant={filtroEstado === "todos" ? "default" : "outline"}
            className="shrink-0"
            onClick={() => setFiltroEstado("todos")}
          >
            Todos
          </Button>
          {PRESUPUESTO_ESTADOS.map((estado) => (
            <Button
              key={estado}
              type="button"
              size="sm"
              variant={filtroEstado === estado ? "default" : "outline"}
              className="shrink-0"
              onClick={() => setFiltroEstado(estado)}
            >
              {presupuestoEstadoLabel(estado)}
            </Button>
          ))}
        </div>
      </div>

      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="whitespace-nowrap">Fecha</TableHead>
            <TableHead className="whitespace-nowrap">Total</TableHead>
            <TableHead className="whitespace-nowrap">Estado</TableHead>
            <TableHead className="whitespace-nowrap text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                {items.length === 0
                  ? "Todavía no hay presupuestos cargados."
                  : "No se encontró ningún presupuesto con esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="whitespace-nowrap font-medium">{item.numero}</TableCell>
              <TableCell className="max-w-[220px] truncate">{item.razonSocial}</TableCell>
              <TableCell className="whitespace-nowrap">
                {new Date(item.fechaISO).toLocaleDateString("es-AR")}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatMoneda(item.total, item.moneda)}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant={presupuestoEstadoBadgeVariant(item.estado)}>
                  {presupuestoEstadoLabel(item.estado)}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-primary hover:bg-primary/10"
                    onClick={() => setEditTarget(item)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(item)}
                  >
                    Borrar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={creatingOpen}
        onOpenChange={setCreatingOpen}
        title="Nuevo presupuesto"
        className="max-w-3xl"
      >
        <PresupuestoForm mode="create" clientes={clientes} onDone={() => setCreatingOpen(false)} />
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title="Editar presupuesto"
        className="max-w-3xl"
      >
        {editTarget && (
          <PresupuestoForm
            mode="edit"
            itemId={editTarget.id}
            defaultValues={editTarget}
            clientes={clientes}
            onDone={() => setEditTarget(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Borrar presupuesto"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar el presupuesto{" "}
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