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
        <h1 className="text-2xl font-semibold">Reporte de Viajes</h1>
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
            <p className="text-sm text-muted-foreground">Total de viajes</p>
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
                  No hay viajes cargados en este mes.
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
        <p className="mb-2 text-sm font-medium">Por forma de pago (honorarios, materiales y extras)</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Forma de pago</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.byPaymentMode.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  No hay gastos de empleados, materiales o extras cargados en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.byPaymentMode.map((row) => (
              <TableRow key={row.paymentMode}>
                <TableCell className="font-medium">{row.paymentMode}</TableCell>
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
              <TableHead>Fechas</TableHead>
              <TableHead>Paga</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Excedente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.detail.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No hay viajes cargados en este mes.
                </TableCell>
              </TableRow>
            )}
            {report.detail.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.nombre}</TableCell>
                <TableCell>
                  {entry.fechaInicioISO === entry.fechaFinISO
                    ? formatDate(entry.fechaInicioISO)
                    : `${formatDate(entry.fechaInicioISO)} – ${formatDate(entry.fechaFinISO)}`}
                </TableCell>
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

      <div>
        <p className="mb-2 text-sm font-medium">Detalle completo por viaje</p>
        {report.viajes.length === 0 && (
          <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            No hay viajes cargados en este mes.
          </p>
        )}
        <div className="flex flex-col gap-4">
          {report.viajes.map((v) => (
            <div key={v.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <p className="font-semibold">{v.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.fechaInicioISO === v.fechaFinISO
                      ? formatDate(v.fechaInicioISO)
                      : `${formatDate(v.fechaInicioISO)} – ${formatDate(v.fechaFinISO)}`}
                    {v.paidBy ? ` · Paga: ${v.paidBy}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(v.totalAmount)}</p>
                  {v.excedente > 0 && (
                    <Badge variant="warning">Excedente: {formatCurrency(v.excedente)}</Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {v.empleados.length > 0 && (
                  <div className="rounded-lg bg-blue-50/50 p-3">
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Empleados</p>
                    <ul className="flex flex-col gap-1 text-sm">
                      {v.empleados.map((e, i) => (
                        <li key={i}>
                          {e.employeeName} —{" "}
                          {e.honorarioType === "DIA"
                            ? `${formatCurrency(e.monto)}/día x ${e.dias ?? 1} día(s)`
                            : formatCurrency(e.monto)}
                          {" = "}
                          {formatCurrency(e.montoTotal)}
                          {e.paymentMode ? ` (${e.paymentMode})` : ""}
                          {" — "}
                          {e.saldo <= 0 ? (
                            <Badge variant="success">Completado</Badge>
                          ) : (
                            <>Saldo: {formatCurrency(e.saldo)}</>
                          )}
                          {e.pagos.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {" "}
                              (pagos:{" "}
                              {e.pagos.map((p) => `${formatDate(p.fechaISO)} ${formatCurrency(p.monto)}`).join(", ")}
                              )
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {v.topesDiarios.length > 0 && (
                  <div className="rounded-lg bg-amber-50/50 p-3">
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                      Tope diario de viático
                    </p>
                    <div className="flex flex-col gap-2 text-sm">
                      {v.topesDiarios.map((t, i) => (
                        <div key={i}>
                          <p>
                            {t.employeeName} — importe {formatCurrency(t.monto)}/día —{" "}
                            {t.saldo < 0 ? (
                              <Badge variant="warning">Excedido en {formatCurrency(Math.abs(t.saldo))}</Badge>
                            ) : (
                              <>Saldo: {formatCurrency(t.saldo)}</>
                            )}
                          </p>
                          {t.gastos.length > 0 && (
                            <ul className="ml-4 list-disc">
                              {t.gastos.map((g, gi) => (
                                <li key={gi}>
                                  {g.descripcion} — {formatCurrency(g.monto)}
                                  {g.paymentMode ? ` (${g.paymentMode})` : ""}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {v.hospedaje && (v.hospedaje.lugar || v.hospedaje.total > 0) && (
                  <div className="rounded-lg bg-emerald-50/50 p-3">
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Hospedaje</p>
                    <p className="text-sm">
                      {v.hospedaje.lugar ?? "—"}
                      {v.hospedaje.checkInISO ? ` (${formatDate(v.hospedaje.checkInISO)}` : ""}
                      {v.hospedaje.checkOutISO ? ` – ${formatDate(v.hospedaje.checkOutISO)})` : v.hospedaje.checkInISO ? ")" : ""}
                      {" — "}
                      {formatCurrency(v.hospedaje.costoPorDia ?? 0)}/día x {v.hospedaje.cantidadDias ?? 0} día(s) ={" "}
                      {formatCurrency(v.hospedaje.total)}
                      {v.hospedaje.paidBy ? ` — paga ${v.hospedaje.paidBy}` : ""}
                    </p>
                  </div>
                )}

                {v.combustible && v.combustible.monto ? (
                  <div className="rounded-lg bg-orange-50/50 p-3">
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Combustible (EdenRed)</p>
                    <p className="text-sm">
                      {formatCurrency(v.combustible.monto)}
                      {v.combustible.paidBy ? ` — paga ${v.combustible.paidBy}` : ""}
                    </p>
                  </div>
                ) : null}

                {v.extras.length > 0 && (
                  <div className="rounded-lg bg-purple-50/50 p-3">
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Extras</p>
                    <ul className="flex flex-col gap-1 text-sm">
                      {v.extras.map((x, i) => (
                        <li key={i}>
                          {x.descripcion} — {formatCurrency(x.monto)}
                          {x.paymentMode ? ` (${x.paymentMode})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {v.materiales.length > 0 && (
                  <div className="rounded-lg bg-cyan-50/50 p-3">
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Materiales</p>
                    <ul className="flex flex-col gap-1 text-sm">
                      {v.materiales.map((m, i) => (
                        <li key={i}>
                          {m.descripcion} {m.cantidad ? `x${m.cantidad}` : ""} — {formatCurrency(m.monto)}
                          {m.paymentMode ? ` (${m.paymentMode})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {v.seguro && v.seguro.compania && (
                  <div className="rounded-lg bg-rose-50/50 p-3">
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Seguro</p>
                    <p className="text-sm">
                      {v.seguro.compania} — {v.seguro.cobertura} ({v.seguro.cantidadDias ?? 0} día(s),{" "}
                      {formatCurrency(v.seguro.costo ?? 0)})
                    </p>
                  </div>
                )}

                {v.notes && <p className="text-xs text-muted-foreground">Notas: {v.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}