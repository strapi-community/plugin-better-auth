import { Flex, Loader } from "@strapi/design-system";
import { Page, useFetchClient } from "@strapi/strapi/admin";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "react-query";
import styled, { keyframes } from "styled-components";
import { client } from "../../client";
import { Avatar } from "../../components/Avatar";
import { PERMISSIONS } from "../../constants";
import { PLUGIN_ID } from "../../pluginId";

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg: "#f6f6f9",
  bgCard: "#ffffff",
  bgCardHover: "#f9f9fc",
  border: "#eaeaef",
  borderHover: "rgba(73,69,255,0.35)",
  accent: "#4945ff",
  accentDim: "rgba(73,69,255,0.1)",
  green: "#5cb176",
  greenDim: "rgba(92,177,118,0.12)",
  amber: "#d9822f",
  amberDim: "rgba(217,130,47,0.12)",
  red: "#d02b20",
  redDim: "rgba(208,43,32,0.1)",
  purple: "#8460b8",
  purpleDim: "rgba(132,96,184,0.12)",
  textPrimary: "#32324d",
  textSecondary: "#666687",
  textMuted: "#b8b8c7",
  mono: `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace`,
};

// ─── Keyframes ────────────────────────────────────────────────────────────────

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Layout ───────────────────────────────────────────────────────────────────

const Wrap = styled.div`
  padding: 28px 32px 48px;
  background: ${T.bg};
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 22px;
`;

const SectionDivider = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: -6px;
`;

const DivLabel = styled.span`
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${T.textMuted};
  white-space: nowrap;
`;

const DivLine = styled.div`
  flex: 1;
  height: 1px;
  background: ${T.border};
`;

// ─── Glass card ───────────────────────────────────────────────────────────────

const Card = styled.div<{ $delay?: number }>`
  background: ${T.bgCard};
  border: 1px solid ${T.border};
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  animation: ${fadeUp} 380ms ease both;
  animation-delay: ${(p) => (p.$delay ?? 0) * 55}ms;
  transition: border-color 200ms, box-shadow 200ms;
  &:hover {
    border-color: ${T.borderHover};
    box-shadow: 0 0 0 1px ${T.borderHover}, 0 8px 32px rgba(124,109,250,0.07);
  }
`;

// ─── Period pill toggle ───────────────────────────────────────────────────────

const PillGroup = styled.div`
  display: flex;
  background: rgba(0,0,0,0.03);
  border: 1px solid ${T.border};
  border-radius: 9px;
  padding: 3px;
  gap: 2px;
`;

const Pill = styled.button<{ $active: boolean }>`
  appearance: none;
  border: none;
  cursor: pointer;
  padding: 5px 16px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  transition: background 180ms, color 180ms;
  background: ${(p) => (p.$active ? T.accent : "transparent")};
  color: ${(p) => (p.$active ? "#fff" : T.textSecondary)};
  &:hover {
    background: ${(p) => (p.$active ? T.accent : "rgba(0,0,0,0.05)")};
    color: ${(p) => (p.$active ? "#fff" : T.textPrimary)};
  }
`;

// ─── Stat strip ───────────────────────────────────────────────────────────────

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  @media (max-width: 1200px) { grid-template-columns: repeat(3, 1fr); }
`;

const StatCard = styled(Card)<{ $accent: string }>`
  padding: 18px 20px 0;
  &::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: ${(p) => p.$accent};
    opacity: 0.75;
  }
`;

const StatLabel = styled.div`
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${T.textMuted};
  margin-bottom: 10px;
`;

const StatValue = styled.div`
  font-size: 30px;
  font-weight: 800;
  color: ${T.textPrimary};
  line-height: 1;
  letter-spacing: -0.045em;
  font-variant-numeric: tabular-nums;
  margin-bottom: 10px;
`;

