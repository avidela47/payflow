import Link from "next/link";
import { Printer } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getProduccionReport, currentPeriodString } from "@/lib/reports";
import { ordenTrabajoEstadoLabel, ordenTrabajoEstadoBadgeVariant } from "@/lib/orden-trabajo-estados";
import { proyectoEstadoLabel, proyectoEstadoBadgeVariant } from "@/lib/proyecto-estados";
import { requireModuleAccess, requireReportModules } from "@/lib/auth";

export default async function ReporteProduccionPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const session = await requireModuleAccess("reportes");
  await requireReportModules(session, ["ordenes", "proyectos", "fabricar"]);

  const periodISO = searchParams.period || currentPeriodString();
  const report = await getProduccionReport(periodISO);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reporte de Producción</h1>
        <p className="text-sm text-muted-foreground">
          Órdenes de Trabajo, Proyectos de fábrica y Fabricar del mes.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <form method="GET" className="flex items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period">Período</Label>
            <Input id="period" name="period" type="month" defaultValue={periodISO} required />
          </div>
          <Button type="submit" variant="outline">
            Ver
          </Button>
        </form>

        <Button asChild variant="outline">
          <Link href={`/imprimir/reportes/produccion?period=${periodISO}`} target="_blank">
            <Printer className="h-4 w-4" />
            Ver para imprimir / PDF
          </Link>
        </Button>
      </div>

      <p className="text-sm font-medium capitalize">{report.periodLabel}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Órdenes de Trabajo</p>
            <p className="text-2xl font-semibold">{report.ordenesTrabajo.creadasCount}</p>
            <p className="text-xs text-muted-foreground">
              {report.ordenesTrabajo.ejecutadasCount} ejecutada(s) en el mes
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Proyectos de fábrica</p>
            <p className="text-2xl font-semibold">{report.proyectos.creadosCount}</p>
            <p className="text-xs text-muted-foreground">
              {report.proyectos.listosCount} listo(s) en el mes
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Fabricación</p>
            <p className="text-2xl font-semibold">{report.fabricacion.totalCantidadFabricada}</p>
            <p className="text-xs text-muted-foreground">
              {report.fabricacion.totalTandas} tanda(s)
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium">Órdenes de Trabajo por estado</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.ordenesTrabajo.byEstado.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Sin órdenes de trabajo en este mes.
                  </TableCell>
                </TableRow>
              )}
              {report.ordenesTrabajo.byEstado.map((row) => (
                <TableRow key={row.estado}>
                  <TableCell>
                    <Badge variant={ordenTrabajoEstadoBadgeVariant(row.estado)}>
                      {ordenTrabajoEstadoLabel(row.estado)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Proyectos por estado</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.proyectos.byEstado.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Sin proyectos en este mes.
                  </TableCell>
                </TableRow>
              )}
              {report.proyectos.byEstado.map((row) => (
                <TableRow key={row.estado}>
                  <TableCell>
                    <Badge variant={proyectoEstadoBadgeVariant(row.estado)}>
                      {proyectoEstadoLabel(row.estado)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Componentes consumidos en fabricación</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.fabricacion.componentesConsumidos.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Sin fabricación en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.fabricacion.componentesConsumidos.map((row) => (
              <TableRow key={row.codigoComponente}>
                <TableCell className="font-medium">{row.codigoComponente}</TableCell>
                <TableCell>{row.descripcionComponente}</TableCell>
                <TableCell className="text-right">{row.cantidad}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Detalle cronológico</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>N°</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.detail.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No hay movimientos en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.detail.map((entry) => (
              <TableRow key={`${entry.tipo}-${entry.id}`}>
                <TableCell>{entry.tipo}</TableCell>
                <TableCell className="font-medium">{entry.numero}</TableCell>
                <TableCell>{entry.descripcion}</TableCell>
                <TableCell>{entry.fechaISO}</TableCell>
                <TableCell>{entry.estado ?? "—"}</TableCell>
                <TableCell className="text-right">{entry.cantidad ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
