import {
  Button,
  Dialog,
  EmptyStateLayout,
  Table,
  Th,
  Thead,
  Tr,
  Typography,
  useCollator,
  useFilter,
  VisuallyHidden,
} from "@strapi/design-system";
import { Plus } from "@strapi/icons";
import {
  ConfirmDialog,
  Layouts,
  Page,
  SearchInput,
  useFetchClient,
  useNotification,
  useQueryParams,
  useRBAC,
} from "@strapi/strapi/admin";
import { useState } from "react";
import { useIntl } from "react-intl";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { useNavigate } from "react-router-dom";
import type { GenericResponse } from "../../types/content-api";
import TableBody from "./components/TableBody";
import { PERMISSIONS } from "./constants";
import { ROLES_ROUTE_NEW } from "./paths";

type Role = {
  documentId: string;
  id: number;
  name: string;
  description: string;
  type: string;
  nb_users: number;
};

export const RolesListPage = () => {
  const { formatMessage, locale } = useIntl();
  const { toggleNotification } = useNotification();
  const { get, del } = useFetchClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [{ query }] = useQueryParams<{ _q?: string }>();
  const _q = query?._q || "";
  const { contains } = useFilter(locale);
  const formatter = useCollator(locale, { sensitivity: "base" });
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string>();

  const {
    isLoading: isLoadingForPermissions,
    allowedActions: { canRead, canDelete, canCreate, canUpdate },
  } = useRBAC({
    create: PERMISSIONS.createRole,
    read: PERMISSIONS.readRoles,
    update: PERMISSIONS.updateRole,
    delete: PERMISSIONS.deleteRole,
  });

  const { data: rolesData, isLoading: isLoadingData } = useQuery(
    ["api-permissions", "roles"],
    async () => get<GenericResponse<Role[]>>("/api-permissions/roles"),
    { enabled: canRead },
  );

  const deleteMutation = useMutation(
    (id: string) => del(`/api-permissions/roles/${id}`),
    {
      onSuccess: () =>
        queryClient.invalidateQueries(["api-permissions", "roles"]),
      onError: () =>
        toggleNotification({
          type: "danger",
          message: formatMessage({
            id: "notification.error",
            defaultMessage: "An error occurred",
          }),
        }),
    },
  );

  const roles = rolesData?.data?.data ?? [];

  const sortedRoles = roles
    .filter(
      (role) => contains(role.name, _q) || contains(role.description ?? "", _q),
    )
    .sort(
      (a, b) =>
        formatter.compare(a.name, b.name) ||
        formatter.compare(a.description ?? "", b.description ?? ""),
    );

  const handleDeleteClick = (id: string) => {
    setRoleToDelete(id);
    setShowConfirmDelete(true);
  };

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return;

    await deleteMutation.mutateAsync(roleToDelete);
    setShowConfirmDelete(false);
    setRoleToDelete(undefined);
  };

  const goToCreate = () => navigate(ROLES_ROUTE_NEW);

  const isLoading = isLoadingData || isLoadingForPermissions;
  const emptyLayout = {
    roles: {
      id: "api-permissions.Roles.empty",
      defaultMessage: "You don't have any roles yet.",
    },
    search: {
      id: "api-permissions.Roles.empty.search",
      defaultMessage: "No roles match the search.",
    },
  };
  const emptyContent = _q && !sortedRoles.length ? "search" : "roles";

  if (isLoading) {
    return <Page.Loading />;
  }

  return (
    <Page.Main>
      <Page.Title>
        {formatMessage(
          { id: "Settings.PageTitle", defaultMessage: "Settings - {name}" },
          {
            name: formatMessage({
              id: "global.roles",
              defaultMessage: "Roles",
            }),
          },
        )}
      </Page.Title>
      <Layouts.Header
        title={formatMessage({ id: "global.roles", defaultMessage: "Roles" })}
        subtitle={formatMessage({
          id: "Settings.roles.list.description",
          defaultMessage: "List of roles",
        })}
        primaryAction={
          canCreate ? (
            <Button
              onClick={goToCreate}
              startIcon={<Plus />}
              size="S"
              fullWidth
            >
              {formatMessage({
                id: "api-permissions.List.button.roles",
                defaultMessage: "Add new role",
              })}
            </Button>
          ) : null
        }
      />
      <Layouts.Action
        startActions={
          <SearchInput
            label={formatMessage({
              id: "app.component.search.label",
              defaultMessage: "Search",
            })}
          />
        }
      />
      <Layouts.Content>
        {!canRead && <Page.NoPermissions />}
        {canRead && sortedRoles.length > 0 ? (
          <Table colCount={4} rowCount={sortedRoles.length + 1}>
            <Thead>
              <Tr>
                <Th>
                  <Typography variant="sigma" textColor="neutral600">
                    {formatMessage({
                      id: "global.name",
                      defaultMessage: "Name",
                    })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma" textColor="neutral600">
                    {formatMessage({
                      id: "global.description",
                      defaultMessage: "Description",
                    })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma" textColor="neutral600">
                    {formatMessage({
                      id: "global.users",
                      defaultMessage: "Users",
                    })}
                  </Typography>
                </Th>
                <Th>
                  <VisuallyHidden>
                    {formatMessage({
                      id: "global.actions",
                      defaultMessage: "Actions",
                    })}
                  </VisuallyHidden>
                </Th>
              </Tr>
            </Thead>
            <TableBody
              sortedRoles={sortedRoles}
              canDelete={canDelete}
              canUpdate={canUpdate}
              onDeleteClick={handleDeleteClick}
            />
          </Table>
        ) : (
          <EmptyStateLayout
            content={formatMessage(emptyLayout[emptyContent])}
          />
        )}
      </Layouts.Content>
      <Dialog.Root open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <ConfirmDialog onConfirm={handleConfirmDelete} />
      </Dialog.Root>
    </Page.Main>
  );
};

export const ProtectedRolesListPage = () => (
  <Page.Protect permissions={PERMISSIONS.accessRoles}>
    <RolesListPage />
  </Page.Protect>
);
