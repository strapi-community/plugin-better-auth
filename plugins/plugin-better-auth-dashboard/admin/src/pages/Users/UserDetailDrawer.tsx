import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Field,
  Flex,
  Grid,
  IconButton,
  Loader,
  Modal,
  NumberInput,
  Tabs,
  TextInput,
  Typography,
} from "@strapi/design-system";
import { Trash } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import type React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { client, getAuthHeaders } from "../../client";
import { Avatar } from "../../components/Avatar";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { CustomFieldsSection } from "../../components/DynamicField";
import { EditViewSidePanels } from "../../components/EditViewSidePanels";
import {
  AccountRow,
  Code,
  DangerRow,
  EditLayout,
  EditSidebar,
  FormSection,
  MetaItem,
  MetaKey,
  MetaVal,
  MonoChip,
  PreviewPill,
  ProviderBadge,
  RoleBadge,
  SectionLabel,
  WarnCard,
} from "../../components/FormPrimitives";
import { MediaPickerField } from "../../components/MediaPickerField";
import { SheetDialog } from "../../components/Sheet";
import { useModelSchema } from "../../hooks/useModelSchema";
import { usePluginSettings } from "../../hooks/usePluginSettings";
import { withContext } from "../../utils/dashContext";

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <Field.Root width="100%">
      <Field.Label>{label}</Field.Label>
      <TextInput readOnly value={value} />
    </Field.Root>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  return (
    <Grid.Root gap={2} gridCols={2}>
      {codes.map((code) => (
        <Grid.Item key={code} col={1}>
          <Box
            width="100%"
            background="neutral0"
            borderColor="neutral200"
            borderStyle="solid"
            borderWidth="1px"
            hasRadius
            padding={2}
            textAlign="center"
          >
            <Code variant="omega" fontWeight="semiBold" textColor="neutral800">
              {code}
            </Code>
          </Box>
        </Grid.Item>
      ))}
    </Grid.Root>
  );
}

// ─── Standard field set ───────────────────────────────────────────────────────

const STANDARD_FIELDS = new Set([
  "id",
  "name",
  "email",
  "emailVerified",
  "image",
  "banned",
  "banReason",
  "banExpires",
  "createdAt",
  "updatedAt",
]);

interface Props {
  userId: string;
  banEnabled: boolean;
  emailVerificationEnabled: boolean;
  twoFactorEnabled: boolean;
  onClose: () => void;
}

