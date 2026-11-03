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
import { useIntl } from "react-intl";
import { useMutation, useQueryClient } from "react-query";
import { client, getAuthHeaders } from "../../client";
import { FormSection, SectionLabel } from "../../components/FormPrimitives";
import { MediaPickerField } from "../../components/MediaPickerField";
import { SheetDialog } from "../../components/Sheet";
import { UserCombobox } from "../../components/UserCombobox";
import { withContext } from "../../utils/dashContext";
import { getTranslation } from "../../utils/getTranslation";

interface Props {
  teamsEnabled: boolean;
  onClose: () => void;
}

export function CreateOrganizationDialog({ teamsEnabled, onClose }: Props) {
  const { formatMessage } = useIntl();
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
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("organizations.create.error.createFailed"),
              defaultMessage: "Create failed",
            }),
        );
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-organizations"] });
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTranslation("organizations.create.notification.success"),
          defaultMessage: "Organization created successfully",
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
            id: getTranslation("organizations.create.notification.error"),
            defaultMessage: "Failed to create organization",
          }),
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
        {formatMessage({
          id: getTranslation("organizations.common.cancel"),
          defaultMessage: "Cancel",
        })}
      </Button>
      <Button
        loading={createMutation.isLoading}
        disabled={!name || !slug || !ownerId}
        onClick={() => createMutation.mutate()}
        data-testid="create-org-submit"
      >
        {formatMessage({
          id: getTranslation("organizations.common.createOrganization"),
          defaultMessage: "Create organization",
        })}
      </Button>
    </>
  );

  return (
    <SheetDialog
      title={formatMessage({
        id: getTranslation("organizations.common.createOrganization"),
        defaultMessage: "Create organization",
      })}
      actionButtons={footer}
      onClose={onClose}
    >
      <Flex direction="column" gap={5}>
        {/* Details */}
        <FormSection>
          <SectionLabel>
            {formatMessage({
              id: getTranslation("organizations.common.details"),
              defaultMessage: "Details",
            })}
          </SectionLabel>
          <Field.Root style={{ width: "100%" }} required>
            <Field.Label>
              {formatMessage({
                id: getTranslation("organizations.common.name"),
                defaultMessage: "Name",
              })}
            </Field.Label>
            <TextInput
              name="name"
              value={name}
              onChange={handleNameChange}
              placeholder={formatMessage({
                id: getTranslation("organizations.create.name.placeholder"),
                defaultMessage: "Acme Corp",
              })}
            />
          </Field.Root>
          <Field.Root
            style={{ width: "100%" }}
            hint={formatMessage({
              id: getTranslation("organizations.common.slugHint"),
              defaultMessage: "Used in URLs",
            })}
            required
          >
            <Field.Label>
              {formatMessage({
                id: getTranslation("organizations.common.slug"),
                defaultMessage: "Slug",
              })}
            </Field.Label>
            <TextInput
              name="slug"
              value={slug}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSlug(e.target.value)
              }
              placeholder={formatMessage({
                id: getTranslation("organizations.create.slug.placeholder"),
                defaultMessage: "acme-corp",
              })}
            />
            <Field.Hint />
          </Field.Root>
          <MediaPickerField
            label={formatMessage({
              id: getTranslation("organizations.common.logo.label"),
              defaultMessage: "Logo URL",
            })}
            name="logo"
            value={logo}
            onChange={setLogo}
            placeholder={formatMessage({
              id: getTranslation("organizations.common.logo.placeholder"),
              defaultMessage: "https://example.com/logo.png",
            })}
            hint={formatMessage({
              id: getTranslation("organizations.common.logo.hint"),
              defaultMessage: "Optional — publicly accessible image URL",
            })}
          />
        </FormSection>

        {/* Owner */}
        <FormSection>
          <SectionLabel>
            {formatMessage({
              id: getTranslation("organizations.create.owner.label"),
              defaultMessage: "Owner",
            })}
          </SectionLabel>
          <UserCombobox
            label={formatMessage({
              id: getTranslation("organizations.create.owner.label"),
              defaultMessage: "Owner",
            })}
            hint={formatMessage({
              id: getTranslation("organizations.create.owner.hint"),
              defaultMessage:
                "The user who will own and manage this organization",
            })}
            value={ownerId}
            onChange={setOwnerId}
            required
          />
        </FormSection>

        {/* Default team (only when teams are enabled) */}
        {teamsEnabled && (
          <FormSection>
            <SectionLabel>
              {formatMessage({
                id: getTranslation("organizations.create.defaultTeam.title"),
                defaultMessage: "Default team",
              })}
            </SectionLabel>
            <Checkbox
              name="skipDefaultTeam"
              checked={skipDefaultTeam}
              onCheckedChange={(checked: boolean) =>
                setSkipDefaultTeam(checked)
              }
            >
              {formatMessage({
                id: getTranslation("organizations.create.defaultTeam.skip"),
                defaultMessage: "Don't create a default team",
              })}
            </Checkbox>
            {!skipDefaultTeam && (
              <Field.Root style={{ width: "100%" }}>
                <Field.Label>
                  {formatMessage({
                    id: getTranslation(
                      "organizations.create.defaultTeam.name.label",
                    ),
                    defaultMessage: "Default team name",
                  })}
                </Field.Label>
                <TextInput
                  name="defaultTeamName"
                  value={defaultTeamName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDefaultTeamName(e.target.value)
                  }
                  placeholder={formatMessage({
                    id: getTranslation(
                      "organizations.create.defaultTeam.name.placeholder",
                    ),
                    defaultMessage: "Leave blank to use the system default",
                  })}
                />
              </Field.Root>
            )}
            {skipDefaultTeam && (
              <Box>
                <Typography variant="pi" textColor="neutral500">
                  {formatMessage({
                    id: getTranslation(
                      "organizations.create.defaultTeam.skipHint",
                    ),
                    defaultMessage:
                      "Members can be added to teams manually after the organization is created.",
                  })}
                </Typography>
              </Box>
            )}
          </FormSection>
        )}
      </Flex>
    </SheetDialog>
  );
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
