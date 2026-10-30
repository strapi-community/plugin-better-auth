import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  IconButton,
  Loader,
  Main,
  Typography,
} from "@strapi/design-system";
import { Trash } from "@strapi/icons";
import { Layouts } from "@strapi/strapi/admin";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { client, getAuthHeaders } from "../../client";
import { Avatar } from "../../components/Avatar";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { MonoChip } from "../../components/FormPrimitives";
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
    <Main data-testid="sessions-page">
      <Layouts.Header
        title="Sessions"
        subtitle={
          usersWithSessions.length > 0
            ? `${usersWithSessions.length} user${usersWithSessions.length !== 1 ? "s" : ""} with active sessions`
            : "Active sessions across all users"
        }
        primaryAction={
          someSelected && (
            <Button
              variant="danger-light"
              onClick={() => setConfirmRevokeMany(true)}
              data-testid="revoke-selected-btn"
            >
              Revoke sessions for {selected.size} user
              {selected.size !== 1 ? "s" : ""}
            </Button>
          )
        }
      />

      <Layouts.Content>
        <Flex direction="column" alignItems="stretch" gap={4}>
          {sessionsQuery.isError && (
            <Alert closeLabel="Close" title="Error" variant="danger">
              {sessionsQuery.error instanceof Error
                ? sessionsQuery.error.message
                : "An error occurred"}
            </Alert>
          )}

          <Box background="neutral0" hasRadius shadow="tableShadow">
            {sessionsQuery.isLoading ? (
              <Flex justifyContent="center" padding={8}>
                <Loader>Loading sessions…</Loader>
              </Flex>
            ) : usersWithSessions.length === 0 ? (
              <Flex justifyContent="center" padding={8}>
                <Typography textColor="neutral600">
                  No active sessions
                </Typography>
              </Flex>
            ) : (
              <>
                <Flex
                  gap={3}
                  paddingTop={3}
                  paddingBottom={3}
                  paddingLeft={4}
                  paddingRight={4}
                  borderColor="neutral150"
                  borderStyle="solid"
                  borderWidth="0 0 1px 0"
                >
                  <Checkbox
                    checked={
                      allSelected
                        ? true
                        : someSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all users"
                  />
                  <Typography variant="sigma" textColor="neutral600">
                    User / Sessions
                  </Typography>
                  <Box marginLeft="auto">
                    <Typography variant="sigma" textColor="neutral600">
                      Sessions
                    </Typography>
                  </Box>
                </Flex>

                {usersWithSessions.map((userRow, i) => (
                  <Box
                    key={userRow.id}
                    data-testid="session-user-row"
                    borderColor="neutral150"
                    borderStyle="solid"
                    borderWidth={
                      i === usersWithSessions.length - 1 ? "0px" : "0 0 1px 0"
                    }
                  >
                    <Flex
                      gap={3}
                      paddingTop={3}
                      paddingBottom={3}
                      paddingLeft={4}
                      paddingRight={4}
                    >
                      <Checkbox
                        checked={selected.has(userRow.id)}
                        onCheckedChange={() => toggleSelect(userRow.id)}
                        aria-label={`Select ${userRow.name}`}
                      />
                      <Avatar name={userRow.name ?? ""} src={null} size={32} />
                      <Flex
                        direction="column"
                        alignItems="flex-start"
                        flex={1}
                        minWidth={0}
                      >
                        <Typography
                          fontWeight="semiBold"
                          textColor="neutral800"
                        >
                          {userRow.name}
                        </Typography>
                        <Typography variant="pi" textColor="neutral600">
                          {userRow.email}
                        </Typography>
                      </Flex>
                      <Badge size="S" variant="primary">
                        {userRow.sessions.length} session
                        {userRow.sessions.length !== 1 ? "s" : ""}
                      </Badge>
                    </Flex>

                    {userRow.sessions.map((session) => (
                      <Flex
                        key={session.id}
                        data-testid="session-row"
                        alignItems="flex-start"
                        justifyContent="space-between"
                        gap={4}
                        background="neutral100"
                        paddingTop={3}
                        paddingBottom={3}
                        paddingRight={4}
                        style={{ paddingLeft: "6.4rem" }}
                        borderColor="neutral150"
                        borderStyle="solid"
                        borderWidth="1px 0 0 0"
                      >
                        <Flex
                          direction="column"
                          alignItems="flex-start"
                          gap={1}
                          flex={1}
                          minWidth={0}
                        >
                          <Flex gap={2} alignItems="center" wrap="wrap">
                            {session.ipAddress && (
                              <MonoChip>{session.ipAddress}</MonoChip>
                            )}
                            <Typography variant="pi" textColor="neutral600">
                              Created{" "}
                              {new Date(session.createdAt).toLocaleString()} ·
                              Expires{" "}
                              {new Date(session.expiresAt).toLocaleString()}
                            </Typography>
                          </Flex>
                          {session.userAgent && (
                            <Typography
                              variant="pi"
                              textColor="neutral500"
                              ellipsis
                              maxWidth="40rem"
                            >
                              {session.userAgent}
                            </Typography>
                          )}
                        </Flex>
                        <IconButton
                          label="Revoke session"
                          variant="ghost"
                          onClick={() => setConfirmRevokeSessionId(session.id)}
                          data-testid="revoke-session-btn"
                        >
                          <Trash />
                        </IconButton>
                      </Flex>
                    ))}
                  </Box>
                ))}
              </>
            )}
          </Box>

          {usersWithSessions.length === PAGE_SIZE && (
            <Flex justifyContent="flex-end" gap={2}>
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
          )}
        </Flex>
      </Layouts.Content>

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
    </Main>
  );
}
