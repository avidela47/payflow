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
import { formatCurrency } from "@/lib/utils";
import { getSalesReport, currentPeriodString } from "@/lib/reports";
import { requireModuleAccess } from "@/lib/auth";

function channelLabel(channel: "OFICINA" | "MERCADO_LIBRE"): string {
  return channel === "MERCADO_LIBRE" ? "Mercado Libre" : "Oficina";
}

export default async function ReporteVentasPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  await requireModuleAccess("reportes");

  const periodISO = searchParams.period || currentPeriodString();
  const report = await getSalesReport(periodISO);

  const hasChannelData =
    report.channelBreakdown.mercadoLibre.count > 0 || report.channelBreakdown.oficina.count > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reporte de Ventas</h1>
        <p className="text-sm text-muted-foreground">
          Total del mes, estado de cobro y formas de pago utilizadas.
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
          <Link href={`/imprimir/reportes/ventas?period=${periodISO}`} target="_blank">
            <Printer className="h-4 w-4" />
            Ver para imprimir / PDF
          </Link>
        </Button>
      </div>

      <p className="text-sm font-medium capitalize">{report.periodLabel}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total de ventas</p>
            <p className="text-2xl font-semibold">{formatCurrency(report.totalAmount)}</p>
            <p className="text-xs text-muted-foreground">{report.totalCount} venta(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Cobradas</p>
            <p className="text-2xl font-semibold text-success">
              {formatCurrency(report.collectedAmount)}
            </p>
            <p className="text-xs text-muted-foreground">{report.collectedCount} venta(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Falta por cobrar</p>
            <p className="text-2xl font-semibold text-warning">
              {formatCurrency(report.pendingAmount)}
            </p>
            <p className="text-xs text-muted-foreground">{report.pendingCount} venta(s)</p>
          </CardContent>
        </Card>
      </div>

      {report.totalAmount > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm">
              <p className="font-medium">Cobro del mes</p>
              <p className="text-muted-foreground">
                {Math.round((report.collectedAmount / report.totalAmount) * 100)}% cobrado
              </p>
            </div>
            <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-success"
                style={{ width: `${(report.collectedAmount / report.totalAmount) * 100}%` }}
              />
              <div
                className="h-full bg-warning"
                style={{ width: `${(report.pendingAmount / report.totalAmount) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">Formas de pago del mes</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Forma de pago</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.byPaymentMethod.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No hay ventas cargadas en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.byPaymentMethod.map((row) => (
              <TableRow key={row.method}>
                <TableCell className="font-medium">{row.method}</TableCell>
                <TableCell className="text-right">{row.count}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hasChannelData && (
        <div>
          <p className="mb-2 text-sm font-medium">Desglose por canal</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {report.channelBreakdown.mercadoLibre.count > 0 && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="mb-2 text-sm font-medium">
                  Mercado Libre ({report.channelBreakdown.mercadoLibre.count} venta(s))
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Bruto</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(report.channelBreakdown.mercadoLibre.grossAmount)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Comisión ML</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(report.channelBreakdown.mercadoLibre.totalCommission)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Envío</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(report.channelBreakdown.mercadoLibre.totalShipping)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Impuestos</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(report.channelBreakdown.mercadoLibre.totalTaxes)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Precio neto real</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(report.channelBreakdown.mercadoLibre.netAmount)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {report.channelBreakdown.oficina.count > 0 && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="mb-2 text-sm font-medium">
                  Oficina ({report.channelBreakdown.oficina.count} venta(s))
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Bruto</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(report.channelBreakdown.oficina.grossAmount)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Ganancia</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(report.channelBreakdown.oficina.totalProfit)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>IIBB</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(report.channelBreakdown.oficina.totalIibb)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>IVA</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(report.channelBreakdown.oficina.totalIva)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Otros</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(report.channelBreakdown.oficina.totalOther)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Costo neto</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(report.channelBreakdown.oficina.netCostAmount)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">Detalle cronológico</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Forma de pago</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.detail.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No hay ventas cargadas en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.detail.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.clientName}</TableCell>
                <TableCell>{entry.saleDateISO}</TableCell>
                <TableCell>{entry.paymentMethod ?? "—"}</TableCell>
                <TableCell>{channelLabel(entry.channel)}</TableCell>
                <TableCell>
                  <Badge variant={entry.collected ? "success" : "default"}>
                    {entry.collected ? "Cobrada" : "Pendiente"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(entry.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}