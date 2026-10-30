import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Grid,
  Loader,
  Main,
  SingleSelect,
  SingleSelectOption,
  Typography,
} from "@strapi/design-system";
import { Layouts, Page, useFetchClient } from "@strapi/strapi/admin";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useQuery } from "react-query";
import styled, { type DefaultTheme, useTheme } from "styled-components";
import { client } from "../../client";
import { Avatar } from "../../components/Avatar";
import { SegmentedControl } from "../../components/SegmentedControl";
import { PERMISSIONS } from "../../constants";
import { PLUGIN_ID } from "../../pluginId";

type ColorToken = keyof DefaultTheme["colors"];

const CARD = {
  background: "neutral0",
  hasRadius: true,
  shadow: "tableShadow",
} as const;

// ─── Layout ───────────────────────────────────────────────────────────────────

const TwoPanel = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30rem;
  gap: ${({ theme }) => theme.spaces[4]};
  align-items: stretch;
  @media (max-width: 900px) { grid-template-columns: 1fr; }
`;

// Feed fills the grid cell so the chart alone decides the row height.
const FeedSlot = styled.div`
  position: relative;

  & > * {
    position: absolute;
    inset: 0;
  }

  @media (max-width: 900px) {
    min-height: 32rem;
  }
`;

function SectionDivider({ label }: { label: string }) {
  return (
    <Flex gap={3} alignItems="center">
      <Typography variant="sigma" textColor="neutral600">
        {label}
      </Typography>
      <Box flex={1}>
        <Divider />
      </Box>
    </Flex>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Flex justifyContent="center" padding={8}>
      <Typography variant="omega" textColor="neutral500">
        {children}
      </Typography>
    </Flex>
  );
}

function Dot({ color }: { color: ColorToken }) {
  return (
    <Box
      tag="span"
      background={color}
      width="0.8rem"
      height="0.8rem"
      display="inline-block"
      shrink={0}
      style={{ borderRadius: "50%" }}
      aria-hidden
    />
  );
}

function TrendBadge({ pct }: { pct: number }) {
  const isPos = pct >= 0;
  return (
    <Badge size="S" variant={isPos ? "success" : "danger"}>
      {isPos ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
    </Badge>
  );
}

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

const ALL_SERIES: {
  key: keyof Omit<GraphRow, "label">;
  color: ColorToken;
  label: string;
}[] = [
  { key: "totalUsers", color: "primary600", label: "Total" },
  { key: "newUsers", color: "success500", label: "New" },
  { key: "activeUsers", color: "warning500", label: "Active" },
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
  const { colors } = useTheme();
  const W = 600;
  const H = 200;
  const PL = 40;
  const PR = 12;
  const PT = 12;
  const PB = 28;
  const CW = W - PL - PR;
  const CH = H - PT - PB;

  if (!data.length) {
    return <Empty>No growth data for this period</Empty>;
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
    hex: colors[s.color],
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
            <stop offset="0%" stopColor={s.hex} stopOpacity="0.18" />
            <stop offset="100%" stopColor={s.hex} stopOpacity="0" />
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
            stroke={colors.neutral150}
            strokeWidth="1"
          />
          <text
            x={PL - 6}
            y={t.y + 4}
            textAnchor="end"
            fill={colors.neutral500}
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
        stroke={colors.neutral150}
        strokeWidth="1"
      />

      {lines.map((s) => (
        <path key={`area-${s.key}`} d={s.area} fill={`url(#ag-${s.key})`} />
      ))}
      {lines.map((s) => (
        <path
          key={`line-${s.key}`}
          d={s.path}
          stroke={s.hex}
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
            fill={colors.neutral500}
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
                stroke={colors.neutral300}
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
                fill={s.hex}
                stroke={colors.neutral0}
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
  color: ColorToken;
  size?: number;
}) {
  const { colors } = useTheme();
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
        stroke={colors.neutral150}
        strokeWidth="7"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={colors[color]}
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

function rateColor(r: number): ColorToken {
  return r >= 70 ? "success500" : r >= 40 ? "warning500" : "danger500";
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
}: {
  id: string;
  label: string;
  value: number;
  pct?: number;
  sparkline?: number[];
  color: ColorToken;
}) {
  const { colors } = useTheme();
  const animated = useCountUp(value);
  return (
    <Flex
      {...CARD}
      direction="column"
      alignItems="stretch"
      overflow="hidden"
      height="100%"
    >
      <Box height="0.2rem" background={color} />
      <Flex
        direction="column"
        alignItems="flex-start"
        gap={2}
        paddingTop={4}
        paddingLeft={5}
        paddingRight={5}
        paddingBottom={sparkline && sparkline.length > 1 ? 2 : 5}
      >
        <Typography variant="sigma" textColor="neutral600">
          {label}
        </Typography>
        <Typography variant="alpha" tag="p" textColor="neutral800">
          {animated.toLocaleString()}
        </Typography>
        {pct !== undefined && <TrendBadge pct={pct} />}
      </Flex>
      {sparkline && sparkline.length > 1 && (
        <Box marginTop="auto" height="4.4rem">
          <Sparkline data={sparkline} color={colors[color]} id={id} />
        </Box>
      )}
    </Flex>
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

  if (statsQuery.isLoading) {
    return (
      <Flex justifyContent="center" alignItems="center" padding={12}>
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

  const hovRow = hovIdx !== null ? graphData[hovIdx] : null;
  const rtnHovRow = rtnHov !== null ? rtnData[rtnHov] : null;

  const activeMax = Math.max(
    stats.activeUsers.daily.active ?? 0,
    stats.activeUsers.weekly.active ?? 0,
    stats.activeUsers.monthly.active ?? 0,
    1,
  );

  const renderFeedItem = (
    key: string,
    name: string,
    email: string,
    image: string | null | undefined,
    when: string | Date,
  ) => (
    <Box
      key={key}
      paddingTop={2}
      paddingBottom={2}
      paddingLeft={4}
      paddingRight={4}
      borderColor="neutral150"
      borderStyle="solid"
      borderWidth="0 0 1px 0"
    >
      <Flex justifyContent="space-between" gap={2}>
        <Flex alignItems="center" gap={2} minWidth={0}>
          <Avatar name={name} src={image} size={20} />
          <Typography
            variant="omega"
            fontWeight="semiBold"
            textColor="neutral800"
            ellipsis
            title={name}
          >
            {name}
          </Typography>
        </Flex>
        <Typography variant="pi" textColor="neutral500" shrink={0}>
          {relTime(when)}
        </Typography>
      </Flex>
      <Typography
        variant="pi"
        textColor="neutral600"
        ellipsis
        tag="div"
        title={email}
      >
        {email}
      </Typography>
    </Box>
  );

  return (
    <Main data-testid="overview-page">
      <Layouts.Header
        title="Overview"
        subtitle={new Date().toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
        primaryAction={
          <SegmentedControl.Root
            label="Period"
            value={period}
            onChange={(v) => setPeriod(v as typeof period)}
          >
            <SegmentedControl.Item value="daily">Daily</SegmentedControl.Item>
            <SegmentedControl.Item value="weekly">Weekly</SegmentedControl.Item>
            <SegmentedControl.Item value="monthly">
              Monthly
            </SegmentedControl.Item>
          </SegmentedControl.Root>
        }
      />

      <Layouts.Content>
        <Flex
          direction="column"
          alignItems="stretch"
          gap={6}
          paddingBottom={10}
        >
          {/* ── Metrics ── */}
          <SectionDivider label="Metrics" />

          <Grid.Root
            gap={4}
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))",
            }}
          >
            <StatItem
              id="total"
              label="Total Users"
              value={stats.total ?? 0}
              sparkline={totalSpark}
              color="primary600"
            />
            <StatItem
              id="d-sig"
              label="Daily Sign-ups"
              value={stats.daily.signUps ?? 0}
              pct={stats.daily.percentage ?? undefined}
              sparkline={newSpark}
              color="success500"
            />
            <StatItem
              id="w-sig"
              label="Weekly Sign-ups"
              value={stats.weekly.signUps ?? 0}
              pct={stats.weekly.percentage ?? undefined}
              sparkline={newSpark}
              color="success500"
            />
            <StatItem
              id="m-sig"
              label="Monthly Sign-ups"
              value={stats.monthly.signUps ?? 0}
              pct={stats.monthly.percentage ?? undefined}
              sparkline={newSpark}
              color="success500"
            />
            <StatItem
              id="orgs"
              label="Organizations"
              value={orgCount}
              color="alternative600"
            />
          </Grid.Root>

          {/* ── Growth ── */}
          <SectionDivider label="Growth" />

          <TwoPanel>
            <Flex
              {...CARD}
              direction="column"
              alignItems="stretch"
              gap={3}
              padding={5}
            >
              <Flex justifyContent="space-between" gap={3}>
                <Typography variant="delta" tag="h2">
                  User Growth
                </Typography>
                <Flex gap={2}>
                  {ALL_SERIES.map((s) => {
                    const on = activeSeries.has(s.key);
                    return (
                      <Button
                        key={s.key}
                        size="S"
                        variant={on ? "secondary" : "tertiary"}
                        aria-pressed={on}
                        startIcon={<Dot color={on ? s.color : "neutral300"} />}
                        onClick={() => toggleSeries(s.key)}
                      >
                        {s.label}
                      </Button>
                    );
                  })}
                </Flex>
              </Flex>
              <Typography variant="pi" textColor="neutral600" tag="p">
                {hovRow
                  ? `${hovRow.label}  ·  ${hovRow.totalUsers.toLocaleString()} total  ·  +${hovRow.newUsers.toLocaleString()} new  ·  ${hovRow.activeUsers.toLocaleString()} active`
                  : "Hover the chart to inspect a data point"}
              </Typography>
              {graphQuery.isLoading ? (
                <Flex
                  justifyContent="center"
                  alignItems="center"
                  minHeight="17rem"
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
            </Flex>

            <FeedSlot>
              <Flex
                {...CARD}
                direction="column"
                alignItems="stretch"
                overflow="hidden"
              >
                <Flex
                  justifyContent="space-between"
                  gap={2}
                  padding={4}
                  borderColor="neutral150"
                  borderStyle="solid"
                  borderWidth="0 0 1px 0"
                >
                  <Typography variant="pi" fontWeight="bold">
                    {feedMode === "signups"
                      ? "Recent Sign-ups"
                      : "Recently Active"}
                  </Typography>
                  <Box width="15rem">
                    <SingleSelect
                      size="S"
                      aria-label="Feed"
                      value={feedMode}
                      onChange={(v: string | number) =>
                        setFeedMode(v as "signups" | "active")
                      }
                    >
                      <SingleSelectOption value="signups">
                        Recent Sign-ups
                      </SingleSelectOption>
                      <SingleSelectOption value="active">
                        Recently Active
                      </SingleSelectOption>
                    </SingleSelect>
                  </Box>
                </Flex>
                <Box flex={1} overflow="auto" minHeight={0}>
                  {feedMode === "signups" ? (
                    usersQuery.isLoading ? (
                      <Flex justifyContent="center" padding={4}>
                        <Loader small>Loading…</Loader>
                      </Flex>
                    ) : users.length === 0 ? (
                      <Empty>No users yet</Empty>
                    ) : (
                      users.map((u) =>
                        renderFeedItem(
                          u.id,
                          u.name,
                          u.email,
                          u.image,
                          u.createdAt,
                        ),
                      )
                    )
                  ) : activeUsersQuery.isLoading || sessionsQuery.isLoading ? (
                    <Flex justifyContent="center" padding={4}>
                      <Loader small>Loading…</Loader>
                    </Flex>
                  ) : sortedActiveUsers.length === 0 ? (
                    <Empty>No recent activity</Empty>
                  ) : (
                    sortedActiveUsers.map((u) =>
                      renderFeedItem(
                        u.documentId,
                        u.name,
                        u.email,
                        u.image,
                        lastActiveByUserId.get(String(u.id)) ?? u.createdAt,
                      ),
                    )
                  )}
                </Box>
              </Flex>
            </FeedSlot>
          </TwoPanel>

          {/* ── Retention & Activity ── */}
          <SectionDivider label="Retention & Activity" />

          <TwoPanel>
            <Flex
              {...CARD}
              direction="column"
              alignItems="stretch"
              gap={3}
              padding={5}
            >
              <Flex justifyContent="space-between" gap={3}>
                <Typography variant="delta" tag="h2">
                  Cohort Retention
                </Typography>
                <Flex gap={3}>
                  {(
                    [
                      { color: "success500", label: "≥70%" },
                      { color: "warning500", label: "40–70%" },
                      { color: "danger500", label: "<40%" },
                    ] as const
                  ).map(({ color, label }) => (
                    <Flex key={color} alignItems="center" gap={1}>
                      <Dot color={color} />
                      <Typography variant="pi" textColor="neutral600">
                        {label}
                      </Typography>
                    </Flex>
                  ))}
                </Flex>
              </Flex>

              <Typography variant="pi" textColor="neutral600" tag="p">
                {rtnHovRow
                  ? `Cohort ${rtnHovRow.label} · ${rtnHovRow.cohortSize.toLocaleString()} users · active ${rtnHovRow.activeStart} – ${rtnHovRow.activeEnd}`
                  : "Hover a row to see cohort details"}
              </Typography>

              {retentionQuery.isLoading ? (
                <Flex
                  justifyContent="center"
                  alignItems="center"
                  minHeight="8rem"
                >
                  <Loader>Loading…</Loader>
                </Flex>
              ) : rtnData.length === 0 ? (
                <Empty>No retention data for this period</Empty>
              ) : (
                <Flex direction="column" alignItems="stretch" gap={1}>
                  {rtnData.map((row, i) => {
                    const color = rateColor(row.retentionRate);
                    return (
                      <Flex
                        key={row.n}
                        gap={3}
                        padding={1}
                        hasRadius
                        background={rtnHov === i ? "neutral100" : undefined}
                        onMouseEnter={() => setRtnHov(i)}
                        onMouseLeave={() => setRtnHov(null)}
                      >
                        <Typography
                          variant="pi"
                          textColor="neutral600"
                          textAlign="right"
                          minWidth="8rem"
                        >
                          {row.label}
                        </Typography>
                        <Typography
                          variant="pi"
                          textColor="neutral500"
                          textAlign="right"
                          minWidth="5.2rem"
                        >
                          {row.cohortSize.toLocaleString()}
                        </Typography>
                        <Box
                          flex={1}
                          height="1rem"
                          background="neutral150"
                          hasRadius
                          overflow="hidden"
                        >
                          <Box
                            height="100%"
                            background={color}
                            hasRadius
                            style={{
                              width: `${Math.max(row.retentionRate, 0.5)}%`,
                              transition: "width 0.55s ease",
                            }}
                          />
                        </Box>
                        <Typography
                          variant="pi"
                          fontWeight="bold"
                          textColor={color}
                          textAlign="right"
                          minWidth="3.8rem"
                        >
                          {row.retentionRate.toFixed(1)}%
                        </Typography>
                      </Flex>
                    );
                  })}
                </Flex>
              )}
            </Flex>

            <Flex direction="column" alignItems="stretch" gap={4}>
              {(
                [
                  {
                    label: "Daily Active",
                    value: stats.activeUsers.daily.active,
                    pct: stats.activeUsers.daily.percentage,
                    color: "warning500",
                  },
                  {
                    label: "Weekly Active",
                    value: stats.activeUsers.weekly.active,
                    pct: stats.activeUsers.weekly.percentage,
                    color: "success500",
                  },
                  {
                    label: "Monthly Active",
                    value: stats.activeUsers.monthly.active,
                    pct: stats.activeUsers.monthly.percentage,
                    color: "primary600",
                  },
                ] as const
              ).map(({ label, value, pct, color }) => (
                <Flex key={label} {...CARD} gap={4} padding={5} flex={1}>
                  <ProgressRing
                    value={value ?? 0}
                    max={activeMax}
                    color={color}
                    size={56}
                  />
                  <Flex direction="column" alignItems="flex-start" gap={1}>
                    <Typography variant="sigma" textColor="neutral600">
                      {label}
                    </Typography>
                    <Typography variant="beta" tag="p" textColor="neutral800">
                      {(value ?? 0).toLocaleString()}
                    </Typography>
                    {pct != null && <TrendBadge pct={pct} />}
                  </Flex>
                </Flex>
              ))}
            </Flex>
          </TwoPanel>
        </Flex>
      </Layouts.Content>
    </Main>
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
