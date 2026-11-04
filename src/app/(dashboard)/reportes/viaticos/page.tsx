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
import { getViaticosReport, currentPeriodString } from "@/lib/reports";
import { requireModuleAccess } from "@/lib/auth";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(y, m - 1, d)
  );
}

export default async function ReporteViaticosPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  await requireModuleAccess("reportes");

  const periodISO = searchParams.period || currentPeriodString();
  const report = await getViaticosReport(periodISO);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reporte de Viáticos</h1>
        <p className="text-sm text-muted-foreground">
          Total del mes por categoría (honorarios, hospedaje, combustible, extras, materiales, seguro) y excedente.
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
          <Link href={`/imprimir/reportes/viaticos?period=${periodISO}`} target="_blank">
            <Printer className="h-4 w-4" />
            Ver para imprimir / PDF
          </Link>
        </Button>
      </div>

      <p className="text-sm font-medium capitalize">{report.periodLabel}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total de viáticos</p>
            <p className="text-2xl font-semibold">{formatCurrency(report.totalAmount)}</p>
            <p className="text-xs text-muted-foreground">{report.totalCount} viaje(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Excedente de viáticos</p>
            <p className="text-2xl font-semibold text-warning">
              {formatCurrency(report.totalExcedente)}
            </p>
            <p className="text-xs text-muted-foreground">Ya incluido dentro del total, no se suma aparte</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Categorías con gasto</p>
            <p className="text-2xl font-semibold">{report.byCategory.length}</p>
            <p className="text-xs text-muted-foreground">de 6 posibles</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Por categoría del mes</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.byCategory.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  No hay viáticos cargados en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.byCategory.map((row) => (
              <TableRow key={row.categoria}>
                <TableCell className="font-medium">{row.categoria}</TableCell>
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
              <TableHead>Viaje</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Paga</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Excedente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.detail.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No hay viáticos cargados en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.detail.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.nombre}</TableCell>
                <TableCell>{formatDate(entry.fechaISO)}</TableCell>
                <TableCell>{entry.paidBy ?? "—"}</TableCell>
                <TableCell className="text-right">{formatCurrency(entry.totalAmount)}</TableCell>
                <TableCell className="text-right">
                  {entry.excedente > 0 ? (
                    <Badge variant="warning">{formatCurrency(entry.excedente)}</Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}