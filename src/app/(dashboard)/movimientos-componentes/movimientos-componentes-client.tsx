"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle, PackagePlus, Plus, Search } from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { componenteUnidadLabel, type ComponenteUnidad } from "@/lib/componente-unidades";
import {
  MOVIMIENTO_COMPONENTE_TIPOS_MANUALES,
  MOVIMIENTO_COMPONENTE_TIPOS,
  movimientoComponenteTipoLabel,
  movimientoComponenteTipoBadgeVariant,
  esMovimientoDeEntrada,
  type MovimientoComponenteTipo,
} from "@/lib/movimiento-componente-tipos";
import { registrarMovimientoComponente } from "../componentes/actions";

export type ComponenteOption = {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: ComponenteUnidad;
  stockActual: number;
};

export type MovimientoItem = {
  id: string;
  componenteId: string;
  codigoComponente: string;
  descripcionComponente: string;
  tipo: MovimientoComponenteTipo;
  cantidad: number;
  stockResultante: number;
  referencia?: string;
  notas?: string;
  usuario: string;
  createdAtISO: string;
};

const TIPO_ICON: Record<(typeof MOVIMIENTO_COMPONENTE_TIPOS_MANUALES)[number], typeof ArrowDownCircle> = {
  ENTRADA_COMPRA: PackagePlus,
  AJUSTE_ENTRADA: ArrowDownCircle,
  AJUSTE_SALIDA: ArrowUpCircle,
};

// ---------- formulario de registrar movimiento (contenido del Dialog) ----------

function MovimientoForm({
  componentes,
  onDone,
}: {
  componentes: ComponenteOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [componenteId, setComponenteId] = useState("");
  const [tipo, setTipo] = useState<(typeof MOVIMIENTO_COMPONENTE_TIPOS_MANUALES)[number]>(
    "ENTRADA_COMPRA"
  );

  const componenteSeleccionado = componentes.find((c) => c.id === componenteId);
  const Icon = TIPO_ICON[tipo];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!componenteId) {
      toast.error("Seleccioná un componente.");
      return;
    }
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set("tipo", tipo);
    const result = await registrarMovimientoComponente(componenteId, formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Movimiento registrado.");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tipo">Tipo de movimiento</Label>
        <Select
          id="tipo"
          value={tipo}
          onChange={(e) =>
            setTipo(e.target.value as (typeof MOVIMIENTO_COMPONENTE_TIPOS_MANUALES)[number])
          }
        >
          {MOVIMIENTO_COMPONENTE_TIPOS_MANUALES.map((t) => (
            <option key={t} value={t}>
              {movimientoComponenteTipoLabel(t)}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="componenteId">Componente</Label>
        <Select
          id="componenteId"
          value={componenteId}
          onChange={(e) => setComponenteId(e.target.value)}
          required
        >
          <option value="">Seleccionar componente...</option>
          {componentes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.codigo} — {c.descripcion} (stock: {c.stockActual} {componenteUnidadLabel(c.unidad)})
            </option>
          ))}
        </Select>
        {componenteSeleccionado && (
          <p className="text-xs text-muted-foreground">
            Stock actual:{" "}
            <span className="font-semibold text-foreground">{componenteSeleccionado.stockActual}</span>{" "}
            {componenteUnidadLabel(componenteSeleccionado.unidad)}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cantidad">Cantidad</Label>
        <Input id="cantidad" name="cantidad" type="number" min={1} step={1} required defaultValue={1} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="referencia">Referencia</Label>
        <Input id="referencia" name="referencia" placeholder="Ej: OC-2026-001" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notas">Notas</Label>
        <Input id="notas" name="notas" placeholder="Observaciones" />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          <Icon className="h-4 w-4" />
          {saving ? "Guardando..." : "Registrar"}
        </Button>
      </div>
    </form>
  );
}

// ---------- componente principal ----------

export function MovimientosComponentesClient({
  componentes,
  movimientos,
}: {
  componentes: ComponenteOption[];
  movimientos: MovimientoItem[];
}) {
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [registrarOpen, setRegistrarOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movimientos.filter((m) => {
      const matchSearch =
        !q ||
        [m.codigoComponente, m.descripcionComponente].some((field) =>
          field?.toLowerCase().includes(q)
        );
      const matchTipo = filtroTipo === "todos" || m.tipo === filtroTipo;
      return matchSearch && matchTipo;
    });
  }, [movimientos, search, filtroTipo]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por componente..."
              className="pl-9"
            />
          </div>
          <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="sm:w-56">
            <option value="todos">Todos los tipos</option>
            {MOVIMIENTO_COMPONENTE_TIPOS.map((t) => (
              <option key={t} value={t}>
                {movimientoComponenteTipoLabel(t)}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={() => setRegistrarOpen(true)}>
          <Plus className="h-4 w-4" />
          Registrar movimiento
        </Button>
      </div>

      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Fecha</TableHead>
            <TableHead className="whitespace-nowrap">Tipo</TableHead>
            <TableHead>Componente</TableHead>
            <TableHead className="whitespace-nowrap">Cantidad</TableHead>
            <TableHead className="whitespace-nowrap">Stock resultante</TableHead>
            <TableHead className="whitespace-nowrap">Referencia</TableHead>
            <TableHead>Notas</TableHead>
            <TableHead className="whitespace-nowrap">Usuario</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                {movimientos.length === 0
                  ? "Todavía no hay movimientos registrados."
                  : "No se encontró ningún movimiento con esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="whitespace-nowrap">
                {new Date(m.createdAtISO).toLocaleDateString("es-AR")}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant={movimientoComponenteTipoBadgeVariant(m.tipo)}>
                  {movimientoComponenteTipoLabel(m.tipo)}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[220px] truncate">
                <span className="font-medium">{m.codigoComponente}</span>{" "}
                <span className="text-muted-foreground">— {m.descripcionComponente}</span>
              </TableCell>
              <TableCell className="whitespace-nowrap font-medium">
                {esMovimientoDeEntrada(m.tipo) ? "+" : "-"}
                {m.cantidad}
              </TableCell>
              <TableCell className="whitespace-nowrap">{m.stockResultante}</TableCell>
              <TableCell className="whitespace-nowrap">{m.referencia || "—"}</TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground">
                {m.notas || "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {m.usuario || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={registrarOpen}
        onOpenChange={setRegistrarOpen}
        title="Registrar movimiento"
        className="max-w-md"
      >
        <MovimientoForm componentes={componentes} onDone={() => setRegistrarOpen(false)} />
      </Dialog>
    </>
  );
}