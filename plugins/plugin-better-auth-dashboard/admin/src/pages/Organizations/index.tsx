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
import { useIntl } from "react-intl";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { client, getAuthHeaders } from "../../client";
import { Avatar } from "../../components/Avatar";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Code } from "../../components/FormPrimitives";
import { PERMISSIONS } from "../../constants";
import { useOrganizationOptions } from "../../hooks/useDashConfig";
import { PLUGIN_ID } from "../../pluginId";
import { withContext } from "../../utils/dashContext";
import { getTranslation } from "../../utils/getTranslation";
import { CreateOrganizationDialog } from "./CreateOrganizationDialog";
import { OrganizationDetail } from "./OrganizationDetail";

const PAGE_SIZE = 25;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  teamsEnabled: boolean;
}

export function OrganizationsPage({ teamsEnabled }: Props) {
  const { formatMessage } = useIntl();
  const rbac = useRBAC(PERMISSIONS.organization);
  const qc = useQueryClient();
  const { toggleNotification } = useNotification();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [detailOrgId, setDetailOrgId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteMany, setConfirmDeleteMany] = useState(false);

  const offset = (page - 1) * PAGE_SIZE;

  const orgsQuery = useQuery({
    queryKey: ["dash-organizations", page, search],
    queryFn: async () => {
      const result = await client.dash.listOrganizations({
        query: {
          limit: PAGE_SIZE,
          offset,
          sortBy: "createdAt",
          sortOrder: "desc",
          ...(search ? { search } : {}),
        },
      });
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.list.error.load"),
              defaultMessage: "Failed to load organizations",
            }),
        );
      return result.data;
    },
    keepPreviousData: true,
  });

  const deleteMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const result = await client.dash.organization.delete(
        { organizationId },
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.common.deleteFailed"),
              defaultMessage: "Delete failed",
            }),
        );
    },
    onSuccess: () => {
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["dash-organizations"] });
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTranslation("organizations.list.notification.deleted"),
          defaultMessage: "Organization deleted",
        }),
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message:
          err.message ??
          formatMessage({
            id: getTranslation("organizations.list.notification.deleteError"),
            defaultMessage: "Failed to delete organization",
          }),
      });
    },
  });

  const deleteManyMutation = useMutation({
    mutationFn: async (organizationIds: string[]) => {
      const result = await client.dash.organization.deleteMany(
        {},
        withContext({ organizationIds } as never, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.common.deleteFailed"),
              defaultMessage: "Delete failed",
            }),
        );
      return result.data;
    },
    onSuccess: (_data, organizationIds) => {
      setConfirmDeleteMany(false);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["dash-organizations"] });
      toggleNotification({
        type: "success",
        message: formatMessage(
          {
            id: getTranslation("organizations.list.notification.deletedMany"),
            defaultMessage:
              "{count, plural, one {# organization} other {# organizations}} deleted",
          },
          { count: organizationIds.length },
        ),
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message:
          err.message ??
          formatMessage({
            id: getTranslation(
              "organizations.list.notification.deleteManyError",
            ),
            defaultMessage: "Failed to delete organizations",
          }),
      });
    },
  });

  const orgs =
    orgsQuery.data && "organizations" in orgsQuery.data
      ? orgsQuery.data.organizations
      : [];
  const total =
    orgsQuery.data && "total" in orgsQuery.data ? orgsQuery.data.total : 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const allSelected = orgs.length > 0 && orgs.every((o) => selected.has(o.id));
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
    else setSelected(new Set(orgs.map((o) => o.id)));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const colCount = rbac.allowedActions.canDelete ? 6 : 5;

  return (
    <Main data-testid="organizations-page">
      <Layouts.Header
        title={formatMessage({
          id: getTranslation("organizations.list.header.title"),
          defaultMessage: "Organizations",
        })}
        subtitle={formatMessage(
          {
            id: getTranslation("organizations.list.header.subtitle"),
            defaultMessage: "{total} total",
          },
          { total: total.toLocaleString() },
        )}
        primaryAction={
          rbac.allowedActions.canCreate && (
            <Button
              startIcon={<Plus />}
              onClick={() => setShowCreate(true)}
              data-testid="create-org-btn"
            >
              {formatMessage({
                id: getTranslation("organizations.common.createOrganization"),
                defaultMessage: "Create organization",
              })}
            </Button>
          )
        }
      />

      <Layouts.Action
        startActions={
          <Flex gap={2}>
            <SearchForm onSubmit={handleSearch}>
              <Searchbar
                clearLabel={formatMessage({
                  id: getTranslation("organizations.list.search.clear"),
                  defaultMessage: "Clear",
                })}
                name="search"
                placeholder={formatMessage({
                  id: getTranslation("organizations.list.search.placeholder"),
                  defaultMessage: "Search organizations…",
                })}
                value={searchInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearchInput(e.target.value)
                }
                onClear={() => {
                  setSearchInput("");
                  setSearch("");
                  setPage(1);
                }}
              >
                {formatMessage({
                  id: getTranslation("organizations.list.search.label"),
                  defaultMessage: "Search organizations",
                })}
              </Searchbar>
            </SearchForm>

            {someSelected && rbac.allowedActions.canDelete && (
              <Button
                variant="danger-light"
                size="S"
                onClick={() => setConfirmDeleteMany(true)}
                data-testid="delete-selected-orgs-btn"
              >
                {formatMessage(
                  {
                    id: getTranslation("organizations.list.deleteSelected"),
                    defaultMessage: "Delete {count} selected",
                  },
                  { count: selected.size },
                )}
              </Button>
            )}
          </Flex>
        }
      />

      <Layouts.Content>
        <Flex direction="column" alignItems="stretch" gap={4}>
          {orgsQuery.isError && (
            <Alert
              closeLabel={formatMessage({
                id: getTranslation("organizations.common.close"),
                defaultMessage: "Close",
              })}
              title={formatMessage({
                id: getTranslation("organizations.list.error.title"),
                defaultMessage: "Error",
              })}
              variant="danger"
            >
              {orgsQuery.error instanceof Error
                ? orgsQuery.error.message
                : formatMessage({
                    id: getTranslation("organizations.common.errorOccurred"),
                    defaultMessage: "An error occurred",
                  })}
            </Alert>
          )}

          {orgsQuery.isLoading ? (
            <Flex justifyContent="center" padding={8}>
              <Loader>
                {formatMessage({
                  id: getTranslation("organizations.list.loading"),
                  defaultMessage: "Loading organizations…",
                })}
              </Loader>
            </Flex>
          ) : (
            <Table colCount={colCount} rowCount={orgs.length + 1}>
              <Thead>
                <Tr>
                  {rbac.allowedActions.canDelete && (
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
                        aria-label={formatMessage({
                          id: getTranslation(
                            "organizations.list.table.selectAll",
                          ),
                          defaultMessage: "Select all",
                        })}
                      />
                    </Th>
                  )}
                  <Th>
                    <Typography variant="sigma">
                      {formatMessage({
                        id: getTranslation("organizations.common.name"),
                        defaultMessage: "Name",
                      })}
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">
                      {formatMessage({
                        id: getTranslation("organizations.common.slug"),
                        defaultMessage: "Slug",
                      })}
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">
                      {formatMessage({
                        id: getTranslation("organizations.common.members"),
                        defaultMessage: "Members",
                      })}
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">
                      {formatMessage({
                        id: getTranslation("organizations.common.created"),
                        defaultMessage: "Created",
                      })}
                    </Typography>
                  </Th>
                  <Th>
                    <VisuallyHidden>
                      {formatMessage({
                        id: getTranslation("organizations.list.table.actions"),
                        defaultMessage: "Actions",
                      })}
                    </VisuallyHidden>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {orgs.length === 0 ? (
                  <Tr>
                    <Td colSpan={colCount}>
                      <Flex
                        justifyContent="center"
                        padding={8}
                        data-testid="orgs-empty"
                      >
                        <Typography textColor="neutral600">
                          {search
                            ? formatMessage(
                                {
                                  id: getTranslation(
                                    "organizations.list.empty.search",
                                  ),
                                  defaultMessage:
                                    'No organizations matching "{search}"',
                                },
                                { search },
                              )
                            : formatMessage({
                                id: getTranslation(
                                  "organizations.list.empty.default",
                                ),
                                defaultMessage: "No organizations found",
                              })}
                        </Typography>
                      </Flex>
                    </Td>
                  </Tr>
                ) : (
                  orgs.map((org) => (
                    <Tr key={org.id} data-testid="org-row">
                      {rbac.allowedActions.canDelete && (
                        <Td>
                          <Checkbox
                            checked={selected.has(org.id)}
                            onCheckedChange={() => toggleSelect(org.id)}
                            aria-label={formatMessage(
                              {
                                id: getTranslation(
                                  "organizations.list.table.selectRow",
                                ),
                                defaultMessage: "Select {name}",
                              },
                              { name: org.name },
                            )}
                          />
                        </Td>
                      )}
                      <Td>
                        <Flex alignItems="center" gap={2}>
                          <Avatar name={org.name} src={org.logo} size={28} />
                          <Typography
                            fontWeight="semiBold"
                            textColor="neutral800"
                          >
                            {org.name}
                          </Typography>
                        </Flex>
                      </Td>
                      <Td>
                        <Code variant="pi" textColor="neutral600">
                          {org.slug}
                        </Code>
                      </Td>
                      <Td>
                        <Badge size="S">{org.memberCount}</Badge>
                      </Td>
                      <Td>
                        <Typography textColor="neutral800">
                          {new Date(org.createdAt).toLocaleDateString()}
                        </Typography>
                      </Td>
                      <Td>
                        <Flex gap={1} justifyContent="flex-end">
                          {rbac.allowedActions.canUpdate && (
                            <IconButton
                              label={formatMessage({
                                id: getTranslation(
                                  "organizations.list.table.edit",
                                ),
                                defaultMessage: "Edit organization",
                              })}
                              variant="ghost"
                              onClick={() => setDetailOrgId(org.id)}
                              data-testid="edit-org-btn"
                            >
                              <Pencil />
                            </IconButton>
                          )}
                          {rbac.allowedActions.canDelete && (
                            <IconButton
                              label={formatMessage({
                                id: getTranslation(
                                  "organizations.common.deleteOrganization",
                                ),
                                defaultMessage: "Delete organization",
                              })}
                              variant="ghost"
                              onClick={() => setConfirmDelete(org.id)}
                              data-testid="delete-org-btn"
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
                {formatMessage({
                  id: getTranslation("organizations.list.pagination.previous"),
                  defaultMessage: "Previous",
                })}
              </Button>
              <Button
                variant="tertiary"
                size="S"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                {formatMessage({
                  id: getTranslation("organizations.list.pagination.next"),
                  defaultMessage: "Next",
                })}
              </Button>
            </Flex>
          )}
        </Flex>
      </Layouts.Content>

      {rbac.allowedActions.canCreate && showCreate && (
        <CreateOrganizationDialog
          teamsEnabled={teamsEnabled}
          onClose={() => setShowCreate(false)}
        />
      )}

      {rbac.allowedActions.canUpdate && detailOrgId && (
        <OrganizationDetail
          organizationId={detailOrgId}
          teamsEnabled={teamsEnabled}
          onClose={() => setDetailOrgId(null)}
        />
      )}

      {rbac.allowedActions.canDelete && confirmDelete && (
        <ConfirmDialog
          title={formatMessage({
            id: getTranslation("organizations.common.deleteOrganization"),
            defaultMessage: "Delete organization",
          })}
          message={formatMessage({
            id: getTranslation("organizations.list.confirmDelete.message"),
            defaultMessage:
              "Are you sure you want to delete this organization? All members and teams will be removed. This action cannot be undone.",
          })}
          confirmLabel={formatMessage({
            id: getTranslation("organizations.common.delete"),
            defaultMessage: "Delete",
          })}
          loading={deleteMutation.isLoading}
          onConfirm={() => deleteMutation.mutate(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {rbac.allowedActions.canDelete && confirmDeleteMany && (
        <ConfirmDialog
          title={formatMessage(
            {
              id: getTranslation("organizations.list.confirmDeleteMany.title"),
              defaultMessage:
                "Delete {count, plural, one {# organization} other {# organizations}}",
            },
            { count: selected.size },
          )}
          message={formatMessage(
            {
              id: getTranslation(
                "organizations.list.confirmDeleteMany.message",
              ),
              defaultMessage:
                "Are you sure you want to delete {count, plural, one {# organization} other {# organizations}}? This action cannot be undone.",
            },
            { count: selected.size },
          )}
          confirmLabel={formatMessage({
            id: getTranslation("organizations.list.confirmDeleteMany.confirm"),
            defaultMessage: "Delete all",
          })}
          loading={deleteManyMutation.isLoading}
          onConfirm={() => deleteManyMutation.mutate([...selected])}
          onCancel={() => setConfirmDeleteMany(false)}
        />
      )}
    </Main>
  );
}

export default function ProtectedOrganizationsPage() {
  const { data: organizationOptions } = useOrganizationOptions();
  const teamsEnabled = organizationOptions?.teamsEnabled ?? false;

  return (
    <Page.Protect
      permissions={PERMISSIONS.organization.filter(
        (p) => p.action === `plugin::${PLUGIN_ID}.organization.read`,
      )}
    >
      <OrganizationsPage teamsEnabled={teamsEnabled} />
    </Page.Protect>
  );
}
