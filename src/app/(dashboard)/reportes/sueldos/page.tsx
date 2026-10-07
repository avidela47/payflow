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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { getPayrollReport, currentPeriodString } from "@/lib/reports";
import { requireModuleAccess } from "@/lib/auth";

export default async function ReporteSueldosPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  await requireModuleAccess("reportes");

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
          <Link href={`/imprimir/reportes/sueldos?period=${periodISO}`} target="_blank">
            <Printer className="h-4 w-4" />
            Ver para imprimir / PDF
          </Link>
        </Button>
      </div>

      <p className="text-sm font-medium capitalize">{report.periodLabel}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total del período</p>
            <p className="text-2xl font-semibold">{formatCurrency(report.totals.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Monotributo</p>
            <p className="text-2xl font-semibold text-violet">
              {formatCurrency(report.totals.monotributo)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Registrado</p>
            <p className="text-2xl font-semibold text-primary">
              {formatCurrency(report.totals.registrado)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Informal / Viáticos</p>
            <p className="text-2xl font-semibold text-success">
              {formatCurrency(report.totals.informal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {report.totals.total > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="mb-3 text-sm font-medium">Composición del período</p>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-violet"
                style={{ width: `${(report.totals.monotributo / report.totals.total) * 100}%` }}
              />
              <div
                className="h-full bg-primary"
                style={{ width: `${(report.totals.registrado / report.totals.total) * 100}%` }}
              />
              <div
                className="h-full bg-success"
                style={{ width: `${(report.totals.informal / report.totals.total) * 100}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-violet" /> Monotributo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> Registrado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" /> Informal / Viáticos
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
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