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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { getPayrollReport, currentPeriodString } from "@/lib/reports";

export default async function ReporteSueldosPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const periodISO = searchParams.period || currentPeriodString();
  const report = await getPayrollReport(periodISO);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reporte de Sueldos</h1>
        <p className="text-sm text-muted-foreground">
          Desglose por empleado de Monotributo, Registrado e Informal/Viáticos.
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
          <Link href={`/imprimir/reportes/sueldos?period=${periodISO}`} target="_blank">
            <Printer className="h-4 w-4" />
            Ver para imprimir / PDF
          </Link>
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium capitalize">{report.periodLabel}</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empleado</TableHead>
              <TableHead className="text-right">Monotributo</TableHead>
              <TableHead className="text-right">Registrado</TableHead>
              <TableHead className="text-right">Informal / Viáticos</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No hay liquidaciones cargadas para este período.
                </TableCell>
              </TableRow>
            )}
            {report.rows.map((row) => (
              <TableRow key={row.employeeId}>
                <TableCell className="font-medium">{row.employeeName}</TableCell>
                <TableCell className="text-right">
                  {row.monotributo > 0 ? formatCurrency(row.monotributo) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {row.registrado > 0 ? formatCurrency(row.registrado) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {row.informal > 0 ? formatCurrency(row.informal) : "—"}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(row.total)}
                </TableCell>
              </TableRow>
            ))}
            {report.rows.length > 0 && (
              <TableRow className="border-t-2 border-border bg-muted/40 hover:bg-muted/40">
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(report.totals.monotributo)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(report.totals.registrado)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(report.totals.informal)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(report.totals.total)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}