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
import { getCheckReport, currentPeriodString } from "@/lib/reports";
import { requireModuleAccess } from "@/lib/auth";
import type { CheckStatus, CheckType, CheckDirection } from "@/models/Check";

const DIRECTION_LABELS: Record<CheckDirection, string> = {
  RECIBIDO: "Recibido",
  EMITIDO: "Emitido",
};

// Mismo campo de datos (`issuerName`), significado distinto según
// dirección: en RECIBIDO es el librador que nos dio el cheque (emisor);
// en EMITIDO es a quién ITELSA se lo entregó (beneficiario).
const PARTY_LABEL_BY_DIRECTION: Record<CheckDirection, string> = {
  RECIBIDO: "Emisor",
  EMITIDO: "Beneficiario",
};

const DIRECTION_BADGE_VARIANT: Record<CheckDirection, "primary" | "default"> = {
  RECIBIDO: "primary",
  EMITIDO: "default",
};

const STATUS_LABELS: Record<CheckStatus, string> = {
  ACTIVO: "Activo",
  COBRADO: "Cobrado",
  ENDOSADO: "Endosado",
  DEPOSITADO: "Depositado",
  CADUCADO: "Caducado",
  OTRO: "Otro",
};

const STATUS_BADGE_VARIANT: Record<CheckStatus, "success" | "default" | "destructive" | "warning"> = {
  ACTIVO: "default",
  COBRADO: "success",
  ENDOSADO: "default",
  DEPOSITADO: "success",
  CADUCADO: "destructive",
  OTRO: "default",
};

// Colores para la barra de composición por estado (distintos entre sí,
// a diferencia de STATUS_BADGE_VARIANT que agrupa varios estados bajo
// el mismo variant de Badge).
const STATUS_BAR_COLOR: Record<CheckStatus, string> = {
  ACTIVO: "bg-warning",
  COBRADO: "bg-success",
  ENDOSADO: "bg-violet",
  DEPOSITADO: "bg-primary",
  CADUCADO: "bg-destructive",
  OTRO: "bg-border",
};

const TYPE_LABELS: Record<CheckType, string> = {
  ELECTRONICO: "E-cheq",
  FISICO: "Físico",
};

export default async function ReporteChequesPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  await requireModuleAccess("reportes");

  const periodISO = searchParams.period || currentPeriodString();
  const report = await getCheckReport(periodISO);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reporte de Cheques</h1>
        <p className="text-sm text-muted-foreground">
          Cheques con vencimiento (fecha de pago) en el mes, por estado y tipo.
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
          <Link href={`/imprimir/reportes/cheques?period=${periodISO}`} target="_blank">
            <Printer className="h-4 w-4" />
            Ver para imprimir / PDF
          </Link>
        </Button>
      </div>

      <p className="text-sm font-medium capitalize">{report.periodLabel}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total del mes</p>
            <p className="text-2xl font-semibold">{formatCurrency(report.totalAmount)}</p>
            <p className="text-xs text-muted-foreground">{report.totalCount} cheque(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Activos (todavía sin cobrar/depositar)</p>
            <p className="text-2xl font-semibold text-warning">
              {formatCurrency(report.byStatus.find((s) => s.status === "ACTIVO")?.amount ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {report.byStatus.find((s) => s.status === "ACTIVO")?.count ?? 0} cheque(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {report.totalAmount > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="mb-3 text-sm font-medium">Recibidos vs. Emitidos</p>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              {report.byDirection.map((row) => (
                <div
                  key={row.direction}
                  className={row.direction === "RECIBIDO" ? "h-full bg-primary" : "h-full bg-violet"}
                  style={{ width: `${(row.amount / report.totalAmount) * 100}%` }}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              {report.byDirection.map((row) => (
                <span key={row.direction} className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      row.direction === "RECIBIDO" ? "bg-primary" : "bg-violet"
                    }`}
                  />
                  {DIRECTION_LABELS[row.direction]} — {formatCurrency(row.amount)} ({row.count})
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {report.totalAmount > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="mb-3 text-sm font-medium">Composición por estado</p>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              {report.byStatus.map((row) => (
                <div
                  key={row.status}
                  className={`h-full ${STATUS_BAR_COLOR[row.status]}`}
                  style={{ width: `${(row.amount / report.totalAmount) * 100}%` }}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              {report.byStatus.map((row) => (
                <span key={row.status} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${STATUS_BAR_COLOR[row.status]}`} />
                  {STATUS_LABELS[row.status]}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">Por estado</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.byStatus.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No hay cheques con vencimiento en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.byStatus.map((row) => (
              <TableRow key={row.status}>
                <TableCell className="font-medium">
                  <Badge variant={STATUS_BADGE_VARIANT[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                </TableCell>
                <TableCell className="text-right">{row.count}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Por tipo</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.byType.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No hay cheques con vencimiento en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.byType.map((row) => (
              <TableRow key={row.type}>
                <TableCell className="font-medium">{TYPE_LABELS[row.type]}</TableCell>
                <TableCell className="text-right">{row.count}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Detalle cronológico</p>
        <Table compact>
          <TableHeader>
            <TableRow>
              <TableHead>Dirección</TableHead>
              <TableHead>Emisor / Beneficiario</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>N° cheque</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.detail.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No hay cheques con vencimiento en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.detail.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Badge variant={DIRECTION_BADGE_VARIANT[entry.direction]}>
                    {DIRECTION_LABELS[entry.direction]}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  <div>{entry.issuerName}</div>
                  <div className="text-xs text-muted-foreground">
                    {PARTY_LABEL_BY_DIRECTION[entry.direction]}
                  </div>
                </TableCell>
                <TableCell>{TYPE_LABELS[entry.type]}</TableCell>
                <TableCell>{entry.checkNumber}</TableCell>
                <TableCell>{entry.paymentDateISO}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE_VARIANT[entry.status]}>
                    {STATUS_LABELS[entry.status]}
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