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
import { client } from "../../client";
import { FormSection, SectionLabel } from "../../components/FormPrimitives";
import { MediaPickerField } from "../../components/MediaPickerField";
import { SheetDialog } from "../../components/Sheet";

interface Props {
  onClose: () => void;
}

export function CreateUserDialog({ onClose }: Props) {
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
        throw new Error(result.error.message ?? "Create failed");
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-users"] });
      qc.invalidateQueries({ queryKey: ["dash-user-stats"] });
      toggleNotification({
        type: "success",
        message: "User created successfully",
      });
      onClose();
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to create user",
      });
    },
  });

  const footer = (
    <>
      <Button variant="tertiary" onClick={onClose}>
        Cancel
      </Button>
      <Button
        loading={createMutation.isLoading}
        onClick={() => createMutation.mutate()}
        disabled={!name || !email}
        data-testid="create-user-submit"
      >
        Create user
      </Button>
    </>
  );

  return (
    <SheetDialog
      title="Create user"
      actionButtons={footer}
      onClose={onClose}
      data-testid="create-user-drawer"
    >
      <Flex direction="column" gap={5}>
        {/* Personal information */}
        <FormSection>
          <SectionLabel>Personal information</SectionLabel>
          <Field.Root style={{ width: "100%" }} required>
            <Field.Label>Full name</Field.Label>
            <TextInput
              name="name"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
              placeholder="Jane Smith"
              data-testid="new-user-name"
            />
          </Field.Root>
          <Field.Root style={{ width: "100%" }} required>
            <Field.Label>Email address</Field.Label>
            <TextInput
              name="email"
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              placeholder="jane@example.com"
              data-testid="new-user-email"
            />
          </Field.Root>
          <MediaPickerField
            label="Avatar URL"
            name="image"
            value={image}
            onChange={setImage}
            placeholder="https://example.com/avatar.png"
            hint="Optional — publicly accessible image URL"
          />
        </FormSection>

        {/* Password section */}
        <FormSection>
          <SectionLabel>Password</SectionLabel>
          <Checkbox
            name="generatePassword"
            checked={generatePassword}
            onCheckedChange={(checked: boolean) => {
              setGeneratePassword(checked);
              if (checked) setPassword("");
            }}
          >
            Generate a random password
          </Checkbox>
          {!generatePassword && (
            <Field.Root style={{ width: "100%" }}>
              <Field.Label>Password</Field.Label>
              <TextInput
                name="password"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
                }
                placeholder="Leave blank for a passwordless account"
              />
            </Field.Root>
          )}
        </FormSection>

        {/* Email verification */}
        <FormSection>
          <SectionLabel>Email verification</SectionLabel>
          <Checkbox
            name="emailVerified"
            checked={emailVerified}
            onCheckedChange={(checked: boolean) => {
              setEmailVerified(checked);
              if (checked) setSendVerificationEmail(false);
            }}
          >
            Mark email as already verified
          </Checkbox>
          {!emailVerified && (
            <Checkbox
              name="sendVerificationEmail"
              checked={sendVerificationEmail}
              onCheckedChange={(checked: boolean) =>
                setSendVerificationEmail(checked)
              }
            >
              Send a verification email to the user
            </Checkbox>
          )}
          {emailVerified && (
            <Box>
              <Typography variant="pi" textColor="success600">
                The user will be able to sign in immediately without verifying
                their email.
              </Typography>
            </Box>
          )}
        </FormSection>
      </Flex>
    </SheetDialog>
  );
}
