// Isolates recharts so it ships in a lazy chunk, off the initial analytics
// route bundle. Import only via `React.lazy(() => import(...))`.
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type SeriesPoint = { date: string; revenue: number };
type PropertyPoint = { name: string; revenue: number };

export function RevenueAreaChart({
  data,
  fmtMoney,
}: {
  data: SeriesPoint[];
  fmtMoney: (n: number) => string;
}) {
  return (
    <ResponsiveContainer>
      <AreaChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} stroke="var(--muted-foreground)" fontSize={11} />
        <YAxis stroke="var(--muted-foreground)" fontSize={11} />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number, name) => [name === "revenue" ? fmtMoney(v) : v, name]}
        />
        <Area type="monotone" dataKey="revenue" stroke="var(--primary)" fill="url(#rev)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PropertyBarChart({
  data,
  fmtMoney,
}: {
  data: PropertyPoint[];
  fmtMoney: (n: number) => string;
}) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
        <YAxis type="category" dataKey="name" width={120} stroke="var(--muted-foreground)" fontSize={11} />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number) => fmtMoney(v)}
        />
        <Bar dataKey="revenue" fill="var(--primary)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
