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
import { client } from "../../client";
import { FormSection, SectionLabel } from "../../components/FormPrimitives";
import { MediaPickerField } from "../../components/MediaPickerField";
import { SheetDialog } from "../../components/Sheet";
import { getTranslation } from "../../utils/getTranslation";

interface Props {
  onClose: () => void;
}

export function CreateUserDialog({ onClose }: Props) {
  const { formatMessage } = useIntl();
  const qc = useQueryClient();
  const { toggleNotification } = useNotification();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState("");
  const [password, setPassword] = useState("");
  const [generatePassword, setGeneratePassword] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendVerificationEmail, setSendVerificationEmail] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await client.dash.createUser({
        name,
        email,
        ...(image ? { image } : {}),
        ...(generatePassword
          ? { generatePassword: true }
          : password
            ? { password }
            : {}),
        emailVerified,
        sendVerificationEmail,
      });
      if (result.error)
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("users.create.errors.createFailed"),
              defaultMessage: "Create failed",
            }),
        );
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-users"] });
      qc.invalidateQueries({ queryKey: ["dash-user-stats"] });
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTranslation("users.create.notifications.success"),
          defaultMessage: "User created successfully",
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
            id: getTranslation("users.create.notifications.error"),
            defaultMessage: "Failed to create user",
          }),
      });
    },
  });

  const footer = (
    <>
      <Button variant="tertiary" onClick={onClose}>
        {formatMessage({
          id: getTranslation("users.create.cancel"),
          defaultMessage: "Cancel",
        })}
      </Button>
      <Button
        loading={createMutation.isLoading}
        onClick={() => createMutation.mutate()}
        disabled={!name || !email}
        data-testid="create-user-submit"
      >
        {formatMessage({
          id: getTranslation("users.create.submit"),
          defaultMessage: "Create user",
        })}
      </Button>
    </>
  );

  return (
    <SheetDialog
      title={formatMessage({
        id: getTranslation("users.create.title"),
        defaultMessage: "Create user",
      })}
      actionButtons={footer}
      onClose={onClose}
      data-testid="create-user-drawer"
    >
      <Flex direction="column" gap={5}>
        {/* Personal information */}
        <FormSection>
          <SectionLabel>
            {formatMessage({
              id: getTranslation("users.create.sections.personal"),
              defaultMessage: "Personal information",
            })}
          </SectionLabel>
          <Field.Root style={{ width: "100%" }} required>
            <Field.Label>
              {formatMessage({
                id: getTranslation("users.create.fields.name.label"),
                defaultMessage: "Full name",
              })}
            </Field.Label>
            <TextInput
              name="name"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
              placeholder={formatMessage({
                id: getTranslation("users.create.fields.name.placeholder"),
                defaultMessage: "Jane Smith",
              })}
              data-testid="new-user-name"
            />
          </Field.Root>
          <Field.Root style={{ width: "100%" }} required>
            <Field.Label>
              {formatMessage({
                id: getTranslation("users.create.fields.email.label"),
                defaultMessage: "Email address",
              })}
            </Field.Label>
            <TextInput
              name="email"
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              placeholder={formatMessage({
                id: getTranslation("users.create.fields.email.placeholder"),
                defaultMessage: "jane@example.com",
              })}
              data-testid="new-user-email"
            />
          </Field.Root>
          <MediaPickerField
            label={formatMessage({
              id: getTranslation("users.create.fields.image.label"),
              defaultMessage: "Avatar URL",
            })}
            name="image"
            value={image}
            onChange={setImage}
            placeholder={formatMessage({
              id: getTranslation("users.create.fields.image.placeholder"),
              defaultMessage: "https://example.com/avatar.png",
            })}
            hint={formatMessage({
              id: getTranslation("users.create.fields.image.hint"),
              defaultMessage: "Optional — publicly accessible image URL",
            })}
          />
        </FormSection>

        {/* Password section */}
        <FormSection>
          <SectionLabel>
            {formatMessage({
              id: getTranslation("users.create.sections.password"),
              defaultMessage: "Password",
            })}
          </SectionLabel>
          <Checkbox
            name="generatePassword"
            checked={generatePassword}
            onCheckedChange={(checked: boolean) => {
              setGeneratePassword(checked);
              if (checked) setPassword("");
            }}
          >
            {formatMessage({
              id: getTranslation("users.create.fields.generatePassword"),
              defaultMessage: "Generate a random password",
            })}
          </Checkbox>
          {!generatePassword && (
            <Field.Root style={{ width: "100%" }}>
              <Field.Label>
                {formatMessage({
                  id: getTranslation("users.create.fields.password.label"),
                  defaultMessage: "Password",
                })}
              </Field.Label>
              <TextInput
                name="password"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
                }
                placeholder={formatMessage({
                  id: getTranslation(
                    "users.create.fields.password.placeholder",
                  ),
                  defaultMessage: "Leave blank for a passwordless account",
                })}
              />
            </Field.Root>
          )}
        </FormSection>

        {/* Email verification */}
        <FormSection>
          <SectionLabel>
            {formatMessage({
              id: getTranslation("users.create.sections.emailVerification"),
              defaultMessage: "Email verification",
            })}
          </SectionLabel>
          <Checkbox
            name="emailVerified"
            checked={emailVerified}
            onCheckedChange={(checked: boolean) => {
              setEmailVerified(checked);
              if (checked) setSendVerificationEmail(false);
            }}
          >
            {formatMessage({
              id: getTranslation("users.create.fields.emailVerified"),
              defaultMessage: "Mark email as already verified",
            })}
          </Checkbox>
          {!emailVerified && (
            <Checkbox
              name="sendVerificationEmail"
              checked={sendVerificationEmail}
              onCheckedChange={(checked: boolean) =>
                setSendVerificationEmail(checked)
              }
            >
              {formatMessage({
                id: getTranslation("users.create.fields.sendVerificationEmail"),
                defaultMessage: "Send a verification email to the user",
              })}
            </Checkbox>
          )}
          {emailVerified && (
            <Box>
              <Typography variant="pi" textColor="success600">
                {formatMessage({
                  id: getTranslation("users.create.fields.emailVerifiedHint"),
                  defaultMessage:
                    "The user will be able to sign in immediately without verifying their email.",
                })}
              </Typography>
            </Box>
          )}
        </FormSection>
      </Flex>
    </SheetDialog>
  );
}
