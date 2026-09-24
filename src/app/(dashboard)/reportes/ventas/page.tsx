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

export default async function ReporteVentasPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  await requireModuleAccess("reportes");

  const periodISO = searchParams.period || currentPeriodString();
  const report = await getSalesReport(periodISO);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reporte de Ventas</h1>
        <p className="text-sm text-muted-foreground">
          Total del mes, estado de cobro y formas de pago utilizadas.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-border p-4">
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
            <p className="text-2xl font-semibold text-emerald-600">
              {formatCurrency(report.collectedAmount)}
            </p>
            <p className="text-xs text-muted-foreground">{report.collectedCount} venta(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Falta por cobrar</p>
            <p className="text-2xl font-semibold text-amber-600">
              {formatCurrency(report.pendingAmount)}
            </p>
            <p className="text-xs text-muted-foreground">{report.pendingCount} venta(s)</p>
          </CardContent>
        </Card>
      </div>

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

      <div>
        <p className="mb-2 text-sm font-medium">Detalle cronológico</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Forma de pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.detail.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No hay ventas cargadas en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.detail.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.clientName}</TableCell>
                <TableCell>{entry.saleDateISO}</TableCell>
                <TableCell>{entry.paymentMethod ?? "—"}</TableCell>
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