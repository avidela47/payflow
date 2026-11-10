"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { formatCurrency, cn } from "@/lib/utils";
import { SpotlightCard } from "@/components/spotlight-card";

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

export type CostosDonutSlice = { name: string; value: number };

// Barras Ventas vs Compras del mes en curso — reemplaza dos tarjetas KPI
// sueltas (Ventas del mes / Compras del mes) por una sola comparación
// visual, igual de rápida de leer pero menos repetitiva que dos cuadros
// idénticos con solo el título distinto.
export function VentasComprasBarChart({ ventas, compras }: { ventas: number; compras: number }) {
  const data = [
    { name: "Ventas", value: ventas },
    { name: "Compras", value: compras },
  ];
  const hasData = ventas > 0 || compras > 0;

  if (!hasData) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Todavía no hay ventas ni compras cargadas este mes.
      </div>
    );
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis hide domain={[0, "auto"]} />
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value) || 0), "Total"]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
            }}
          />
          <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={72}>
            <Cell className="fill-success" />
            <Cell className="fill-violet" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
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
  donutData,
  showCostosFijos = true,
}: {
  donutData: CostosDonutSlice[];
  // Para usuarios con ese módulo restringido (ver User.restrictedModules).
  showCostosFijos?: boolean;
}) {
  if (!showCostosFijos) return null;

  return (
    <SpotlightCard className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-1 font-semibold">Costos fijos pendientes por categoría</h2>
      <p className="mb-4 text-xs text-muted-foreground">Del mes en curso, sin pagar todavía.</p>
      <CostosDonutChart data={donutData} />
    </SpotlightCard>
  );
}