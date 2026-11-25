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
import { getStockReport, currentPeriodString } from "@/lib/reports";
import { luminariaOrigenLabel, luminariaOrigenBadgeVariant } from "@/lib/luminaria-origen";
import {
  movimientoComponenteTipoLabel,
  movimientoComponenteTipoBadgeVariant,
} from "@/lib/movimiento-componente-tipos";
import { requireModuleAccess, requireReportModules } from "@/lib/auth";

// Mismo criterio que Componentes/Luminarias: cotizan en U$D, no en pesos.
function formatUsd(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function ReporteStockPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const session = await requireModuleAccess("reportes");
  await requireReportModules(session, ["componentes", "luminarias"]);

  // El catálogo (stock, valorización, bajo mínimo) es siempre el estado EN
  // VIVO, no una foto del mes elegido — ver comentario en lib/reports.ts,
  // getStockReport. El período solo filtra la tabla de Movimientos.
  const periodISO = searchParams.period || currentPeriodString();
  const report = await getStockReport(periodISO);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reporte de Stock</h1>
        <p className="text-sm text-muted-foreground">
          Componentes y Luminarias bajo mínimo, valorización actual y movimientos de Componentes
          del mes.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <form method="GET" className="flex items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period">Período (movimientos)</Label>
            <Input id="period" name="period" type="month" defaultValue={periodISO} required />
          </div>
          <Button type="submit" variant="outline">
            Ver
          </Button>
        </form>

        <Button asChild variant="outline">
          <Link href={`/imprimir/reportes/stock?period=${periodISO}`} target="_blank">
            <Printer className="h-4 w-4" />
            Ver para imprimir / PDF
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Componentes</p>
            <p className="text-2xl font-semibold">U$D {formatUsd(report.componentes.valorizacionTotalUsd)}</p>
            <p className="text-xs text-muted-foreground">
              {report.componentes.totalCount} código(s) · {report.componentes.bajoMinimo.length} bajo mínimo
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Luminarias</p>
            <p className="text-2xl font-semibold">U$D {formatUsd(report.luminarias.valorizacionTotalUsd)}</p>
            <p className="text-xs text-muted-foreground">
              {report.luminarias.totalCount} código(s) · {report.luminarias.bajoMinimo.length} bajo mínimo
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Componentes bajo stock mínimo</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Stock actual</TableHead>
              <TableHead className="text-right">Stock mínimo</TableHead>
              <TableHead className="text-right">Valorización</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.componentes.bajoMinimo.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Ningún componente está bajo su stock mínimo.
                </TableCell>
              </TableRow>
            )}
            {report.componentes.bajoMinimo.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.codigo}</TableCell>
                <TableCell>{row.descripcion}</TableCell>
                <TableCell className="text-right text-warning">{row.stockActual}</TableCell>
                <TableCell className="text-right">{row.stockMinimo}</TableCell>
                <TableCell className="text-right">U$D {formatUsd(row.valorizacionUsd)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Luminarias bajo stock mínimo</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead className="text-right">Stock actual</TableHead>
              <TableHead className="text-right">Stock mínimo</TableHead>
              <TableHead className="text-right">Valorización</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.luminarias.bajoMinimo.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Ninguna luminaria está bajo su stock mínimo.
                </TableCell>
              </TableRow>
            )}
            {report.luminarias.bajoMinimo.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.codigo}</TableCell>
                <TableCell>{row.descripcion}</TableCell>
                <TableCell>
                  <Badge variant={luminariaOrigenBadgeVariant(row.origen)}>
                    {luminariaOrigenLabel(row.origen)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-warning">{row.stockActual}</TableCell>
                <TableCell className="text-right">{row.stockMinimo}</TableCell>
                <TableCell className="text-right">U$D {formatUsd(row.valorizacionUsd)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Movimientos de Componentes del mes</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Stock resultante</TableHead>
              <TableHead>Referencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.movimientos.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Sin movimientos de Componentes en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.movimientos.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.fechaISO}</TableCell>
                <TableCell className="font-medium">{m.codigoComponente}</TableCell>
                <TableCell>{m.descripcionComponente}</TableCell>
                <TableCell>
                  <Badge variant={movimientoComponenteTipoBadgeVariant(m.tipo)}>
                    {movimientoComponenteTipoLabel(m.tipo)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{m.cantidad}</TableCell>
                <TableCell className="text-right">{m.stockResultante}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{m.referencia || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
