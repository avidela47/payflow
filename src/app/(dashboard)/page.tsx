import Link from "next/link";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Employee } from "@/models/Employee";
import { Client } from "@/models/Client";
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
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { MaskedAmount } from "@/components/masked-amount";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Rediseño: en vez de solo KPIs sueltos, el dashboard ahora es un
// "lanzador" de los 10 módulos — cada tile muestra un número vivo (sacado
// de la base) para que sirva de vistazo general, no solo de menú. Notas
// es privado por usuario, así que ese conteo se filtra por
// session.user.id — nunca mostramos el total de notas de todos.
export default async function DashboardPage() {
  await connectDB();
  const session = await getSession();

  const periodStart = startOfMonth(new Date());
  const todayStart = startOfToday();
  const in7Days = new Date(todayStart);
  in7Days.setDate(in7Days.getDate() + 7);

  const [
    activeEmployees,
    totalClients,
    payrollEntries,
    pendingFixedCosts,
    activeChecks,
    pendingAgenda,
    weekEvents,
    vaultCount,
    myNotesCount,
  ] = await Promise.all([
    Employee.countDocuments({ active: true }),
    Client.countDocuments({}),
    PayrollEntry.find({ period: periodStart }).lean(),
    FixedCostEntry.find({ period: periodStart, paid: false }).lean(),
    Check.find({ status: "ACTIVO" }).lean(),
    AgendaEntry.countDocuments({ sent: false, date: { $gte: todayStart, $lte: in7Days } }),
    CalendarEvent.countDocuments({ startsAt: { $gte: todayStart, $lte: in7Days } }),
    VaultEntry.countDocuments({}),
    session?.user ? Note.countDocuments({ user: session.user.id }) : Promise.resolve(0),
  ]);

  const totalPayroll = payrollEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalPendingFixedCosts = pendingFixedCosts.reduce((sum, e) => sum + e.amount, 0);

  // Mismo criterio que la página de Cheques (daysUntil por cheque activo)
  // para que estos números coincidan siempre con los badges que se ven ahí.
  const now = new Date();
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Vista general de PayFlow.</p>
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
                <h2 className="font-semibold">{mod.title}</h2>
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
  );
}