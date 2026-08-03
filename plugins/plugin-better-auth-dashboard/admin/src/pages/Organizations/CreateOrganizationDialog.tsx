import {
  Box,
  Button,
  Checkbox,
  Field,
  Flex,
  TextInput,
  Typography,
} from "@strapi/design-system";
import { useNotification } from "@strapi/strapi/admin";
import type React from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "react-query";
import { client, getAuthHeaders } from "../../client";
import { Drawer } from "../../components/Drawer";
import { FormSection, SectionLabel } from "../../components/FormPrimitives";
import { MediaPickerField } from "../../components/MediaPickerField";
import { UserCombobox } from "../../components/UserCombobox";
import { withContext } from "../../utils/dashContext";

interface Props {
  teamsEnabled: boolean;
  onClose: () => void;
}

export function CreateOrganizationDialog({ teamsEnabled, onClose }: Props) {
  const qc = useQueryClient();
  const { toggleNotification } = useNotification();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logo, setLogo] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [skipDefaultTeam, setSkipDefaultTeam] = useState(false);
  const [defaultTeamName, setDefaultTeamName] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await client.dash.organization.create(
        {
          name,
          slug,
          ...(logo ? { logo } : {}),
          ...(teamsEnabled && !skipDefaultTeam && defaultTeamName
            ? { defaultTeamName }
            : {}),
        },
        withContext({ userId: ownerId, skipDefaultTeam }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(result.error.message ?? "Create failed");
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-organizations"] });
      toggleNotification({
        type: "success",
        message: "Organization created successfully",
      });
      onClose();
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to create organization",
      });
    },
  });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(val));
    }
  };

  const footer = (
    <>
      <Button variant="tertiary" onClick={onClose}>
        Cancel
      </Button>
      <Button
        loading={createMutation.isLoading}
        disabled={!name || !slug || !ownerId}
        onClick={() => createMutation.mutate()}
        data-testid="create-org-submit"
      >
        Create organization
      </Button>
    </>
  );

  return (
    <Drawer title="Create organization" footer={footer} onClose={onClose}>
      <Flex direction="column" gap={5}>
        {/* Details */}
        <FormSection>
          <SectionLabel>Details</SectionLabel>
          <Field.Root style={{ width: "100%" }} required>
            <Field.Label>Name</Field.Label>
            <TextInput
              name="name"
              value={name}
              onChange={handleNameChange}
              placeholder="Acme Corp"
            />
          </Field.Root>
          <Field.Root style={{ width: "100%" }} hint="Used in URLs" required>
            <Field.Label>Slug</Field.Label>
            <TextInput
              name="slug"
              value={slug}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSlug(e.target.value)
              }
              placeholder="acme-corp"
            />
            <Field.Hint />
          </Field.Root>
          <MediaPickerField
            label="Logo URL"
            name="logo"
            value={logo}
            onChange={setLogo}
            placeholder="https://example.com/logo.png"
            hint="Optional — publicly accessible image URL"
          />
        </FormSection>

        {/* Owner */}
        <FormSection>
          <SectionLabel>Owner</SectionLabel>
          <UserCombobox
            label="Owner"
            hint="The user who will own and manage this organization"
            value={ownerId}
            onChange={setOwnerId}
            required
          />
        </FormSection>

        {/* Default team (only when teams are enabled) */}
        {teamsEnabled && (
          <FormSection>
            <SectionLabel>Default team</SectionLabel>
            <Checkbox
              name="skipDefaultTeam"
              checked={skipDefaultTeam}
              onCheckedChange={(checked: boolean) =>
                setSkipDefaultTeam(checked)
              }
            >
              Don't create a default team
            </Checkbox>
            {!skipDefaultTeam && (
              <Field.Root style={{ width: "100%" }}>
                <Field.Label>Default team name</Field.Label>
                <TextInput
                  name="defaultTeamName"
                  value={defaultTeamName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDefaultTeamName(e.target.value)
                  }
                  placeholder="Leave blank to use the system default"
                />
              </Field.Root>
            )}
            {skipDefaultTeam && (
              <Box>
                <Typography variant="pi" textColor="neutral500">
                  Members can be added to teams manually after the organization
                  is created.
                </Typography>
              </Box>
            )}
          </FormSection>
        )}
      </Flex>
    </Drawer>
  );
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
