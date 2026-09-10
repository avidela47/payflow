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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatPeriod } from "@/lib/utils";
import { getFixedCostReport, currentPeriodString, periodStringToDate } from "@/lib/reports";

export default async function ReporteGastosPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const current = currentPeriodString();
  const fromISO = searchParams.from || current;
  const toISO = searchParams.to || current;
  const report = await getFixedCostReport(fromISO, toISO);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reporte de Gastos</h1>
        <p className="text-sm text-muted-foreground">
          Costos fijos por categoría y período, con el detalle de cada pago.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-border p-4">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="from">Desde</Label>
            <Input id="from" name="from" type="month" defaultValue={fromISO} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="to">Hasta</Label>
            <Input id="to" name="to" type="month" defaultValue={toISO} required />
          </div>
          <Button type="submit" variant="outline">
            Ver
          </Button>
        </form>

        <Button asChild variant="outline">
          <Link
            href={`/imprimir/reportes/gastos?from=${report.fromISO}&to=${report.toISO}`}
            target="_blank"
          >
            <Printer className="h-4 w-4" />
            Ver para imprimir / PDF
          </Link>
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          Resumen por categoría —{" "}
          <span className="capitalize">
            {formatPeriod(periodStringToDate(report.fromISO))} a{" "}
            {formatPeriod(periodStringToDate(report.toISO))}
          </span>
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoría</TableHead>
              {report.months.map((m) => (
                <TableHead key={m} className="whitespace-nowrap text-right capitalize">
                  {formatPeriod(periodStringToDate(m))}
                </TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.summary.length === 0 && (
              <TableRow>
                <TableCell colSpan={report.months.length + 2} className="text-center text-muted-foreground">
                  No hay gastos cargados en este rango.
                </TableCell>
              </TableRow>
            )}
            {report.summary.map((row) => (
              <TableRow key={row.categoryId}>
                <TableCell className="font-medium">{row.categoryName}</TableCell>
                {report.months.map((m) => (
                  <TableCell key={m} className="text-right">
                    {row.amountsByPeriod[m] ? formatCurrency(row.amountsByPeriod[m]) : "—"}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium">
                  {formatCurrency(row.total)}
                </TableCell>
              </TableRow>
            ))}
            {report.summary.length > 0 && (
              <TableRow className="border-t-2 border-border bg-muted/40 hover:bg-muted/40">
                <TableCell className="font-semibold">Total</TableCell>
                {report.months.map((m) => (
                  <TableCell key={m} className="text-right font-semibold">
                    {formatCurrency(report.summaryTotalsByPeriod[m] ?? 0)}
                  </TableCell>
                ))}
                <TableCell className="text-right font-semibold">
                  {formatCurrency(report.grandTotal)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Detalle cronológico</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoría</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Forma de pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.detail.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No hay gastos cargados en este rango.
                </TableCell>
              </TableRow>
            )}
            {report.detail.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.categoryName}</TableCell>
                <TableCell className="capitalize">{entry.periodLabel}</TableCell>
                <TableCell>{entry.paymentMode ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={entry.paid ? "success" : "default"}>
                    {entry.paid ? "Pagado" : "Pendiente"}
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