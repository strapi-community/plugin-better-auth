import {
  Alert,
  Box,
  Button,
  Field,
  Flex,
  Grid,
  IconButton,
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
import { useMutation, useQuery, useQueryClient } from "react-query";
import styled from "styled-components";
import { client, getAuthHeaders } from "../../client";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Drawer } from "../../components/Drawer";
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
import { UserCombobox } from "../../components/UserCombobox";
import { useModelSchema } from "../../hooks/useModelSchema";
import { withContext } from "../../utils/dashContext";

// ─── Team row styled components ───────────────────────────────────────────────

const ExpandableRow = styled.div`
  width: 100%;
  background: white;
  border: 1px solid #dcdce4;
  border-radius: 8px;
  overflow: hidden;
`;

const ExpandableRowHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  gap: 12px;
  cursor: pointer;
  &:hover {
    background: #fafafe;
  }
`;

const ExpandableRowBody = styled.div`
  padding: 12px 14px;
  border-top: 1px solid #eaeaef;
  background: #fafafe;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

// ──────────────────────────────────────────────────────────────────────────────

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
        throw new Error(result.error.message ?? "Failed to load org");
      return result.data;
    },
  });

  const membersQuery = useQuery({
    queryKey: ["dash-org-members", organizationId],
    queryFn: async () => {
      const result = await client.dash.organization[
        organizationId as ":id"
      ].members({}, withContext({ organizationId }, getAuthHeaders()));
      if (result.error) throw new Error(result.error.message ?? "Failed");
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
      if (result.error) throw new Error(result.error.message ?? "Failed");
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
      if (result.error) throw new Error(result.error.message ?? "Failed");
      return result.data ?? [];
    },
  });

  const invitationsQuery = useQuery({
    queryKey: ["dash-org-invitations", organizationId],
    queryFn: async () => {
      const result = await client.dash.organization[
        organizationId as ":id"
      ].invitations({}, withContext({ organizationId }, getAuthHeaders()));
      if (result.error) throw new Error(result.error.message ?? "Failed");
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
        throw new Error("Could not resolve documentId for organization");

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
        message: "Organization updated successfully",
      });
      onClose();
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Update failed",
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
        throw new Error(result.error.message ?? "Add member failed");
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-org-members", organizationId] });
      setAddUserId("");
      setAddRole("member");
      toggleNotification({ type: "success", message: "Member added" });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to add member",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const result = await client.dash.organization.removeMember(
        { memberId },
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error) throw new Error(result.error.message ?? "Failed");
    },
    onSuccess: () => {
      setConfirmRemoveMemberId(null);
      qc.invalidateQueries({ queryKey: ["dash-org-members", organizationId] });
      toggleNotification({ type: "success", message: "Member removed" });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to remove member",
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
      if (result.error) throw new Error(result.error.message ?? "Failed");
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-org-members", organizationId] });
      toggleNotification({ type: "success", message: "Role updated" });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to update role",
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
        throw new Error(result.error.message ?? "Create team failed");
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-org-teams", organizationId] });
      setNewTeamName("");
      toggleNotification({ type: "success", message: "Team created" });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to create team",
      });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const result = await client.dash.organization.deleteTeam(
        { teamId },
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error) throw new Error(result.error.message ?? "Failed");
    },
    onSuccess: () => {
      setConfirmDeleteTeamId(null);
      qc.invalidateQueries({ queryKey: ["dash-org-teams", organizationId] });
      toggleNotification({ type: "success", message: "Team deleted" });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to delete team",
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
      if (result.error) throw new Error(result.error.message ?? "Failed");
    },
    onSuccess: () => {
      setConfirmDeleteSsoId(null);
      qc.invalidateQueries({ queryKey: ["dash-org-sso", organizationId] });
      toggleNotification({ type: "success", message: "SSO provider deleted" });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to delete SSO provider",
      });
    },
  });

  const inviteMemberMutation = useMutation({
    mutationFn: async () => {
      const result = await client.dash.organization.inviteMember(
        { email: inviteEmail, role: inviteRole, invitedBy: "" } as never,
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error) throw new Error(result.error.message ?? "Failed");
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["dash-org-invitations", organizationId],
      });
      setInviteEmail("");
      setInviteRole("member");
      toggleNotification({ type: "success", message: "Invitation sent" });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to invite",
      });
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await client.dash.organization.cancelInvitation(
        { invitationId } as never,
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error) throw new Error(result.error.message ?? "Failed");
    },
    onSuccess: () => {
      setConfirmCancelInvitationId(null);
      qc.invalidateQueries({
        queryKey: ["dash-org-invitations", organizationId],
      });
      toggleNotification({ type: "success", message: "Invitation cancelled" });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to cancel",
      });
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await client.dash.organization.resendInvitation(
        { invitationId } as never,
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error) throw new Error(result.error.message ?? "Failed");
    },
    onSuccess: () => {
      toggleNotification({ type: "success", message: "Invitation resent" });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to resend",
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
          }}
        >
          Discard
        </Button>
        <Button
          disabled={!hasOrgEdits}
          loading={updateOrgMutation.isLoading}
          onClick={() => updateOrgMutation.mutate()}
          data-testid="save-org-btn"
        >
          Save changes
        </Button>
      </>
    ) : undefined;

  return (
    <Drawer
      title={org?.name ?? "Organization"}
      footer={detailsFooter}
      onClose={onClose}
      data-testid="org-detail-drawer"
    >
      {orgQuery.isLoading ? (
        <Typography textColor="neutral500">Loading…</Typography>
      ) : orgQuery.isError ? (
        <Alert
          closeLabel="Close"
          title="Failed to load organization"
          variant="danger"
        >
          {orgQuery.error instanceof Error
            ? orgQuery.error.message
            : "An error occurred"}
        </Alert>
      ) : (
        <Tabs.Root defaultValue="details" onValueChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Trigger value="details">Details</Tabs.Trigger>
            <Tabs.Trigger value="members" data-testid="org-members-tab">
              Members ({members.length})
            </Tabs.Trigger>
            {teamsEnabled && (
              <Tabs.Trigger value="teams">Teams ({teams.length})</Tabs.Trigger>
            )}
            <Tabs.Trigger value="invitations">
              Invitations ({invitations.length})
            </Tabs.Trigger>
            <Tabs.Trigger value="sso">SSO ({ssoProviders.length})</Tabs.Trigger>
          </Tabs.List>

          {/* ── Details ── */}
          <Tabs.Content value="details">
            <EditLayout>
              {/* Left: editable fields */}
              <Flex direction="column" gap={5}>
                <FormSection>
                  <SectionLabel>Details</SectionLabel>
                  <Field.Root style={{ width: "100%" }}>
                    <Field.Label>Name</Field.Label>
                    <TextInput
                      value={editName ?? org?.name ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEditName(e.target.value)
                      }
                      data-testid="org-name-input"
                    />
                  </Field.Root>
                  <Field.Root hint="Used in URLs" style={{ width: "100%" }}>
                    <Field.Label>Slug</Field.Label>
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
                    label="Logo URL"
                    name="logo"
                    value={editLogo ?? org?.logo ?? ""}
                    onChange={setEditLogo}
                    placeholder="https://example.com/logo.png"
                    hint="Optional — publicly accessible image URL"
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
                  <SectionLabel>Details</SectionLabel>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    <MetaItem style={{ gridColumn: "1 / -1" }}>
                      <MetaKey>Organization ID</MetaKey>
                      <MonoChip>{org?.id}</MonoChip>
                    </MetaItem>
                    <MetaItem>
                      <MetaKey>Members</MetaKey>
                      <MetaVal>{org?.memberCount ?? 0}</MetaVal>
                    </MetaItem>
                    <MetaItem>
                      <MetaKey>Created</MetaKey>
                      <MetaVal>
                        {org?.createdAt
                          ? new Date(org.createdAt).toLocaleDateString()
                          : "—"}
                      </MetaVal>
                    </MetaItem>
                  </div>
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
                <SectionLabel>Add member</SectionLabel>
                <Grid.Root gap={3}>
                  <Grid.Item col={8}>
                    <UserCombobox
                      label="User"
                      value={addUserId}
                      onChange={setAddUserId}
                    />
                  </Grid.Item>
                  <Grid.Item col={4}>
                    <Field.Root>
                      <Field.Label>Role</Field.Label>
                      <SingleSelect
                        value={addRole}
                        onChange={(role: string | number) =>
                          setAddRole(String(role))
                        }
                        aria-label="Member role"
                      >
                        <SingleSelectOption value="member">
                          Member
                        </SingleSelectOption>
                        <SingleSelectOption value="admin">
                          Admin
                        </SingleSelectOption>
                        <SingleSelectOption value="owner">
                          Owner
                        </SingleSelectOption>
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
                    Add member
                  </Button>
                </Box>
              </FormSection>

              <FormSection>
                <SectionLabel>Members ({members.length})</SectionLabel>
                {membersQuery.isLoading ? (
                  <Typography textColor="neutral500">Loading…</Typography>
                ) : members.length === 0 ? (
                  <Typography variant="pi" textColor="neutral500">
                    No members yet.
                  </Typography>
                ) : (
                  <Flex direction="column" gap={2}>
                    {members.map((member) => (
                      <AccountRow key={member.id} data-testid="member-row">
                        <Flex
                          direction="column"
                          gap={1}
                          alignItems="flex-start"
                          style={{ flex: 1 }}
                        >
                          <Typography variant="omega" fontWeight="semiBold">
                            {member.user?.name ?? "Unknown"}
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
                              aria-label="Member role"
                            >
                              <SingleSelectOption value="member">
                                Member
                              </SingleSelectOption>
                              <SingleSelectOption value="admin">
                                Admin
                              </SingleSelectOption>
                              <SingleSelectOption value="owner">
                                Owner
                              </SingleSelectOption>
                            </SingleSelect>
                          </Field.Root>
                          <IconButton
                            label="Remove member"
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
                  <SectionLabel>Create team</SectionLabel>
                  <Flex gap={2} alignItems="flex-end">
                    <Box style={{ flex: 1 }}>
                      <Field.Root>
                        <Field.Label>Team name</Field.Label>
                        <TextInput
                          value={newTeamName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewTeamName(e.target.value)
                          }
                          placeholder="e.g. Engineering"
                        />
                      </Field.Root>
                    </Box>
                    <Button
                      startIcon={<Plus />}
                      disabled={!newTeamName}
                      loading={createTeamMutation.isLoading}
                      onClick={() => createTeamMutation.mutate()}
                    >
                      Create
                    </Button>
                  </Flex>
                </FormSection>

                <FormSection>
                  <SectionLabel>Teams ({teams.length})</SectionLabel>
                  {teamsQuery.isLoading ? (
                    <Typography textColor="neutral500">Loading…</Typography>
                  ) : teams.length === 0 ? (
                    <Typography variant="pi" textColor="neutral500">
                      No teams yet.
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
                <SectionLabel>SSO providers</SectionLabel>
                {ssoQuery.isLoading ? (
                  <Typography textColor="neutral500">Loading…</Typography>
                ) : ssoProviders.length === 0 ? (
                  <Typography variant="pi" textColor="neutral500">
                    No SSO providers configured.
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
                          style={{ flex: 1 }}
                        >
                          <ProviderBadge>{provider.providerId}</ProviderBadge>
                          <Typography variant="pi" textColor="neutral500">
                            {provider.domain}
                          </Typography>
                          <Typography variant="pi" textColor="neutral500">
                            Issuer: {provider.issuer}
                          </Typography>
                        </Flex>
                        <IconButton
                          label="Delete SSO provider"
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
                <SectionLabel>Invite member by email</SectionLabel>
                <Grid.Root gap={3}>
                  <Grid.Item col={8}>
                    <Field.Root>
                      <Field.Label>Email address</Field.Label>
                      <TextInput
                        type="email"
                        value={inviteEmail}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setInviteEmail(e.target.value)
                        }
                        placeholder="user@example.com"
                      />
                    </Field.Root>
                  </Grid.Item>
                  <Grid.Item col={4}>
                    <Field.Root>
                      <Field.Label>Role</Field.Label>
                      <SingleSelect
                        value={inviteRole}
                        onChange={(v: string | number) =>
                          setInviteRole(String(v))
                        }
                        aria-label="Invite role"
                      >
                        <SingleSelectOption value="member">
                          Member
                        </SingleSelectOption>
                        <SingleSelectOption value="admin">
                          Admin
                        </SingleSelectOption>
                        <SingleSelectOption value="owner">
                          Owner
                        </SingleSelectOption>
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
                    Send invitation
                  </Button>
                </Box>
              </FormSection>

              <FormSection>
                <SectionLabel>Invitations ({invitations.length})</SectionLabel>
                {invitationsQuery.isLoading ? (
                  <Typography textColor="neutral500">Loading…</Typography>
                ) : invitations.length === 0 ? (
                  <Typography variant="pi" textColor="neutral500">
                    No invitations yet.
                  </Typography>
                ) : (
                  <Flex direction="column" gap={2}>
                    {invitations.map((inv) => {
                      const statusColor: Record<string, string> = {
                        pending: "#f59e0b",
                        accepted: "#5cb176",
                        rejected: "#d02b20",
                        canceled: "#8e8ea9",
                      };
                      const color = statusColor[inv.status] ?? "#8e8ea9";
                      const isPending = inv.status === "pending";
                      return (
                        <AccountRow key={inv.id}>
                          <Flex
                            direction="column"
                            gap={1}
                            alignItems="flex-start"
                            style={{ flex: 1 }}
                          >
                            <Typography variant="omega" fontWeight="semiBold">
                              {inv.user?.name ?? inv.email}
                            </Typography>
                            <Typography variant="pi" textColor="neutral500">
                              {inv.email} · role: {inv.role}
                            </Typography>
                            <Typography variant="pi" textColor="neutral500">
                              Expires{" "}
                              {new Date(inv.expiresAt).toLocaleDateString()}
                            </Typography>
                          </Flex>
                          <Flex gap={2} alignItems="center">
                            <MonoChip
                              style={{
                                color,
                                borderColor: color,
                                background: `${color}18`,
                              }}
                            >
                              {inv.status}
                            </MonoChip>
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
                                  Resend
                                </Button>
                                <IconButton
                                  label="Cancel invitation"
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
          title="Remove member"
          message="Are you sure you want to remove this member from the organization?"
          confirmLabel="Remove"
          loading={removeMemberMutation.isLoading}
          onConfirm={() => removeMemberMutation.mutate(confirmRemoveMemberId)}
          onCancel={() => setConfirmRemoveMemberId(null)}
        />
      )}

      {confirmDeleteTeamId && (
        <ConfirmDialog
          title="Delete team"
          message="Are you sure you want to delete this team? All team members will be removed. This action cannot be undone."
          confirmLabel="Delete"
          loading={deleteTeamMutation.isLoading}
          onConfirm={() => deleteTeamMutation.mutate(confirmDeleteTeamId)}
          onCancel={() => setConfirmDeleteTeamId(null)}
        />
      )}

      {confirmDeleteSsoId && (
        <ConfirmDialog
          title="Delete SSO provider"
          message="Are you sure you want to delete this SSO provider? Members using this provider will need to authenticate differently."
          confirmLabel="Delete"
          loading={deleteSsoMutation.isLoading}
          onConfirm={() => deleteSsoMutation.mutate(confirmDeleteSsoId)}
          onCancel={() => setConfirmDeleteSsoId(null)}
        />
      )}

      {confirmCancelInvitationId && (
        <ConfirmDialog
          title="Cancel invitation"
          message="Are you sure you want to cancel this invitation? The invite link will no longer work."
          confirmLabel="Cancel invitation"
          loading={cancelInvitationMutation.isLoading}
          onConfirm={() =>
            cancelInvitationMutation.mutate(confirmCancelInvitationId)
          }
          onCancel={() => setConfirmCancelInvitationId(null)}
        />
      )}
    </Drawer>
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
      if (result.error) throw new Error(result.error.message ?? "Failed");
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
      if (result.error) throw new Error(result.error.message ?? "Failed");
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
      if (result.error) throw new Error(result.error.message ?? "Failed");
    },
    onSuccess: () => {
      setConfirmRemoveTeamMemberId(null);
      qc.invalidateQueries({
        queryKey: ["dash-team-members", organizationId, team.id],
      });
    },
  });

  return (
    <ExpandableRow data-testid="team-row">
      <ExpandableRowHeader onClick={() => setExpanded((e) => !e)}>
        <Flex
          direction="column"
          gap={1}
          alignItems="flex-start"
          style={{ flex: 1 }}
        >
          <Typography variant="omega" fontWeight="semiBold">
            {team.name}
          </Typography>
          <Typography variant="pi" textColor="neutral500">
            {expanded ? "Collapse" : "Expand"} ·{" "}
            {teamMembersQuery.data?.length ?? "—"} members
          </Typography>
        </Flex>
        <Flex gap={2} alignItems="center">
          <Typography variant="pi" textColor="neutral400">
            {expanded ? "▲" : "▼"}
          </Typography>
          <Box onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <IconButton label="Delete team" onClick={onDelete}>
              <Trash />
            </IconButton>
          </Box>
        </Flex>
      </ExpandableRowHeader>

      {expanded && (
        <ExpandableRowBody>
          <Flex gap={2} alignItems="flex-end">
            <Box style={{ flex: 1 }}>
              <UserCombobox
                label="Add member to team"
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
              Add
            </Button>
          </Flex>

          {teamMembersQuery.isLoading ? (
            <Typography variant="pi" textColor="neutral500">
              Loading…
            </Typography>
          ) : (teamMembersQuery.data ?? []).length === 0 ? (
            <Typography variant="pi" textColor="neutral500">
              No members in this team.
            </Typography>
          ) : (
            <Flex direction="column" gap={2}>
              {/* biome-ignore lint/suspicious/noExplicitAny: team member shape varies by config */}
              {(teamMembersQuery.data ?? []).map((tm: any) => (
                <AccountRow key={tm.id}>
                  <Flex
                    direction="column"
                    gap={1}
                    alignItems="flex-start"
                    style={{ flex: 1 }}
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
                    label="Remove from team"
                    onClick={() => setConfirmRemoveTeamMemberId(tm.userId)}
                  >
                    <Trash />
                  </IconButton>
                </AccountRow>
              ))}
            </Flex>
          )}
        </ExpandableRowBody>
      )}

      {confirmRemoveTeamMemberId && (
        <ConfirmDialog
          title="Remove from team"
          message="Are you sure you want to remove this member from the team?"
          confirmLabel="Remove"
          loading={removeTeamMemberMutation.isLoading}
          onConfirm={() =>
            removeTeamMemberMutation.mutate(confirmRemoveTeamMemberId)
          }
          onCancel={() => setConfirmRemoveTeamMemberId(null)}
        />
      )}
    </ExpandableRow>
  );
}
