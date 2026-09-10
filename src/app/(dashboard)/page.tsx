import { connectDB } from "@/lib/db";
import { Employee } from "@/models/Employee";
import { PayrollEntry } from "@/models/PayrollEntry";
import { FixedCostEntry } from "@/models/FixedCost";
import { Check } from "@/models/Check";
import { AgendaEntry } from "@/models/AgendaEntry";
import { Users, Wallet, Receipt, Landmark, AlertTriangle, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function DashboardPage() {
  await connectDB();

  const periodStart = startOfMonth(new Date());
  const todayStart = startOfToday();
  const in7Days = new Date(todayStart);
  in7Days.setDate(in7Days.getDate() + 7);

  const [activeEmployees, payrollEntries, pendingFixedCosts, activeChecks, pendingAgenda] =
    await Promise.all([
      Employee.countDocuments({ active: true }),
      PayrollEntry.find({ period: periodStart }).lean(),
      FixedCostEntry.find({ period: periodStart, paid: false }).lean(),
      Check.find({ status: "ACTIVO" }).lean(),
      AgendaEntry.countDocuments({ sent: false, date: { $gte: todayStart, $lte: in7Days } }),
    ]);

  const totalPayroll = payrollEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalPendingFixedCosts = pendingFixedCosts.reduce((sum, e) => sum + e.amount, 0);

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

  const stats = [
    {
      title: "Empleados activos",
      value: String(activeEmployees),
      icon: Users,
      bar: "bg-primary",
      iconWrap: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      title: "Sueldos del mes",
      value: formatCurrency(totalPayroll),
      icon: Wallet,
      bar: "bg-success",
      iconWrap: "bg-success/10",
      iconColor: "text-success",
    },
    {
      title: "Costos fijos pendientes",
      value: formatCurrency(totalPendingFixedCosts),
      icon: Receipt,
      bar: "bg-warning",
      iconWrap: "bg-warning/10",
      iconColor: "text-warning",
    },
    {
      title: "Cheques por vencer (7 días)",
      value: String(checksDueSoon),
      icon: Landmark,
      bar: "bg-warning",
      iconWrap: "bg-warning/10",
      iconColor: "text-warning",
    },
    {
      title: "Cheques vencidos",
      value: String(checksOverdue),
      icon: AlertTriangle,
      bar: "bg-destructive",
      iconWrap: "bg-destructive/10",
      iconColor: "text-destructive",
    },
    {
      title: "Agenda: pendientes esta semana",
      value: String(pendingAgenda),
      icon: CalendarClock,
      bar: "bg-violet",
      iconWrap: "bg-violet/10",
      iconColor: "text-violet",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Vista general del mes en curso.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="overflow-hidden">
              <div className={`h-1.5 ${stat.bar}`} />
              <CardHeader className="flex-row items-center gap-3">
                <div className={`rounded-md p-2 ${stat.iconWrap}`}>
                  <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                </div>
                <CardTitle>{stat.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <CardValue>{stat.value}</CardValue>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}