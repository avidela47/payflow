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
  valeEstadoLabel,
  valeEstadoBadgeVariant,
  valeItemTipoLabel,
  VALE_ITEM_TIPOS,
  type ValeEstado,
  type ValeItemTipo,
} from "@/lib/vale-estados";
import { createVale, registrarDevolucionVale, deleteVale } from "./actions";

export type ItemValeForm = {
  descripcion: string;
  cantidadSalida: number;
  cantidadDevuelta: number;
  tipo: ValeItemTipo;
  notas?: string;
};

export type ValeItem = {
  id: string;
  numero: string;
  fechaSalidaISO: string;
  fechaDevolucionISO?: string;
  responsable: string;
  emitidoPor: string;
  estado: ValeEstado;
  items: ItemValeForm[];
  observacionesSalida?: string;
  observacionesDevolucion?: string;
};

// ---------- formulario de creación (contenido del Dialog) ----------
//
// Igual criterio que el original: los ítems son descripción libre, sin
// referenciar ningún catálogo real (ver nota en models/Vale.ts) — "tipo"
// es solo informativo.

function ValeForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [responsable, setResponsable] = useState("");
  const [items, setItems] = useState<
    { descripcion: string; cantidadSalida: number; tipo: ValeItemTipo; notas: string }[]
  >([]);
  const [nuevaDescripcion, setNuevaDescripcion] = useState("");
  const [nuevaCantidad, setNuevaCantidad] = useState(1);
  const [nuevoTipo, setNuevoTipo] = useState<ValeItemTipo>("OTRO");

  function agregarItem() {
    if (!nuevaDescripcion.trim()) {
      toast.error("Completá la descripción del ítem.");
      return;
    }
    setItems((prev) => [
      ...prev,
      { descripcion: nuevaDescripcion.trim(), cantidadSalida: nuevaCantidad, tipo: nuevoTipo, notas: "" },
    ]);
    setNuevaDescripcion("");
    setNuevaCantidad(1);
    setNuevoTipo("OTRO");
  }

  function quitarItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!responsable.trim()) {
      toast.error("Completá quién retira.");
      return;
    }
    if (items.length === 0) {
      toast.error("Agregá al menos un ítem.");
      return;
    }
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set("itemsJson", JSON.stringify(items));
    const result = await createVale(formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Vale creado.");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fechaSalida">Fecha de salida</Label>
        <Input
          id="fechaSalida"
          name="fechaSalida"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="responsable">Responsable (quien retira)</Label>
        <Input
          id="responsable"
          name="responsable"
          value={responsable}
          onChange={(e) => setResponsable(e.target.value)}
          placeholder="Nombre de quien retira"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Ítems</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
          <Input
            className="sm:col-span-6"
            placeholder="Descripción del ítem"
            value={nuevaDescripcion}
            onChange={(e) => setNuevaDescripcion(e.target.value)}
          />
          <Input
            className="sm:col-span-2"
            type="number"
            min={1}
            step={1}
            value={nuevaCantidad}
            onChange={(e) => setNuevaCantidad(Number(e.target.value))}
          />
          <Select
            className="h-9 sm:col-span-3"
            value={nuevoTipo}
            onChange={(e) => setNuevoTipo(e.target.value as ValeItemTipo)}
          >
            {VALE_ITEM_TIPOS.map((t) => (
              <option key={t} value={t}>
                {valeItemTipoLabel(t)}
              </option>
            ))}
          </Select>
          <Button type="button" size="sm" className="sm:col-span-1" onClick={agregarItem}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Agregá al menos un ítem.
          </p>
        ) : (
          <div className="flex flex-col gap-2 rounded-md border border-border p-2">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-2 items-center gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0 sm:grid-cols-12"
              >
                <div className="sm:col-span-7">
                  <p className="text-sm font-medium">{item.descripcion}</p>
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  {valeItemTipoLabel(item.tipo)}
                </p>
                <p className="text-xs text-muted-foreground sm:col-span-2">Cant: {item.cantidadSalida}</p>
                <div className="flex items-center justify-end sm:col-span-1">
                  <Button type="button" size="sm" variant="delete" onClick={() => quitarItem(index)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="observacionesSalida">Observaciones</Label>
        <Textarea id="observacionesSalida" name="observacionesSalida" rows={2} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Crear vale"}
        </Button>
      </div>
    </form>
  );
}

// ---------- formulario de devolución (sub-dialog dentro de "Ver") ----------

