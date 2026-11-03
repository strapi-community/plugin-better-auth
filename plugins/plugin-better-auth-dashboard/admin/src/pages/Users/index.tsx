import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Flex,
  IconButton,
  Loader,
  Main,
  Searchbar,
  SearchForm,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
  VisuallyHidden,
} from "@strapi/design-system";
import { Pencil, Plus, Trash } from "@strapi/icons";
import { Layouts, Page, useNotification, useRBAC } from "@strapi/strapi/admin";
import type React from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "react-query";
import { client, getAuthHeaders } from "../../client";
import { Avatar } from "../../components/Avatar";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PERMISSIONS } from "../../constants";
import {
  type DashConfig,
  hasPlugin,
  useDashConfig,
} from "../../hooks/useDashConfig";
import { useUsers } from "../../hooks/useUsers";
import { PLUGIN_ID } from "../../pluginId";
import { withContext } from "../../utils/dashContext";
import { CreateUserDialog } from "./CreateUserDialog";
import { UserDetailDrawer } from "./UserDetailDrawer";

const PAGE_SIZE = 25;

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

  const canSelect =
    rbac.allowedActions.canDelete || rbac.allowedActions.canUpdate;
  const colCount = canSelect ? 6 : 5;

  return (
    <Main data-testid="users-page">
      <Layouts.Header
        title="Users"
        subtitle={`${total.toLocaleString()} total${
          data?.onlineUsers ? ` · ${data.onlineUsers} online` : ""
        }`}
        primaryAction={
          rbac.allowedActions.canCreate && (
            <Button
              startIcon={<Plus />}
              onClick={() => setShowCreate(true)}
              data-testid="create-user-btn"
            >
              Create user
            </Button>
          )
        }
      />

      <Layouts.Action
        startActions={
          <Flex gap={2}>
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

            {someSelected && rbac.allowedActions.canDelete && (
              <Button
                variant="danger-light"
                size="S"
                onClick={() => setConfirmDeleteMany(true)}
                data-testid="delete-selected-btn"
              >
                Delete {selected.size} selected
              </Button>
            )}
            {someSelected && banEnabled && rbac.allowedActions.canUpdate && (
              <Button
                variant="secondary"
                size="S"
                onClick={() => setConfirmBanMany(true)}
              >
                Ban {selected.size} selected
              </Button>
            )}
          </Flex>
        }
      />

      <Layouts.Content>
        <Flex direction="column" alignItems="stretch" gap={4}>
          {isError && (
            <Alert closeLabel="Close" title="Error" variant="danger">
              {(error as Error)?.message}
            </Alert>
          )}

          {isLoading ? (
            <Flex justifyContent="center" padding={8}>
              <Loader>Loading users…</Loader>
            </Flex>
          ) : (
            <Table colCount={colCount} rowCount={users.length + 1}>
              <Thead>
                <Tr>
                  {canSelect && (
                    <Th>
                      <Checkbox
                        checked={
                          allSelected
                            ? true
                            : someSelected
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </Th>
                  )}
                  <Th>
                    <Typography variant="sigma">Name</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Email</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Status</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Created</Typography>
                  </Th>
                  <Th>
                    <VisuallyHidden>Actions</VisuallyHidden>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {users.length === 0 ? (
                  <Tr>
                    <Td colSpan={colCount}>
                      <Flex
                        justifyContent="center"
                        padding={8}
                        data-testid="users-empty"
                      >
                        <Typography textColor="neutral600">
                          {search
                            ? `No users matching "${search}"`
                            : "No users found"}
                        </Typography>
                      </Flex>
                    </Td>
                  </Tr>
                ) : (
                  users.map((user) => (
                    <Tr key={user.id} data-testid="user-row">
                      {canSelect && (
                        <Td>
                          <Checkbox
                            checked={selected.has(user.id)}
                            onCheckedChange={() => toggleSelect(user.id)}
                            aria-label={`Select ${user.name}`}
                          />
                        </Td>
                      )}
                      <Td>
                        <Flex alignItems="center" gap={2}>
                          <Avatar
                            name={user.name ?? ""}
                            src={user.image}
                            size={28}
                          />
                          <Typography
                            fontWeight="semiBold"
                            textColor="neutral800"
                          >
                            {user.name}
                          </Typography>
                        </Flex>
                      </Td>
                      <Td>
                        <Typography textColor="neutral800">
                          {user.email}
                        </Typography>
                      </Td>
                      <Td>
                        <Flex gap={1}>
                          {user.emailVerified ? (
                            <Badge variant="success" size="S">
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="S">
                              Unverified
                            </Badge>
                          )}
                          {user.banned && (
                            <Badge variant="danger" size="S">
                              Banned
                            </Badge>
                          )}
                        </Flex>
                      </Td>
                      <Td>
                        <Typography textColor="neutral800">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </Typography>
                      </Td>
                      <Td>
                        <Flex gap={1} justifyContent="flex-end">
                          {rbac.allowedActions.canUpdate && (
                            <IconButton
                              label="Edit user"
                              variant="ghost"
                              onClick={() => setDetailUserId(user.id)}
                              data-testid="edit-user-btn"
                            >
                              <Pencil />
                            </IconButton>
                          )}
                          {rbac.allowedActions.canDelete && (
                            <IconButton
                              label="Delete user"
                              variant="ghost"
                              onClick={() => setConfirmDelete(user.id)}
                              data-testid="delete-user-btn"
                            >
                              <Trash />
                            </IconButton>
                          )}
                        </Flex>
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          )}

          {pageCount > 1 && (
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
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </Flex>
          )}
        </Flex>
      </Layouts.Content>

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
    </Main>
  );
}

export default function ProtectedUsersPage() {
  const { data: config, isError, error } = useDashConfig();

  if (isError) {
    return (
      <Flex padding={6}>
        <Alert
          closeLabel="Close"
          title="Error loading configuration"
          variant="danger"
        >
          {error.message}
        </Alert>
      </Flex>
    );
  }

  if (!config) {
    return (
      <Flex justifyContent="center" alignItems="center" padding={12}>
        <Loader>Loading user configuration…</Loader>
      </Flex>
    );
  }

  return (
    <Page.Protect
      permissions={PERMISSIONS.user.filter(
        (p) => p.action === `plugin::${PLUGIN_ID}.user.read`,
      )}
    >
      <UsersPage config={config} />
    </Page.Protect>
  );
}