export function UserDetailDrawer({
  userId,
  banEnabled,
  emailVerificationEnabled,
  twoFactorEnabled,
  onClose,
}: Props) {
  const qc = useQueryClient();
  const { toggleNotification } = useNotification();
  const { get, put } = useFetchClient();
  const schemaQuery = useModelSchema("user");
  const settingsQuery = usePluginSettings();

  // Where email verification / password reset links should redirect back to
  // once the user completes the flow. Only the configured
  // `email_callback_url` server setting is used — deliberately no fallback
  // to the current (admin panel) origin, since guessing a client URL is
  // exactly what caused these links to point at the admin panel before.
  const emailCallbackUrl = settingsQuery.data?.email_callback_url ?? null;

  const userQuery = useQuery({
    queryKey: ["dash-user", userId],
    queryFn: async () => {
      const result = await client.dash.user(
        {},
        withContext({ userId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(result.error.message ?? "Failed to load user");
      return result.data;
    },
  });

  const orgsQuery = useQuery({
    queryKey: ["dash-user-orgs", userId],
    queryFn: async () => {
      const result = await client.dash.userOrganizations(
        {},
        withContext({ userId }, getAuthHeaders()),
      );
      if (result.error) throw new Error(result.error.message ?? "Failed");
      return result.data?.organizations ?? [];
    },
  });

  type StrapiSession = {
    id: number;
    documentId: string;
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    createdAt: string;
    expiresAt: string;
  };

  const sessionsQuery = useQuery({
    queryKey: ["dash-user-sessions", userId],
    queryFn: async () => {
      const { data } = await get<{ results: StrapiSession[] }>(
        `/better-auth-dashboard/db?uid=plugin::better-auth.session&filters[userId][$eq]=${userId}&sort[0]=createdAt:desc&pagination[pageSize]=50`,
      );
      return (data as { results?: StrapiSession[] }).results ?? [];
    },
  });

  const strapiUserQuery = useQuery({
    queryKey: ["dash-strapi-user", userId],
    enabled: !!schemaQuery.data,
    queryFn: async () => {
      const relationFields = Object.entries(schemaQuery.data!)
        .filter(([, attr]) => attr.type === "relation")
        .map(([fieldName]) => fieldName);

      const populateParam =
        relationFields.length > 0
          ? `&populate=${encodeURIComponent(relationFields.join(","))}`
          : "";

      const { data } = await get<{ results: Record<string, unknown>[] }>(
        `/better-auth-dashboard/db?uid=plugin::better-auth.user&filters[id][$eq]=${userId}&pagination[pageSize]=1${populateParam}`,
      );
      return (
        (data as { results?: Record<string, unknown>[] }).results?.[0] ?? null
      );
    },
  });

  const [activeTab, setActiveTab] = useState("profile");
  const [editName, setEditName] = useState<string | undefined>(undefined);
  const [editEmail, setEditEmail] = useState<string | undefined>(undefined);
  const [editEmailVerified, setEditEmailVerified] = useState<
    boolean | undefined
  >(undefined);
  const [editImage, setEditImage] = useState<string | undefined>(undefined);
  const [editExtra, setEditExtra] = useState<Record<string, unknown>>({});
  const [newPassword, setNewPassword] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banExpiresDays, setBanExpiresDays] = useState("");
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [confirmRevokeSessionId, setConfirmRevokeSessionId] = useState<
    string | null
  >(null);
  const [confirmBan, setConfirmBan] = useState(false);
  const [confirmUnban, setConfirmUnban] = useState(false);
  const [confirmUnlinkAccountId, setConfirmUnlinkAccountId] = useState<
    string | null
  >(null);
  const [confirmDisable2FA, setConfirmDisable2FA] = useState(false);
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const [confirmRegenerateBackupCodes, setConfirmRegenerateBackupCodes] =
    useState(false);
  const [twoFactorData, setTwoFactorData] = useState<{
    totpURI: string;
    secret: string;
    backupCodes: string[];
  } | null>(null);
  const [totpUriData, setTotpUriData] = useState<{
    totpURI: string;
    secret: string;
  } | null>(null);
  const [backupCodesData, setBackupCodesData] = useState<string[] | null>(null);

  const user = userQuery.data;
  const displayName = editName ?? user?.name ?? "";
  const displayEmail = editEmail ?? user?.email ?? "";
  const displayEmailVerified =
    editEmailVerified ?? user?.emailVerified ?? false;
  const displayImage = editImage ?? user?.image ?? "";

  const handleExtraChange = (name: string, value: unknown) => {
    setEditExtra((prev) => ({ ...prev, [name]: value }));
  };

  const extraData: Record<string, unknown> = {
    ...(strapiUserQuery.data ?? {}),
    ...editExtra,
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      if (editName !== undefined) body.name = editName;
      if (editEmail !== undefined) body.email = editEmail;
      if (editEmailVerified !== undefined)
        body.emailVerified = editEmailVerified;
      if (editImage !== undefined) body.image = editImage;

      const documentId = strapiUserQuery.data?.documentId as string | undefined;
      if (!documentId) throw new Error("Could not resolve documentId for user");

      const updateUser = await client.dash.updateUser(
        { userId, ...body },
        withContext({ userId }, getAuthHeaders()),
      );

      if (!updateUser.data) throw new Error("Update failed");

      if (Object.keys(editExtra).length > 0) {
        await put(
          `/better-auth-dashboard/db/${documentId}?uid=plugin::better-auth.user`,
          editExtra,
        );
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dash-strapi-user", userId] });
      qc.invalidateQueries({ queryKey: ["dash-user", userId] });
      qc.invalidateQueries({ queryKey: ["dash-users"] });
      setEditName(undefined);
      setEditEmail(undefined);
      setEditEmailVerified(undefined);
      setEditImage(undefined);
      setEditExtra({});
      toggleNotification({
        type: "success",
        message: "User updated successfully",
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

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const result = await client.dash.sessions.revoke(
        {},
        withContext({ sessionId, userId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(result.error.message ?? "Revoke failed");
    },
    onSuccess: () => {
      setConfirmRevokeSessionId(null);
      qc.invalidateQueries({ queryKey: ["dash-user-sessions", userId] });
      toggleNotification({ type: "success", message: "Session revoked" });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to revoke session",
      });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      const result = await client.dash.setPassword(
        { password: newPassword },
        withContext({ userId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(result.error.message ?? "Password update failed");
      return result.data;
    },
    onSuccess: () => {
      setNewPassword("");
      toggleNotification({
        type: "success",
        message: "Password updated successfully",
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Password update failed",
      });
    },
  });

  const banMutation = useMutation({
    mutationFn: async () => {
      const body: { banReason?: string; banExpires?: number } = {};
      if (banReason) body.banReason = banReason;
      if (banExpiresDays) {
        const days = parseInt(banExpiresDays, 10);
        if (!Number.isNaN(days)) body.banExpires = Date.now() + days * 86400000;
      }
      const result = await client.dash.banUser(
        body,
        withContext({ userId }, getAuthHeaders()),
      );
      if (result.error) throw new Error(result.error.message ?? "Ban failed");
      return result.data;
    },
    onSuccess: () => {
      setConfirmBan(false);
      qc.invalidateQueries({ queryKey: ["dash-user", userId] });
      qc.invalidateQueries({ queryKey: ["dash-users"] });
      setBanReason("");
      setBanExpiresDays("");
      toggleNotification({ type: "success", message: "User has been banned" });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Ban failed",
      });
    },
  });

  const unbanMutation = useMutation({
    mutationFn: async () => {
      const result = await client.dash.unbanUser(
        {},
        withContext({ userId }, getAuthHeaders()),
      );
      if (result.error) throw new Error(result.error.message ?? "Unban failed");
      return result.data;
    },
    onSuccess: () => {
      setConfirmUnban(false);
      qc.invalidateQueries({ queryKey: ["dash-user", userId] });
      qc.invalidateQueries({ queryKey: ["dash-users"] });
      toggleNotification({ type: "success", message: "Ban has been lifted" });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Unban failed",
      });
    },
  });

  const unlinkAccountMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const result = await client.dash.unlinkAccount(
        { providerId },
        withContext({ userId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(result.error.message ?? "Failed to unlink account");
    },
    onSuccess: () => {
      setConfirmUnlinkAccountId(null);
      qc.invalidateQueries({ queryKey: ["dash-user", userId] });
      toggleNotification({ type: "success", message: "Account unlinked" });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to unlink account",
      });
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      const result = await client.dash.sessions.revokeAll(
        { userId },
        withContext({}, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(result.error.message ?? "Revoke failed");
      return result.data;
    },
    onSuccess: () => {
      setConfirmRevokeAll(false);
      toggleNotification({ type: "success", message: "All sessions revoked" });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to revoke sessions",
      });
    },
  });

  const sendVerificationMutation = useMutation({
    mutationFn: async () => {
      if (!emailCallbackUrl) {
        throw new Error(
          "Set `email_callback_url` in the better-auth-dashboard plugin config to enable this action.",
        );
      }
      const result = await client.dash.sendVerificationEmail(
        { callbackUrl: emailCallbackUrl },
        withContext({ userId }, getAuthHeaders()),
      );
      if (result.error) throw new Error(result.error.message ?? "Failed");
      return result.data;
    },
    onSuccess: () => {
      toggleNotification({
        type: "success",
        message: "Verification email sent",
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to send email",
      });
    },
  });

  const sendResetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!emailCallbackUrl) {
        throw new Error(
          "Set `email_callback_url` in the better-auth-dashboard plugin config to enable this action.",
        );
      }
      const result = await client.dash.sendResetPasswordEmail(
        { callbackUrl: emailCallbackUrl },
        withContext({ userId }, getAuthHeaders()),
      );
      if (result.error) throw new Error(result.error.message ?? "Failed");
      return result.data;
    },
    onSuccess: () => {
      toggleNotification({
        type: "success",
        message: "Password reset email sent",
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to send email",
      });
    },
  });

  const enableTwoFactorMutation = useMutation({
    mutationFn: async () => {
      const result = await client.dash.enableTwoFactor(
        {},
        withContext({ userId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(result.error.message ?? "Failed to enable 2FA");
      return result.data;
    },
    onSuccess: (data) => {
      if (data) setTwoFactorData(data);
      qc.invalidateQueries({ queryKey: ["dash-user", userId] });
      toggleNotification({
        type: "success",
        message: "Two-factor authentication enabled",
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to enable 2FA",
      });
    },
  });

  const disableTwoFactorMutation = useMutation({
    mutationFn: async () => {
      const result = await client.dash.disableTwoFactor(
        {},
        withContext({ userId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(result.error.message ?? "Failed to disable 2FA");
      return result.data;
    },
    onSuccess: () => {
      setConfirmDisable2FA(false);
      setTwoFactorData(null);
      setTotpUriData(null);
      setBackupCodesData(null);
      qc.invalidateQueries({ queryKey: ["dash-user", userId] });
      toggleNotification({
        type: "success",
        message: "Two-factor authentication disabled",
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to disable 2FA",
      });
    },
  });

  const viewTotpUriMutation = useMutation({
    mutationFn: async () => {
      // biome-ignore lint/suspicious/noExplicitAny: viewTwoFactorTotpUri is not typed in @better-auth/infra
      const result = await (client.dash as any).viewTwoFactorTotpUri(
        {},
        withContext({ userId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(result.error.message ?? "Failed to load TOTP URI");
      return result.data;
    },
    onSuccess: (data) => {
      if (data) {
        setTotpUriData(data);
        setShowTotpModal(true);
      }
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to load TOTP URI",
      });
    },
  });

  const viewBackupCodesMutation = useMutation({
    mutationFn: async () => {
      const result = await client.dash.viewBackupCodes(
        {},
        withContext({ userId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(result.error.message ?? "Failed to load backup codes");
      return result.data;
    },
    onSuccess: (data) => {
      if (data) {
        setBackupCodesData(data.backupCodes);
        setShowBackupCodesModal(true);
      }
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to load backup codes",
      });
    },
  });

  const generateBackupCodesMutation = useMutation({
    mutationFn: async () => {
      const result = await client.dash.generateBackupCodes(
        {},
        withContext({ userId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(
          result.error.message ?? "Failed to generate backup codes",
        );
      return result.data;
    },
    onSuccess: (data) => {
      setConfirmRegenerateBackupCodes(false);
      if (data) {
        setBackupCodesData(data.backupCodes);
        setShowBackupCodesModal(true);
      }
      toggleNotification({
        type: "success",
        message: "New backup codes generated",
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to generate backup codes",
      });
    },
  });

  const hasEdits =
    editName !== undefined ||
    editEmail !== undefined ||
    editEmailVerified !== undefined ||
    editImage !== undefined ||
    Object.keys(editExtra).length > 0;

  const customFields = Object.entries(schemaQuery.data ?? {})
    .filter(([name]) => !STANDARD_FIELDS.has(name))
    .map(([name, attribute]) => ({ name, attribute }));

  const banExpiryPreview =
    banExpiresDays && !Number.isNaN(parseInt(banExpiresDays, 10))
      ? new Date(
          Date.now() + parseInt(banExpiresDays, 10) * 86400000,
        ).toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

  const drawerTitle = (
    <Flex tag="span" gap={3} alignItems="center">
      <Avatar name={user?.name ?? "?"} src={user?.image} size={32} />
      <Flex tag="span" direction="column" alignItems="flex-start">
        <Typography variant="omega" fontWeight="bold" textColor="neutral800">
          {user?.name ?? "User"}
        </Typography>
        {user?.email && (
          <Typography variant="pi" textColor="neutral600">
            {user.email}
          </Typography>
        )}
      </Flex>
      {user?.banned && (
        <Badge variant="danger" size="S">
          Banned
        </Badge>
      )}
    </Flex>
  );

  const profileFooter =
    activeTab === "profile" ? (
      <>
        <Button
          variant="tertiary"
          onClick={() => {
            setEditName(undefined);
            setEditEmail(undefined);
            setEditEmailVerified(undefined);
            setEditImage(undefined);
            setEditExtra({});
            onClose();
          }}
        >
          Discard
        </Button>
        <Button
          disabled={!hasEdits}
          loading={updateMutation.isLoading}
          onClick={() => updateMutation.mutate()}
          data-testid="save-user-btn"
        >
          Save changes
        </Button>
      </>
    ) : undefined;

  return (
    <SheetDialog
      title={drawerTitle}
      actionButtons={profileFooter}
      onClose={onClose}
      data-testid="user-detail-drawer"
    >
      {userQuery.isLoading ? (
        <Flex justifyContent="center" padding={8}>
          <Loader>Loading user…</Loader>
        </Flex>
      ) : userQuery.isError ? (
        <Alert closeLabel="Close" title="Failed to load user" variant="danger">
          {userQuery.error instanceof Error
            ? userQuery.error.message
            : "An error occurred"}
        </Alert>
      ) : (
        <Tabs.Root defaultValue="profile" onValueChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
            <Tabs.Trigger value="security">Security</Tabs.Trigger>
            {banEnabled && <Tabs.Trigger value="ban">Ban</Tabs.Trigger>}
            <Tabs.Trigger value="sessions">Sessions</Tabs.Trigger>
            <Tabs.Trigger value="organizations">Organizations</Tabs.Trigger>
          </Tabs.List>

          {/* ── Profile ── */}
          <Tabs.Content value="profile">
            <EditLayout>
              {/* Left: editable fields */}
              <Flex direction="column" gap={5}>
                <FormSection>
                  <SectionLabel>Personal information</SectionLabel>
                  <Field.Root style={{ width: "100%" }}>
                    <Field.Label>Full name</Field.Label>
                    <TextInput
                      value={displayName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEditName(e.target.value)
                      }
                      data-testid="user-name-input"
                    />
                  </Field.Root>
                  <Field.Root style={{ width: "100%" }}>
                    <Field.Label>Email address</Field.Label>
                    <TextInput
                      type="email"
                      value={displayEmail}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEditEmail(e.target.value)
                      }
                    />
                  </Field.Root>
                  <Checkbox
                    checked={displayEmailVerified}
                    onCheckedChange={(checked: boolean) =>
                      setEditEmailVerified(checked)
                    }
                  >
                    Mark email as verified
                  </Checkbox>
                  <MediaPickerField
                    label="Avatar URL"
                    name="image"
                    value={displayImage}
                    onChange={setEditImage}
                    placeholder="https://example.com/avatar.png"
                    hint="Optional — publicly accessible image URL"
                  />
                </FormSection>

                <CustomFieldsSection
                  fields={customFields}
                  data={extraData}
                  onChange={handleExtraChange}
                />
              </Flex>

              {/* Right: metadata + email actions */}
              <EditSidebar>
                <FormSection>
                  <SectionLabel>Details</SectionLabel>
                  <Grid.Root gap={3} gridCols={2}>
                    <Grid.Item col={2}>
                      <MetaItem>
                        <MetaKey>User ID</MetaKey>
                        <MonoChip>{user?.id}</MonoChip>
                      </MetaItem>
                    </Grid.Item>
                    <Grid.Item col={1}>
                      <MetaItem>
                        <MetaKey>Created</MetaKey>
                        <MetaVal>
                          {user?.createdAt
                            ? new Date(user.createdAt).toLocaleString()
                            : "—"}
                        </MetaVal>
                      </MetaItem>
                    </Grid.Item>
                    <Grid.Item col={1}>
                      <MetaItem>
                        <MetaKey>Last updated</MetaKey>
                        <MetaVal>
                          {user?.updatedAt
                            ? new Date(user.updatedAt).toLocaleString()
                            : "—"}
                        </MetaVal>
                      </MetaItem>
                    </Grid.Item>
                  </Grid.Root>
                </FormSection>

                {emailVerificationEnabled && (
                  <Flex direction="column" alignItems="stretch" gap={2}>
                    <SectionLabel>Email actions</SectionLabel>
                    <Flex direction="column" alignItems="stretch" gap={2}>
                      <Button
                        variant="secondary"
                        size="S"
                        fullWidth
                        loading={sendVerificationMutation.isLoading}
                        disabled={!emailCallbackUrl || user?.emailVerified}
                        onClick={() => sendVerificationMutation.mutate()}
                      >
                        Send verification email
                      </Button>
                      <Button
                        variant="secondary"
                        size="S"
                        fullWidth
                        loading={sendResetPasswordMutation.isLoading}
                        disabled={!emailCallbackUrl}
                        onClick={() => sendResetPasswordMutation.mutate()}
                      >
                        Send password reset
                      </Button>
                      {!settingsQuery.isLoading && !emailCallbackUrl && (
                        <Typography variant="pi" textColor="neutral600">
                          Set `email_callback_url` in the better-auth-dashboard
                          plugin config to enable these actions.
                        </Typography>
                      )}
                    </Flex>
                  </Flex>
                )}

                <EditViewSidePanels
                  model="plugin::better-auth.user"
                  documentId={
                    strapiUserQuery.data?.documentId as string | undefined
                  }
                  document={strapiUserQuery.data ?? undefined}
                />
              </EditSidebar>
            </EditLayout>
          </Tabs.Content>

          {/* ── Security ── */}
          <Tabs.Content value="security">
            <Flex direction="column" gap={5} paddingTop={6}>
              {/* Password */}
              <FormSection>
                <SectionLabel>Password</SectionLabel>
                <Field.Root hint="The user will be able to sign in with this new password">
                  <Field.Label>New password</Field.Label>
                  <TextInput
                    type="password"
                    value={newPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewPassword(e.target.value)
                    }
                    placeholder="Enter a strong password…"
                  />
                  <Field.Hint />
                </Field.Root>
                <Box>
                  <Button
                    disabled={!newPassword}
                    loading={passwordMutation.isLoading}
                    onClick={() => passwordMutation.mutate()}
                  >
                    Set password
                  </Button>
                </Box>
              </FormSection>

              {/* Linked accounts */}
              <FormSection>
                <SectionLabel>Linked accounts</SectionLabel>
                {user?.account && user.account.length > 0 ? (
                  <Flex direction="column" gap={2}>
                    {user.account.map((acc) => (
                      <AccountRow key={acc.id}>
                        <ProviderBadge>{acc.providerId}</ProviderBadge>
                        <Button
                          variant="danger-light"
                          size="S"
                          onClick={() =>
                            setConfirmUnlinkAccountId(acc.providerId)
                          }
                        >
                          Unlink
                        </Button>
                      </AccountRow>
                    ))}
                  </Flex>
                ) : (
                  <Typography variant="pi" textColor="neutral500">
                    No linked OAuth accounts.
                  </Typography>
                )}
              </FormSection>

              {/* Two-factor authentication */}
              {twoFactorEnabled && (
                <FormSection>
                  <Flex justifyContent="space-between" alignItems="center">
                    <SectionLabel>Two-factor authentication</SectionLabel>
                    <Badge
                      size="S"
                      variant={
                        (user as Record<string, unknown>)?.twoFactorEnabled
                          ? "success"
                          : "neutral"
                      }
                    >
                      {(user as Record<string, unknown>)?.twoFactorEnabled
                        ? "Enabled"
                        : "Not enabled"}
                    </Badge>
                  </Flex>

                  {(user as Record<string, unknown>)?.twoFactorEnabled ? (
                    <Flex direction="column" gap={2}>
                      {/* TOTP row */}
                      <AccountRow>
                        <Flex
                          direction="column"
                          gap={1}
                          alignItems="flex-start"
                        >
                          <Typography variant="omega" fontWeight="semiBold">
                            TOTP authenticator
                          </Typography>
                          <Typography variant="pi" textColor="neutral500">
                            View the URI and secret for this user's
                            authenticator app.
                          </Typography>
                        </Flex>
                        <Button
                          variant="secondary"
                          size="S"
                          loading={viewTotpUriMutation.isLoading}
                          onClick={() => viewTotpUriMutation.mutate()}
                        >
                          {totpUriData ? "Refresh" : "View"}
                        </Button>
                      </AccountRow>

                      {/* Backup codes row */}
                      <AccountRow>
                        <Flex
                          direction="column"
                          gap={1}
                          alignItems="flex-start"
                        >
                          <Typography variant="omega" fontWeight="semiBold">
                            Backup codes
                          </Typography>
                          <Typography variant="pi" textColor="neutral500">
                            View or regenerate the user's recovery codes.
                          </Typography>
                        </Flex>
                        <Flex gap={2}>
                          <Button
                            variant="secondary"
                            size="S"
                            loading={viewBackupCodesMutation.isLoading}
                            onClick={() => viewBackupCodesMutation.mutate()}
                          >
                            {backupCodesData ? "Refresh" : "View"}
                          </Button>
                          <Button
                            variant="secondary"
                            size="S"
                            onClick={() =>
                              setConfirmRegenerateBackupCodes(true)
                            }
                          >
                            Regenerate
                          </Button>
                        </Flex>
                      </AccountRow>

                      {/* Disable row */}
                      <DangerRow>
                        <Flex
                          direction="column"
                          gap={1}
                          alignItems="flex-start"
                        >
                          <Typography
                            variant="omega"
                            fontWeight="semiBold"
                            textColor="danger600"
                          >
                            Disable two-factor authentication
                          </Typography>
                          <Typography variant="pi" textColor="danger500">
                            The user will no longer need a second factor to sign
                            in.
                          </Typography>
                        </Flex>
                        <Button
                          variant="danger-light"
                          size="S"
                          onClick={() => setConfirmDisable2FA(true)}
                        >
                          Disable 2FA
                        </Button>
                      </DangerRow>
                    </Flex>
                  ) : (
                    <Flex direction="column" gap={2}>
                      {twoFactorData && (
                        <Flex direction="column" alignItems="stretch" gap={3}>
                          <Typography variant="pi" textColor="neutral600">
                            Scan the TOTP URI with an authenticator app, or
                            enter the secret key manually.
                          </Typography>
                          <ReadOnlyField
                            label="TOTP URI"
                            value={twoFactorData.totpURI}
                          />
                          <ReadOnlyField
                            label="Secret key"
                            value={twoFactorData.secret}
                          />
                          <Flex direction="column" alignItems="stretch" gap={2}>
                            <SectionLabel>Backup codes</SectionLabel>
                            <BackupCodes codes={twoFactorData.backupCodes} />
                          </Flex>
                        </Flex>
                      )}

                      <AccountRow>
                        <Flex
                          direction="column"
                          gap={1}
                          alignItems="flex-start"
                        >
                          <Typography variant="omega" fontWeight="semiBold">
                            Enable two-factor authentication
                          </Typography>
                          <Typography variant="pi" textColor="neutral500">
                            Add an extra layer of security to this account.
                          </Typography>
                        </Flex>
                        <Button
                          size="S"
                          loading={enableTwoFactorMutation.isLoading}
                          onClick={() => enableTwoFactorMutation.mutate()}
                        >
                          Enable 2FA
                        </Button>
                      </AccountRow>
                    </Flex>
                  )}
                </FormSection>
              )}
            </Flex>
          </Tabs.Content>

          {/* ── Ban ── */}
          {banEnabled && (
            <Tabs.Content value="ban">
              <Flex direction="column" gap={5} paddingTop={6}>
                {user?.banned ? (
                  <FormSection>
                    <SectionLabel>Ban status</SectionLabel>
                    <WarnCard>
                      <Typography
                        variant="omega"
                        fontWeight="semiBold"
                        textColor="danger600"
                      >
                        This user is currently banned
                      </Typography>
                      {user.banReason && (
                        <Typography variant="pi" textColor="danger600">
                          Reason: {user.banReason}
                        </Typography>
                      )}
                      {user.banExpires ? (
                        <Typography variant="pi" textColor="danger600">
                          Expires:{" "}
                          {new Date(user.banExpires).toLocaleDateString(
                            undefined,
                            {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            },
                          )}
                        </Typography>
                      ) : (
                        <Typography variant="pi" textColor="danger600">
                          Duration: Permanent
                        </Typography>
                      )}
                    </WarnCard>
                    <Box>
                      <Button
                        variant="secondary"
                        onClick={() => setConfirmUnban(true)}
                      >
                        Lift ban
                      </Button>
                    </Box>
                  </FormSection>
                ) : (
                  <FormSection>
                    <SectionLabel>Apply ban</SectionLabel>
                    <Field.Root
                      hint="Optional — will be shown to the user"
                      style={{ width: "100%" }}
                    >
                      <Field.Label>Reason</Field.Label>
                      <TextInput
                        value={banReason}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setBanReason(e.target.value)
                        }
                        placeholder="e.g. Violated terms of service"
                      />
                      <Field.Hint />
                    </Field.Root>
                    <Field.Root
                      hint="Leave empty for a permanent ban"
                      style={{ width: "100%" }}
                    >
                      <Field.Label>Duration (days)</Field.Label>
                      <Flex gap={4} alignItems="center">
                        <Box flex={1}>
                          <NumberInput
                            value={
                              banExpiresDays
                                ? Number(banExpiresDays)
                                : undefined
                            }
                            onValueChange={(v: number | undefined) =>
                              setBanExpiresDays(
                                v === undefined ? "" : String(v),
                              )
                            }
                            placeholder="e.g. 30"
                          />
                        </Box>
                        <Box shrink={0}>
                          <PreviewPill>
                            {banExpiryPreview
                              ? `Expires ${banExpiryPreview}`
                              : "Permanent ban"}
                          </PreviewPill>
                        </Box>
                      </Flex>
                      <Field.Hint />
                    </Field.Root>
                    <Box>
                      <Button
                        variant="danger"
                        onClick={() => setConfirmBan(true)}
                      >
                        Ban user
                      </Button>
                    </Box>
                  </FormSection>
                )}
              </Flex>
            </Tabs.Content>
          )}

          {/* ── Sessions ── */}
          <Tabs.Content value="sessions">
            <Flex direction="column" gap={5} paddingTop={6}>
              <FormSection>
                <SectionLabel>Session management</SectionLabel>
                <AccountRow>
                  <Flex direction="column" gap={1} alignItems="flex-start">
                    <Typography variant="omega" fontWeight="semiBold">
                      Revoke all sessions
                    </Typography>
                    <Typography variant="pi" textColor="neutral500">
                      Signs the user out immediately on all devices.
                    </Typography>
                  </Flex>
                  <Button
                    variant="danger-light"
                    size="S"
                    onClick={() => setConfirmRevokeAll(true)}
                    style={{ flexShrink: 0 }}
                  >
                    Revoke all
                  </Button>
                </AccountRow>
              </FormSection>

              <FormSection>
                <SectionLabel>Active sessions</SectionLabel>
                {sessionsQuery.isLoading ? (
                  <Flex justifyContent="center" padding={4}>
                    <Loader>Loading sessions…</Loader>
                  </Flex>
                ) : (sessionsQuery.data ?? []).length === 0 ? (
                  <Typography variant="pi" textColor="neutral500">
                    No active sessions.
                  </Typography>
                ) : (
                  <Flex direction="column" gap={2} alignItems="stretch">
                    {(sessionsQuery.data ?? []).map((session) => (
                      <AccountRow
                        key={session.documentId}
                        alignItems="flex-start"
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
                              width="100%"
                            >
                              {session.userAgent}
                            </Typography>
                          )}
                        </Flex>
                        <IconButton
                          label="Revoke session"
                          onClick={() =>
                            setConfirmRevokeSessionId(String(session.id))
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

          {/* ── Organizations ── */}
          <Tabs.Content value="organizations">
            <Flex direction="column" gap={5} paddingTop={6}>
              <FormSection>
                <SectionLabel>Memberships</SectionLabel>
                {orgsQuery.isLoading ? (
                  <Flex justifyContent="center" padding={4}>
                    <Loader small>Loading…</Loader>
                  </Flex>
                ) : (orgsQuery.data ?? []).length === 0 ? (
                  <Typography variant="pi" textColor="neutral500">
                    Not a member of any organizations.
                  </Typography>
                ) : (
                  <Flex direction="column" gap={2}>
                    {(orgsQuery.data ?? []).map((org) =>
                      org ? (
                        <AccountRow key={org.id}>
                          <Flex
                            direction="column"
                            gap={1}
                            alignItems="flex-start"
                          >
                            <Typography variant="omega" fontWeight="semiBold">
                              {org.name}
                            </Typography>
                            <Flex gap={2} alignItems="center">
                              <RoleBadge memberRole={org.role}>
                                {org.role}
                              </RoleBadge>
                              {org.teams.length > 0 && (
                                <Typography variant="pi" textColor="neutral500">
                                  {org.teams.length} team
                                  {org.teams.length !== 1 ? "s" : ""}
                                </Typography>
                              )}
                            </Flex>
                          </Flex>
                        </AccountRow>
                      ) : null,
                    )}
                  </Flex>
                )}
              </FormSection>
            </Flex>
          </Tabs.Content>
        </Tabs.Root>
      )}

      {confirmRevokeAll && (
        <ConfirmDialog
          title="Revoke all sessions"
          message="Are you sure you want to revoke all sessions for this user? They will be signed out on all devices."
          confirmLabel="Revoke all"
          loading={revokeAllMutation.isLoading}
          onConfirm={() => revokeAllMutation.mutate()}
          onCancel={() => setConfirmRevokeAll(false)}
        />
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

      {confirmBan && (
        <ConfirmDialog
          title="Ban user"
          message={
            banReason
              ? `Ban this user for the following reason: "${banReason}"? They will be prevented from signing in.`
              : "Are you sure you want to ban this user? They will be prevented from signing in."
          }
          confirmLabel="Ban user"
          variant="danger"
          loading={banMutation.isLoading}
          onConfirm={() => banMutation.mutate()}
          onCancel={() => setConfirmBan(false)}
        />
      )}

      {confirmUnban && (
        <ConfirmDialog
          title="Lift ban"
          message="Are you sure you want to lift the ban on this user? They will be able to sign in again."
          confirmLabel="Lift ban"
          variant="default"
          loading={unbanMutation.isLoading}
          onConfirm={() => unbanMutation.mutate()}
          onCancel={() => setConfirmUnban(false)}
        />
      )}

      {confirmUnlinkAccountId && (
        <ConfirmDialog
          title="Unlink account"
          message={`Are you sure you want to unlink the "${confirmUnlinkAccountId}" provider from this user?`}
          confirmLabel="Unlink"
          loading={unlinkAccountMutation.isLoading}
          onConfirm={() => unlinkAccountMutation.mutate(confirmUnlinkAccountId)}
          onCancel={() => setConfirmUnlinkAccountId(null)}
        />
      )}

      {confirmDisable2FA && (
        <ConfirmDialog
          title="Disable two-factor authentication"
          message="Are you sure you want to disable 2FA for this user? They will no longer need a second factor to sign in."
          confirmLabel="Disable 2FA"
          loading={disableTwoFactorMutation.isLoading}
          onConfirm={() => disableTwoFactorMutation.mutate()}
          onCancel={() => setConfirmDisable2FA(false)}
        />
      )}

      {confirmRegenerateBackupCodes && (
        <ConfirmDialog
          title="Regenerate backup codes"
          message="This will invalidate all existing backup codes. New codes will be shown once after generation. Are you sure?"
          confirmLabel="Regenerate"
          loading={generateBackupCodesMutation.isLoading}
          onConfirm={() => generateBackupCodesMutation.mutate()}
          onCancel={() => setConfirmRegenerateBackupCodes(false)}
        />
      )}

      {showTotpModal && totpUriData && (
        <Modal.Root
          defaultOpen
          onOpenChange={(open: boolean) => !open && setShowTotpModal(false)}
        >
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>TOTP authenticator</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Flex direction="column" alignItems="stretch" gap={4}>
                <Typography variant="omega" textColor="neutral600">
                  Share these details with the user to set up their
                  authenticator app.
                </Typography>
                <ReadOnlyField label="TOTP URI" value={totpUriData.totpURI} />
                <ReadOnlyField label="Secret key" value={totpUriData.secret} />
              </Flex>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="tertiary"
                onClick={() => setShowTotpModal(false)}
              >
                Close
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Root>
      )}

      {showBackupCodesModal && backupCodesData && (
        <Modal.Root
          defaultOpen
          onOpenChange={(open: boolean) =>
            !open && setShowBackupCodesModal(false)
          }
        >
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Backup codes</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Flex direction="column" alignItems="stretch" gap={4}>
                <Typography variant="omega" textColor="neutral600">
                  Each code can only be used once. Store them somewhere safe.
                </Typography>
                <BackupCodes codes={backupCodesData} />
              </Flex>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="tertiary"
                onClick={() => setShowBackupCodesModal(false)}
              >
                Close
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Root>
      )}
    </SheetDialog>
  );
}
