import {
  Accordion,
  Alert,
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Grid,
  IconButton,
  Loader,
  SingleSelect,
  SingleSelectOption,
  Tabs,
  TextInput,
  Typography,
} from "@strapi/design-system";
import { Plus, Trash } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import type React from "react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { client, getAuthHeaders } from "../../client";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { CustomFieldsSection } from "../../components/DynamicField";
import { EditViewSidePanels } from "../../components/EditViewSidePanels";
import {
  AccountRow,
  EditLayout,
  EditSidebar,
  FormSection,
  MetaItem,
  MetaKey,
  MetaVal,
  MonoChip,
  ProviderBadge,
  SectionLabel,
} from "../../components/FormPrimitives";
import { MediaPickerField } from "../../components/MediaPickerField";
import { SheetDialog } from "../../components/Sheet";
import { UserCombobox } from "../../components/UserCombobox";
import { useModelSchema } from "../../hooks/useModelSchema";
import { withContext } from "../../utils/dashContext";
import { getTranslation } from "../../utils/getTranslation";

const INVITATION_STATUS_VARIANT = {
  pending: "warning",
  accepted: "success",
  rejected: "danger",
  canceled: "neutral",
} as const;

const INVITATION_STATUS_LABEL = {
  pending: {
    id: getTranslation("organizations.detail.invitations.status.pending"),
    defaultMessage: "pending",
  },
  accepted: {
    id: getTranslation("organizations.detail.invitations.status.accepted"),
    defaultMessage: "accepted",
  },
  rejected: {
    id: getTranslation("organizations.detail.invitations.status.rejected"),
    defaultMessage: "rejected",
  },
  canceled: {
    id: getTranslation("organizations.detail.invitations.status.canceled"),
    defaultMessage: "canceled",
  },
} as const;

const ROLE_OPTIONS = [
  {
    value: "member",
    label: {
      id: getTranslation("organizations.common.roles.member"),
      defaultMessage: "Member",
    },
  },
  {
    value: "admin",
    label: {
      id: getTranslation("organizations.common.roles.admin"),
      defaultMessage: "Admin",
    },
  },
  {
    value: "owner",
    label: {
      id: getTranslation("organizations.common.roles.owner"),
      defaultMessage: "Owner",
    },
  },
] as const;

function InlineLoader() {
  const { formatMessage } = useIntl();
  return (
    <Flex justifyContent="center" padding={4}>
      <Loader small>
        {formatMessage({
          id: getTranslation("organizations.common.loading"),
          defaultMessage: "Loading…",
        })}
      </Loader>
    </Flex>
  );
}

const STANDARD_ORG_FIELDS = new Set([
  "id",
  "name",
  "slug",
  "logo",
  "metadata",
  "memberCount",
  "createdAt",
  "updatedAt",
]);

interface Props {
  organizationId: string;
  teamsEnabled: boolean;
  onClose: () => void;
}

