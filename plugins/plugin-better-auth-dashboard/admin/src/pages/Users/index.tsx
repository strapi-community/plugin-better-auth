import {
  Button,
  Checkbox,
  Flex,
  IconButton,
  Loader,
  Searchbar,
  SearchForm,
} from "@strapi/design-system";
import { Pencil, Plus, Trash } from "@strapi/icons";
import { Page, useNotification, useRBAC } from "@strapi/strapi/admin";
import type React from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "react-query";
import styled, { keyframes } from "styled-components";
import { client, getAuthHeaders } from "../../client";
import { Avatar } from "../../components/Avatar";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PERMISSIONS } from "../../constants";
import type { DashConfig } from "../../hooks/useDashConfig";
import { hasPlugin } from "../../hooks/useDashConfig";
import { useUsers } from "../../hooks/useUsers";
import { PLUGIN_ID } from "../../pluginId";
import { withContext } from "../../utils/dashContext";
import { CreateUserDialog } from "./CreateUserDialog";
import { UserDetailDrawer } from "./UserDetailDrawer";

const PAGE_SIZE = 25;

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

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const TH = styled.th`
  text-align: left;
  padding: 10px 14px;
  font-size: 10px;
  font-weight: 700;
  color: #8e8ea9;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-bottom: 1px solid #eaeaef;
  background: #fafafa;
  white-space: nowrap;
  &:first-child { padding-left: 20px; }
  &:last-child  { padding-right: 20px; }
`;

const THCheck = styled(TH)`
  width: 44px;
`;

const THActions = styled(TH)`
  width: 80px;
`;

const TD = styled.td`
  padding: 11px 14px;
  font-size: 12px;
  color: #32324d;
  border-bottom: 1px solid #f5f5f9;
  vertical-align: middle;
  &:first-child { padding-left: 20px; }
  &:last-child  { padding-right: 20px; }
`;

const TDCheck = styled(TD)`
  width: 44px;
`;

const TDActions = styled(TD)`
  width: 80px;
`;

const TR = styled.tr<{ $selected?: boolean; $i?: number }>`
  animation: ${fadeUp} 280ms ease both;
  animation-delay: ${(p) => (p.$i ?? 0) * 25}ms;
  background: ${(p) => (p.$selected ? "#f0f0ff" : "transparent")};
  transition: background 120ms ease;
  &:hover td { background: ${(p) => (p.$selected ? "#e8e8ff" : "#fafafe")}; }
  &:last-child td { border-bottom: none; }
`;

// ─── Status chips ─────────────────────────────────────────────────────────────

const StatusChip = styled.span<{
  $variant: "verified" | "unverified" | "banned";
}>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 700;
  background: ${(p) =>
    p.$variant === "verified"
      ? "#eafbe7"
      : p.$variant === "banned"
        ? "#fcecea"
        : "#f0f0ff"};
  color: ${(p) =>
    p.$variant === "verified"
      ? "#5cb176"
      : p.$variant === "banned"
        ? "#d02b20"
        : "#8e8ea9"};

  &::before {
    content: '';
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: ${(p) =>
      p.$variant === "verified"
        ? "#5cb176"
        : p.$variant === "banned"
          ? "#d02b20"
          : "#b8b8c7"};
  }
`;

// ─── Misc text ────────────────────────────────────────────────────────────────

const MonoText = styled.span`
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 11px;
  color: #8e8ea9;
`;

const DateText = styled.span`
  font-size: 11px;
  color: #b8b8c7;
  font-variant-numeric: tabular-nums;
`;

const UserName = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: #32324d;
`;

// ─── Toolbar ──────────────────────────────────────────────────────────────────

