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
import { getReparacionesReport, currentPeriodString } from "@/lib/reports";
import { reparacionEstadoLabel, reparacionEstadoBadgeVariant } from "@/lib/reparacion-estados";
import { requireModuleAccess, requireReportModules } from "@/lib/auth";

export default async function ReporteReparacionesPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const session = await requireModuleAccess("reportes");
  await requireReportModules(session, ["reparaciones"]);

  const periodISO = searchParams.period || currentPeriodString();
  const report = await getReparacionesReport(periodISO);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reporte de Reparaciones</h1>
        <p className="text-sm text-muted-foreground">
          Reparaciones del mes, por estado, y Componentes descontados al ejecutarlas.
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
          <Link href={`/imprimir/reportes/reparaciones?period=${periodISO}`} target="_blank">
            <Printer className="h-4 w-4" />
            Ver para imprimir / PDF
          </Link>
        </Button>
      </div>

      <p className="text-sm font-medium capitalize">{report.periodLabel}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Reparaciones cargadas</p>
            <p className="text-2xl font-semibold">{report.creadasCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Ejecutadas (Listas) en el mes</p>
            <p className="text-2xl font-semibold text-success">{report.ejecutadasCount}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Por estado</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.byEstado.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  Sin reparaciones en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.byEstado.map((row) => (
              <TableRow key={row.estado}>
                <TableCell>
                  <Badge variant={reparacionEstadoBadgeVariant(row.estado)}>
                    {reparacionEstadoLabel(row.estado)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{row.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Componentes descontados (reparaciones ejecutadas)</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.componentesDescontados.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Sin componentes descontados en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.componentesDescontados.map((row) => (
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
              <TableHead>N°</TableHead>
              <TableHead>Razón social</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Tomada por</TableHead>
              <TableHead>Ejecutada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.detail.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No hay reparaciones en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.detail.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.numero}</TableCell>
                <TableCell>{entry.razonSocial}</TableCell>
                <TableCell>{entry.fechaISO}</TableCell>
                <TableCell>
                  <Badge variant={reparacionEstadoBadgeVariant(entry.estado)}>
                    {reparacionEstadoLabel(entry.estado)}
                  </Badge>
                </TableCell>
                <TableCell>{entry.tomadoPor || "—"}</TableCell>
                <TableCell>{entry.fechaEjecucionISO ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
