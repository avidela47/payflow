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
import { getPurchasesReport, currentPeriodString } from "@/lib/reports";
import type { PurchaseReceiptStatus } from "@/models/Purchase";

const RECEIPT_STATUS_LABELS: Record<PurchaseReceiptStatus, string> = {
  EN_CURSO: "En curso",
  RECIBIDA_PARCIAL: "Recibida parcial",
  RECIBIDA_TOTAL: "Recibida total",
};

export default async function ReporteComprasPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const periodISO = searchParams.period || currentPeriodString();
  const report = await getPurchasesReport(periodISO);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reporte de Compras</h1>
        <p className="text-sm text-muted-foreground">
          Total del mes, estado de pago, formas de pago y estado de recepción.
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
          <Link href={`/imprimir/reportes/compras?period=${periodISO}`} target="_blank">
            <Printer className="h-4 w-4" />
            Ver para imprimir / PDF
          </Link>
        </Button>
      </div>

      <p className="text-sm font-medium capitalize">{report.periodLabel}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total de compras</p>
            <p className="text-2xl font-semibold">{formatCurrency(report.totalAmount)}</p>
            <p className="text-xs text-muted-foreground">{report.totalCount} compra(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pagadas</p>
            <p className="text-2xl font-semibold text-emerald-600">
              {formatCurrency(report.paidAmount)}
            </p>
            <p className="text-xs text-muted-foreground">{report.paidCount} compra(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Falta por pagar</p>
            <p className="text-2xl font-semibold text-amber-600">
              {formatCurrency(report.pendingAmount)}
            </p>
            <p className="text-xs text-muted-foreground">{report.pendingCount} compra(s)</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Estado de recepción del mes</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.byReceiptStatus.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No hay compras cargadas en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.byReceiptStatus.map((row) => (
              <TableRow key={row.status}>
                <TableCell className="font-medium">{RECEIPT_STATUS_LABELS[row.status]}</TableCell>
                <TableCell className="text-right">{row.count}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
                  No hay compras cargadas en este mes.
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
              <TableHead>Proveedor</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Forma de pago</TableHead>
              <TableHead>Recepción</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.detail.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No hay compras cargadas en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.detail.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.providerName}</TableCell>
                <TableCell>{entry.purchaseDateISO}</TableCell>
                <TableCell>{entry.paymentMethod ?? "—"}</TableCell>
                <TableCell>{RECEIPT_STATUS_LABELS[entry.receiptStatus]}</TableCell>
                <TableCell>
                  <Badge variant={entry.paid ? "success" : "default"}>
                    {entry.paid ? "Pagada" : "Pendiente"}
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