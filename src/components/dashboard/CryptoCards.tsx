import { ReactNode } from "react";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  RadialBar, RadialBarChart, PolarAngleAxis, Line, LineChart,
} from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Point = { x: string | number; y: number };

export function StatCard({
  label, value, delta, icon, spark, accent = "primary",
}: {
  label: string; value: ReactNode; delta?: number;
  icon?: ReactNode; spark?: Point[];
  accent?: "primary" | "accent" | "success" | "warning" | "destructive";
}) {
  const up = (delta ?? 0) >= 0;
  const stroke = `var(--${accent})`;
  const id = `g-${label.replace(/\W+/g, "")}-${accent}`;
  return (
    <div className="stat-glass p-5 tilt-3d">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-accent pulse-dot" />{label}
          </div>
          <div className="font-display text-3xl font-bold neon-text">{value}</div>
          {delta !== undefined && (
            <div className={cn("inline-flex items-center gap-1 text-xs font-medium", up ? "neon-up" : "neon-down")}>
              {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {up ? "+" : ""}{delta.toFixed(1)}%
              <span className="text-muted-foreground/70">vs last term</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="grid size-10 place-items-center rounded-xl border border-border/60 bg-background/40 text-primary shadow-inner">
            {icon}
          </div>
        )}
      </div>
      {spark && spark.length > 1 && (
        <div className="-mx-2 -mb-1 mt-3 h-14">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="y" stroke={stroke} strokeWidth={2}
                fill={`url(#${id})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function ChartShell({ title, subtitle, children, right }: {
  title: string; subtitle?: string; children: ReactNode; right?: ReactNode;
}) {
  return (
    <div className="stat-glass p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
          {subtitle && <div className="mt-0.5 font-display text-lg font-semibold">{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function CurveChart({ data, dataKey = "y", color = "var(--primary)", height = 240 }: {
  data: { x: string; y: number }[]; dataKey?: string; color?: string; height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="curveStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="color-mix(in oklab, var(--border) 60%, transparent)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="x" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={36} />
          <Tooltip
            contentStyle={{
              background: "color-mix(in oklab, var(--card) 90%, transparent)",
              border: "1px solid var(--border)", borderRadius: 12,
              boxShadow: "0 10px 30px -10px rgba(0,0,0,.4)", color: "var(--foreground)",
            }}
            cursor={{ stroke: color, strokeOpacity: 0.4 }}
          />
          <Area type="monotone" dataKey={dataKey} stroke="url(#curveStroke)" strokeWidth={3}
            fill="url(#curveFill)" dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RadialScore({ value, label, color = "var(--accent)" }: {
  value: number; label: string; color?: string;
}) {
  const data = [{ name: label, value: Math.max(0, Math.min(100, value)), fill: color }];
  return (
    <div className="relative h-48">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={220} endAngle={-40}>
          <defs>
            <linearGradient id="radGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--primary)" />
            </linearGradient>
          </defs>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: "color-mix(in oklab, var(--muted) 60%, transparent)" }}
            dataKey="value" cornerRadius={20} fill="url(#radGrad)" />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-display text-4xl font-bold neon-text">{Math.round(value)}<span className="text-base text-muted-foreground">%</span></div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}

export function MiniLine({ data, color = "var(--accent)" }: { data: Point[]; color?: string }) {
  return (
    <div className="h-16">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="y" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DashboardHero({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: string }) {
  return (
    <div className="grid-bg relative overflow-hidden rounded-2xl border border-border/60 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {badge && (
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-accent">
              <span className="size-1.5 rounded-full bg-accent pulse-dot" />{badge}
            </div>
          )}
          <h2 className="font-display text-3xl font-bold neon-text md:text-4xl">{title}</h2>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="hidden text-right text-xs text-muted-foreground sm:block">
          <div className="font-mono">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</div>
          <div className="font-mono">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>
    </div>
  );
}