export function OrganizationDetail({
  organizationId,
  teamsEnabled,
  onClose,
}: Props) {
  const { formatMessage } = useIntl();
  const schemaQuery = useModelSchema("organization");
  const qc = useQueryClient();
  const { toggleNotification } = useNotification();
  const { get, put } = useFetchClient();

  const orgQuery = useQuery({
    queryKey: ["dash-org", organizationId],
    queryFn: async () => {
      const result = await client.dash.organization[organizationId as ":id"](
        {},
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.detail.error.loadOrg"),
              defaultMessage: "Failed to load org",
            }),
        );
      return result.data;
    },
  });

  const membersQuery = useQuery({
    queryKey: ["dash-org-members", organizationId],
    queryFn: async () => {
      const result = await client.dash.organization[
        organizationId as ":id"
      ].members({}, withContext({ organizationId }, getAuthHeaders()));
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.common.failed"),
              defaultMessage: "Failed",
            }),
        );
      return result.data ?? [];
    },
  });

  const teamsQuery = useQuery({
    queryKey: ["dash-org-teams", organizationId],
    queryFn: async () => {
      if (!teamsEnabled) return [];
      const result = await client.dash.organization[
        organizationId as ":id"
      ].teams({}, withContext({ organizationId }, getAuthHeaders()));
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.common.failed"),
              defaultMessage: "Failed",
            }),
        );
      return (result.data ?? []) as Array<{
        id: string;
        name: string;
        organizationId: string;
        createdAt: Date;
        updatedAt?: Date;
      }>;
    },
    enabled: teamsEnabled,
  });

  const ssoQuery = useQuery({
    queryKey: ["dash-org-sso", organizationId],
    queryFn: async () => {
      const result = await client.dash.organization[
        organizationId as ":id"
      ].ssoProviders({}, withContext({ organizationId }, getAuthHeaders()));
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.common.failed"),
              defaultMessage: "Failed",
            }),
        );
      return result.data ?? [];
    },
  });

  const invitationsQuery = useQuery({
    queryKey: ["dash-org-invitations", organizationId],
    queryFn: async () => {
      const result = await client.dash.organization[
        organizationId as ":id"
      ].invitations({}, withContext({ organizationId }, getAuthHeaders()));
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.common.failed"),
              defaultMessage: "Failed",
            }),
        );
      return (result.data ?? []) as Array<{
        id: string;
        organizationId: string;
        email: string;
        role: string;
        status: "pending" | "accepted" | "rejected" | "canceled";
        inviterId: string;
        expiresAt: Date;
        createdAt: Date;
        teamId?: string | null;
        user: {
          id: string;
          name: string;
          email: string;
          image: string | null;
        } | null;
      }>;
    },
  });

  const strapiOrgQuery = useQuery({
    queryKey: ["dash-strapi-org", organizationId],
    enabled: !!orgQuery.data,
    queryFn: async () => {
      const { data } = await get<{ results: Record<string, unknown>[] }>(
        `/better-auth-dashboard/db?uid=plugin::better-auth.organization&filters[id][$eq]=${organizationId}&pagination[pageSize]=1`,
      );
      return (
        (data as { results?: Record<string, unknown>[] }).results?.[0] ?? null
      );
    },
  });

  const [activeTab, setActiveTab] = useState("details");
  const [editName, setEditName] = useState<string | undefined>(undefined);
  const [editSlug, setEditSlug] = useState<string | undefined>(undefined);
  const [editLogo, setEditLogo] = useState<string | undefined>(undefined);
  const [editExtra, setEditExtra] = useState<Record<string, unknown>>({});
  const [confirmRemoveMemberId, setConfirmRemoveMemberId] = useState<
    string | null
  >(null);
  const [confirmDeleteTeamId, setConfirmDeleteTeamId] = useState<string | null>(
    null,
  );
  const [confirmDeleteSsoId, setConfirmDeleteSsoId] = useState<string | null>(
    null,
  );

  // Invite member form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [confirmCancelInvitationId, setConfirmCancelInvitationId] = useState<
    string | null
  >(null);

  const handleExtraChange = (name: string, value: unknown) => {
    setEditExtra((prev) => ({ ...prev, [name]: value }));
  };

  const org = orgQuery.data;
  const extraData: Record<string, unknown> = {
    ...(strapiOrgQuery.data ?? {}),
    ...editExtra,
  };

  const updateOrgMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { ...editExtra };
      if (editName !== undefined) body.name = editName;
      if (editSlug !== undefined) body.slug = editSlug;
      if (editLogo !== undefined) body.logo = editLogo;

      const documentId = strapiOrgQuery.data?.documentId as string | undefined;
      if (!documentId)
        throw new Error(
          formatMessage({
            id: getTranslation("organizations.detail.error.documentId"),
            defaultMessage: "Could not resolve documentId for organization",
          }),
        );

      await put(
        `/better-auth-dashboard/db/${documentId}?uid=plugin::better-auth.organization`,
        body,
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ["dash-strapi-org", organizationId],
      });
      qc.invalidateQueries({ queryKey: ["dash-org", organizationId] });
      qc.invalidateQueries({ queryKey: ["dash-organizations"] });
      qc.invalidateQueries({ queryKey: ["dash-strapi-org", organizationId] });
      setEditName(undefined);
      setEditSlug(undefined);
      setEditLogo(undefined);
      setEditExtra({});
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTranslation("organizations.detail.notification.updated"),
          defaultMessage: "Organization updated successfully",
        }),
      });
      onClose();
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message:
          err.message ??
          formatMessage({
            id: getTranslation("organizations.detail.notification.updateError"),
            defaultMessage: "Update failed",
          }),
      });
    },
  });

  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState("member");

  const addMemberMutation = useMutation({
    mutationFn: async () => {
      const result = await client.dash.organization.addMember(
        { userId: addUserId, role: addRole },
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation(
                "organizations.detail.members.error.addFailed",
              ),
              defaultMessage: "Add member failed",
            }),
        );
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-org-members", organizationId] });
      setAddUserId("");
      setAddRole("member");
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTranslation("organizations.detail.members.notification.added"),
          defaultMessage: "Member added",
        }),
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message:
          err.message ??
          formatMessage({
            id: getTranslation(
              "organizations.detail.members.notification.addError",
            ),
            defaultMessage: "Failed to add member",
          }),
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const result = await client.dash.organization.removeMember(
        { memberId },
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.common.failed"),
              defaultMessage: "Failed",
            }),
        );
    },
    onSuccess: () => {
      setConfirmRemoveMemberId(null);
      qc.invalidateQueries({ queryKey: ["dash-org-members", organizationId] });
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTranslation(
            "organizations.detail.members.notification.removed",
          ),
          defaultMessage: "Member removed",
        }),
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message:
          err.message ??
          formatMessage({
            id: getTranslation(
              "organizations.detail.members.notification.removeError",
            ),
            defaultMessage: "Failed to remove member",
          }),
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: string;
      role: string;
    }) => {
      const result = await client.dash.organization.updateMemberRole(
        { memberId, role },
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.common.failed"),
              defaultMessage: "Failed",
            }),
        );
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-org-members", organizationId] });
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTranslation(
            "organizations.detail.members.notification.roleUpdated",
          ),
          defaultMessage: "Role updated",
        }),
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message:
          err.message ??
          formatMessage({
            id: getTranslation(
              "organizations.detail.members.notification.roleUpdateError",
            ),
            defaultMessage: "Failed to update role",
          }),
      });
    },
  });

  const [newTeamName, setNewTeamName] = useState("");

  const createTeamMutation = useMutation({
    mutationFn: async () => {
      const result = await client.dash.organization.createTeam(
        { name: newTeamName },
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation(
                "organizations.detail.teams.error.createFailed",
              ),
              defaultMessage: "Create team failed",
            }),
        );
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-org-teams", organizationId] });
      setNewTeamName("");
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTranslation("organizations.detail.teams.notification.created"),
          defaultMessage: "Team created",
        }),
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message:
          err.message ??
          formatMessage({
            id: getTranslation(
              "organizations.detail.teams.notification.createError",
            ),
            defaultMessage: "Failed to create team",
          }),
      });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const result = await client.dash.organization.deleteTeam(
        { teamId },
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.common.failed"),
              defaultMessage: "Failed",
            }),
        );
    },
    onSuccess: () => {
      setConfirmDeleteTeamId(null);
      qc.invalidateQueries({ queryKey: ["dash-org-teams", organizationId] });
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTranslation("organizations.detail.teams.notification.deleted"),
          defaultMessage: "Team deleted",
        }),
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message:
          err.message ??
          formatMessage({
            id: getTranslation(
              "organizations.detail.teams.notification.deleteError",
            ),
            defaultMessage: "Failed to delete team",
          }),
      });
    },
  });

  const deleteSsoMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const result = await client.dash.organization[
        organizationId as ":id"
      ].ssoProvider.delete(
        { providerId },
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.common.failed"),
              defaultMessage: "Failed",
            }),
        );
    },
    onSuccess: () => {
      setConfirmDeleteSsoId(null);
      qc.invalidateQueries({ queryKey: ["dash-org-sso", organizationId] });
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTranslation("organizations.detail.sso.notification.deleted"),
          defaultMessage: "SSO provider deleted",
        }),
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message:
          err.message ??
          formatMessage({
            id: getTranslation(
              "organizations.detail.sso.notification.deleteError",
            ),
            defaultMessage: "Failed to delete SSO provider",
          }),
      });
    },
  });

  const inviteMemberMutation = useMutation({
    mutationFn: async () => {
      const result = await client.dash.organization.inviteMember(
        { email: inviteEmail, role: inviteRole, invitedBy: "" } as never,
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.common.failed"),
              defaultMessage: "Failed",
            }),
        );
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["dash-org-invitations", organizationId],
      });
      setInviteEmail("");
      setInviteRole("member");
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTranslation(
            "organizations.detail.invitations.notification.sent",
          ),
          defaultMessage: "Invitation sent",
        }),
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message:
          err.message ??
          formatMessage({
            id: getTranslation(
              "organizations.detail.invitations.notification.inviteError",
            ),
            defaultMessage: "Failed to invite",
          }),
      });
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await client.dash.organization.cancelInvitation(
        { invitationId } as never,
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.common.failed"),
              defaultMessage: "Failed",
            }),
        );
    },
    onSuccess: () => {
      setConfirmCancelInvitationId(null);
      qc.invalidateQueries({
        queryKey: ["dash-org-invitations", organizationId],
      });
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTranslation(
            "organizations.detail.invitations.notification.cancelled",
          ),
          defaultMessage: "Invitation cancelled",
        }),
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message:
          err.message ??
          formatMessage({
            id: getTranslation(
              "organizations.detail.invitations.notification.cancelError",
            ),
            defaultMessage: "Failed to cancel",
          }),
      });
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await client.dash.organization.resendInvitation(
        { invitationId } as never,
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.common.failed"),
              defaultMessage: "Failed",
            }),
        );
    },
    onSuccess: () => {
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTranslation(
            "organizations.detail.invitations.notification.resent",
          ),
          defaultMessage: "Invitation resent",
        }),
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message:
          err.message ??
          formatMessage({
            id: getTranslation(
              "organizations.detail.invitations.notification.resendError",
            ),
            defaultMessage: "Failed to resend",
          }),
      });
    },
  });

  const members = membersQuery.data ?? [];
  const teams = teamsQuery.data ?? [];
  const ssoProviders = ssoQuery.data ?? [];
  const invitations = invitationsQuery.data ?? [];

  const hasOrgEdits =
    editName !== undefined ||
    editSlug !== undefined ||
    editLogo !== undefined ||
    Object.keys(editExtra).length > 0;

  const customFields = Object.entries(schemaQuery.data ?? {})
    .filter(([name]) => !STANDARD_ORG_FIELDS.has(name))
    .map(([name, attribute]) => ({ name, attribute }));

  const detailsFooter =
    activeTab === "details" ? (
      <>
        <Button
          variant="tertiary"
          onClick={() => {
            setEditName(undefined);
            setEditSlug(undefined);
            setEditLogo(undefined);
            setEditExtra({});
            onClose();
          }}
        >
          {formatMessage({
            id: getTranslation("organizations.detail.discard"),
            defaultMessage: "Discard",
          })}
        </Button>
        <Button
          disabled={!hasOrgEdits}
          loading={updateOrgMutation.isLoading}
          onClick={() => updateOrgMutation.mutate()}
          data-testid="save-org-btn"
        >
          {formatMessage({
            id: getTranslation("organizations.detail.save"),
            defaultMessage: "Save changes",
          })}
        </Button>
      </>
    ) : undefined;

  return (
    <SheetDialog
      title={
        org?.name ??
        formatMessage({
          id: getTranslation("organizations.detail.fallbackTitle"),
          defaultMessage: "Organization",
        })
      }
      actionButtons={detailsFooter}
      onClose={onClose}
      data-testid="org-detail-drawer"
    >
      {orgQuery.isLoading ? (
        <InlineLoader />
      ) : orgQuery.isError ? (
        <Alert
          closeLabel={formatMessage({
            id: getTranslation("organizations.common.close"),
            defaultMessage: "Close",
          })}
          title={formatMessage({
            id: getTranslation("organizations.detail.error.loadTitle"),
            defaultMessage: "Failed to load organization",
          })}
          variant="danger"
        >
          {orgQuery.error instanceof Error
            ? orgQuery.error.message
            : formatMessage({
                id: getTranslation("organizations.common.errorOccurred"),
                defaultMessage: "An error occurred",
              })}
        </Alert>
      ) : (
        <Tabs.Root defaultValue="details" onValueChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Trigger value="details">
              {formatMessage({
                id: getTranslation("organizations.common.details"),
                defaultMessage: "Details",
              })}
            </Tabs.Trigger>
            <Tabs.Trigger value="members" data-testid="org-members-tab">
              {formatMessage(
                {
                  id: getTranslation("organizations.detail.tabs.members"),
                  defaultMessage: "Members ({count})",
                },
                { count: members.length },
              )}
            </Tabs.Trigger>
            {teamsEnabled && (
              <Tabs.Trigger value="teams">
                {formatMessage(
                  {
                    id: getTranslation("organizations.detail.tabs.teams"),
                    defaultMessage: "Teams ({count})",
                  },
                  { count: teams.length },
                )}
              </Tabs.Trigger>
            )}
            <Tabs.Trigger value="invitations">
              {formatMessage(
                {
                  id: getTranslation("organizations.detail.tabs.invitations"),
                  defaultMessage: "Invitations ({count})",
                },
                { count: invitations.length },
              )}
            </Tabs.Trigger>
            <Tabs.Trigger value="sso">
              {formatMessage(
                {
                  id: getTranslation("organizations.detail.tabs.sso"),
                  defaultMessage: "SSO ({count})",
                },
                { count: ssoProviders.length },
              )}
            </Tabs.Trigger>
          </Tabs.List>

          {/* ── Details ── */}
          <Tabs.Content value="details">
            <EditLayout>
              {/* Left: editable fields */}
              <Flex direction="column" gap={5}>
                <FormSection>
                  <SectionLabel>
                    {formatMessage({
                      id: getTranslation("organizations.common.details"),
                      defaultMessage: "Details",
                    })}
                  </SectionLabel>
                  <Field.Root style={{ width: "100%" }}>
                    <Field.Label>
                      {formatMessage({
                        id: getTranslation("organizations.common.name"),
                        defaultMessage: "Name",
                      })}
                    </Field.Label>
                    <TextInput
                      value={editName ?? org?.name ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEditName(e.target.value)
                      }
                      data-testid="org-name-input"
                    />
                  </Field.Root>
                  <Field.Root
                    hint={formatMessage({
                      id: getTranslation("organizations.common.slugHint"),
                      defaultMessage: "Used in URLs",
                    })}
                    style={{ width: "100%" }}
                  >
                    <Field.Label>
                      {formatMessage({
                        id: getTranslation("organizations.common.slug"),
                        defaultMessage: "Slug",
                      })}
                    </Field.Label>
                    <TextInput
                      value={editSlug ?? org?.slug ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEditSlug(e.target.value)
                      }
                      data-testid="org-slug-input"
                    />
                    <Field.Hint />
                  </Field.Root>
                  <MediaPickerField
                    label={formatMessage({
                      id: getTranslation("organizations.common.logo.label"),
                      defaultMessage: "Logo URL",
                    })}
                    name="logo"
                    value={editLogo ?? org?.logo ?? ""}
                    onChange={setEditLogo}
                    placeholder={formatMessage({
                      id: getTranslation(
                        "organizations.common.logo.placeholder",
                      ),
                      defaultMessage: "https://example.com/logo.png",
                    })}
                    hint={formatMessage({
                      id: getTranslation("organizations.common.logo.hint"),
                      defaultMessage:
                        "Optional — publicly accessible image URL",
                    })}
                  />
                </FormSection>

                <CustomFieldsSection
                  fields={customFields}
                  data={extraData}
                  onChange={handleExtraChange}
                />
              </Flex>

              {/* Right: metadata */}
              <EditSidebar>
                <FormSection>
                  <SectionLabel>
                    {formatMessage({
                      id: getTranslation("organizations.common.details"),
                      defaultMessage: "Details",
                    })}
                  </SectionLabel>
                  <Grid.Root gap={3} gridCols={2}>
                    <Grid.Item col={2}>
                      <MetaItem>
                        <MetaKey>
                          {formatMessage({
                            id: getTranslation("organizations.detail.meta.id"),
                            defaultMessage: "Organization ID",
                          })}
                        </MetaKey>
                        <MonoChip>{org?.id}</MonoChip>
                      </MetaItem>
                    </Grid.Item>
                    <Grid.Item col={1}>
                      <MetaItem>
                        <MetaKey>
                          {formatMessage({
                            id: getTranslation("organizations.common.members"),
                            defaultMessage: "Members",
                          })}
                        </MetaKey>
                        <MetaVal>{org?.memberCount ?? 0}</MetaVal>
                      </MetaItem>
                    </Grid.Item>
                    <Grid.Item col={1}>
                      <MetaItem>
                        <MetaKey>
                          {formatMessage({
                            id: getTranslation("organizations.common.created"),
                            defaultMessage: "Created",
                          })}
                        </MetaKey>
                        <MetaVal>
                          {org?.createdAt
                            ? new Date(org.createdAt).toLocaleDateString()
                            : "—"}
                        </MetaVal>
                      </MetaItem>
                    </Grid.Item>
                  </Grid.Root>
                </FormSection>
                <EditViewSidePanels
                  model="plugin::better-auth.organization"
                  documentId={
                    strapiOrgQuery.data?.documentId as string | undefined
                  }
                  document={strapiOrgQuery.data ?? undefined}
                />
              </EditSidebar>
            </EditLayout>
          </Tabs.Content>

          {/* ── Members ── */}
          <Tabs.Content value="members">
            <Flex direction="column" gap={5} paddingTop={6}>
              <FormSection>
                <SectionLabel>
                  {formatMessage({
                    id: getTranslation("organizations.detail.members.add"),
                    defaultMessage: "Add member",
                  })}
                </SectionLabel>
                <Grid.Root gap={3}>
                  <Grid.Item col={8}>
                    <UserCombobox
                      label={formatMessage({
                        id: getTranslation("organizations.detail.members.user"),
                        defaultMessage: "User",
                      })}
                      value={addUserId}
                      onChange={setAddUserId}
                    />
                  </Grid.Item>
                  <Grid.Item col={4}>
                    <Field.Root>
                      <Field.Label>
                        {formatMessage({
                          id: getTranslation("organizations.common.role"),
                          defaultMessage: "Role",
                        })}
                      </Field.Label>
                      <SingleSelect
                        value={addRole}
                        onChange={(role: string | number) =>
                          setAddRole(String(role))
                        }
                        aria-label={formatMessage({
                          id: getTranslation(
                            "organizations.detail.members.roleLabel",
                          ),
                          defaultMessage: "Member role",
                        })}
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <SingleSelectOption
                            key={option.value}
                            value={option.value}
                          >
                            {formatMessage(option.label)}
                          </SingleSelectOption>
                        ))}
                      </SingleSelect>
                    </Field.Root>
                  </Grid.Item>
                </Grid.Root>
                <Box>
                  <Button
                    size="S"
                    startIcon={<Plus />}
                    disabled={!addUserId}
                    loading={addMemberMutation.isLoading}
                    onClick={() => addMemberMutation.mutate()}
                    data-testid="add-member-btn"
                  >
                    {formatMessage({
                      id: getTranslation("organizations.detail.members.add"),
                      defaultMessage: "Add member",
                    })}
                  </Button>
                </Box>
              </FormSection>

              <FormSection>
                <SectionLabel>
                  {formatMessage(
                    {
                      id: getTranslation("organizations.detail.tabs.members"),
                      defaultMessage: "Members ({count})",
                    },
                    { count: members.length },
                  )}
                </SectionLabel>
                {membersQuery.isLoading ? (
                  <InlineLoader />
                ) : members.length === 0 ? (
                  <Typography variant="pi" textColor="neutral500">
                    {formatMessage({
                      id: getTranslation("organizations.detail.members.empty"),
                      defaultMessage: "No members yet.",
                    })}
                  </Typography>
                ) : (
                  <Flex direction="column" gap={2}>
                    {members.map((member) => (
                      <AccountRow key={member.id} data-testid="member-row">
                        <Flex
                          direction="column"
                          gap={1}
                          alignItems="flex-start"
                          flex={1}
                        >
                          <Typography variant="omega" fontWeight="semiBold">
                            {member.user?.name ??
                              formatMessage({
                                id: getTranslation(
                                  "organizations.detail.members.unknown",
                                ),
                                defaultMessage: "Unknown",
                              })}
                          </Typography>
                          <Typography variant="pi" textColor="neutral500">
                            {member.user?.email}
                          </Typography>
                        </Flex>
                        <Flex gap={2} alignItems="center">
                          <Field.Root style={{ width: 110 }}>
                            <SingleSelect
                              value={member.role}
                              onChange={(role: string | number) =>
                                updateRoleMutation.mutate({
                                  memberId: member.id,
                                  role: String(role),
                                })
                              }
                              size="S"
                              aria-label={formatMessage({
                                id: getTranslation(
                                  "organizations.detail.members.roleLabel",
                                ),
                                defaultMessage: "Member role",
                              })}
                            >
                              {ROLE_OPTIONS.map((option) => (
                                <SingleSelectOption
                                  key={option.value}
                                  value={option.value}
                                >
                                  {formatMessage(option.label)}
                                </SingleSelectOption>
                              ))}
                            </SingleSelect>
                          </Field.Root>
                          <IconButton
                            label={formatMessage({
                              id: getTranslation(
                                "organizations.detail.members.remove",
                              ),
                              defaultMessage: "Remove member",
                            })}
                            onClick={() => setConfirmRemoveMemberId(member.id)}
                            data-testid="remove-member-btn"
                          >
                            <Trash />
                          </IconButton>
                        </Flex>
                      </AccountRow>
                    ))}
                  </Flex>
                )}
              </FormSection>
            </Flex>
          </Tabs.Content>

          {/* ── Teams ── */}
          {teamsEnabled && (
            <Tabs.Content value="teams">
              <Flex direction="column" gap={5} paddingTop={6}>
                <FormSection>
                  <SectionLabel>
                    {formatMessage({
                      id: getTranslation("organizations.detail.teams.create"),
                      defaultMessage: "Create team",
                    })}
                  </SectionLabel>
                  <Flex gap={2} alignItems="flex-end">
                    <Box flex={1}>
                      <Field.Root>
                        <Field.Label>
                          {formatMessage({
                            id: getTranslation(
                              "organizations.detail.teams.name.label",
                            ),
                            defaultMessage: "Team name",
                          })}
                        </Field.Label>
                        <TextInput
                          value={newTeamName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewTeamName(e.target.value)
                          }
                          placeholder={formatMessage({
                            id: getTranslation(
                              "organizations.detail.teams.name.placeholder",
                            ),
                            defaultMessage: "e.g. Engineering",
                          })}
                        />
                      </Field.Root>
                    </Box>
                    <Button
                      startIcon={<Plus />}
                      disabled={!newTeamName}
                      loading={createTeamMutation.isLoading}
                      onClick={() => createTeamMutation.mutate()}
                    >
                      {formatMessage({
                        id: getTranslation(
                          "organizations.detail.teams.createSubmit",
                        ),
                        defaultMessage: "Create",
                      })}
                    </Button>
                  </Flex>
                </FormSection>

                <FormSection>
                  <SectionLabel>
                    {formatMessage(
                      {
                        id: getTranslation("organizations.detail.tabs.teams"),
                        defaultMessage: "Teams ({count})",
                      },
                      { count: teams.length },
                    )}
                  </SectionLabel>
                  {teamsQuery.isLoading ? (
                    <InlineLoader />
                  ) : teams.length === 0 ? (
                    <Typography variant="pi" textColor="neutral500">
                      {formatMessage({
                        id: getTranslation("organizations.detail.teams.empty"),
                        defaultMessage: "No teams yet.",
                      })}
                    </Typography>
                  ) : (
                    <Flex direction="column" gap={2}>
                      {teams.map((team) => (
                        <TeamRow
                          key={team.id}
                          team={team}
                          organizationId={organizationId}
                          onDelete={() => setConfirmDeleteTeamId(team.id)}
                        />
                      ))}
                    </Flex>
                  )}
                </FormSection>
              </Flex>
            </Tabs.Content>
          )}

          {/* ── SSO ── */}
          <Tabs.Content value="sso">
            <Flex direction="column" gap={5} paddingTop={6}>
              <FormSection>
                <SectionLabel>
                  {formatMessage({
                    id: getTranslation("organizations.detail.sso.title"),
                    defaultMessage: "SSO providers",
                  })}
                </SectionLabel>
                {ssoQuery.isLoading ? (
                  <InlineLoader />
                ) : ssoProviders.length === 0 ? (
                  <Typography variant="pi" textColor="neutral500">
                    {formatMessage({
                      id: getTranslation("organizations.detail.sso.empty"),
                      defaultMessage: "No SSO providers configured.",
                    })}
                  </Typography>
                ) : (
                  <Flex direction="column" gap={2}>
                    {ssoProviders.map((provider) => (
                      <AccountRow
                        key={provider.id}
                        data-testid="sso-provider-row"
                      >
                        <Flex
                          direction="column"
                          gap={1}
                          alignItems="flex-start"
                          flex={1}
                        >
                          <ProviderBadge>{provider.providerId}</ProviderBadge>
                          <Typography variant="pi" textColor="neutral500">
                            {provider.domain}
                          </Typography>
                          <Typography variant="pi" textColor="neutral500">
                            {formatMessage(
                              {
                                id: getTranslation(
                                  "organizations.detail.sso.issuer",
                                ),
                                defaultMessage: "Issuer: {issuer}",
                              },
                              { issuer: provider.issuer },
                            )}
                          </Typography>
                        </Flex>
                        <IconButton
                          label={formatMessage({
                            id: getTranslation(
                              "organizations.detail.sso.delete",
                            ),
                            defaultMessage: "Delete SSO provider",
                          })}
                          onClick={() =>
                            setConfirmDeleteSsoId(provider.providerId)
                          }
                        >
                          <Trash />
                        </IconButton>
                      </AccountRow>
                    ))}
                  </Flex>
                )}
              </FormSection>
            </Flex>
          </Tabs.Content>

          {/* ── Invitations ── */}
          <Tabs.Content value="invitations">
            <Flex direction="column" gap={5} paddingTop={6}>
              <FormSection>
                <SectionLabel>
                  {formatMessage({
                    id: getTranslation(
                      "organizations.detail.invitations.invite",
                    ),
                    defaultMessage: "Invite member by email",
                  })}
                </SectionLabel>
                <Grid.Root gap={3}>
                  <Grid.Item col={8}>
                    <Field.Root>
                      <Field.Label>
                        {formatMessage({
                          id: getTranslation(
                            "organizations.detail.invitations.email.label",
                          ),
                          defaultMessage: "Email address",
                        })}
                      </Field.Label>
                      <TextInput
                        type="email"
                        value={inviteEmail}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setInviteEmail(e.target.value)
                        }
                        placeholder={formatMessage({
                          id: getTranslation(
                            "organizations.detail.invitations.email.placeholder",
                          ),
                          defaultMessage: "user@example.com",
                        })}
                      />
                    </Field.Root>
                  </Grid.Item>
                  <Grid.Item col={4}>
                    <Field.Root>
                      <Field.Label>
                        {formatMessage({
                          id: getTranslation("organizations.common.role"),
                          defaultMessage: "Role",
                        })}
                      </Field.Label>
                      <SingleSelect
                        value={inviteRole}
                        onChange={(v: string | number) =>
                          setInviteRole(String(v))
                        }
                        aria-label={formatMessage({
                          id: getTranslation(
                            "organizations.detail.invitations.roleLabel",
                          ),
                          defaultMessage: "Invite role",
                        })}
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <SingleSelectOption
                            key={option.value}
                            value={option.value}
                          >
                            {formatMessage(option.label)}
                          </SingleSelectOption>
                        ))}
                      </SingleSelect>
                    </Field.Root>
                  </Grid.Item>
                </Grid.Root>
                <Box>
                  <Button
                    size="S"
                    startIcon={<Plus />}
                    disabled={!inviteEmail}
                    loading={inviteMemberMutation.isLoading}
                    onClick={() => inviteMemberMutation.mutate()}
                  >
                    {formatMessage({
                      id: getTranslation(
                        "organizations.detail.invitations.send",
                      ),
                      defaultMessage: "Send invitation",
                    })}
                  </Button>
                </Box>
              </FormSection>

              <FormSection>
                <SectionLabel>
                  {formatMessage(
                    {
                      id: getTranslation(
                        "organizations.detail.tabs.invitations",
                      ),
                      defaultMessage: "Invitations ({count})",
                    },
                    { count: invitations.length },
                  )}
                </SectionLabel>
                {invitationsQuery.isLoading ? (
                  <InlineLoader />
                ) : invitations.length === 0 ? (
                  <Typography variant="pi" textColor="neutral500">
                    {formatMessage({
                      id: getTranslation(
                        "organizations.detail.invitations.empty",
                      ),
                      defaultMessage: "No invitations yet.",
                    })}
                  </Typography>
                ) : (
                  <Flex direction="column" gap={2}>
                    {invitations.map((inv) => {
                      const isPending = inv.status === "pending";
                      return (
                        <AccountRow key={inv.id}>
                          <Flex
                            direction="column"
                            gap={1}
                            alignItems="flex-start"
                            flex={1}
                          >
                            <Typography variant="omega" fontWeight="semiBold">
                              {inv.user?.name ?? inv.email}
                            </Typography>
                            <Typography variant="pi" textColor="neutral500">
                              {formatMessage(
                                {
                                  id: getTranslation(
                                    "organizations.detail.invitations.emailRole",
                                  ),
                                  defaultMessage: "{email} · role: {role}",
                                },
                                { email: inv.email, role: inv.role },
                              )}
                            </Typography>
                            <Typography variant="pi" textColor="neutral500">
                              {formatMessage(
                                {
                                  id: getTranslation(
                                    "organizations.detail.invitations.expires",
                                  ),
                                  defaultMessage: "Expires {date}",
                                },
                                {
                                  date: new Date(
                                    inv.expiresAt,
                                  ).toLocaleDateString(),
                                },
                              )}
                            </Typography>
                          </Flex>
                          <Flex gap={2} alignItems="center">
                            <Badge
                              size="S"
                              variant={
                                INVITATION_STATUS_VARIANT[inv.status] ??
                                "neutral"
                              }
                            >
                              {INVITATION_STATUS_LABEL[inv.status]
                                ? formatMessage(
                                    INVITATION_STATUS_LABEL[inv.status],
                                  )
                                : inv.status}
                            </Badge>
                            {isPending && (
                              <>
                                <Button
                                  size="S"
                                  variant="secondary"
                                  loading={resendInvitationMutation.isLoading}
                                  onClick={() =>
                                    resendInvitationMutation.mutate(inv.id)
                                  }
                                >
                                  {formatMessage({
                                    id: getTranslation(
                                      "organizations.detail.invitations.resend",
                                    ),
                                    defaultMessage: "Resend",
                                  })}
                                </Button>
                                <IconButton
                                  label={formatMessage({
                                    id: getTranslation(
                                      "organizations.detail.invitations.cancel",
                                    ),
                                    defaultMessage: "Cancel invitation",
                                  })}
                                  onClick={() =>
                                    setConfirmCancelInvitationId(inv.id)
                                  }
                                >
                                  <Trash />
                                </IconButton>
                              </>
                            )}
                          </Flex>
                        </AccountRow>
                      );
                    })}
                  </Flex>
                )}
              </FormSection>
            </Flex>
          </Tabs.Content>
        </Tabs.Root>
      )}

      {confirmRemoveMemberId && (
        <ConfirmDialog
          title={formatMessage({
            id: getTranslation("organizations.detail.members.remove"),
            defaultMessage: "Remove member",
          })}
          message={formatMessage({
            id: getTranslation(
              "organizations.detail.members.confirmRemove.message",
            ),
            defaultMessage:
              "Are you sure you want to remove this member from the organization?",
          })}
          confirmLabel={formatMessage({
            id: getTranslation("organizations.common.remove"),
            defaultMessage: "Remove",
          })}
          loading={removeMemberMutation.isLoading}
          onConfirm={() => removeMemberMutation.mutate(confirmRemoveMemberId)}
          onCancel={() => setConfirmRemoveMemberId(null)}
        />
      )}

      {confirmDeleteTeamId && (
        <ConfirmDialog
          title={formatMessage({
            id: getTranslation("organizations.detail.teams.delete"),
            defaultMessage: "Delete team",
          })}
          message={formatMessage({
            id: getTranslation(
              "organizations.detail.teams.confirmDelete.message",
            ),
            defaultMessage:
              "Are you sure you want to delete this team? All team members will be removed. This action cannot be undone.",
          })}
          confirmLabel={formatMessage({
            id: getTranslation("organizations.common.delete"),
            defaultMessage: "Delete",
          })}
          loading={deleteTeamMutation.isLoading}
          onConfirm={() => deleteTeamMutation.mutate(confirmDeleteTeamId)}
          onCancel={() => setConfirmDeleteTeamId(null)}
        />
      )}

      {confirmDeleteSsoId && (
        <ConfirmDialog
          title={formatMessage({
            id: getTranslation("organizations.detail.sso.delete"),
            defaultMessage: "Delete SSO provider",
          })}
          message={formatMessage({
            id: getTranslation(
              "organizations.detail.sso.confirmDelete.message",
            ),
            defaultMessage:
              "Are you sure you want to delete this SSO provider? Members using this provider will need to authenticate differently.",
          })}
          confirmLabel={formatMessage({
            id: getTranslation("organizations.common.delete"),
            defaultMessage: "Delete",
          })}
          loading={deleteSsoMutation.isLoading}
          onConfirm={() => deleteSsoMutation.mutate(confirmDeleteSsoId)}
          onCancel={() => setConfirmDeleteSsoId(null)}
        />
      )}

      {confirmCancelInvitationId && (
        <ConfirmDialog
          title={formatMessage({
            id: getTranslation("organizations.detail.invitations.cancel"),
            defaultMessage: "Cancel invitation",
          })}
          message={formatMessage({
            id: getTranslation(
              "organizations.detail.invitations.confirmCancel.message",
            ),
            defaultMessage:
              "Are you sure you want to cancel this invitation? The invite link will no longer work.",
          })}
          confirmLabel={formatMessage({
            id: getTranslation("organizations.detail.invitations.cancel"),
            defaultMessage: "Cancel invitation",
          })}
          loading={cancelInvitationMutation.isLoading}
          onConfirm={() =>
            cancelInvitationMutation.mutate(confirmCancelInvitationId)
          }
          onCancel={() => setConfirmCancelInvitationId(null)}
        />
      )}
    </SheetDialog>
  );
}