const Toolbar = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 12px;
`;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  config: DashConfig;
}

export function UsersPage({ config }: Props) {
  const rbac = useRBAC(PERMISSIONS.user);
  const qc = useQueryClient();
  const { toggleNotification } = useNotification();
  const banEnabled = hasPlugin(config, "admin");
  const emailVerificationEnabled =
    config.emailVerification.sendVerificationEmailEnabled;
  const twoFactorEnabled = hasPlugin(config, "two-factor");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteMany, setConfirmDeleteMany] = useState(false);
  const [confirmBanMany, setConfirmBanMany] = useState(false);

  const offset = (page - 1) * PAGE_SIZE;
  const { data, isLoading, isError, error } = useUsers({
    limit: PAGE_SIZE,
    offset,
    search: search || undefined,
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const result = await client.dash.deleteUser(
        {},
        withContext({ userId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(result.error.message ?? "Delete failed");
    },
    onSuccess: () => {
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["dash-users"] });
      qc.invalidateQueries({ queryKey: ["dash-user-stats"] });
      toggleNotification({ type: "success", message: "User deleted" });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to delete user",
      });
    },
  });

  const deleteManyMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const result = await client.dash.deleteManyUsers(
        {},
        withContext({ userIds } as never, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(result.error.message ?? "Delete failed");
      return result.data;
    },
    onSuccess: (_data, userIds) => {
      setConfirmDeleteMany(false);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["dash-users"] });
      qc.invalidateQueries({ queryKey: ["dash-user-stats"] });
      toggleNotification({
        type: "success",
        message: `${userIds.length} user${userIds.length !== 1 ? "s" : ""} deleted`,
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to delete users",
      });
    },
  });

  const banManyMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const result = await client.dash.banManyUsers(
        {},
        withContext({ userIds } as never, getAuthHeaders()),
      );
      if (result.error) throw new Error(result.error.message ?? "Ban failed");
      return result.data;
    },
    onSuccess: (_data, userIds) => {
      setConfirmBanMany(false);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["dash-users"] });
      toggleNotification({
        type: "success",
        message: `${userIds.length} user${userIds.length !== 1 ? "s" : ""} banned`,
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to ban users",
      });
    },
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected =
    users.length > 0 && users.every((u) => selected.has(u.id));
  const someSelected = selected.size > 0;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map((u) => u.id)));
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <Page.Protect
      permissions={PERMISSIONS.user.filter(
        (p) => p.action === `plugin::${PLUGIN_ID}.user.read`,
      )}
    >
      <Wrap data-testid="users-page">
        <PageHeader>
          <TitleBlock>
            <PageTitle>Users</PageTitle>
            <PageSubtitle>
              {total.toLocaleString()} total
              {data?.onlineUsers ? ` · ${data.onlineUsers} online` : ""}
            </PageSubtitle>
          </TitleBlock>
          {rbac.allowedActions.canCreate && (
            <Button
              startIcon={<Plus />}
              onClick={() => setShowCreate(true)}
              data-testid="create-user-btn"
            >
              Create user
            </Button>
          )}
        </PageHeader>

        <Toolbar>
          <SearchForm onSubmit={handleSearch}>
            <Searchbar
              clearLabel="Clear"
              name="search"
              placeholder="Search by email…"
              value={searchInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchInput(e.target.value)
              }
              onClear={() => {
                setSearchInput("");
                setSearch("");
                setPage(1);
              }}
              data-testid="user-search"
            >
              Search users
            </Searchbar>
          </SearchForm>

          {someSelected && (
            <Flex gap={2}>
              {rbac.allowedActions.canDelete && (
                <Button
                  variant="danger-light"
                  size="S"
                  onClick={() => setConfirmDeleteMany(true)}
                  data-testid="delete-selected-btn"
                >
                  Delete {selected.size} selected
                </Button>
              )}
              {banEnabled && rbac.allowedActions.canUpdate && (
                <Button
                  variant="secondary"
                  size="S"
                  onClick={() => setConfirmBanMany(true)}
                >
                  Ban {selected.size} selected
                </Button>
              )}
            </Flex>
          )}
        </Toolbar>

        {isError && (
          <div style={{ color: "#d02b20", fontSize: 12, padding: "8px 0" }}>
            {(error as Error)?.message}
          </div>
        )}

        <TableCard>
          {isLoading ? (
            <Flex justifyContent="center" padding={8}>
              <Loader>Loading users…</Loader>
            </Flex>
          ) : (
            <Table>
              <thead>
                <tr>
                  {(rbac.allowedActions.canDelete ||
                    rbac.allowedActions.canUpdate) && (
                    <THCheck>
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </THCheck>
                  )}
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Status</TH>
                  <TH>Created</TH>
                  <THActions />
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <TD
                      colSpan={6}
                      style={{
                        textAlign: "center",
                        padding: "40px",
                        color: "#8e8ea9",
                      }}
                      data-testid="users-empty"
                    >
                      {search
                        ? `No users matching "${search}"`
                        : "No users found"}
                    </TD>
                  </tr>
                ) : (
                  users.map((user, i) => (
                    <TR
                      key={user.id}
                      $selected={selected.has(user.id)}
                      $i={i}
                      data-testid="user-row"
                    >
                      {(rbac.allowedActions.canDelete ||
                        rbac.allowedActions.canUpdate) && (
                        <TDCheck>
                          <Checkbox
                            checked={selected.has(user.id)}
                            onCheckedChange={() => toggleSelect(user.id)}
                            aria-label={`Select ${user.name}`}
                          />
                        </TDCheck>
                      )}
                      <TD>
                        <Flex alignItems="center" gap={2}>
                          <Avatar
                            name={user.name ?? ""}
                            src={user.image}
                            size={28}
                          />
                          <UserName>{user.name}</UserName>
                        </Flex>
                      </TD>
                      <TD>
                        <MonoText>{user.email}</MonoText>
                      </TD>
                      <TD>
                        <Flex gap={1}>
                          {user.emailVerified ? (
                            <StatusChip $variant="verified">
                              Verified
                            </StatusChip>
                          ) : (
                            <StatusChip $variant="unverified">
                              Unverified
                            </StatusChip>
                          )}
                          {user.banned && (
                            <StatusChip $variant="banned">Banned</StatusChip>
                          )}
                        </Flex>
                      </TD>
                      <TD>
                        <DateText>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </DateText>
                      </TD>
                      <TDActions>
                        <Flex gap={1} justifyContent="flex-end">
                          {rbac.allowedActions.canUpdate && (
                            <IconButton
                              label="Edit user"
                              onClick={() => setDetailUserId(user.id)}
                              data-testid="edit-user-btn"
                            >
                              <Pencil />
                            </IconButton>
                          )}
                          {rbac.allowedActions.canDelete && (
                            <IconButton
                              label="Delete user"
                              onClick={() => setConfirmDelete(user.id)}
                              data-testid="delete-user-btn"
                            >
                              <Trash />
                            </IconButton>
                          )}
                        </Flex>
                      </TDActions>
                    </TR>
                  ))
                )}
              </tbody>
            </Table>
          )}
        </TableCard>

        {pageCount > 1 && (
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
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </Flex>
          </Flex>
        )}

        {rbac.allowedActions.canCreate && showCreate && (
          <CreateUserDialog onClose={() => setShowCreate(false)} />
        )}

        {rbac.allowedActions.canUpdate && detailUserId && (
          <UserDetailDrawer
            userId={detailUserId}
            banEnabled={banEnabled}
            emailVerificationEnabled={emailVerificationEnabled}
            twoFactorEnabled={twoFactorEnabled}
            onClose={() => setDetailUserId(null)}
          />
        )}

        {rbac.allowedActions.canDelete && confirmDelete && (
          <ConfirmDialog
            title="Delete user"
            message="Are you sure you want to delete this user? This action cannot be undone."
            confirmLabel="Delete"
            loading={deleteMutation.isLoading}
            onConfirm={() => deleteMutation.mutate(confirmDelete)}
            onCancel={() => setConfirmDelete(null)}
          />
        )}

        {rbac.allowedActions.canDelete && confirmDeleteMany && (
          <ConfirmDialog
            title={`Delete ${selected.size} user${selected.size !== 1 ? "s" : ""}`}
            message={`Are you sure you want to delete ${selected.size} user${selected.size !== 1 ? "s" : ""}? This action cannot be undone.`}
            confirmLabel="Delete all"
            loading={deleteManyMutation.isLoading}
            onConfirm={() => deleteManyMutation.mutate([...selected])}
            onCancel={() => setConfirmDeleteMany(false)}
          />
        )}

        {rbac.allowedActions.canUpdate && confirmBanMany && (
          <ConfirmDialog
            title={`Ban ${selected.size} user${selected.size !== 1 ? "s" : ""}`}
            message={`Are you sure you want to ban ${selected.size} user${selected.size !== 1 ? "s" : ""}? They will be prevented from signing in.`}
            confirmLabel="Ban all"
            variant="danger"
            loading={banManyMutation.isLoading}
            onConfirm={() => banManyMutation.mutate([...selected])}
            onCancel={() => setConfirmBanMany(false)}
          />
        )}
      </Wrap>
    </Page.Protect>
  );
}
