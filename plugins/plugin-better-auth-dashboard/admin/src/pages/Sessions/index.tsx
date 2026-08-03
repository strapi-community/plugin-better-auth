import {
  Button,
  Checkbox,
  Flex,
  IconButton,
  Loader,
} from "@strapi/design-system";
import { Trash } from "@strapi/icons";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import styled, { keyframes } from "styled-components";
import { client, getAuthHeaders } from "../../client";
import { Avatar } from "../../components/Avatar";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { withContext } from "../../utils/dashContext";

const PAGE_SIZE = 25;

type UserWithSessions = {
  id: string;
  name: string;
  email: string;
  sessions: {
    id: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    createdAt: string;
    expiresAt: string;
  }[];
};

// ─── Animations ───────────────────────────────────────────────────────────────

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Layout ───────────────────────────────────────────────────────────────────

const Wrap = styled.div`
  padding: 28px 32px;
  background: #f6f6f9;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const PageTitle = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: #32324d;
  letter-spacing: -0.03em;
`;

const PageSubtitle = styled.p`
  margin: 0;
  font-size: 12px;
  color: #8e8ea9;
`;

// ─── Table card ───────────────────────────────────────────────────────────────

const TableCard = styled.div`
  background: #ffffff;
  border: 1px solid #eaeaef;
  border-radius: 10px;
  overflow: hidden;
`;

// ─── Column header bar ────────────────────────────────────────────────────────

const ColumnHeader = styled.div`
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fafafa;
  border-bottom: 1px solid #eaeaef;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8e8ea9;
`;

const ColumnHeaderRight = styled.div`
  margin-left: auto;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8e8ea9;
`;

// ─── User row group ───────────────────────────────────────────────────────────

const UserGroup = styled.div<{ $i?: number }>`
  border-bottom: 1px solid #eaeaef;
  animation: ${fadeUp} 280ms ease both;
  animation-delay: ${(p) => (p.$i ?? 0) * 30}ms;
  &:last-child { border-bottom: none; }
`;

const UserRowHeader = styled.div`
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #f5f5f9;
  cursor: default;
  &:hover { background: #fafafe; }
`;

const UserInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const UserName = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: #32324d;
`;

const UserEmail = styled.span`
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 11px;
  color: #8e8ea9;
`;

// ─── Session count badge ──────────────────────────────────────────────────────

const SessionCountChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 700;
  background: #f0f0ff;
  color: #4945ff;
`;

// ─── Session sub-row ──────────────────────────────────────────────────────────

const SessionCard = styled.div`
  padding: 10px 20px 10px 64px;
  border-top: 1px solid #f5f5f9;
  background: #fafafa;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  &:hover { background: #f5f5ff; }
`;

const SessionMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
`;

const IpChip = styled.span`
  display: inline-block;
  background: #f0f0ff;
  color: #4945ff;
  border-radius: 5px;
  padding: 2px 6px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 11px;
  font-weight: 600;
`;

const TimestampText = styled.span`
  font-size: 11px;
  color: #8e8ea9;
  font-variant-numeric: tabular-nums;
`;

const AgentText = styled.span`
  font-size: 11px;
  color: #b8b8c7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
  max-width: 400px;
`;

// ─── Empty / loading ──────────────────────────────────────────────────────────

const EmptyState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 48px;
  font-size: 12px;
  color: #8e8ea9;
`;

// ─── Component ────────────────────────────────────────────────────────────────

