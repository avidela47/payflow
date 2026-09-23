import Link from "next/link";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Employee } from "@/models/Employee";
import { Client } from "@/models/Client";
import { Sale } from "@/models/Sale";
import { Provider } from "@/models/Provider";
import { Purchase } from "@/models/Purchase";
import { PayrollEntry } from "@/models/PayrollEntry";
import { FixedCostEntry } from "@/models/FixedCost";
import { Check } from "@/models/Check";
import { AgendaEntry } from "@/models/AgendaEntry";
import { CalendarEvent } from "@/models/CalendarEvent";
import { VaultEntry } from "@/models/Vault";
import { Note } from "@/models/Note";
import {
  Users,
  Building2,
  Wallet,
  Receipt,
  Landmark,
  CalendarClock,
  CalendarDays,
  FileBarChart,
  KeyRound,
  StickyNote,
  AlertTriangle,
  ArrowRight,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { formatCurrency, formatFullDate, cn } from "@/lib/utils";
import { MaskedAmount } from "@/components/masked-amount";
import { DashboardCharts, type SueldosLinePoint, type CostosDonutSlice } from "@/components/dashboard-charts";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Nombre de pila para el saludo: se corta en el primer espacio porque el
// "name" del usuario suele ser nombre + apellido y "Hola, Ariel" queda
// mejor que "Hola, Ariel Videla".
function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

// Rediseño (v2): arriba, saludo + fecha, tarjetas KPI con variación mes a
// mes, 3 accesos rápidos y 2 gráficos (sueldos por día, costos fijos por
// categoría). Abajo se mantiene el lanzador de módulos, ahora como
// referencia completa además del resumen de arriba. Notas sigue siendo
// privado por usuario — ese conteo se filtra por session.user.id, nunca se
// muestra el total de todos.
export default async function DashboardPage() {
  await connectDB();
  const session = await getSession();

  const now = new Date();
  const periodStart = startOfMonth(now);
  const prevPeriodStart = new Date(periodStart.getFullYear(), periodStart.getMonth() - 1, 1);
  const todayStart = startOfToday();
  const in7Days = new Date(todayStart);
  in7Days.setDate(in7Days.getDate() + 7);
  const daysInMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate();
  const nextPeriodStart = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1);

  const [
    activeEmployees,
    newEmployeesThisMonth,
    totalClients,
    newClientsThisMonth,
    totalProviders,
    salesThisMonth,
    overdueSalesCount,
    purchasesThisMonth,
    pendingPaymentPurchasesThisMonth,
    overduePurchasesCount,
    inProgressPurchasesCount,
    payrollEntries,
    prevPayrollEntries,
    pendingFixedCosts,
    activeChecks,
    pendingAgenda,
    weekEvents,
    vaultCount,
    myNotesCount,
  ] = await Promise.all([
    Employee.countDocuments({ active: true }),
    Employee.countDocuments({ active: true, createdAt: { $gte: periodStart } }),
    Client.countDocuments({}),
    Client.countDocuments({ createdAt: { $gte: periodStart } }),
    Provider.countDocuments({}),
    Sale.find({ saleDate: { $gte: periodStart, $lt: nextPeriodStart } }).lean(),
    Sale.countDocuments({ collected: false, expectedCollectionDate: { $lt: todayStart } }),
    Purchase.find({ purchaseDate: { $gte: periodStart, $lt: nextPeriodStart } }).lean(),
    Purchase.find({
      purchaseDate: { $gte: periodStart, $lt: nextPeriodStart },
      paid: false,
    }).lean(),
    Purchase.countDocuments({ paid: false, expectedPaymentDate: { $lt: todayStart } }),
    // "En curso / por recibir" es un estado operativo, no atado al mes en
    // que se cargó la compra — una compra pedida hace dos meses que sigue
    // sin llegar sigue siendo relevante hoy, igual que overdueSalesCount
    // más abajo tampoco se filtra por mes.
    Purchase.countDocuments({ receiptStatus: { $in: ["EN_CURSO", "RECIBIDA_PARCIAL"] } }),
    PayrollEntry.find({ period: periodStart }).lean(),
    PayrollEntry.find({ period: prevPeriodStart }).lean(),
    FixedCostEntry.find({ period: periodStart, paid: false }).populate("category").lean(),
    Check.find({ status: "ACTIVO" }).lean(),
    AgendaEntry.countDocuments({ sent: false, date: { $gte: todayStart, $lte: in7Days } }),
    CalendarEvent.countDocuments({ startsAt: { $gte: todayStart, $lte: in7Days } }),
    VaultEntry.countDocuments({}),
    session?.user ? Note.countDocuments({ user: session.user.id }) : Promise.resolve(0),
  ]);

  const totalSalesThisMonth = salesThisMonth.reduce((sum, s) => sum + s.amount, 0);
  const totalPurchasesThisMonth = purchasesThisMonth.reduce((sum, p) => sum + p.amount, 0);
  const totalPendingPaymentPurchasesThisMonth = pendingPaymentPurchasesThisMonth.reduce(
    (sum, p) => sum + p.amount,
    0
  );

  const totalPayroll = payrollEntries.reduce((sum, e) => sum + e.amount, 0);
  const prevTotalPayroll = prevPayrollEntries.reduce((sum, e) => sum + e.amount, 0);
  const payrollDeltaPct =
    prevTotalPayroll > 0 ? Math.round(((totalPayroll - prevTotalPayroll) / prevTotalPayroll) * 100) : null;

  const totalPendingFixedCosts = pendingFixedCosts.reduce((sum, e) => sum + e.amount, 0);

  // Serie diaria acumulada del mes en curso, en base a cuándo se cargó
  // cada liquidación (no hay un campo de "fecha de pago" separado en
  // PayrollEntry — createdAt es el único dato con granularidad diaria).
  const dailyTotals = new Array(daysInMonth + 1).fill(0);
  for (const entry of payrollEntries) {
    const day = new Date(entry.createdAt).getDate();
    dailyTotals[day] = (dailyTotals[day] ?? 0) + entry.amount;
  }
  let running = 0;
  const lineData: SueldosLinePoint[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    running += dailyTotals[day] ?? 0;
    lineData.push({ day, total: running });
  }

  // Costos fijos pendientes agrupados por categoría (nombre real de
  // FixedCostCategory, poblado arriba), ordenados de mayor a menor.
  const donutByCategory = new Map<string, number>();
  for (const entry of pendingFixedCosts) {
    const categoryDoc = entry.category as unknown as { name?: string } | null;
    const name = categoryDoc && typeof categoryDoc === "object" ? categoryDoc.name ?? "Sin categoría" : "Sin categoría";
    donutByCategory.set(name, (donutByCategory.get(name) ?? 0) + entry.amount);
  }
  const donutData: CostosDonutSlice[] = Array.from(donutByCategory.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Mismo criterio que la página de Cheques (daysUntil por cheque activo)
  // para que estos números coincidan siempre con los badges que se ven ahí.
  let checksDueSoon = 0;
  let checksOverdue = 0;
  for (const check of activeChecks) {
    const daysUntil = Math.ceil(
      (check.paymentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntil < 0) checksOverdue += 1;
    else if (daysUntil <= 7) checksDueSoon += 1;
  }

  const alerts = [
    checksOverdue > 0 && {
      text: `${checksOverdue} cheque${checksOverdue === 1 ? "" : "s"} vencido${
        checksOverdue === 1 ? "" : "s"
      }`,
      tone: "text-destructive",
    },
    overdueSalesCount > 0 && {
      text: `${overdueSalesCount} venta${overdueSalesCount === 1 ? "" : "s"} vencida${
        overdueSalesCount === 1 ? "" : "s"
      } sin cobrar`,
      tone: "text-destructive",
    },
    overduePurchasesCount > 0 && {
      text: `${overduePurchasesCount} compra${overduePurchasesCount === 1 ? "" : "s"} vencida${
        overduePurchasesCount === 1 ? "" : "s"
      } sin pagar`,
      tone: "text-destructive",
    },
    checksDueSoon > 0 && {
      text: `${checksDueSoon} cheque${checksDueSoon === 1 ? "" : "s"} por vencer esta semana`,
      tone: "text-warning",
    },
    pendingFixedCosts.length > 0 && {
      text: `${pendingFixedCosts.length} costo${
        pendingFixedCosts.length === 1 ? "" : "s"
      } fijo${pendingFixedCosts.length === 1 ? "" : "s"} pendiente${
        pendingFixedCosts.length === 1 ? "" : "s"
      } este mes`,
      tone: "text-warning",
    },
  ].filter((a): a is { text: string; tone: string } => Boolean(a));

  // Las tarjetas de arriba. Sueldos usa MaskedAmount (mismo criterio que
  // el resto de la app); el resto queda a la vista, como antes.
  const kpis = [
    {
      title: "Empleados activos",
      icon: Users,
      iconWrap: "bg-blue-50",
      iconColor: "text-blue-600",
      value: <p className="text-2xl font-semibold tracking-tight">{activeEmployees}</p>,
      delta:
        newEmployeesThisMonth > 0
          ? { text: `${newEmployeesThisMonth} este mes`, up: true }
          : null,
    },
    {
      title: "Clientes",
      icon: Building2,
      iconWrap: "bg-indigo-50",
      iconColor: "text-indigo-600",
      value: <p className="text-2xl font-semibold tracking-tight">{totalClients}</p>,
      delta:
        newClientsThisMonth > 0 ? { text: `${newClientsThisMonth} este mes`, up: true } : null,
    },
    {
      title: "Sueldos del mes",
      icon: Wallet,
      iconWrap: "bg-emerald-50",
      iconColor: "text-emerald-600",
      value: <MaskedAmount value={formatCurrency(totalPayroll)} className="text-2xl font-semibold tracking-tight" />,
      delta:
        payrollDeltaPct !== null
          ? { text: `${Math.abs(payrollDeltaPct)}% vs mes anterior`, up: payrollDeltaPct >= 0 }
          : null,
    },
    {
      title: "Costos fijos pendientes",
      icon: Receipt,
      iconWrap: "bg-amber-50",
      iconColor: "text-amber-600",
      value: <p className="text-2xl font-semibold tracking-tight">{formatCurrency(totalPendingFixedCosts)}</p>,
      delta:
        pendingFixedCosts.length > 0
          ? { text: `${pendingFixedCosts.length} pendiente${pendingFixedCosts.length === 1 ? "" : "s"}`, up: false }
          : null,
    },
    {
      title: "Compras del mes",
      icon: ShoppingCart,
      iconWrap: "bg-orange-50",
      iconColor: "text-orange-600",
      value: <p className="text-2xl font-semibold tracking-tight">{formatCurrency(totalPurchasesThisMonth)}</p>,
      delta:
        purchasesThisMonth.length > 0
          ? { text: `${purchasesThisMonth.length} compra${purchasesThisMonth.length === 1 ? "" : "s"}`, up: true }
          : null,
    },
    {
      title: "Pendiente de pago (compras)",
      icon: Receipt,
      iconWrap: "bg-rose-50",
      iconColor: "text-rose-600",
      value: (
        <p className="text-2xl font-semibold tracking-tight">
          {formatCurrency(totalPendingPaymentPurchasesThisMonth)}
        </p>
      ),
      delta:
        pendingPaymentPurchasesThisMonth.length > 0
          ? {
              text: `${pendingPaymentPurchasesThisMonth.length} pendiente${
                pendingPaymentPurchasesThisMonth.length === 1 ? "" : "s"
              }`,
              up: false,
            }
          : null,
    },
    {
      title: "En curso / por recibir",
      icon: Truck,
      iconWrap: "bg-cyan-50",
      iconColor: "text-cyan-600",
      value: <p className="text-2xl font-semibold tracking-tight">{inProgressPurchasesCount}</p>,
      delta: null,
    },
  ];

  // Accesos rápidos: van directo a la página del módulo. En Clientes el
  // formulario de alta vive en un diálogo (no se abre solo), así que ahí
  // queda un click más — el resto ya cae parado en el formulario.
  const quickActions = [
    {
      href: "/sueldos",
      title: "Nueva liquidación",
      description: "Cargar sueldo de un empleado",
      icon: Wallet,
      wrap: "bg-emerald-50 hover:bg-emerald-100",
      iconColor: "text-emerald-600",
    },
    {
      href: "/costos-fijos",
      title: "Nuevo costo fijo",
      description: "Registrar un gasto del mes",
      icon: Receipt,
      wrap: "bg-amber-50 hover:bg-amber-100",
      iconColor: "text-amber-600",
    },
    {
      href: "/clientes",
      title: "Nuevo cliente",
      description: "Sumar a la cartera",
      icon: Building2,
      wrap: "bg-indigo-50 hover:bg-indigo-100",
      iconColor: "text-indigo-600",
    },
  ];

  const modules = [
    {
      href: "/empleados",
      title: "Empleados",
      description: "Legajos y datos de pago",
      value: String(activeEmployees),
      caption: "activos",
      icon: Users,
      iconWrap: "bg-blue-50",
      iconColor: "text-blue-600",
      bar: "bg-blue-500",
    },
    {
      href: "/clientes",
      title: "Clientes",
      description: "Cartera de clientes",
      value: String(totalClients),
      caption: totalClients === 1 ? "cliente" : "clientes",
      icon: Building2,
      iconWrap: "bg-indigo-50",
      iconColor: "text-indigo-600",
      bar: "bg-indigo-500",
    },
    {
      href: "/proveedores",
      title: "Proveedores",
      description: "Cartera de proveedores",
      value: String(totalProviders),
      caption: totalProviders === 1 ? "proveedor" : "proveedores",
      icon: Truck,
      iconWrap: "bg-purple-50",
      iconColor: "text-purple-600",
      bar: "bg-purple-500",
    },
    {
      href: "/ventas",
      title: "Ventas",
      description: "Ventas por cliente y cobros",
      value: formatCurrency(totalSalesThisMonth),
      caption: "este mes",
      icon: TrendingUp,
      iconWrap: "bg-teal-50",
      iconColor: "text-teal-600",
      bar: "bg-teal-500",
    },
    {
      href: "/compras",
      title: "Compras",
      description: "Compras por proveedor y pagos",
      value: formatCurrency(totalPurchasesThisMonth),
      caption: "este mes",
      icon: ShoppingCart,
      iconWrap: "bg-orange-50",
      iconColor: "text-orange-600",
      bar: "bg-orange-500",
    },
    {
      href: "/sueldos",
      title: "Sueldos",
      description: "Liquidación mensual",
      value: formatCurrency(totalPayroll),
      caption: "este mes",
      icon: Wallet,
      iconWrap: "bg-emerald-50",
      iconColor: "text-emerald-600",
      bar: "bg-emerald-500",
    },
    {
      href: "/costos-fijos",
      title: "Costos Fijos",
      description: "Gastos recurrentes",
      value: formatCurrency(totalPendingFixedCosts),
      caption: "pendiente este mes",
      icon: Receipt,
      iconWrap: "bg-amber-50",
      iconColor: "text-amber-600",
      bar: "bg-amber-500",
    },
    {
      href: "/cheques",
      title: "Cheques",
      description: "Cartera de cheques",
      value: String(activeChecks.length),
      caption:
        checksOverdue > 0
          ? `${checksOverdue} vencido${checksOverdue === 1 ? "" : "s"}`
          : checksDueSoon > 0
            ? `${checksDueSoon} por vencer`
            : "activos, todo en orden",
      icon: Landmark,
      iconWrap: "bg-rose-50",
      iconColor: "text-rose-600",
      bar: "bg-rose-500",
    },
    {
      href: "/agenda",
      title: "Agenda",
      description: "Recordatorios con aviso por mail",
      value: String(pendingAgenda),
      caption: "pendientes esta semana",
      icon: CalendarClock,
      iconWrap: "bg-violet-50",
      iconColor: "text-violet-600",
      bar: "bg-violet-500",
    },
    {
      href: "/calendario",
      title: "Calendario",
      description: "Vista mes / semana / día",
      value: String(weekEvents),
      caption: "eventos esta semana",
      icon: CalendarDays,
      iconWrap: "bg-cyan-50",
      iconColor: "text-cyan-600",
      bar: "bg-cyan-500",
    },
    {
      href: "/reportes",
      title: "Reportes",
      description: "Sueldos y gastos, listos para imprimir",
      value: "PDF",
      caption: "reportes disponibles",
      icon: FileBarChart,
      iconWrap: "bg-slate-100",
      iconColor: "text-slate-600",
      bar: "bg-slate-500",
    },
    {
      href: "/vault",
      title: "Vault",
      description: "Credenciales cifradas",
      value: String(vaultCount),
      caption: vaultCount === 1 ? "credencial guardada" : "credenciales guardadas",
      icon: KeyRound,
      iconWrap: "bg-fuchsia-50",
      iconColor: "text-fuchsia-600",
      bar: "bg-fuchsia-500",
    },
    {
      href: "/notas",
      title: "Notas",
      description: "Tus notas privadas",
      value: String(myNotesCount),
      caption: myNotesCount === 1 ? "nota tuya" : "notas tuyas",
      icon: StickyNote,
      iconWrap: "bg-yellow-50",
      iconColor: "text-yellow-600",
      bar: "bg-yellow-500",
    },
  ];

  const displayName = session?.user?.name ? firstName(session.user.name) : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">
            Hola{displayName ? `, ${displayName}` : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground">Acá tenés un resumen de PayFlow.</p>
        </div>
        <p className="text-sm text-muted-foreground">{formatFullDate(now)}</p>
      </div>

      {alerts.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/5 p-4">
          {alerts.map((alert) => (
            <div key={alert.text} className="flex items-center gap-2 text-sm">
              <AlertTriangle className={cn("h-4 w-4 shrink-0", alert.tone)} />
              <span className={alert.tone}>{alert.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.title}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className={`rounded-lg p-2 ${kpi.iconWrap}`}>
                  <Icon className={`h-4 w-4 ${kpi.iconColor}`} />
                </div>
                <span className="text-sm text-muted-foreground">{kpi.title}</span>
              </div>
              {kpi.value}
              {kpi.delta && (
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    kpi.delta.up ? "text-success" : "text-destructive"
                  )}
                >
                  {kpi.delta.up ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  {kpi.delta.text}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <Zap className="h-4 w-4 text-primary" />
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className={cn(
                  "flex flex-col gap-2 rounded-lg p-4 transition-colors",
                  action.wrap
                )}
              >
                <Icon className={`h-6 w-6 ${action.iconColor}`} />
                <span className="font-medium">{action.title}</span>
                <span className="text-xs text-muted-foreground">{action.description}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <DashboardCharts lineData={lineData} donutData={donutData} />

      <div>
        <h2 className="mb-3 font-semibold">Todos los módulos</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className={`absolute inset-x-0 top-0 h-1 ${mod.bar}`} />
                <div className="flex items-center justify-between">
                  <div className={`rounded-lg p-2.5 ${mod.iconWrap}`}>
                    <Icon className={`h-5 w-5 ${mod.iconColor}`} />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div>
                  <h3 className="font-semibold">{mod.title}</h3>
                  <p className="text-xs text-muted-foreground">{mod.description}</p>
                </div>
                <div>
                  {mod.href === "/sueldos" ? (
                    <MaskedAmount
                      value={mod.value}
                      className="text-xl font-semibold tracking-tight"
                    />
                  ) : (
                    <p className="text-xl font-semibold tracking-tight">{mod.value}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{mod.caption}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}