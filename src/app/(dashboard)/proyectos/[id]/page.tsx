import { notFound } from "next/navigation";
import Link from "next/link";
import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Proyecto } from "@/models/Proyecto";
import { ProyectoAvance } from "@/models/ProyectoAvance";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { proyectoEstadoLabel, proyectoEstadoBadgeVariant } from "@/lib/proyecto-estados";

// Detalle de solo lectura — igual que el original (app/(app)/proyectos/
// [id]/page.tsx nunca tuvo UI de edición). Las acciones de taller
// (tomar/cargar avance/marcar listo) viven en la pantalla kiosco
// /fabrica-proyectos, no acá.
export default async function ProyectoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("proyectos");
  await connectDB();

  const { id } = await params;
  const proyecto = await Proyecto.findById(id).lean();
  if (!proyecto) notFound();

  const avances = await ProyectoAvance.find({ proyectoId: proyecto._id })
    .sort({ createdAt: -1 })
    .lean();

  const solicitado = proyecto.items.reduce((a, i) => a + i.cantidadSolicitada, 0);
  const completado = proyecto.items.reduce((a, i) => a + i.cantidadCompletada, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Proyecto {proyecto.numero}</h1>
          <p className="text-sm text-muted-foreground">
            {proyecto.cliente}
            {proyecto.nombre && ` — ${proyecto.nombre}`}
          </p>
        </div>
        <Badge variant={proyectoEstadoBadgeVariant(proyecto.estado)}>
          {proyectoEstadoLabel(proyecto.estado)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground">Prioridad</p>
          <p className="font-medium">{proyecto.prioridad === "URGENTE" ? "Urgente" : "Normal"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Avance total</p>
          <p className="font-medium">
            {completado}/{solicitado}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Tomado por</p>
          <p className="font-medium">{proyecto.tomadoPor || "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Orden de trabajo</p>
          {proyecto.ordenTrabajoId ? (
            <Link href={`/ordenes/${proyecto.ordenTrabajoId}`} className="font-medium text-primary hover:underline">
              {proyecto.numeroOrdenTrabajo}
            </Link>
          ) : (
            <p className="font-medium">Manual</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Modelos</h2>
        <Table compact>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead className="whitespace-nowrap text-right">Solicitado</TableHead>
              <TableHead className="whitespace-nowrap text-right">Completado</TableHead>
              <TableHead className="whitespace-nowrap text-right">Pendiente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proyecto.items.map((it) => (
              <TableRow key={it.id}>
                <TableCell className="font-medium">{it.modelo}</TableCell>
                <TableCell className="whitespace-nowrap text-right">{it.cantidadSolicitada}</TableCell>
                <TableCell className="whitespace-nowrap text-right">{it.cantidadCompletada}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {it.cantidadSolicitada - it.cantidadCompletada}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {proyecto.notas && <p className="text-sm text-muted-foreground">{proyecto.notas}</p>}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Historial de avances</h2>
        <Table compact>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Fecha</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead className="whitespace-nowrap text-right">Cantidad</TableHead>
              <TableHead>Operario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {avances.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Todavía no se cargó producción para este proyecto.
                </TableCell>
              </TableRow>
            )}
            {avances.map((a) => (
              <TableRow key={a._id.toString()}>
                <TableCell className="whitespace-nowrap">
                  {new Date(a.createdAt).toLocaleString("es-AR")}
                </TableCell>
                <TableCell className="font-medium">{a.modelo}</TableCell>
                <TableCell className="whitespace-nowrap text-right">{a.cantidad}</TableCell>
                <TableCell>{a.operario}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
