import Link from "next/link";
import {
  Wallet,
  Receipt,
  TrendingUp,
  ShoppingCart,
  Landmark,
  ArrowRight,
  FileBarChart,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { requireModuleAccess } from "@/lib/auth";

export default async function ReportesPage() {
  await requireModuleAccess("reportes");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <FileBarChart className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Reportes para imprimir o exportar a PDF, con el encabezado de la empresa.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/reportes/ventas" className="group">
          <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md shadow-primary/25">
                <TrendingUp className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="font-semibold">Ventas</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Por mes: total, cobradas/pendientes y formas de pago.
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/reportes/compras" className="group">
          <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-violet/40 hover:shadow-lg hover:shadow-violet/5">
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet to-violet/70 shadow-md shadow-violet/25">
                <ShoppingCart className="h-6 w-6 text-violet-foreground" />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="font-semibold">Compras</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Por mes: total, pagadas/pendientes, formas de pago y estado de recepción.
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-violet" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/reportes/sueldos" className="group">
          <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-success/40 hover:shadow-lg hover:shadow-success/5">
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-success to-success/70 shadow-md shadow-success/25">
                <Wallet className="h-6 w-6 text-success-foreground" />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="font-semibold">Sueldos</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Por período: Monotributo, Registrado e Informal/Viáticos, por empleado.
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-success" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/reportes/gastos" className="group">
          <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-warning/40 hover:shadow-lg hover:shadow-warning/5">
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-warning to-warning/70 shadow-md shadow-warning/25">
                <Receipt className="h-6 w-6 text-warning-foreground" />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="font-semibold">Costos Fijos / Gastos</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Por rango de meses: resumen por categoría y detalle cronológico.
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-warning" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/reportes/cheques" className="group">
          <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-destructive/40 hover:shadow-lg hover:shadow-destructive/5">
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-destructive to-destructive/70 shadow-md shadow-destructive/25">
                <Landmark className="h-6 w-6 text-destructive-foreground" />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="font-semibold">Cheques</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Por mes de vencimiento: totales por estado y por tipo.
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-destructive" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}