function DevolucionForm({
  vale,
  onDone,
}: {
  vale: ValeItem;
  onDone: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [cantidades, setCantidades] = useState<number[]>(vale.items.map(() => 0));
  const [observaciones, setObservaciones] = useState("");

  async function handleSubmit() {
    const total = cantidades.reduce((a, b) => a + b, 0);
    if (total <= 0) {
      toast.error("Ingresá al menos una cantidad devuelta.");
      return;
    }
    setSaving(true);
    const result = await registrarDevolucionVale(vale.id, JSON.stringify(cantidades), observaciones);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Devolución registrada.");
    router.refresh();
    onDone();
  }

  return (
    <div className="flex flex-col gap-4">
      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead>Descripción</TableHead>
            <TableHead className="whitespace-nowrap text-right">Salió</TableHead>
            <TableHead className="whitespace-nowrap text-right">Devuelto</TableHead>
            <TableHead className="whitespace-nowrap text-right">Devuelve ahora</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vale.items.map((item, i) => {
            const pendiente = item.cantidadSalida - item.cantidadDevuelta;
            return (
              <TableRow key={i}>
                <TableCell className="max-w-[180px] truncate">{item.descripcion}</TableCell>
                <TableCell className="whitespace-nowrap text-right">{item.cantidadSalida}</TableCell>
                <TableCell className="whitespace-nowrap text-right text-success">
                  {item.cantidadDevuelta}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Input
                    type="number"
                    min={0}
                    max={pendiente}
                    disabled={pendiente === 0}
                    value={cantidades[i]}
                    onChange={(e) =>
                      setCantidades((prev) =>
                        prev.map((v, idx) => (idx === i ? Number(e.target.value) : v))
                      )
                    }
                    className="h-8 w-20 text-right"
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="observacionesDevolucion">Observaciones</Label>
        <Textarea
          id="observacionesDevolucion"
          rows={2}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="button" disabled={saving} onClick={handleSubmit}>
          {saving ? "Guardando..." : "Confirmar devolución"}
        </Button>
      </div>
    </div>
  );
}

// ---------- componente principal ----------

export function ValesClient({ items }: { items: ValeItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<ValeItem | null>(null);
  const [devolviendo, setDevolviendo] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ValeItem | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.numero, item.responsable, item.emitidoPor, valeEstadoLabel(item.estado)].some((f) =>
        f?.toLowerCase().includes(q)
      )
    );
  }, [items, search]);

  async function performDelete(item: ValeItem) {
    setProcessingId(item.id);
    const result = await deleteVale(item.id);
    setProcessingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Vale borrado.");
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
            placeholder="Buscar por número, responsable o estado..."
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCreatingOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo vale
        </Button>
      </div>

      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Número</TableHead>
            <TableHead className="whitespace-nowrap">Fecha salida</TableHead>
            <TableHead>Responsable</TableHead>
            <TableHead>Emitido por</TableHead>
            <TableHead className="whitespace-nowrap">Ítems</TableHead>
            <TableHead className="whitespace-nowrap">Estado</TableHead>
            <TableHead className="whitespace-nowrap text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {items.length === 0
                  ? "Todavía no hay vales cargados."
                  : "No se encontró ningún vale con esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="whitespace-nowrap font-medium">{item.numero}</TableCell>
              <TableCell className="whitespace-nowrap">
                {new Date(item.fechaSalidaISO).toLocaleDateString("es-AR")}
              </TableCell>
              <TableCell className="max-w-[160px] truncate">{item.responsable}</TableCell>
              <TableCell className="max-w-[140px] truncate text-muted-foreground">
                {item.emitidoPor}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {item.items.length} ítem{item.items.length === 1 ? "" : "s"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant={valeEstadoBadgeVariant(item.estado)}>{valeEstadoLabel(item.estado)}</Badge>
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
                    disabled={item.estado === "CERRADO"}
                    title={
                      item.estado === "CERRADO"
                        ? "No se puede borrar: el vale ya está cerrado — queda como registro."
                        : "Borrar"
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
          if (!open) {
            setViewTarget(null);
            setDevolviendo(false);
          }
        }}
        title={viewTarget ? `Vale ${viewTarget.numero}` : ""}
        className="max-w-xl"
      >
        {viewTarget && !devolviendo && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{viewTarget.responsable}</p>
                <p className="text-muted-foreground">
                  {new Date(viewTarget.fechaSalidaISO).toLocaleDateString("es-AR")} — emitido por{" "}
                  {viewTarget.emitidoPor}
                </p>
              </div>
              <Badge variant={valeEstadoBadgeVariant(viewTarget.estado)}>
                {valeEstadoLabel(viewTarget.estado)}
              </Badge>
            </div>

            <Table compact>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="whitespace-nowrap">Tipo</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Salió</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Devuelto</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Pendiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewTarget.items.map((item, i) => {
                  const pendiente = item.cantidadSalida - item.cantidadDevuelta;
                  return (
                    <TableRow key={i}>
                      <TableCell className="max-w-[180px] truncate">{item.descripcion}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {valeItemTipoLabel(item.tipo)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">{item.cantidadSalida}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-success">
                        {item.cantidadDevuelta}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium">
                        {pendiente > 0 ? pendiente : "✓"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {viewTarget.observacionesSalida && (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Salida: </span>
                {viewTarget.observacionesSalida}
              </p>
            )}
            {viewTarget.observacionesDevolucion && (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Devolución: </span>
                {viewTarget.observacionesDevolucion}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setViewTarget(null)}>
                Cerrar
              </Button>
              <Link href={`/imprimir/vales/${viewTarget.id}`} target="_blank">
                <Button type="button" variant="outline">
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
              </Link>
              {viewTarget.estado !== "CERRADO" && (
                <Button onClick={() => setDevolviendo(true)}>Registrar devolución</Button>
              )}
            </div>
          </div>
        )}

        {viewTarget && devolviendo && (
          <DevolucionForm
            vale={viewTarget}
            onDone={() => {
              setDevolviendo(false);
              setViewTarget(null);
            }}
          />
        )}
      </Dialog>

      <Dialog open={creatingOpen} onOpenChange={setCreatingOpen} title="Nuevo vale" className="max-w-2xl">
        <ValeForm onDone={() => setCreatingOpen(false)} />
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Borrar vale"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar el vale{" "}
              <span className="font-medium text-foreground">{deleteTarget.numero}</span> de{" "}
              {deleteTarget.responsable}? No se puede deshacer.
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
