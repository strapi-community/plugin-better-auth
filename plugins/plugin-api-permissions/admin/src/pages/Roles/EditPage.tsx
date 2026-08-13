import {
  Box,
  Button,
  Field,
  Flex,
  Grid,
  Link,
  Textarea,
  TextInput,
  Typography,
} from "@strapi/design-system";
import { ArrowLeft, Check } from "@strapi/icons";
import {
  Layouts,
  Page,
  useFetchClient,
  useNotification,
  useRBAC,
} from "@strapi/strapi/admin";
import type { FormEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useMutation, useQuery } from "react-query";
import { useNavigate } from "react-router-dom";
import type { GenericResponse } from "../../types/content-api";
import { Permissions, type PermissionsRef } from "./components/Permissions";
import { PERMISSIONS } from "./constants";
import {
  PermissionsProvider,
  usePermissions,
} from "./contexts/PermissionsContext";
import { ROLES_BASE, ROLES_ROUTE_BASE } from "./paths";
import {
  apiToFormState,
  type PermissionEntry,
  type PermissionsFormState,
  type PermissionsLayout,
} from "./utils/transform";

type RoleData = {
  name?: string;
  description?: string;
  nb_users?: number;
  permissions?: PermissionEntry[];
};

type RolesEditPageProps = {
  description?: string;
  id: string;
  layout: PermissionsLayout;
  name: string;
  permissions: PermissionsFormState;
  usersCount: number;
};

export const RolesEditPage = ({
  description,
  id,
  layout,
  name,
  permissions,
  usersCount = 0,
}: RolesEditPageProps) => {
  const { formatMessage } = useIntl();
  const { toggleNotification } = useNotification();
  const { put } = useFetchClient();
  const permissionsRef = useRef<PermissionsRef>(null);
  const navigate = useNavigate();
  const goBack = () => navigate(ROLES_ROUTE_BASE);

  const {
    isLoading: isLoadingForPermissions,
    allowedActions: { canUpdate },
  } = useRBAC({ update: PERMISSIONS.updateRole });

  const [error, setError] = useState<string | null>(null);
  const { modifiedData } = usePermissions();

  const updateMutation = useMutation(
    (body: {
      name: string;
      description: string;
      permissions: PermissionsFormState;
    }) =>
      put(`/api-permissions/roles/${id}`, {
        data: body,
      }),
    {
      onSuccess: () => {
        toggleNotification({
          type: "success",
          message: formatMessage({
            id: "notification.success.saved",
            defaultMessage: "Saved",
          }),
        });
        goBack();
      },
      onError: () => {
        toggleNotification({
          type: "danger",
          message: formatMessage({
            id: "notification.error",
            defaultMessage: "An error occurred",
          }),
        });
      },
    },
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const { name = "", description = "" } = Object.fromEntries(
      new FormData(e.currentTarget as HTMLFormElement).entries(),
    ) as Record<string, string>;

    setError(null);
    if (!name || name.length < 3) {
      setError(
        formatMessage({
          id: "form.validation.required",
          defaultMessage: "This value is required",
        }),
      );
      return;
    }
    updateMutation.mutate({ name, description, permissions: modifiedData });
  };

  if (isLoadingForPermissions) {
    return <Page.Loading />;
  }

  if (!canUpdate) {
    return <Page.NoPermissions />;
  }

  return (
    <Page.Main>
      <Page.Title>
        {formatMessage(
          { id: "Settings.PageTitle", defaultMessage: "Settings - {name}" },
          { name: "Roles" },
        )}
      </Page.Title>
      <form onSubmit={handleSubmit}>
        <Layouts.Header
          title={formatMessage({
            id: "Settings.roles.edit.title",
            defaultMessage: "Edit a role",
          })}
          subtitle={formatMessage({
            id: "Settings.roles.create.description",
            defaultMessage: "Define the rights given to the role",
          })}
          primaryAction={
            <Button
              type="submit"
              loading={updateMutation.isLoading}
              startIcon={<Check />}
            >
              {formatMessage({ id: "global.save", defaultMessage: "Save" })}
            </Button>
          }
          navigationAction={
            <Link
              href={ROLES_BASE}
              startIcon={<ArrowLeft />}
              onClick={(e) => {
                e.preventDefault();
                goBack();
              }}
            >
              {formatMessage({ id: "global.back", defaultMessage: "Back" })}
            </Link>
          }
        />
        <Layouts.Content>
          <Flex direction="column" alignItems="stretch" gap={6}>
            <Box
              background="neutral0"
              padding={6}
              shadow="filterShadow"
              hasRadius
            >
              <Flex direction="column" alignItems="stretch" gap={4}>
                <Flex justifyContent="space-between">
                  <Box>
                    <Typography fontWeight="bold">
                      {formatMessage({
                        id: "global.details",
                        defaultMessage: "Details",
                      })}
                    </Typography>
                    <br />
                    <Typography variant="pi" textColor="neutral600">
                      {formatMessage({
                        id: "Settings.roles.form.description",
                        defaultMessage: "Name and description of the role",
                      })}
                    </Typography>
                  </Box>
                  <Box
                    padding={2}
                    paddingLeft={4}
                    paddingRight={4}
                    background="primary100"
                    style={{
                      border: "1px solid var(--strapi-colors-primary200)",
                      borderRadius: "var(--strapi-border-radius)",
                      color: "var(--strapi-colors-primary600)",
                      fontWeight: 600,
                    }}
                  >
                    {formatMessage(
                      {
                        id: "Settings.roles.form.button.users-with-role",
                        defaultMessage:
                          "{number, plural, =0 {# users} one {# user} other {# users}} with this role",
                      },
                      { number: usersCount },
                    )}
                  </Box>
                </Flex>
                <Grid.Root gap={4}>
                  <Grid.Item
                    xs={12}
                    col={6}
                    direction="column"
                    alignItems="stretch"
                  >
                    <Field.Root
                      name="name"
                      error={
                        error
                          ? formatMessage({
                              id: "form.validation.required",
                              defaultMessage: "This value is required",
                            })
                          : undefined
                      }
                      required
                    >
                      <Field.Label>
                        {formatMessage({
                          id: "global.name",
                          defaultMessage: "Name",
                        })}
                      </Field.Label>
                      <TextInput defaultValue={name} type="text" />
                      <Field.Error />
                    </Field.Root>
                  </Grid.Item>
                  <Grid.Item
                    xs={12}
                    col={6}
                    direction="column"
                    alignItems="stretch"
                  >
                    <Field.Root name="description">
                      <Field.Label>
                        {formatMessage({
                          id: "global.description",
                          defaultMessage: "Description",
                        })}
                      </Field.Label>
                      <Textarea defaultValue={description} />
                      <Field.Error />
                    </Field.Root>
                  </Grid.Item>
                </Grid.Root>
              </Flex>
            </Box>
            <Box shadow="filterShadow" hasRadius>
              <Permissions
                ref={permissionsRef}
                permissions={permissions}
                layout={layout}
              />
            </Box>
          </Flex>
        </Layouts.Content>
      </form>
    </Page.Main>
  );
};

