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
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useMutation, useQuery } from "react-query";
import { useNavigate } from "react-router-dom";
import type { GenericResponse } from "../../types/content-api";
import { Permissions } from "./components/Permissions";
import { PERMISSIONS } from "./constants";
import {
  PermissionsProvider,
  usePermissions,
} from "./contexts/PermissionsContext";
import { ROLES_BASE, ROLES_ROUTE_BASE } from "./paths";
import {
  createEmptyFormState,
  type PermissionsFormState,
  type PermissionsLayout,
} from "./utils/transform";

type RolesCreatePageContentProps = {
  layout: PermissionsLayout;
  permissions: PermissionsFormState;
};

const RolesCreatePageContent = ({
  layout,
  permissions,
}: RolesCreatePageContentProps) => {
  const { formatMessage } = useIntl();
  const { toggleNotification } = useNotification();
  const { post } = useFetchClient();
  const { modifiedData } = usePermissions();
  const navigate = useNavigate();
  const goBack = () => navigate(ROLES_ROUTE_BASE);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation(
    (body: {
      name: string;
      description: string;
      permissions: PermissionsFormState;
    }) =>
      post("/api-permissions/roles", {
        data: body,
      }),
    {
      onSuccess: () => {
        toggleNotification({
          type: "success",
          message: formatMessage({
            id: "Settings.roles.created",
            defaultMessage: "Created",
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
    createMutation.mutate({ name, description, permissions: modifiedData });
  };

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
            id: "Settings.roles.create.title",
            defaultMessage: "Create a role",
          })}
          subtitle={formatMessage({
            id: "Settings.roles.create.description",
            defaultMessage: "Define the rights given to the role",
          })}
          primaryAction={
            <Button
              type="submit"
              loading={createMutation.isLoading}
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
                      { number: 0 },
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
                      <TextInput
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        type="text"
                      />
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
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                      <Field.Error />
                    </Field.Root>
                  </Grid.Item>
                </Grid.Root>
              </Flex>
            </Box>
            <Box shadow="filterShadow" hasRadius>
              <Permissions permissions={permissions} layout={layout} />
            </Box>
          </Flex>
        </Layouts.Content>
      </form>
    </Page.Main>
  );
};

export const RolesCreatePage = () => {
  const { get } = useFetchClient();

  const {
    isLoading: isLoadingForPermissions,
    allowedActions: { canCreate },
  } = useRBAC({
    create: PERMISSIONS.createRole,
  });

  const { data: layoutData, isLoading: isLoadingLayout } = useQuery(
    ["api-permissions", "permissions", "layout"],
    async () =>
      get<GenericResponse<{ sections: PermissionsLayout }>>(
        "/api-permissions/permissions/layout",
      ),
  );

  const layout = layoutData?.data?.data?.sections ?? null;
  const permissions = useMemo(
    () => (layout ? createEmptyFormState(layout) : null),
    [layout],
  );

  if (isLoadingForPermissions) {
    return <Page.Loading />;
  }

  if (!canCreate) {
    return <Page.NoPermissions />;
  }

  if (isLoadingLayout || !layout || !permissions) {
    return <Page.Loading />;
  }

  return (
    <PermissionsProvider permissions={permissions}>
      <RolesCreatePageContent layout={layout} permissions={permissions} />
    </PermissionsProvider>
  );
};

export const ProtectedRolesCreatePage = () => (
  <Page.Protect permissions={PERMISSIONS.accessRoles}>
    <RolesCreatePage />
  </Page.Protect>
);
