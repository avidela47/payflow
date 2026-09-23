import Link from "next/link";
import { Wallet, Receipt, TrendingUp, ShoppingCart, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function ReportesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Reportes para imprimir o exportar a PDF, con el encabezado de la empresa.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/reportes/ventas">
          <Card className="transition-colors hover:border-primary">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-md bg-primary/10 p-3">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Ventas</p>
                <p className="text-sm text-muted-foreground">
                  Por mes: total, cobradas/pendientes y formas de pago.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/reportes/compras">
          <Card className="transition-colors hover:border-primary">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-md bg-primary/10 p-3">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Compras</p>
                <p className="text-sm text-muted-foreground">
                  Por mes: total, pagadas/pendientes, formas de pago y estado de recepción.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/reportes/sueldos">
          <Card className="transition-colors hover:border-primary">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-md bg-primary/10 p-3">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Sueldos</p>
                <p className="text-sm text-muted-foreground">
                  Por período: Monotributo, Registrado e Informal/Viáticos, por empleado.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/reportes/gastos">
          <Card className="transition-colors hover:border-primary">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-md bg-primary/10 p-3">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Costos Fijos / Gastos</p>
                <p className="text-sm text-muted-foreground">
                  Por rango de meses: resumen por categoría y detalle cronológico.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}