const RolesEditPageWithPermissions = ({ id }: { id: string }) => {
  const { get } = useFetchClient();

  const [initialised, setInitialised] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: layoutData, isLoading: isLoadingLayout } = useQuery(
    ["api-permissions", "permissions", "layout"],
    async () =>
      get<GenericResponse<{ sections: PermissionsLayout }>>(
        "/api-permissions/permissions/layout",
      ),
  );

  const { data: roleData, isLoading: isLoadingRole } = useQuery(
    ["api-permissions", "roles", id],
    async () =>
      get<GenericResponse<RoleData>>(
        `/api-permissions/roles/${id}?populate=permissions`,
      ),
    {
      enabled: !!id,
      onSuccess: (res) => {
        if (!initialised) {
          setName(res.data?.data?.name ?? "");
          setDescription(res.data?.data?.description ?? "");
          setInitialised(true);
        }
      },
    },
  );

  const layout = layoutData?.data?.data?.sections ?? null;
  const roleApiData = roleData?.data?.data ?? null;

  const permissionsForm = useMemo(
    () =>
      layout && roleApiData
        ? apiToFormState(roleApiData?.permissions ?? [], layout)
        : null,
    [layout, roleApiData],
  );

  if (isLoadingLayout || isLoadingRole || !permissionsForm || !layout) {
    return <Page.Loading />;
  }

  return (
    <PermissionsProvider permissions={permissionsForm}>
      <RolesEditPage
        id={id}
        name={name}
        description={description}
        permissions={permissionsForm}
        layout={layout}
        usersCount={roleApiData?.nb_users ?? 0}
      />
    </PermissionsProvider>
  );
};

export const ProtectedRolesEditPage = ({ id }: { id: string }) => (
  <Page.Protect permissions={PERMISSIONS.accessRoles}>
    <RolesEditPageWithPermissions id={id} />
  </Page.Protect>
);