const TrendBadge = styled.span<{ $pos: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.03em;
  background: ${(p) => (p.$pos ? T.greenDim : T.redDim)};
  color: ${(p) => (p.$pos ? T.green : T.red)};
  margin-bottom: 12px;
`;

const SparkWrap = styled.div`
  height: 44px;
  margin: 0 -20px;
`;

// ─── Chart card ───────────────────────────────────────────────────────────────

const ChartCard = styled(Card)`
  padding: 20px 20px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ChartHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
`;

const ChartTitle = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: ${T.textPrimary};
  letter-spacing: 0.01em;
`;

const SeriesRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const SeriesBtn = styled.button<{ $on: boolean; $c: string }>`
  appearance: none;
  border: 1px solid ${(p) => (p.$on ? `${p.$c}55` : T.border)};
  background: ${(p) => (p.$on ? `${p.$c}18` : "transparent")};
  color: ${(p) => (p.$on ? p.$c : T.textMuted)};
  font-size: 10px;
  font-weight: 600;
  padding: 3px 10px 3px 8px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 160ms;
  &:hover {
    border-color: ${(p) => `${p.$c}88`};
    color: ${(p) => p.$c};
    background: ${(p) => `${p.$c}22`};
  }
`;

const SDot = styled.span<{ $c: string }>`
  width: 6px; height: 6px;
  border-radius: 50%;
  background: ${(p) => p.$c};
  display: inline-block;
  flex-shrink: 0;
`;

const HoverInfo = styled.div`
  font-size: 11px;
  color: ${T.textSecondary};
  font-variant-numeric: tabular-nums;
  font-family: ${T.mono};
  min-height: 15px;
`;

// ─── Two-panel row ────────────────────────────────────────────────────────────

const TwoPanel = styled.div<{ $ratio?: string }>`
  display: grid;
  grid-template-columns: ${(p) => p.$ratio ?? "1fr 288px"};
  gap: 10px;
  align-items: stretch;
  @media (max-width: 900px) { grid-template-columns: 1fr; }
`;

// ─── Feed card ────────────────────────────────────────────────────────────────

const FeedCard = styled(Card)`
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const FeedHead = styled.div`
  padding: 13px 16px 9px;
  border-bottom: 1px solid ${T.border};
  font-size: 11px;
  font-weight: 700;
  color: ${T.textPrimary};
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const FeedSelect = styled.select`
  appearance: none;
  border: 1px solid ${T.border};
  border-radius: 6px;
  background: ${T.bgCard};
  color: ${T.textSecondary};
  font-size: 10px;
  font-weight: 600;
  padding: 3px 22px 3px 8px;
  cursor: pointer;
  outline: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666687'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 7px center;
  transition: border-color 160ms;
  &:hover, &:focus { border-color: ${T.accent}; color: ${T.textPrimary}; }
`;

const FeedScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: ${T.textMuted}; border-radius: 2px; }
`;

const FeedItem = styled.div`
  padding: 9px 14px;
  border-bottom: 1px solid #f0f0f5;
  display: flex;
  flex-direction: column;
  gap: 3px;
  transition: background 130ms;
  &:hover { background: #fafaff; }
  &:last-child { border-bottom: none; }
`;

const FeedTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
`;

const FeedName = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: ${T.textPrimary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FeedEmail = styled.span`
  font-size: 10px;
  color: ${T.textSecondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
`;

const FeedMeta = styled.span`
  font-size: 9px;
  color: ${T.textMuted};
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
`;

// ─── Retention chart ─────────────────────────────────────────────────────────

const RtnCard = styled(Card)`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const RtnRow = styled.div<{ $hov: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px;
  border-radius: 7px;
  transition: background 130ms;
  background: ${(p) => (p.$hov ? "#f0f0f6" : "transparent")};
  cursor: default;
`;

const RtnLabel = styled.span`
  font-size: 10px;
  color: ${T.textSecondary};
  min-width: 80px;
  text-align: right;
  white-space: nowrap;
`;

const RtnSize = styled.span`
  font-size: 9px;
  color: ${T.textMuted};
  min-width: 52px;
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
`;

const RtnTrack = styled.div`
  flex: 1;
  height: 10px;
  background: #eaeaef;
  border-radius: 4px;
  overflow: hidden;
`;

const RtnBar = styled.div<{ $w: number; $hue: number }>`
  width: ${(p) => Math.max(p.$w, 0.5)}%;
  height: 100%;
  background: hsl(${(p) => p.$hue}, 60%, 50%);
  border-radius: 4px;
  transition: width 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94);
`;

const RtnPct = styled.span<{ $hue: number }>`
  font-size: 10px;
  font-weight: 700;
  color: hsl(${(p) => p.$hue}, 60%, 60%);
  min-width: 38px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-family: ${T.mono};
`;

const RtnTip = styled.div`
  font-size: 10px;
  color: ${T.textSecondary};
  min-height: 14px;
  font-variant-numeric: tabular-nums;
  padding: 0 6px;
`;

// ─── Ring cards (active users) ────────────────────────────────────────────────

const RingGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const RingCard = styled(Card)`
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
`;

const RingInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const RingVal = styled.div`
  font-size: 24px;
  font-weight: 800;
  color: ${T.textPrimary};
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
`;

const RingLabel = styled.div`
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${T.textMuted};
`;

// ─── Empty state ──────────────────────────────────────────────────────────────

const Empty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: ${T.textMuted};
  font-size: 12px;
  gap: 8px;
`;

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 850) {
  const [count, setCount] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    let raf: number;
    let start = 0;
    const from = prevRef.current;
    const diff = target - from;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setCount(Math.round(from + eased * diff));
      if (progress < 1) raf = requestAnimationFrame(step);
      else prevRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return count;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({
  data,
  color,
  id,
}: {
  data: number[];
  color: string;
  id: string;
}) {
  const W = 300;
  const H = 44;
  if (data.length < 2) return <svg width="100%" height={H} />;
  const min = Math.min(...data);
  const max = Math.max(...data, min + 1);
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - 3 - ((v - min) / (max - min)) * (H - 8),
  }));
  const line = pts.reduce((a, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const pr = pts[i - 1];
    const cx = (pr.x + p.x) / 2;
    return `${a} C ${cx} ${pr.y} ${cx} ${p.y} ${p.x} ${p.y}`;
  }, "");
  const area = `${line} L ${pts.at(-1)!.x} ${H} L 0 ${H} Z`;
  const gid = `spk-${id}`;
  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden={true}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        stroke={color}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Growth area chart ────────────────────────────────────────────────────────

type GraphRow = {
  label: string;
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
};

const ALL_SERIES = [
  { key: "totalUsers" as const, color: T.accent, label: "Total" },
  { key: "newUsers" as const, color: T.green, label: "New" },
  { key: "activeUsers" as const, color: T.amber, label: "Active" },
];

function GrowthChart({
  data,
  hovered,
  onHover,
  activeSeries,
}: {
  data: GraphRow[];
  hovered: number | null;
  onHover: (i: number | null) => void;
  activeSeries: Set<string>;
}) {
  const W = 600;
  const H = 200;
  const PL = 40;
  const PR = 12;
  const PT = 12;
  const PB = 28;
  const CW = W - PL - PR;
  const CH = H - PT - PB;

  if (!data.length) {
    return (
      <Empty>
        <div style={{ fontSize: 24 }}>📊</div>
        <div>No growth data for this period</div>
      </Empty>
    );
  }

  const active = ALL_SERIES.filter((s) => activeSeries.has(s.key));
  const allVals = data.flatMap((d) => active.map((s) => d[s.key]));
  const maxV = Math.max(...allVals, 10);
  const yMax = Math.ceil(maxV * 1.15);

  const xp = (i: number) => PL + (i / Math.max(data.length - 1, 1)) * CW;
  const yp = (v: number) => PT + (1 - v / yMax) * CH;

  const smooth = (vals: number[]) => {
    const pts = vals.map((v, i) => ({ x: xp(i), y: yp(v) }));
    const path = pts.reduce((a, p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const pr = pts[i - 1];
      const cx = (pr.x + p.x) / 2;
      return `${a} C ${cx} ${pr.y} ${cx} ${p.y} ${p.x} ${p.y}`;
    }, "");
    const area = `${path} L ${pts.at(-1)!.x} ${PT + CH} L ${pts[0].x} ${PT + CH} Z`;
    return { pts, path, area };
  };

  const lines = active.map((s) => ({
    ...s,
    ...smooth(data.map((d) => d[s.key])),
  }));
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const v = (yMax * (4 - i)) / 4;
    return { v: Math.round(v), y: yp(v) };
  });
  const step = Math.max(1, Math.ceil(data.length / 8));
  const segW = CW / Math.max(data.length - 1, 1);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
      aria-label="User growth chart"
      role="img"
    >
      <defs>
        {lines.map((s) => (
          <linearGradient
            key={s.key}
            id={`ag-${s.key}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {yTicks.map((t) => (
        <g key={t.v}>
          <line
            x1={PL}
            y1={t.y}
            x2={W - PR}
            y2={t.y}
            stroke="#eaeaef"
            strokeWidth="1"
          />
          <text
            x={PL - 6}
            y={t.y + 4}
            textAnchor="end"
            fill={T.textMuted}
            fontSize="9"
          >
            {t.v >= 1000 ? `${(t.v / 1000).toFixed(1)}k` : t.v}
          </text>
        </g>
      ))}
      <line
        x1={PL}
        y1={PT + CH}
        x2={W - PR}
        y2={PT + CH}
        stroke="#eaeaef"
        strokeWidth="1"
      />

      {lines.map((s) => (
        <path key={`area-${s.key}`} d={s.area} fill={`url(#ag-${s.key})`} />
      ))}
      {lines.map((s) => (
        <path
          key={`line-${s.key}`}
          d={s.path}
          stroke={s.color}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {data.map((d, i) => {
        if (i % step !== 0 && i !== data.length - 1) return null;
        return (
          <text
            key={i}
            x={xp(i)}
            y={H - 6}
            textAnchor="middle"
            fill={T.textMuted}
            fontSize="9"
          >
            {d.label}
          </text>
        );
      })}

      {data.map((d, i) => {
        const isHov = hovered === i;
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: SVG chart hover
          <g
            key={i}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
            style={{ cursor: "crosshair" }}
          >
            <rect
              x={xp(i) - segW / 2}
              y={PT}
              width={segW}
              height={CH}
              fill="transparent"
            />
            {isHov && (
              <line
                x1={xp(i)}
                y1={PT}
                x2={xp(i)}
                y2={PT + CH}
                stroke="rgba(50,50,77,0.2)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            )}
            {lines.map((s) => (
              <circle
                key={s.key}
                cx={xp(i)}
                cy={yp(d[s.key])}
                r={isHov ? 4 : 2.5}
                fill={s.color}
                stroke={T.bg}
                strokeWidth={isHov ? 2 : 1}
                opacity={isHov ? 1 : 0.5}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({
  value,
  max,
  color,
  size = 56,
}: {
  value: number;
  max: number;
  color: string;
  size?: number;
}) {
  const r = (size - 9) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / Math.max(max, 1), 1);
  const offset = circ * (1 - pct);
  return (
    <svg
      width={size}
      height={size}
      style={{ flexShrink: 0 }}
      aria-hidden={true}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="7"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeDasharray={`${circ} ${circ}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{
          transition: "stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </svg>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function relTime(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function rateHue(r: number) {
  return r >= 70 ? 142 : r >= 40 ? 38 : 4;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type User = {
  id: string;
  name: string;
  email: string;
  image?: string;
  emailVerified: boolean;
  banned?: boolean;
  createdAt: string | Date;
};

type StrapiSession = {
  id: number;
  documentId: string;
  userId: number;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

type ActiveUser = {
  id: number;
  documentId: string;
  name: string;
  email: string;
  image?: string | null;
  createdAt: string;
};

type RetentionRow = {
  n: number;
  label: string;
  cohortStart: string;
  cohortEnd: string;
  activeStart: string;
  activeEnd: string;
  cohortSize: number;
  retentionRate: number;
};

// ─── Stat card with count-up ──────────────────────────────────────────────────

function StatItem({
  id,
  label,
  value,
  pct,
  sparkline,
  color,
  delay = 0,
}: {
  id: string;
  label: string;
  value: number;
  pct?: number;
  sparkline?: number[];
  color: string;
  delay?: number;
}) {
  const animated = useCountUp(value);
  const isPos = pct === undefined || pct >= 0;
  return (
    <StatCard $delay={delay} $accent={color}>
      <StatLabel>{label}</StatLabel>
      <StatValue>{animated.toLocaleString()}</StatValue>
      {pct !== undefined && (
        <TrendBadge $pos={isPos}>
          {isPos ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
        </TrendBadge>
      )}
      {sparkline && sparkline.length > 1 && (
        <SparkWrap>
          <Sparkline data={sparkline} color={color} id={id} />
        </SparkWrap>
      )}
    </StatCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function OverviewPage() {
  const { get } = useFetchClient();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">(
    "weekly",
  );
  const [feedMode, setFeedMode] = useState<"signups" | "active">("signups");
  const [hovIdx, setHovIdx] = useState<number | null>(null);
  const [rtnHov, setRtnHov] = useState<number | null>(null);
  const [activeSeries, setActiveSeries] = useState(
    () => new Set(["totalUsers", "newUsers", "activeUsers"]),
  );

  const toggleSeries = (key: string) => {
    setActiveSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key) && next.size > 1) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const statsQuery = useQuery({
    queryKey: ["dash-user-stats"],
    queryFn: async () => {
      const r = await client.dash.userStats();
      if (r.error) throw new Error(r.error.message ?? "Failed");
      return r.data;
    },
  });

  const graphQuery = useQuery({
    queryKey: ["dash-user-graph", period],
    queryFn: async () => {
      const r = await client.dash.userGraphData({ query: { period } });
      if (r.error) throw new Error(r.error.message ?? "Failed");
      return r.data;
    },
  });

  const retentionQuery = useQuery({
    queryKey: ["dash-user-retention", period],
    queryFn: async () => {
      const r = await client.dash.userRetentionData({ query: { period } });
      if (r.error) throw new Error(r.error.message ?? "Failed");
      return r.data;
    },
  });

  const usersQuery = useQuery({
    queryKey: ["dash-recent-users"],
    queryFn: async () => {
      const r = await client.dash.listUsers({
        query: { limit: 12, offset: 0, sortBy: "createdAt", sortOrder: "desc" },
      });
      if (r.error) throw new Error(r.error.message ?? "Failed");
      return r.data;
    },
  });

  const sessionsQuery = useQuery({
    queryKey: ["dash-recent-sessions"],
    queryFn: async () => {
      const { data } = await get<{ results: StrapiSession[] }>(
        "/better-auth-dashboard/db?uid=plugin::better-auth.session&pagination[pageSize]=12&sort[0]=updatedAt:desc",
      );
      return (data as { results?: StrapiSession[] }).results ?? [];
    },
    refetchInterval: 30_000,
  });

  const orgsQuery = useQuery({
    queryKey: ["dash-orgs-count"],
    queryFn: async () => {
      const r = await (client.dash as any).listOrganizations({
        query: { page: 1, limit: 1 },
      });
      if (r.error) throw new Error(r.error.message ?? "Failed");
      return r.data;
    },
  });

  // Derive ordered unique userIds from sessions for the "recently active" feed
  const sessionsRaw = sessionsQuery.data ?? [];
  const activeUserIds: string[] = [];
  const lastActiveByUserId = new Map<string, string>();
  for (const s of sessionsRaw) {
    const uid = String(s.userId);
    if (!lastActiveByUserId.has(uid)) {
      lastActiveByUserId.set(uid, s.updatedAt ?? s.createdAt);
      activeUserIds.push(uid);
    }
  }

  const activeUsersQuery = useQuery({
    queryKey: ["dash-active-users", activeUserIds],
    queryFn: async () => {
      if (activeUserIds.length === 0) return [];
      const params = new URLSearchParams({ uid: "plugin::better-auth.user" });
      for (let i = 0; i < activeUserIds.length; i++) {
        params.set(`filters[id][$in][${i}]`, activeUserIds[i]);
      }
      params.set("pagination[pageSize]", "12");
      const { data } = await get<{ results: ActiveUser[] }>(
        `/better-auth-dashboard/db?${params}`,
      );
      return (data as { results?: ActiveUser[] }).results ?? [];
    },
    enabled: feedMode === "active" && activeUserIds.length > 0,
  });

  // Match FeedCard height to ChartCard height via ResizeObserver
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(0);
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setChartHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (statsQuery.isLoading) {
    return (
      <Flex
        justifyContent="center"
        alignItems="center"
        padding={12}
        style={{ background: T.bg, minHeight: "100%" }}
      >
        <Loader>Loading…</Loader>
      </Flex>
    );
  }

  const stats = statsQuery.data;
  if (!stats) return null;

  const graphData = (graphQuery.data?.data ?? []) as GraphRow[];
  const rtnData = (retentionQuery.data?.data ?? []) as RetentionRow[];
  const users = (usersQuery.data?.users ?? []) as User[];
  const orgCount = (orgsQuery.data as any)?.total ?? 0;

  // Build sorted active users (session order preserved, joined with user docs)
  const activeUserMap = new Map<string, ActiveUser>();
  for (const u of activeUsersQuery.data ?? []) {
    activeUserMap.set(String(u.id), u);
  }
  const sortedActiveUsers = activeUserIds
    .map((uid) => activeUserMap.get(uid))
    .filter((u): u is ActiveUser => u !== undefined);

  const totalSpark = graphData.map((d) => d.totalUsers);
  const newSpark = graphData.map((d) => d.newUsers);
  const activeSpark = graphData.map((d) => d.activeUsers);

  const hovRow = hovIdx !== null ? graphData[hovIdx] : null;
  const rtnHovRow = rtnHov !== null ? rtnData[rtnHov] : null;

  const activeMax = Math.max(
    stats.activeUsers.daily.active ?? 0,
    stats.activeUsers.weekly.active ?? 0,
    stats.activeUsers.monthly.active ?? 0,
    1,
  );

  return (
    <Wrap data-testid="overview-page">
      {/* ── Header ── */}
      <Flex justifyContent="space-between" alignItems="flex-end">
        <div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: T.textPrimary,
              letterSpacing: "-0.03em",
            }}
          >
            Overview
          </div>
          <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4 }}>
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
        <PillGroup>
          {(["daily", "weekly", "monthly"] as const).map((p) => (
            <Pill key={p} $active={period === p} onClick={() => setPeriod(p)}>
              {p[0].toUpperCase() + p.slice(1)}
            </Pill>
          ))}
        </PillGroup>
      </Flex>

      {/* ── Metrics ── */}
      <SectionDivider>
        <DivLabel>Metrics</DivLabel>
        <DivLine />
      </SectionDivider>

      <StatGrid>
        <StatItem
          id="total"
          label="Total Users"
          value={stats.total ?? 0}
          sparkline={totalSpark}
          color={T.accent}
          delay={0}
        />
        <StatItem
          id="d-sig"
          label="Daily Sign-ups"
          value={stats.daily.signUps ?? 0}
          pct={stats.daily.percentage ?? undefined}
          sparkline={newSpark}
          color={T.green}
          delay={1}
        />
        <StatItem
          id="w-sig"
          label="Weekly Sign-ups"
          value={stats.weekly.signUps ?? 0}
          pct={stats.weekly.percentage ?? undefined}
          sparkline={newSpark}
          color={T.green}
          delay={2}
        />
        <StatItem
          id="m-sig"
          label="Monthly Sign-ups"
          value={stats.monthly.signUps ?? 0}
          pct={stats.monthly.percentage ?? undefined}
          sparkline={newSpark}
          color={T.green}
          delay={3}
        />
        <StatItem
          id="orgs"
          label="Organizations"
          value={orgCount}
          color={T.purple}
          delay={4}
        />
      </StatGrid>

      {/* ── Growth ── */}
      <SectionDivider>
        <DivLabel>Growth</DivLabel>
        <DivLine />
      </SectionDivider>

      <TwoPanel>
        <ChartCard ref={chartRef} $delay={5}>
          <ChartHeader>
            <ChartTitle>User Growth</ChartTitle>
            <SeriesRow>
              {ALL_SERIES.map((s) => (
                <SeriesBtn
                  key={s.key}
                  $on={activeSeries.has(s.key)}
                  $c={s.color}
                  onClick={() => toggleSeries(s.key)}
                >
                  <SDot $c={s.color} />
                  {s.label}
                </SeriesBtn>
              ))}
            </SeriesRow>
          </ChartHeader>
          <HoverInfo>
            {hovRow
              ? `${hovRow.label}  ·  ${hovRow.totalUsers.toLocaleString()} total  ·  +${hovRow.newUsers.toLocaleString()} new  ·  ${hovRow.activeUsers.toLocaleString()} active`
              : "Hover the chart to inspect a data point"}
          </HoverInfo>
          {graphQuery.isLoading ? (
            <Flex
              justifyContent="center"
              alignItems="center"
              style={{ flex: 1, minHeight: 170 }}
            >
              <Loader>Loading…</Loader>
            </Flex>
          ) : (
            <GrowthChart
              data={graphData}
              hovered={hovIdx}
              onHover={setHovIdx}
              activeSeries={activeSeries}
            />
          )}
        </ChartCard>

        <FeedCard
          $delay={6}
          style={chartHeight > 0 ? { height: chartHeight } : undefined}
        >
          <FeedHead>
            <span>
              {feedMode === "signups" ? "Recent Sign-ups" : "Recently Active"}
            </span>
            <FeedSelect
              value={feedMode}
              onChange={(e) =>
                setFeedMode(e.target.value as "signups" | "active")
              }
            >
              <option value="signups">Recent Sign-ups</option>
              <option value="active">Recently Active</option>
            </FeedSelect>
          </FeedHead>
          <FeedScroll>
            {feedMode === "signups" ? (
              usersQuery.isLoading ? (
                <Flex justifyContent="center" padding={4}>
                  <Loader>Loading…</Loader>
                </Flex>
              ) : users.length === 0 ? (
                <Empty>No users yet</Empty>
              ) : (
                users.map((u) => (
                  <FeedItem key={u.id}>
                    <FeedTop>
                      <Flex alignItems="center" gap={1} style={{ minWidth: 0 }}>
                        <Avatar name={u.name} src={u.image} size={20} />
                        <FeedName title={u.name}>{u.name}</FeedName>
                      </Flex>
                      <FeedMeta>{relTime(u.createdAt)}</FeedMeta>
                    </FeedTop>
                    <FeedEmail title={u.email}>{u.email}</FeedEmail>
                  </FeedItem>
                ))
              )
            ) : activeUsersQuery.isLoading || sessionsQuery.isLoading ? (
              <Flex justifyContent="center" padding={4}>
                <Loader>Loading…</Loader>
              </Flex>
            ) : sortedActiveUsers.length === 0 ? (
              <Empty>No recent activity</Empty>
            ) : (
              sortedActiveUsers.map((u) => (
                <FeedItem key={u.documentId}>
                  <FeedTop>
                    <Flex alignItems="center" gap={1} style={{ minWidth: 0 }}>
                      <Avatar
                        name={u.name}
                        src={u.image ?? undefined}
                        size={20}
                      />
                      <FeedName title={u.name}>{u.name}</FeedName>
                    </Flex>
                    <FeedMeta>
                      {relTime(
                        lastActiveByUserId.get(String(u.id)) ?? u.createdAt,
                      )}
                    </FeedMeta>
                  </FeedTop>
                  <FeedEmail title={u.email}>{u.email}</FeedEmail>
                </FeedItem>
              ))
            )}
          </FeedScroll>
        </FeedCard>
      </TwoPanel>

      {/* ── Retention & Activity ── */}
      <SectionDivider>
        <DivLabel>Retention &amp; Activity</DivLabel>
        <DivLine />
      </SectionDivider>

      <TwoPanel>
        <RtnCard $delay={7}>
          <ChartHeader>
            <ChartTitle>Cohort Retention</ChartTitle>
            <Flex alignItems="center" gap={2}>
              {[
                { hue: 142, label: "≥70%" },
                { hue: 38, label: "40–70%" },
                { hue: 4, label: "<40%" },
              ].map(({ hue, label }) => (
                <Flex
                  key={hue}
                  alignItems="center"
                  gap={1}
                  style={{ marginLeft: 8 }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: `hsl(${hue},60%,50%)`,
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 9, color: T.textMuted }}>
                    {label}
                  </span>
                </Flex>
              ))}
            </Flex>
          </ChartHeader>

          <RtnTip>
            {rtnHovRow
              ? `Cohort ${rtnHovRow.label} · ${rtnHovRow.cohortSize.toLocaleString()} users · active ${rtnHovRow.activeStart} – ${rtnHovRow.activeEnd}`
              : "Hover a row to see cohort details"}
          </RtnTip>

          {retentionQuery.isLoading ? (
            <Flex
              justifyContent="center"
              alignItems="center"
              style={{ minHeight: 80 }}
            >
              <Loader>Loading…</Loader>
            </Flex>
          ) : rtnData.length === 0 ? (
            <Empty>
              <div style={{ fontSize: 22 }}>📉</div>
              <div>No retention data for this period</div>
            </Empty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {rtnData.map((row, i) => {
                const hue = rateHue(row.retentionRate);
                return (
                  <RtnRow
                    key={row.n}
                    $hov={rtnHov === i}
                    onMouseEnter={() => setRtnHov(i)}
                    onMouseLeave={() => setRtnHov(null)}
                  >
                    <RtnLabel>{row.label}</RtnLabel>
                    <RtnSize>{row.cohortSize.toLocaleString()}</RtnSize>
                    <RtnTrack>
                      <RtnBar $w={row.retentionRate} $hue={hue} />
                    </RtnTrack>
                    <RtnPct $hue={hue}>{row.retentionRate.toFixed(1)}%</RtnPct>
                  </RtnRow>
                );
              })}
            </div>
          )}
        </RtnCard>

        <RingGrid>
          {(
            [
              {
                label: "Daily Active",
                value: stats.activeUsers.daily.active,
                pct: stats.activeUsers.daily.percentage,
                color: T.amber,
                sparkline: activeSpark,
                delay: 8,
              },
              {
                label: "Weekly Active",
                value: stats.activeUsers.weekly.active,
                pct: stats.activeUsers.weekly.percentage,
                color: T.green,
                sparkline: activeSpark,
                delay: 9,
              },
              {
                label: "Monthly Active",
                value: stats.activeUsers.monthly.active,
                pct: stats.activeUsers.monthly.percentage,
                color: T.accent,
                sparkline: activeSpark,
                delay: 10,
              },
            ] as const
          ).map(({ label, value, pct, color, delay }) => {
            const isPos = pct == null || pct >= 0;
            return (
              <RingCard key={label} $delay={delay}>
                <ProgressRing
                  value={value ?? 0}
                  max={activeMax}
                  color={color}
                  size={56}
                />
                <RingInfo>
                  <RingLabel>{label}</RingLabel>
                  <RingVal>{(value ?? 0).toLocaleString()}</RingVal>
                  {pct != null && (
                    <TrendBadge
                      $pos={isPos}
                      style={{ marginTop: 4, marginBottom: 0 }}
                    >
                      {isPos ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
                    </TrendBadge>
                  )}
                </RingInfo>
              </RingCard>
            );
          })}
        </RingGrid>
      </TwoPanel>
    </Wrap>
  );
}

export default function ProtectedOverviewPage() {
  return (
    <Page.Protect
      permissions={PERMISSIONS.overview.filter(
        (p) => p.action === `plugin::${PLUGIN_ID}.overview.read`,
      )}
    >
      <OverviewPage />
    </Page.Protect>
  );
}
