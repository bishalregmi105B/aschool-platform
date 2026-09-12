"use client";
/**
 * Theme-matched Recharts wrappers so every chart in the product shares one
 * visual language: deep-green ramp from the brand palette, quiet grid,
 * tabular numerals, rounded tops on bars. Labels are bilingual via useI18n.
 */
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useI18n } from "@/lib/i18n";

/** Brand categorical ramp — ocean→mint family plus warm neutrals for
 *  contrast where 3+ series/segments sit side by side. */
export const CHART_COLORS = [
  "#155a44", // ocean-light (brand)
  "#2f8f6f", // mid green
  "#7cc5a4", // mint-leaning
  "#c5f4dd", // mint (light fill)
  "#0e3b2e", // ocean deep
  "#d9a441", // harvest gold (fees/money)
  "#b45f3f", // terracotta
  "#5b7fb9", // slate blue
];

const axisStyle = { fontSize: 10, fill: "var(--w11-text-secondary)" };
const gridStroke = "var(--w11-border-subtle)";
const cursorFill = "var(--w11-control-hover)";

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
}) {
  const { t } = useI18n();
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-[var(--w11-radius-md)] border border-[var(--w11-acrylic-border)] px-2.5 py-1.5"
      style={{
        background: "var(--w11-surface-flyout)",
        boxShadow: "var(--w11-elevation-flyout)",
        backdropFilter: "blur(24px) saturate(180%)",
      }}
    >
      {label !== undefined && (
        <p className="mb-0.5 text-[10px] font-medium text-[var(--w11-text-secondary)]">{label}</p>
      )}
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--w11-text-primary)]">
          <span className="h-2 w-2 rounded-sm" style={{ background: entry.color }} />
          {entry.name}: <span className="tabular-nums">{entry.value}</span>
        </p>
      ))}
      <span className="sr-only">{t("chart value", "चार्ट मान")}</span>
    </div>
  );
}

export function ThemedBarChart({
  data,
  xKey,
  bars,
  height = 220,
  stacked = false,
}: {
  data: Array<Record<string, unknown>>;
  xKey: string;
  bars: Array<{ key: string; name: string; ne?: string; color?: string }>;
  height?: number;
  stacked?: boolean;
}) {
  const { t } = useI18n();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: cursorFill, opacity: 0.5 }} />
        {bars.length > 1 && (
          <Legend
            formatter={(value) => {
              const bar = bars.find((b) => b.key === value);
              return <span style={{ fontSize: 11 }}>{bar?.ne ? t(bar.name, bar.ne) : value}</span>;
            }}
          />
        )}
        {bars.map((bar, i) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.name}
            fill={bar.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={[4, 4, 0, 0]}
            maxBarSize={42}
            stackId={stacked ? "a" : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ThemedLineChart({
  data,
  xKey,
  lines,
  height = 220,
}: {
  data: Array<Record<string, unknown>>;
  xKey: string;
  lines: Array<{ key: string; name: string; ne?: string; color?: string }>;
  height?: number;
}) {
  const { t } = useI18n();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} />
        {lines.length > 1 && (
          <Legend
            formatter={(value) => {
              const line = lines.find((l) => l.key === value);
              return <span style={{ fontSize: 11 }}>{line?.ne ? t(line.name, line.ne) : value}</span>;
            }}
          />
        )}
        {lines.map((line, i) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ThemedDonutChart({
  data,
  nameKey,
  valueKey,
  height = 200,
}: {
  data: Array<Record<string, unknown>>;
  nameKey: string;
  valueKey: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          innerRadius="58%"
          outerRadius="85%"
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
