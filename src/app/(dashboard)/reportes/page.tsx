import Link from "next/link";
import {
  Wallet,
  Receipt,
  TrendingUp,
  ShoppingCart,
  Landmark,
  ArrowRight,
  FileBarChart,
  Plane,
  Building2,
  Factory,
  Wrench,
  Boxes,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { requireModuleAccess } from "@/lib/auth";
import type { RestrictableModule } from "@/models/User";

// Rediseño (vuelta a neutro, igual que Dashboard/Sidebar): antes cada
// reporte tenía su propio color (primary/violet/success/warning/
// destructive) solo para diferenciarse a simple vista — pero usar tokens
// de estado (success, warning, destructive) como paleta decorativa es
// justo lo que se dejó de hacer: ningún reporte está "vencido" o
// "aprobado", así que no correspondía ese color. Ahora las 5 tarjetas
// comparten el mismo acento (primary); se distinguen por ícono y texto,
// no por color.
//
// Filtrado por módulo (2026-11-25, pedido de Ariel: "reportes de acuerdo a
// sus módulos" para Cristian/Fabio/Pajarito): hasta acá, tener acceso al
// módulo "reportes" mostraba las 10 tarjetas sin importar qué otros
// módulos tenga restringidos ese usuario — alguien sin acceso a Finanzas
// igual veía el reporte de Sueldos. Mismo criterio que ya usa el Dashboard
// con sus tarjetas/KPIs: cada reporte declara de qué módulo(s) depende
// (moduleKeys: null = siempre visible, sin ningún moduleKey del que
// depender) y se oculta si falta acceso a CUALQUIERA de ellos — algunos
// reportes cruzan más de un módulo (ej. Stock mezcla Componentes de
// Producción y Luminarias de Stock).
// 2026-11-26: Ventas/Compras (sección COMERCIAL) pasaron a ser
// restringibles (antes eran siempre visibles, ver RESTRICTABLE_MODULES en
// models/User.ts) — sus tarjetas de reporte ya no son moduleKeys: null.
type ReportCard = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  moduleKeys: RestrictableModule[] | null;
};

const REPORT_CARDS: ReportCard[] = [
  {
    href: "/reportes/ventas",
    title: "Ventas",
    description: "Por mes: total, cobradas/pendientes y formas de pago.",
    icon: TrendingUp,
    moduleKeys: ["ventas"],
  },
  {
    href: "/reportes/compras",
    title: "Compras",
    description: "Por mes: total, pagadas/pendientes, formas de pago y estado de recepción.",
    icon: ShoppingCart,
    moduleKeys: ["compras"],
  },
  {
    href: "/reportes/sueldos",
    title: "Sueldos",
    description: "Por período: Monotributo, Registrado e Informal/Viáticos, por empleado.",
    icon: Wallet,
    moduleKeys: ["sueldos"],
  },
  {
    href: "/reportes/gastos",
    title: "Costos Fijos / Gastos",
    description: "Por rango de meses: resumen por categoría y detalle cronológico.",
    icon: Receipt,
    moduleKeys: ["costos-fijos"],
  },
  {
    href: "/reportes/viaticos",
    title: "Viajes",
    description:
      "Por mes: total por categoría (honorarios, hospedaje, combustible, extras, materiales, seguro) y excedente.",
    icon: Plane,
    moduleKeys: ["viaticos"],
  },
  {
    href: "/reportes/cheques",
    title: "Cheques",
    description: "Por mes de vencimiento: totales por estado y por tipo.",
    icon: Landmark,
    moduleKeys: ["cheques"],
  },
  {
    href: "/reportes/comercial-planta",
    title: "Comercial Planta",
    description: "Por mes: Presupuestos, Despachos y Recibos (U$D).",
    icon: Building2,
    moduleKeys: ["presupuestos", "despachos", "recibos"],
  },
  {
    href: "/reportes/produccion",
    title: "Producción",
    description: "Por mes: Órdenes de Trabajo, Proyectos de fábrica y Fabricar.",
    icon: Factory,
    moduleKeys: ["ordenes", "proyectos", "fabricar"],
  },
  {
    href: "/reportes/reparaciones",
    title: "Reparaciones",
    description: "Por mes: cantidad por estado y Componentes descontados.",
    icon: Wrench,
    moduleKeys: ["reparaciones"],
  },
  {
    href: "/reportes/stock",
    title: "Stock",
    description: "Componentes y Luminarias bajo mínimo, valorización y movimientos del mes.",
    icon: Boxes,
    moduleKeys: ["componentes", "luminarias"],
  },
];

export default async function ReportesPage() {
  const session = await requireModuleAccess("reportes");
  const restrictedModules = session?.user?.restrictedModules ?? [];

  const visibleCards = REPORT_CARDS.filter(
    (card) => !card.moduleKeys || card.moduleKeys.every((k) => !restrictedModules.includes(k as never))
  );

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
        {visibleCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="group">
              <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                <CardContent className="flex items-start gap-4 pt-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-semibold">{card.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
