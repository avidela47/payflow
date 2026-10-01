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

// Rediseño (vuelta a neutro, igual que Dashboard/Sidebar): antes cada
// reporte tenía su propio color (primary/violet/success/warning/
// destructive) solo para diferenciarse a simple vista — pero usar tokens
// de estado (success, warning, destructive) como paleta decorativa es
// justo lo que se dejó de hacer: ningún reporte está "vencido" o
// "aprobado", así que no correspondía ese color. Ahora las 5 tarjetas
// comparten el mismo acento (primary); se distinguen por ícono y texto,
// no por color.
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
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
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
          <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="font-semibold">Compras</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Por mes: total, pagadas/pendientes, formas de pago y estado de recepción.
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/reportes/sueldos" className="group">
          <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="font-semibold">Sueldos</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Por período: Monotributo, Registrado e Informal/Viáticos, por empleado.
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/reportes/gastos" className="group">
          <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="font-semibold">Costos Fijos / Gastos</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Por rango de meses: resumen por categoría y detalle cronológico.
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/reportes/cheques" className="group">
          <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Landmark className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="font-semibold">Cheques</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Por mes de vencimiento: totales por estado y por tipo.
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}