function TeamRow({
  team,
  organizationId,
  onDelete,
}: {
  team: { id: string; name: string; organizationId: string; createdAt: Date };
  organizationId: string;
  onDelete: () => void;
}) {
  const { formatMessage } = useIntl();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [confirmRemoveTeamMemberId, setConfirmRemoveTeamMemberId] = useState<
    string | null
  >(null);

  const teamMembersQuery = useQuery({
    queryKey: ["dash-team-members", organizationId, team.id],
    queryFn: async () => {
      const result = await client.dash.organization[
        // @ts-expect-error
        organizationId as ":orgId"
      ].teams[team.id as ":teamId"].members(
        { params: { orgId: organizationId, teamId: team.id } },
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.common.failed"),
              defaultMessage: "Failed",
            }),
        );
      return result.data ?? [];
    },
    enabled: expanded,
  });

  const [addUserId, setAddUserId] = useState("");

  const addTeamMemberMutation = useMutation({
    mutationFn: async () => {
      const result = await client.dash.organization.addTeamMember(
        { teamId: team.id, userId: addUserId },
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.common.failed"),
              defaultMessage: "Failed",
            }),
        );
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["dash-team-members", organizationId, team.id],
      });
      setAddUserId("");
    },
  });

  const removeTeamMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const result = await client.dash.organization.removeTeamMember(
        { teamId: team.id, userId },
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.common.failed"),
              defaultMessage: "Failed",
            }),
        );
    },
    onSuccess: () => {
      setConfirmRemoveTeamMemberId(null);
      qc.invalidateQueries({
        queryKey: ["dash-team-members", organizationId, team.id],
      });
    },
  });

  return (
    <Box width="100%">
      <Accordion.Root
        value={expanded ? team.id : ""}
        onValueChange={(v: string) => setExpanded(v === team.id)}
        collapsible
      >
        <Accordion.Item value={team.id} data-testid="team-row">
          <Accordion.Header>
            <Accordion.Trigger
              description={formatMessage(
                {
                  id: getTranslation("organizations.detail.teams.memberCount"),
                  defaultMessage:
                    "{count, plural, =-1 {— members} one {# member} other {# members}}",
                },
                { count: teamMembersQuery.data?.length ?? -1 },
              )}
            >
              {team.name}
            </Accordion.Trigger>
            <Accordion.Actions>
              <IconButton
                label={formatMessage({
                  id: getTranslation("organizations.detail.teams.delete"),
                  defaultMessage: "Delete team",
                })}
                variant="ghost"
                onClick={onDelete}
              >
                <Trash />
              </IconButton>
            </Accordion.Actions>
          </Accordion.Header>
          <Accordion.Content>
            <Flex direction="column" alignItems="stretch" gap={3} padding={4}>
              <Flex gap={2} alignItems="flex-end">
                <Box flex={1}>
                  <UserCombobox
                    label={formatMessage({
                      id: getTranslation(
                        "organizations.detail.teams.addMember",
                      ),
                      defaultMessage: "Add member to team",
                    })}
                    value={addUserId}
                    onChange={setAddUserId}
                  />
                </Box>
                <Button
                  size="S"
                  startIcon={<Plus />}
                  disabled={!addUserId}
                  loading={addTeamMemberMutation.isLoading}
                  onClick={() => addTeamMemberMutation.mutate()}
                >
                  {formatMessage({
                    id: getTranslation(
                      "organizations.detail.teams.addMemberSubmit",
                    ),
                    defaultMessage: "Add",
                  })}
                </Button>
              </Flex>

              {teamMembersQuery.isLoading ? (
                <InlineLoader />
              ) : (teamMembersQuery.data ?? []).length === 0 ? (
                <Typography variant="pi" textColor="neutral500">
                  {formatMessage({
                    id: getTranslation(
                      "organizations.detail.teams.membersEmpty",
                    ),
                    defaultMessage: "No members in this team.",
                  })}
                </Typography>
              ) : (
                <Flex direction="column" alignItems="stretch" gap={2}>
                  {/* biome-ignore lint/suspicious/noExplicitAny: team member shape varies by config */}
                  {(teamMembersQuery.data ?? []).map((tm: any) => (
                    <AccountRow key={tm.id}>
                      <Flex
                        direction="column"
                        gap={1}
                        alignItems="flex-start"
                        flex={1}
                      >
                        <Typography variant="omega" fontWeight="semiBold">
                          {tm.user?.name ?? tm.userId}
                        </Typography>
                        {tm.user?.email && (
                          <Typography variant="pi" textColor="neutral500">
                            {tm.user.email}
                          </Typography>
                        )}
                      </Flex>
                      <IconButton
                        label={formatMessage({
                          id: getTranslation(
                            "organizations.detail.teams.removeMember",
                          ),
                          defaultMessage: "Remove from team",
                        })}
                        onClick={() => setConfirmRemoveTeamMemberId(tm.userId)}
                      >
                        <Trash />
                      </IconButton>
                    </AccountRow>
                  ))}
                </Flex>
              )}
            </Flex>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>

      {confirmRemoveTeamMemberId && (
        <ConfirmDialog
          title={formatMessage({
            id: getTranslation("organizations.detail.teams.removeMember"),
            defaultMessage: "Remove from team",
          })}
          message={formatMessage({
            id: getTranslation(
              "organizations.detail.teams.confirmRemoveMember.message",
            ),
            defaultMessage:
              "Are you sure you want to remove this member from the team?",
          })}
          confirmLabel={formatMessage({
            id: getTranslation("organizations.common.remove"),
            defaultMessage: "Remove",
          })}
          loading={removeTeamMemberMutation.isLoading}
          onConfirm={() =>
            removeTeamMemberMutation.mutate(confirmRemoveTeamMemberId)
          }
          onCancel={() => setConfirmRemoveTeamMemberId(null)}
        />
      )}
    </Box>
  );
}