export function SessionsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmRevokeSessionId, setConfirmRevokeSessionId] = useState<
    string | null
  >(null);
  const [confirmRevokeMany, setConfirmRevokeMany] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: ["dash-all-sessions", page],
    queryFn: async () => {
      // biome-ignore lint/suspicious/noExplicitAny: listAllSessions is a custom endpoint not in the upstream @better-auth/infra types
      const result = await (client.dash as any).listAllSessions({});
      if (result.error)
        throw new Error(result.error.message ?? "Failed to load sessions");
      return (result.data ?? []) as UserWithSessions[];
    },
    keepPreviousData: true,
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const result = await client.dash.sessions.revoke(
        {},
        withContext({ sessionId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(result.error.message ?? "Revoke failed");
    },
    onSuccess: () => {
      setConfirmRevokeSessionId(null);
      qc.invalidateQueries({ queryKey: ["dash-all-sessions"] });
    },
  });

  const revokeManyMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const result = await client.dash.sessions.revokeMany(
        {},
        withContext({ userIds } as never, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(result.error.message ?? "Revoke failed");
      return result.data;
    },
    onSuccess: () => {
      setConfirmRevokeMany(false);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["dash-all-sessions"] });
    },
  });

  const usersWithSessions = sessionsQuery.data ?? [];
  const allUserIds = usersWithSessions.map((u) => u.id);
  const allSelected =
    allUserIds.length > 0 && allUserIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allUserIds));
  };

  return (
    <Wrap data-testid="sessions-page">
      <PageHeader>
        <TitleBlock>
          <PageTitle>Sessions</PageTitle>
          <PageSubtitle>
            {usersWithSessions.length > 0
              ? `${usersWithSessions.length} user${usersWithSessions.length !== 1 ? "s" : ""} with active sessions`
              : "Active sessions across all users"}
          </PageSubtitle>
        </TitleBlock>
        {someSelected && (
          <Button
            variant="danger-light"
            size="S"
            onClick={() => setConfirmRevokeMany(true)}
            data-testid="revoke-selected-btn"
          >
            Revoke sessions for {selected.size} user
            {selected.size !== 1 ? "s" : ""}
          </Button>
        )}
      </PageHeader>

      {sessionsQuery.isError && (
        <div style={{ color: "#d02b20", fontSize: 12, padding: "8px 0" }}>
          {sessionsQuery.error instanceof Error
            ? sessionsQuery.error.message
            : "An error occurred"}
        </div>
      )}

      <TableCard>
        {sessionsQuery.isLoading ? (
          <Flex justifyContent="center" padding={8}>
            <Loader>Loading sessions…</Loader>
          </Flex>
        ) : usersWithSessions.length === 0 ? (
          <EmptyState>No active sessions</EmptyState>
        ) : (
          <>
            <ColumnHeader>
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all users"
              />
              <span>User / Sessions</span>
              <ColumnHeaderRight>Sessions</ColumnHeaderRight>
            </ColumnHeader>

            {usersWithSessions.map((userRow, i) => (
              <UserGroup key={userRow.id} $i={i} data-testid="session-user-row">
                <UserRowHeader>
                  <Checkbox
                    checked={selected.has(userRow.id)}
                    onCheckedChange={() => toggleSelect(userRow.id)}
                    aria-label={`Select ${userRow.name}`}
                  />
                  <Avatar name={userRow.name ?? ""} src={null} size={30} />
                  <UserInfo>
                    <UserName>{userRow.name}</UserName>
                    <UserEmail>{userRow.email}</UserEmail>
                  </UserInfo>
                  <SessionCountChip>
                    {userRow.sessions.length} session
                    {userRow.sessions.length !== 1 ? "s" : ""}
                  </SessionCountChip>
                </UserRowHeader>

                {userRow.sessions.map((session) => (
                  <SessionCard key={session.id} data-testid="session-row">
                    <SessionMeta>
                      <Flex
                        gap={2}
                        alignItems="center"
                        style={{ flexWrap: "wrap" }}
                      >
                        {session.ipAddress && (
                          <IpChip>{session.ipAddress}</IpChip>
                        )}
                        <TimestampText>
                          Created {new Date(session.createdAt).toLocaleString()}{" "}
                          · Expires{" "}
                          {new Date(session.expiresAt).toLocaleString()}
                        </TimestampText>
                      </Flex>
                      {session.userAgent && (
                        <AgentText>{session.userAgent}</AgentText>
                      )}
                    </SessionMeta>
                    <IconButton
                      label="Revoke session"
                      onClick={() => setConfirmRevokeSessionId(session.id)}
                      style={{ flexShrink: 0 }}
                      data-testid="revoke-session-btn"
                    >
                      <Trash />
                    </IconButton>
                  </SessionCard>
                ))}
              </UserGroup>
            ))}
          </>
        )}
      </TableCard>

      {usersWithSessions.length === PAGE_SIZE && (
        <Flex justifyContent="flex-end">
          <Flex gap={2}>
            <Button
              variant="tertiary"
              size="S"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="tertiary"
              size="S"
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </Flex>
        </Flex>
      )}

      {confirmRevokeSessionId && (
        <ConfirmDialog
          title="Revoke session"
          message="Are you sure you want to revoke this session? The user will be signed out on this device."
          confirmLabel="Revoke"
          loading={revokeSessionMutation.isLoading}
          onConfirm={() => revokeSessionMutation.mutate(confirmRevokeSessionId)}
          onCancel={() => setConfirmRevokeSessionId(null)}
        />
      )}

      {confirmRevokeMany && (
        <ConfirmDialog
          title={`Revoke sessions for ${selected.size} user${selected.size !== 1 ? "s" : ""}`}
          message={`Are you sure you want to revoke all sessions for ${selected.size} user${selected.size !== 1 ? "s" : ""}? They will be signed out on all their devices.`}
          confirmLabel="Revoke all"
          loading={revokeManyMutation.isLoading}
          onConfirm={() => revokeManyMutation.mutate([...selected])}
          onCancel={() => setConfirmRevokeMany(false)}
        />
      )}
    </Wrap>
  );
}
