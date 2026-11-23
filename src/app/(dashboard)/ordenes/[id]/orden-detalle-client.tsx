"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Printer, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import {
  ordenTrabajoEstadoLabel,
  ordenTrabajoEstadoBadgeVariant,
  type OrdenTrabajoEstado,
} from "@/lib/orden-trabajo-estados";
import { proyectoEstadoLabel, proyectoEstadoBadgeVariant, type ProyectoEstado } from "@/lib/proyecto-estados";
import { ejecutarOrdenTrabajo, deleteOrdenTrabajo } from "../actions";

export type OrdenDetalle = {
  id: string;
  numero: string;
  fechaISO: string;
  fechaEntregaISO?: string;
  razonSocial: string;
  numeroPresupuesto?: string;
  vendedor: string;
  lineas: { codigoLuminaria: string; descripcion: string; cantidad: number }[];
  estado: OrdenTrabajoEstado;
  ejecutada: boolean;
  fechaEjecucionISO?: string;
  itemsDescontados: { codigo: string; origen: string; cantidad: number }[];
  notas?: string;
};

export type ProyectoResumen = { id: string; numero: string; estado: ProyectoEstado };

export function OrdenDetalleClient({
  orden,
  proyecto,
}: {
  orden: OrdenDetalle;
  proyecto: ProyectoResumen | null;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  async function handleEjecutar() {
    setProcessing(true);
    const result = await ejecutarOrdenTrabajo(orden.id);
    setProcessing(false);
    setConfirmOpen(false);

    if (!result.ok) {
      // "Falta fabricar..." no es un error de uso — es el resultado
      // esperado cuando no había stock. Se muestra igual como aviso.
      toast.error(result.error ?? "Ocurrió un error.");
      router.refresh();
      return;
    }
    toast.success(result.mensaje ?? "Orden ejecutada.");
    router.refresh();
  }

  async function handleDelete() {
    setProcessing(true);
    const result = await deleteOrdenTrabajo(orden.id);
    setProcessing(false);
    setDeleteOpen(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Orden borrada.");
    router.push("/ordenes");
  }

  const puedeEjecutar = !orden.ejecutada;
  const puedeBorrar = !orden.ejecutada && orden.estado === "PENDIENTE";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Fecha</p>
            <p className="font-medium">{new Date(orden.fechaISO).toLocaleDateString("es-AR")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Entrega</p>
            <p className="font-medium">
              {orden.fechaEntregaISO ? new Date(orden.fechaEntregaISO).toLocaleDateString("es-AR") : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Presupuesto</p>
            <p className="font-medium">{orden.numeroPresupuesto || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Vendedor</p>
            <p className="font-medium">{orden.vendedor || "—"}</p>
          </div>
        </div>
        <Badge variant={ordenTrabajoEstadoBadgeVariant(orden.estado)}>
          {ordenTrabajoEstadoLabel(orden.estado)}
        </Badge>
      </div>

      {proyecto && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-4">
          <div>
            <p className="text-sm text-muted-foreground">Proyecto de fábrica generado</p>
            <p className="font-medium">{proyecto.numero}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={proyectoEstadoBadgeVariant(proyecto.estado)}>
              {proyectoEstadoLabel(proyecto.estado)}
            </Badge>
            <Link href={`/proyectos/${proyecto.id}`}>
              <Button variant="outline" size="sm">
                Ver proyecto
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Líneas</h2>
        <Table compact>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="whitespace-nowrap text-right">Cant.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orden.lineas.map((l, i) => (
              <TableRow key={i}>
                <TableCell className="whitespace-nowrap font-medium">{l.codigoLuminaria}</TableCell>
                <TableCell className="max-w-[300px] truncate">{l.descripcion}</TableCell>
                <TableCell className="whitespace-nowrap text-right">{l.cantidad}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {orden.ejecutada && orden.itemsDescontados.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Stock a tomar al despachar{" "}
            {orden.fechaEjecucionISO && (
              <span className="font-normal">
                (ejecutada el {new Date(orden.fechaEjecucionISO).toLocaleDateString("es-AR")})
              </span>
            )}
          </h2>
          <Table compact>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Código</TableHead>
                <TableHead className="whitespace-nowrap">Origen</TableHead>
                <TableHead className="whitespace-nowrap text-right">Cant.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orden.itemsDescontados.map((i, idx) => (
                <TableRow key={idx}>
                  <TableCell className="whitespace-nowrap font-medium">{i.codigo}</TableCell>
                  <TableCell className="whitespace-nowrap">{i.origen}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">{i.cantidad}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {orden.notas && <p className="text-sm text-muted-foreground">{orden.notas}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Link href={`/imprimir/ordenes/${orden.id}`} target="_blank">
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
          <Button disabled={processing} onClick={() => setConfirmOpen(true)}>
            Ejecutar orden
          </Button>
        )}
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Ejecutar orden de trabajo"
        className="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            PayFlow va a revisar el stock disponible para cada línea. Lo que no esté en stock genera
            automáticamente un Proyecto de fábrica para el taller. El stock no se descuenta todavía —
            eso ocurre al confirmar el despacho correspondiente.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={processing} onClick={handleEjecutar}>
              {processing ? "Procesando..." : "Confirmar ejecución"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Borrar orden de trabajo" className="max-w-md">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            ¿Seguro que querés borrar la orden{" "}
            <span className="font-medium text-foreground">{orden.numero}</span>? No se puede deshacer.
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
