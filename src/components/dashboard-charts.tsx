"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatCurrency, cn } from "@/lib/utils";

// Colores de las porciones de la dona — mismo criterio que los "bar" de
// las tarjetas de módulo: clases de Tailwind, nunca strings armados a
// mano (así el JIT las detecta y no las purga en producción).
const SLICE_CLASSES = [
  "fill-amber-500",
  "fill-blue-500",
  "fill-violet-500",
  "fill-rose-500",
  "fill-emerald-500",
  "fill-cyan-500",
  "fill-slate-400",
] as const;

const DOT_CLASSES = [
  "bg-amber-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-cyan-500",
  "bg-slate-400",
] as const;

export type SueldosLinePoint = { day: number; total: number };
export type CostosDonutSlice = { name: string; value: number };

// El importe de sueldos se enmascara en toda la app (ver MaskedAmount) —
// este gráfico respeta esa misma regla: se ve la tendencia, no el número.
// Por eso el eje Y va oculto y el tooltip muestra puntitos en vez del
// monto real.
function SueldosLineChart({ data }: { data: SueldosLinePoint[] }) {
  const hasData = data.some((d) => d.total > 0);

  return (
    <div className="h-56 w-full">
      {hasData ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              stroke="hsl(var(--muted-foreground))"
              interval={4}
            />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip
              formatter={() => ["••••••", "Acumulado"]}
              labelFormatter={(day) => `Día ${day}`}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
              }}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Todavía no hay liquidaciones este mes.
        </div>
      )}
    </div>
  );
}

function CostosDonutChart({ data }: { data: CostosDonutSlice[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        No hay costos fijos pendientes este mes.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <div className="h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="65%"
              outerRadius="100%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((slice, i) => (
                <Cell key={slice.name} className={SLICE_CLASSES[i % SLICE_CLASSES.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [formatCurrency(Number(value) || 0), String(name)]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {data.map((slice, i) => (
          <div key={slice.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT_CLASSES[i % DOT_CLASSES.length])}
              />
              {slice.name}
            </span>
            <span className="font-medium text-foreground">
              {total > 0 ? Math.round((slice.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardCharts({
  lineData,
  donutData,
}: {
  lineData: SueldosLinePoint[];
  donutData: CostosDonutSlice[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-1 font-semibold">Sueldos liquidados este mes</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Acumulado por día. El monto queda tapado, igual que en la tabla de Sueldos.
        </p>
        <SueldosLineChart data={lineData} />
      </div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-1 font-semibold">Costos fijos pendientes por categoría</h2>
        <p className="mb-4 text-xs text-muted-foreground">Del mes en curso, sin pagar todavía.</p>
        <CostosDonutChart data={donutData} />
      </div>
    </div>
  );
}
