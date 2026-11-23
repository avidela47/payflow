"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Printer, Trash2 } from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import {
  reparacionEstadoLabel,
  reparacionEstadoBadgeVariant,
  type ReparacionEstado,
} from "@/lib/reparacion-estados";
import { ejecutarReparacion, deleteReparacion } from "../actions";

export type ReparacionDetalle = {
  id: string;
  numero: string;
  fechaISO: string;
  fechaEntregaISO?: string;
  razonSocial: string;
  numeroPresupuesto?: string;
  vendedor: string;
  lineas: { codigoLuminaria?: string; descripcion: string; cantidad: number }[];
  estado: ReparacionEstado;
  ejecutada: boolean;
  fechaEjecucionISO?: string;
  componentesDescontados: { codigoComponente: string; descripcionComponente: string; cantidad: number }[];
  notas?: string;
};

export type ComponenteOption = {
  id: string;
  codigo: string;
  descripcion: string;
  stockActual: number;
};

type ComponenteUsadoForm = { componenteId: string; cantidad: number };

export function ReparacionDetalleClient({
  reparacion,
  componentes,
}: {
  reparacion: ReparacionDetalle;
  componentes: ComponenteOption[];
}) {
  const router = useRouter();
  const [ejecutarOpen, setEjecutarOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [usados, setUsados] = useState<ComponenteUsadoForm[]>([{ componenteId: "", cantidad: 1 }]);

  function actualizarUsado(index: number, patch: Partial<ComponenteUsadoForm>) {
    setUsados((prev) => prev.map((u, i) => (i === index ? { ...u, ...patch } : u)));
  }

  function agregarUsado() {
    setUsados((prev) => [...prev, { componenteId: "", cantidad: 1 }]);
  }

  function quitarUsado(index: number) {
    setUsados((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleEjecutar() {
    const validos = usados.filter((u) => u.componenteId && u.cantidad > 0);
    if (validos.length === 0) {
      toast.error("Elegí al menos un componente usado.");
      return;
    }

    setProcessing(true);
    const result = await ejecutarReparacion(reparacion.id, JSON.stringify(validos));
    setProcessing(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    setEjecutarOpen(false);
    toast.success(result.mensaje ?? "Reparación ejecutada.");
    router.refresh();
  }

  async function handleDelete() {
    setProcessing(true);
    const result = await deleteReparacion(reparacion.id);
    setProcessing(false);
    setDeleteOpen(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Reparación borrada.");
    router.push("/reparaciones");
  }

  const puedeEjecutar = !reparacion.ejecutada;
  const puedeBorrar = !reparacion.ejecutada && reparacion.estado === "PENDIENTE";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Fecha</p>
            <p className="font-medium">{new Date(reparacion.fechaISO).toLocaleDateString("es-AR")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Entrega</p>
            <p className="font-medium">
              {reparacion.fechaEntregaISO
                ? new Date(reparacion.fechaEntregaISO).toLocaleDateString("es-AR")
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Presupuesto</p>
            <p className="font-medium">{reparacion.numeroPresupuesto || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Vendedor</p>
            <p className="font-medium">{reparacion.vendedor || "—"}</p>
          </div>
        </div>
        <Badge variant={reparacionEstadoBadgeVariant(reparacion.estado)}>
          {reparacionEstadoLabel(reparacion.estado)}
        </Badge>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Líneas (luminarias a reparar)</h2>
        <Table compact>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="whitespace-nowrap text-right">Cant.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reparacion.lineas.map((l, i) => (
              <TableRow key={i}>
                <TableCell className="whitespace-nowrap font-medium">{l.codigoLuminaria || "—"}</TableCell>
                <TableCell className="max-w-[300px] truncate">{l.descripcion}</TableCell>
                <TableCell className="whitespace-nowrap text-right">{l.cantidad}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {reparacion.ejecutada && reparacion.componentesDescontados.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Componentes usados{" "}
            {reparacion.fechaEjecucionISO && (
              <span className="font-normal">
                (ejecutada el {new Date(reparacion.fechaEjecucionISO).toLocaleDateString("es-AR")})
              </span>
            )}
          </h2>
          <Table compact>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="whitespace-nowrap text-right">Cant.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reparacion.componentesDescontados.map((c, idx) => (
                <TableRow key={idx}>
                  <TableCell className="whitespace-nowrap font-medium">{c.codigoComponente}</TableCell>
                  <TableCell className="max-w-[300px] truncate">{c.descripcionComponente}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">{c.cantidad}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {reparacion.notas && <p className="text-sm text-muted-foreground">{reparacion.notas}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Link href={`/imprimir/reparaciones/${reparacion.id}`} target="_blank">
          <Button type="button" variant="outline">
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </Link>
        {puedeBorrar && (
          <Button variant="delete" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Borrar
          </Button>
        )}
        {puedeEjecutar && (
          <Button disabled={processing} onClick={() => setEjecutarOpen(true)}>
            Ejecutar reparación
          </Button>
        )}
      </div>

      <Dialog
        open={ejecutarOpen}
        onOpenChange={setEjecutarOpen}
        title="Ejecutar reparación"
        className="max-w-lg"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Elegí los Componentes que se usaron en esta reparación y la cantidad de cada uno. Se
            descuenta del stock real al confirmar — no hay Receta automática, cada reparación puede
            gastar cosas distintas.
          </p>

          <div className="flex flex-col gap-2 rounded-md border border-border p-2">
            {usados.map((u, index) => {
              const seleccionado = componentes.find((c) => c.id === u.componenteId);
              return (
                <div
                  key={index}
                  className="grid grid-cols-1 items-center gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0 sm:grid-cols-12"
                >
                  <Select
                    className="sm:col-span-7"
                    value={u.componenteId}
                    onChange={(e) => actualizarUsado(index, { componenteId: e.target.value })}
                  >
                    <option value="">Elegir componente...</option>
                    {componentes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.codigo} — {c.descripcion} (stock: {c.stockActual})
                      </option>
                    ))}
                  </Select>
                  <Input
                    className="sm:col-span-3"
                    type="number"
                    min={1}
                    step={1}
                    max={seleccionado?.stockActual}
                    value={u.cantidad}
                    onChange={(e) => actualizarUsado(index, { cantidad: Number(e.target.value) })}
                  />
                  <div className="flex items-center justify-end sm:col-span-2">
                    <Button type="button" size="sm" variant="delete" onClick={() => quitarUsado(index)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={agregarUsado}>
            <Plus className="h-3.5 w-3.5" />
            Agregar componente
          </Button>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEjecutarOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={processing} onClick={handleEjecutar}>
              {processing ? "Procesando..." : "Confirmar ejecución"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Borrar reparación" className="max-w-md">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            ¿Seguro que querés borrar la reparación{" "}
            <span className="font-medium text-foreground">{reparacion.numero}</span>? No se puede
            deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={processing} onClick={handleDelete}>
              {processing ? "Borrando..." : "Sí, borrar"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
