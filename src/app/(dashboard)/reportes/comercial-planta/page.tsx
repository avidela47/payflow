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
import { getComercialPlantaReport, currentPeriodString } from "@/lib/reports";
import { presupuestoEstadoLabel, presupuestoEstadoBadgeVariant } from "@/lib/presupuesto-estados";
import { despachoEstadoLabel, despachoEstadoBadgeVariant } from "@/lib/despacho-estados";
import { requireModuleAccess, requireReportModules } from "@/lib/auth";

// Mismo criterio que Componentes/Luminarias/Presupuestos/Despachos/
// Recibos: estos 3 módulos cotizan en U$D, no en pesos — por eso acá se
// usa este formatUsd local en vez de formatCurrency (ARS) de lib/utils.
function formatUsd(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function ReporteComercialPlantaPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const session = await requireModuleAccess("reportes");
  await requireReportModules(session, ["presupuestos", "despachos", "recibos"]);

  const periodISO = searchParams.period || currentPeriodString();
  const report = await getComercialPlantaReport(periodISO);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reporte de Comercial Planta</h1>
        <p className="text-sm text-muted-foreground">
          Presupuestos, Despachos y Recibos del mes (Remito queda afuera: no mueve plata ni stock).
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
          <Link href={`/imprimir/reportes/comercial-planta?period=${periodISO}`} target="_blank">
            <Printer className="h-4 w-4" />
            Ver para imprimir / PDF
          </Link>
        </Button>
      </div>

      <p className="text-sm font-medium capitalize">{report.periodLabel}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Presupuestos</p>
            <p className="text-2xl font-semibold">U$D {formatUsd(report.presupuestos.totalUsd)}</p>
            <p className="text-xs text-muted-foreground">
              {report.presupuestos.totalCount} presupuesto(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Despachos</p>
            <p className="text-2xl font-semibold">U$D {formatUsd(report.despachos.montoUsd)}</p>
            <p className="text-xs text-muted-foreground">
              {report.despachos.totalCount} despacho(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Recibos</p>
            <p className="text-2xl font-semibold">U$D {formatUsd(report.recibos.totalUsd)}</p>
            <p className="text-xs text-muted-foreground">
              Cobrado U$D {formatUsd(report.recibos.totalCobradoUsd)} · Pendiente U$D{" "}
              {formatUsd(report.recibos.totalPendienteUsd)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium">Presupuestos por estado</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.presupuestos.byEstado.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Sin presupuestos en este mes.
                  </TableCell>
                </TableRow>
              )}
              {report.presupuestos.byEstado.map((row) => (
                <TableRow key={row.estado}>
                  <TableCell>
                    <Badge variant={presupuestoEstadoBadgeVariant(row.estado)}>
                      {presupuestoEstadoLabel(row.estado)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                  <TableCell className="text-right">U$D {formatUsd(row.totalUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Despachos por estado</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.despachos.byEstado.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Sin despachos en este mes.
                  </TableCell>
                </TableRow>
              )}
              {report.despachos.byEstado.map((row) => (
                <TableRow key={row.estado}>
                  <TableCell>
                    <Badge variant={despachoEstadoBadgeVariant(row.estado)}>
                      {despachoEstadoLabel(row.estado)}
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
        <p className="mb-2 text-sm font-medium">Detalle cronológico</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>N°</TableHead>
              <TableHead>Razón social</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Monto</TableHead>
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
                <TableCell>{entry.razonSocial}</TableCell>
                <TableCell>{entry.fechaISO}</TableCell>
                <TableCell>{entry.estado}</TableCell>
                <TableCell className="text-right">
                  {entry.montoUsd !== undefined ? `U$D ${formatUsd(entry.montoUsd)}` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
