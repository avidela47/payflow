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
import { PettyCashMovement } from "@/models/PettyCash";
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
  Banknote,
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

// Rediseño (v2): arriba, saludo + fecha, 4 tarjetas KPI con variación
// mes a mes, 3 accesos rápidos y 2 gráficos (sueldos por día, costos
// fijos por categoría). Abajo se mantiene el lanzador de los 10 módulos
// que ya existía, ahora como referencia completa además del resumen de
// arriba. Notas sigue siendo privado por usuario — ese conteo se filtra
// por session.user.id, nunca se muestra el total de todos.
//
// Rediseño (v3→v5, visual): se probaron chips con degradé por módulo y
// después tarjetas con fondo sólido de color (una por módulo). Se volvió
// atrás: tarjeta blanca con borde, ícono en círculo bg-primary/10, un
// solo color de acento (primary) en todos lados. El color deja de ser
// decorativo y se reserva para estado real — success/warning/destructive,
// como en `captionTone` de Cheques más abajo y en `alerts`. Ninguna
// lógica de datos cambia acá, solo las clases de Tailwind.
export default async function DashboardPage() {
  await connectDB();
  const session = await getSession();
  // Mismos módulos restringibles que sidebar.tsx/requireModuleAccess —
  // acá no bloqueamos la página entera (el Dashboard es de todos), pero sí
  // sacamos de la vista las tarjetas/alertas/gráficos/accesos que exponen
  // datos de un módulo al que este usuario puntual no tiene acceso.
  const restrictedModules = session?.user?.restrictedModules ?? [];

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
    pendingCollectionSalesThisMonth,
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
    pettyCashBalanceAgg,
  ] = await Promise.all([
    Employee.countDocuments({ active: true }),
    Employee.countDocuments({ active: true, createdAt: { $gte: periodStart } }),
    Client.countDocuments({}),
    Client.countDocuments({ createdAt: { $gte: periodStart } }),
    Provider.countDocuments({}),
    Sale.find({ saleDate: { $gte: periodStart, $lt: nextPeriodStart } }).lean(),
    Sale.find({
      saleDate: { $gte: periodStart, $lt: nextPeriodStart },
      collected: false,
    }).lean(),
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
    // Mismo criterio que caja-chica/page.tsx: el saldo sale de TODOS los
    // movimientos vía agregación, no de una lectura parcial.
    PettyCashMovement.aggregate([
      {
        $group: {
          _id: null,
          ingresos: { $sum: { $cond: [{ $eq: ["$type", "ingreso"] }, "$amount", 0] } },
          egresos: { $sum: { $cond: [{ $eq: ["$type", "egreso"] }, "$amount", 0] } },
        },
      },
    ]),
  ]);

  const pettyCashBalance = pettyCashBalanceAgg[0]
    ? pettyCashBalanceAgg[0].ingresos - pettyCashBalanceAgg[0].egresos
    : 0;

  const totalSalesThisMonth = salesThisMonth.reduce((sum, s) => sum + s.amount, 0);
  const totalPendingCollectionSalesThisMonth = pendingCollectionSalesThisMonth.reduce(
    (sum, s) => sum + s.amount,
    0
  );
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
      moduleKey: "cheques",
    },
    overdueSalesCount > 0 && {
      text: `${overdueSalesCount} venta${overdueSalesCount === 1 ? "" : "s"} vencida${
        overdueSalesCount === 1 ? "" : "s"
      } sin cobrar`,
      tone: "text-destructive",
      moduleKey: null,
    },
    overduePurchasesCount > 0 && {
      text: `${overduePurchasesCount} compra${overduePurchasesCount === 1 ? "" : "s"} vencida${
        overduePurchasesCount === 1 ? "" : "s"
      } sin pagar`,
      tone: "text-destructive",
      moduleKey: null,
    },
    checksDueSoon > 0 && {
      text: `${checksDueSoon} cheque${checksDueSoon === 1 ? "" : "s"} por vencer esta semana`,
      tone: "text-warning",
      moduleKey: "cheques",
    },
    pendingFixedCosts.length > 0 && {
      text: `${pendingFixedCosts.length} costo${
        pendingFixedCosts.length === 1 ? "" : "s"
      } fijo${pendingFixedCosts.length === 1 ? "" : "s"} pendiente${
        pendingFixedCosts.length === 1 ? "" : "s"
      } este mes`,
      tone: "text-warning",
      moduleKey: "costos-fijos",
    },
  ]
    .filter((a): a is { text: string; tone: string; moduleKey: string | null } => Boolean(a))
    .filter((a) => !a.moduleKey || !restrictedModules.includes(a.moduleKey as never));

  // Las tarjetas de arriba. Sueldos usa MaskedAmount (mismo criterio que
  // el resto de la app); Costos Fijos queda a la vista, como antes. Todas
  // comparten el mismo ícono en círculo bg-primary/10 — ya no hay un color
  // distinto por KPI.
  const kpis = [
    {
      title: "Empleados activos",
      icon: Users,
      value: <p className="text-2xl font-semibold tracking-tight">{activeEmployees}</p>,
      delta:
        newEmployeesThisMonth > 0
          ? { text: `${newEmployeesThisMonth} este mes`, up: true }
          : null,
      moduleKey: "empleados",
    },
    {
      title: "Clientes",
      icon: Building2,
      value: <p className="text-2xl font-semibold tracking-tight">{totalClients}</p>,
      delta:
        newClientsThisMonth > 0 ? { text: `${newClientsThisMonth} este mes`, up: true } : null,
      moduleKey: null,
    },
    {
      title: "Sueldos del mes",
      icon: Wallet,
      value: <MaskedAmount value={formatCurrency(totalPayroll)} className="text-2xl font-semibold tracking-tight" />,
      delta:
        payrollDeltaPct !== null
          ? { text: `${Math.abs(payrollDeltaPct)}% vs mes anterior`, up: payrollDeltaPct >= 0 }
          : null,
      moduleKey: "sueldos",
    },
    {
      title: "Costos fijos pendientes",
      icon: Receipt,
      value: <p className="text-2xl font-semibold tracking-tight">{formatCurrency(totalPendingFixedCosts)}</p>,
      delta:
        pendingFixedCosts.length > 0
          ? { text: `${pendingFixedCosts.length} pendiente${pendingFixedCosts.length === 1 ? "" : "s"}`, up: false }
          : null,
      moduleKey: "costos-fijos",
    },
    {
      title: "Ventas del mes",
      icon: TrendingUp,
      value: <p className="text-2xl font-semibold tracking-tight">{formatCurrency(totalSalesThisMonth)}</p>,
      delta:
        salesThisMonth.length > 0
          ? { text: `${salesThisMonth.length} venta${salesThisMonth.length === 1 ? "" : "s"}`, up: true }
          : null,
      moduleKey: null,
    },
    {
      title: "Pendiente de cobro",
      icon: Receipt,
      value: (
        <p className="text-2xl font-semibold tracking-tight">
          {formatCurrency(totalPendingCollectionSalesThisMonth)}
        </p>
      ),
      delta:
        pendingCollectionSalesThisMonth.length > 0
          ? {
              text: `${pendingCollectionSalesThisMonth.length} pendiente${
                pendingCollectionSalesThisMonth.length === 1 ? "" : "s"
              }`,
              up: false,
            }
          : null,
      moduleKey: null,
    },
    {
      title: "Compras del mes",
      icon: ShoppingCart,
      value: <p className="text-2xl font-semibold tracking-tight">{formatCurrency(totalPurchasesThisMonth)}</p>,
      delta:
        purchasesThisMonth.length > 0
          ? { text: `${purchasesThisMonth.length} compra${purchasesThisMonth.length === 1 ? "" : "s"}`, up: true }
          : null,
      moduleKey: null,
    },
    {
      title: "Pendiente de pago (compras)",
      icon: Receipt,
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
      moduleKey: null,
    },
    {
      title: "En curso / por recibir",
      icon: Truck,
      value: <p className="text-2xl font-semibold tracking-tight">{inProgressPurchasesCount}</p>,
      delta: null,
      moduleKey: null,
    },
  ].filter((kpi) => !kpi.moduleKey || !restrictedModules.includes(kpi.moduleKey as never));

  // Accesos rápidos: van directo a la página del módulo. En Clientes el
  // formulario de alta vive en un diálogo (no se abre solo), así que ahí
  // queda un click más — el resto ya cae parado en el formulario.
  const quickActions = [
    {
      href: "/sueldos",
      title: "Nueva liquidación",
      description: "Cargar sueldo de un empleado",
      icon: Wallet,
      moduleKey: "sueldos",
    },
    {
      href: "/costos-fijos",
      title: "Nuevo costo fijo",
      description: "Registrar un gasto del mes",
      icon: Receipt,
      moduleKey: "costos-fijos",
    },
    {
      href: "/clientes",
      title: "Nuevo cliente",
      description: "Sumar a la cartera",
      icon: Building2,
      moduleKey: null,
    },
  ].filter((action) => !action.moduleKey || !restrictedModules.includes(action.moduleKey as never));

  const modules = [
    {
      href: "/empleados",
      title: "Empleados",
      description: "Legajos y datos de pago",
      value: String(activeEmployees),
      caption: "activos",
      icon: Users,
      moduleKey: "empleados",
    },
    {
      href: "/clientes",
      title: "Clientes",
      description: "Cartera de clientes",
      value: String(totalClients),
      caption: totalClients === 1 ? "cliente" : "clientes",
      icon: Building2,
      moduleKey: null,
    },
    {
      href: "/proveedores",
      title: "Proveedores",
      description: "Cartera de proveedores",
      value: String(totalProviders),
      caption: totalProviders === 1 ? "proveedor" : "proveedores",
      icon: Truck,
      moduleKey: null,
    },
    {
      href: "/ventas",
      title: "Ventas",
      description: "Ventas por cliente y cobros",
      value: formatCurrency(totalSalesThisMonth),
      caption: "este mes",
      icon: TrendingUp,
      moduleKey: null,
    },
    {
      href: "/compras",
      title: "Compras",
      description: "Compras por proveedor y pagos",
      value: formatCurrency(totalPurchasesThisMonth),
      caption: "este mes",
      icon: ShoppingCart,
      moduleKey: null,
    },
    {
      href: "/sueldos",
      title: "Sueldos",
      description: "Liquidación mensual",
      value: formatCurrency(totalPayroll),
      caption: "este mes",
      icon: Wallet,
      moduleKey: "sueldos",
    },
    {
      href: "/costos-fijos",
      title: "Costos Fijos",
      description: "Gastos recurrentes",
      value: formatCurrency(totalPendingFixedCosts),
      caption: "pendiente este mes",
      icon: Receipt,
      moduleKey: "costos-fijos",
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
      // Único lugar de la grilla donde el color dice algo (no decora): rojo
      // si hay vencidos, ámbar si hay por vencer esta semana, gris si está
      // todo en orden — mismo criterio que las alertas de arriba.
      captionTone: checksOverdue > 0 ? "text-destructive" : checksDueSoon > 0 ? "text-warning" : undefined,
      icon: Landmark,
      moduleKey: "cheques",
    },
    {
      href: "/caja-chica",
      title: "Caja Chica",
      description: "Efectivo para gastos corrientes",
      value: formatCurrency(pettyCashBalance),
      caption: "saldo actual",
      icon: Banknote,
      moduleKey: "caja-chica",
    },
    {
      href: "/agenda",
      title: "Agenda",
      description: "Recordatorios con aviso por mail",
      value: String(pendingAgenda),
      caption: "pendientes esta semana",
      icon: CalendarClock,
      moduleKey: null,
    },
    {
      href: "/calendario",
      title: "Calendario",
      description: "Vista mes / semana / día",
      value: String(weekEvents),
      caption: "eventos esta semana",
      icon: CalendarDays,
      moduleKey: null,
    },
    {
      href: "/reportes",
      title: "Reportes",
      description: "Sueldos y gastos, listos para imprimir",
      value: "PDF",
      caption: "reportes disponibles",
      icon: FileBarChart,
      moduleKey: "reportes",
    },
    {
      href: "/vault",
      title: "Vault",
      description: "Credenciales cifradas",
      value: String(vaultCount),
      caption: vaultCount === 1 ? "credencial guardada" : "credenciales guardadas",
      icon: KeyRound,
      moduleKey: "vault",
    },
    {
      href: "/notas",
      title: "Notas",
      description: "Tus notas privadas",
      value: String(myNotesCount),
      caption: myNotesCount === 1 ? "nota tuya" : "notas tuyas",
      icon: StickyNote,
      moduleKey: null,
    },
  ].filter((mod) => !mod.moduleKey || !restrictedModules.includes(mod.moduleKey as never));

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
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
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
                className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="font-medium">{action.title}</span>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <DashboardCharts
        lineData={lineData}
        donutData={donutData}
        showSueldos={!restrictedModules.includes("sueldos" as never)}
        showCostosFijos={!restrictedModules.includes("costos-fijos" as never)}
      />

      <div>
        <h2 className="mb-3 font-semibold">Todos los módulos</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
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
                  <p className={cn("text-xs", mod.captionTone ?? "text-muted-foreground")}>
                    {mod.caption}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}