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
  ClipboardList,
  ChevronRight,
} from "lucide-react";
import { formatCurrency, formatFullDate, formatPeriod, cn } from "@/lib/utils";
import { MaskedAmount } from "@/components/masked-amount";
import {
  DashboardCharts,
  VentasComprasBarChart,
  type CostosDonutSlice,
} from "@/components/dashboard-charts";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

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
  // Avatar del header: si esta cuenta está ligada a un legajo de Empleados
  // (ver User.employeeId), usamos la foto real de ahí; si no, el círculo
  // de iniciales de siempre.
  const linkedEmployee = session?.user?.employeeId
    ? await Employee.findById(session.user.employeeId, "foto").lean()
    : null;
  // Mismos módulos restringibles que sidebar.tsx/requireModuleAccess —
  // acá no bloqueamos la página entera (el Dashboard es de todos), pero sí
  // sacamos de la vista las tarjetas/alertas/gráficos/accesos que exponen
  // datos de un módulo al que este usuario puntual no tiene acceso.
  const restrictedModules = session?.user?.restrictedModules ?? [];

  const now = new Date();
  const periodStart = startOfMonth(now);
  const todayStart = startOfToday();
  const in7Days = new Date(todayStart);
  in7Days.setDate(in7Days.getDate() + 7);
  const nextPeriodStart = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1);

  // Sueldos: igual que en /sueldos, la imputación siempre va un mes atrás
  // del mes en que se paga, así que "mes calendario actual" casi nunca
  // tiene nada cargado. Usamos el ÚLTIMO período con datos (mismo criterio
  // que esa página) en vez del mes calendario, para no mostrar $0 en el
  // Dashboard mientras /sueldos sí tiene los datos reales cargados.
  const latestPayrollEntry = await PayrollEntry.findOne({}).sort({ period: -1 }).lean();
  const payrollPeriod = latestPayrollEntry ? latestPayrollEntry.period : periodStart;
  const prevPayrollPeriod = new Date(payrollPeriod.getFullYear(), payrollPeriod.getMonth() - 1, 1);
  const payrollPeriodLabel = formatPeriod(payrollPeriod);

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
    })
      .populate("client", "nombre")
      .lean(),
    Sale.countDocuments({ collected: false, expectedCollectionDate: { $lt: todayStart } }),
    Purchase.find({ purchaseDate: { $gte: periodStart, $lt: nextPeriodStart } }).lean(),
    Purchase.find({
      purchaseDate: { $gte: periodStart, $lt: nextPeriodStart },
      paid: false,
    })
      .populate("provider", "nombre")
      .lean(),
    Purchase.countDocuments({ paid: false, expectedPaymentDate: { $lt: todayStart } }),
    // "En curso / por recibir" es un estado operativo, no atado al mes en
    // que se cargó la compra — una compra pedida hace dos meses que sigue
    // sin llegar sigue siendo relevante hoy, igual que overdueSalesCount
    // más abajo tampoco se filtra por mes.
    Purchase.countDocuments({ receiptStatus: { $in: ["EN_CURSO", "RECIBIDA_PARCIAL"] } }),
    PayrollEntry.find({ period: payrollPeriod }).lean(),
    PayrollEntry.find({ period: prevPayrollPeriod }).lean(),
    FixedCostEntry.find({ period: periodStart, paid: false })
      .populate("category")
      .lean(),
    Check.find({ status: "ACTIVO" }).lean(),
    // Agenda y Calendario son privados por usuario (ver
    // migrar-agenda-calendario-florencia.ts) — sin el filtro por user, este
    // conteo mostraba recordatorios/eventos de CUALQUIER usuario (ej. los
    // de la contadora aparecían también en el Dashboard de Ariel).
    session?.user
      ? AgendaEntry.countDocuments({
          user: session.user.id,
          sent: false,
          date: { $gte: todayStart, $lte: in7Days },
        })
      : Promise.resolve(0),
    session?.user
      ? CalendarEvent.countDocuments({
          user: session.user.id,
          startsAt: { $gte: todayStart, $lte: in7Days },
        })
      : Promise.resolve(0),
    // Vault es privado por usuario desde este cambio (ver
    // migrar-vault-contadora.ts) — mismo motivo que Agenda/Calendario
    // arriba: sin el filtro por owner, este conteo mostraba las
    // credenciales de CUALQUIER usuario.
    session?.user
      ? VaultEntry.countDocuments({ owner: session.user.id })
      : Promise.resolve(0),
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
  const totalPurchasesThisMonth = purchasesThisMonth.reduce((sum, p) => sum + p.amount, 0);

  const totalPayroll = payrollEntries.reduce((sum, e) => sum + e.amount, 0);
  const prevTotalPayroll = prevPayrollEntries.reduce((sum, e) => sum + e.amount, 0);
  const payrollDeltaPct =
    prevTotalPayroll > 0 ? Math.round(((totalPayroll - prevTotalPayroll) / prevTotalPayroll) * 100) : null;

  const totalPendingFixedCosts = pendingFixedCosts.reduce((sum, e) => sum + e.amount, 0);

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

  // Resultado del mes: ventas menos compras, mismo criterio simple que el
  // gráfico de barras de al lado — no incluye sueldos/costos fijos porque
  // esos se liquidan en fechas distintas y mezclarían períodos distintos.
  const resultadoMes = totalSalesThisMonth - totalPurchasesThisMonth;

  const formatShortDate = (date: Date) =>
    new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(date);

  // Pendientes y vencimientos: una sola tabla con lo que antes eran 4
  // tarjetas KPI sueltas (cheques por vencer, costos fijos pendientes,
  // ventas sin cobrar, compras sin pagar) más las alertas de vencido. Cada
  // fila linkea directo al módulo correspondiente.
  type PendingItem = {
    key: string;
    tipo: string;
    detalle: string;
    monto: number;
    vencimiento?: Date;
    tone: "destructive" | "warning";
    href: string;
  };
  const pendingItems: PendingItem[] = [];

  if (!restrictedModules.includes("cheques" as never)) {
    for (const check of activeChecks) {
      const daysUntil = Math.ceil(
        (check.paymentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntil > 7) continue;
      pendingItems.push({
        key: `check-${check._id}`,
        tipo: "Cheque",
        detalle: `${check.direction === "EMITIDO" ? "A" : "De"} ${check.issuerName} · Nº ${check.checkNumber}`,
        monto: check.amount,
        vencimiento: check.paymentDate,
        tone: daysUntil < 0 ? "destructive" : "warning",
        href: "/cheques",
      });
    }
  }

  if (!restrictedModules.includes("costos-fijos" as never)) {
    for (const entry of pendingFixedCosts) {
      const categoryDoc = entry.category as unknown as { name?: string } | null;
      pendingItems.push({
        key: `fixedcost-${entry._id}`,
        tipo: "Costo fijo",
        detalle: categoryDoc?.name ?? "Sin categoría",
        monto: entry.amount,
        tone: "warning",
        href: "/costos-fijos",
      });
    }
  }

  for (const sale of pendingCollectionSalesThisMonth) {
    const clientDoc = sale.client as unknown as { nombre?: string } | null;
    const vencida = Boolean(sale.expectedCollectionDate && sale.expectedCollectionDate < todayStart);
    pendingItems.push({
      key: `sale-${sale._id}`,
      tipo: "Venta",
      detalle: clientDoc?.nombre ?? "Cliente",
      monto: sale.amount,
      vencimiento: sale.expectedCollectionDate,
      tone: vencida ? "destructive" : "warning",
      href: "/ventas",
    });
  }

  for (const purchase of pendingPaymentPurchasesThisMonth) {
    const providerDoc = purchase.provider as unknown as { nombre?: string } | null;
    const vencida = Boolean(
      purchase.expectedPaymentDate && purchase.expectedPaymentDate < todayStart
    );
    pendingItems.push({
      key: `purchase-${purchase._id}`,
      tipo: "Compra",
      detalle: providerDoc?.nombre ?? "Proveedor",
      monto: purchase.amount,
      vencimiento: purchase.expectedPaymentDate,
      tone: vencida ? "destructive" : "warning",
      href: "/compras",
    });
  }

  pendingItems.sort((a, b) => {
    if (a.tone !== b.tone) return a.tone === "destructive" ? -1 : 1;
    return b.monto - a.monto;
  });
  const pendingItemsTop = pendingItems.slice(0, 6);

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
      title: `Sueldos (${payrollPeriodLabel})`,
      icon: Wallet,
      value: <MaskedAmount value={formatCurrency(totalPayroll)} className="text-2xl font-semibold tracking-tight" />,
      delta:
        payrollDeltaPct !== null
          ? { text: `${Math.abs(payrollDeltaPct)}% vs período anterior`, up: payrollDeltaPct >= 0 }
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
      title: "Compras en curso",
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
      caption: payrollPeriodLabel,
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
      caption: vaultCount === 1 ? "credencial tuya" : "credenciales tuyas",
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
  // No hay foto cargada para el usuario logueado (User no tiene ese campo,
  // a diferencia de Employee) — mismo estilo que el avatar de Empleados
  // (círculo de color con iniciales), pero con las iniciales del nombre
  // de la cuenta en vez de una foto real.
  const userInitials = (session?.user?.name ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            {linkedEmployee?.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={linkedEmployee.foto} alt="" className="h-full w-full object-cover object-top" />
            ) : (
              userInitials
            )}
          </div>
          <h1 className="text-2xl font-semibold">
            Hola{displayName ? `, ${displayName}` : ""}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">{formatFullDate(now)}</p>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Módulos</h2>
        <div className="grid grid-cols-1 gap-1 rounded-xl border border-border bg-card p-2 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{mod.title}</span>
                  <p className="truncate text-xs text-muted-foreground">{mod.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  {mod.href === "/sueldos" ? (
                    <MaskedAmount value={mod.value} className="block text-sm font-semibold" />
                  ) : (
                    <span className="block text-sm font-semibold">{mod.value}</span>
                  )}
                  <span className={cn("text-xs", mod.captionTone ?? "text-muted-foreground")}>
                    {mod.caption}
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
              </Link>
            );
          })}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {alerts.map((alert) => {
            const row = (
              <div className="flex items-center gap-3 px-4 py-3 text-sm">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    alert.tone === "text-destructive" ? "bg-destructive/10" : "bg-warning/10"
                  )}
                >
                  <AlertTriangle className={cn("h-3.5 w-3.5", alert.tone)} />
                </span>
                <span className={cn("flex-1", alert.tone)}>{alert.text}</span>
                {alert.moduleKey && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </div>
            );
            return alert.moduleKey ? (
              <Link
                key={alert.text}
                href={`/${alert.moduleKey}`}
                className="transition-colors hover:bg-muted/50"
              >
                {row}
              </Link>
            ) : (
              <div key={alert.text}>{row}</div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-1 font-semibold">Ventas vs. compras este mes</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            {salesThisMonth.length} venta{salesThisMonth.length === 1 ? "" : "s"} ·{" "}
            {purchasesThisMonth.length} compra{purchasesThisMonth.length === 1 ? "" : "s"}
          </p>
          <VentasComprasBarChart ventas={totalSalesThisMonth} compras={totalPurchasesThisMonth} />
        </div>
        <div
          className={cn(
            "flex flex-col justify-center gap-2 rounded-xl p-5 shadow-sm",
            resultadoMes >= 0 ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"
          )}
        >
          <span className="flex items-center gap-2 text-sm opacity-80">
            {resultadoMes >= 0 ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            Resultado del mes
          </span>
          <p className="font-heading text-3xl font-semibold tracking-tight">
            {formatCurrency(resultadoMes)}
          </p>
          <p className="text-xs opacity-80">Ventas menos compras de {formatPeriod(now)}</p>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card shadow-sm sm:flex-row sm:divide-x sm:divide-y-0">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.title} className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5 text-primary" />
                {kpi.title}
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
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {kpi.delta.text}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <ClipboardList className="h-4 w-4 text-primary" />
            Pendientes y vencimientos
          </h2>
          {pendingItemsTop.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
              No hay nada pendiente ni por vencer. Todo en orden.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingItemsTop.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell>
                      <Link href={item.href} className="font-medium hover:text-primary">
                        {item.tipo}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.detalle}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.vencimiento ? formatShortDate(item.vencimiento) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.monto)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={item.tone}>
                        {item.tone === "destructive" ? "Vencido" : "Pendiente"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {pendingItems.length > pendingItemsTop.length && (
            <p className="mt-2 text-xs text-muted-foreground">
              +{pendingItems.length - pendingItemsTop.length} más — revisá cada módulo para el detalle
              completo.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 font-semibold">
              <Zap className="h-4 w-4 text-primary" />
              Acciones rápidas
            </h2>
            <div className="flex flex-col divide-y divide-border">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-center gap-3 py-2.5 transition-colors first:pt-2 last:pb-1 hover:text-primary"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{action.title}</span>
                      <p className="truncate text-xs text-muted-foreground">{action.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 font-semibold">
              <CalendarClock className="h-4 w-4 text-primary" />
              Esta semana
            </h2>
            <div className="flex flex-col divide-y divide-border text-sm">
              <Link
                href="/agenda"
                className="flex items-center justify-between py-2 transition-colors first:pt-2 hover:text-primary"
              >
                <span className="text-muted-foreground">Recordatorios pendientes</span>
                <span className="font-semibold">{pendingAgenda}</span>
              </Link>
              <Link
                href="/calendario"
                className="flex items-center justify-between py-2 transition-colors last:pb-1 hover:text-primary"
              >
                <span className="text-muted-foreground">Eventos en el calendario</span>
                <span className="font-semibold">{weekEvents}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <DashboardCharts
        donutData={donutData}
        showCostosFijos={!restrictedModules.includes("costos-fijos" as never)}
      />
    </div>
  );
}