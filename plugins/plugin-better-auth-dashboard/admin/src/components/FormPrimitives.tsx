import {
  Badge,
  Box,
  Flex,
  type FlexProps,
  Grid,
  Typography,
  type TypographyProps,
} from "@strapi/design-system";
import { Clock } from "@strapi/icons";
import type { ReactNode } from "react";
import styled from "styled-components";

/** Subtle background card for grouping related form fields */
export const FormSection = (props: FlexProps) => (
  <Flex
    direction="column"
    alignItems="stretch"
    gap={4}
    width="100%"
    background="neutral100"
    hasRadius
    paddingTop={4}
    paddingBottom={4}
    paddingLeft={5}
    paddingRight={5}
    {...props}
  />
);

/**
 * Two-column edit layout: main form on the left, sidebar details on the right.
 * Used inside sheet tabs where fields and metadata sit side by side.
 */
export const EditLayout = ({ children }: { children: ReactNode }) => (
  <Grid.Root
    gap={6}
    paddingTop={6}
    style={{
      gridTemplateColumns: "minmax(0, 1fr) 25.6rem",
      alignItems: "start",
    }}
  >
    {children}
  </Grid.Root>
);

/** Right-hand sidebar inside an EditLayout */
export const EditSidebar = ({ children }: { children: ReactNode }) => (
  <Flex
    direction="column"
    alignItems="stretch"
    gap={5}
    position="sticky"
    top={0}
  >
    {children}
  </Flex>
);

/** Small uppercase label for a form section */
export const SectionLabel = (props: TypographyProps<"p">) => (
  <Typography variant="sigma" textColor="neutral600" tag="p" {...props} />
);

export const MetaItem = (props: FlexProps) => (
  <Flex direction="column" alignItems="flex-start" gap={1} {...props} />
);

export const MetaKey = (props: TypographyProps) => (
  <Typography variant="sigma" textColor="neutral600" {...props} />
);

export const MetaVal = (props: TypographyProps) => (
  <Typography variant="omega" textColor="neutral800" {...props} />
);

/** Monospaced text, e.g. IDs, IP addresses, codes */
export const Code = styled(Typography)`
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  word-break: break-all;
`;

/** Monospaced ID chip */
export const MonoChip = ({ children }: { children: ReactNode }) => (
  <Box
    background="primary100"
    borderColor="primary200"
    borderStyle="solid"
    borderWidth="1px"
    hasRadius
    paddingLeft={2}
    paddingRight={2}
    paddingTop={1}
    paddingBottom={1}
  >
    <Code variant="pi" textColor="primary600">
      {children}
    </Code>
  </Box>
);

/** Inline badge for showing a provider name */
export const ProviderBadge = ({ children }: { children: ReactNode }) => (
  <Badge variant="primary">{children}</Badge>
);

/** Warning/danger info card */
export const WarnCard = ({ children }: { children: ReactNode }) => (
  <Flex
    direction="column"
    alignItems="flex-start"
    gap={1}
    background="danger100"
    borderColor="danger200"
    borderStyle="solid"
    borderWidth="1px"
    hasRadius
    padding={4}
  >
    {children}
  </Flex>
);

/** Preview pill — e.g. for expiry dates */
export const PreviewPill = ({ children }: { children: ReactNode }) => (
  <Flex
    gap={2}
    background="warning100"
    borderColor="warning200"
    borderStyle="solid"
    borderWidth="1px"
    hasRadius
    paddingTop={2}
    paddingBottom={2}
    paddingLeft={3}
    paddingRight={3}
    width="fit-content"
  >
    <Clock fill="warning700" width="1.2rem" height="1.2rem" />
    <Typography variant="pi" fontWeight="semiBold" textColor="warning700">
      {children}
    </Typography>
  </Flex>
);

/** Linked account row */
export const AccountRow = (props: FlexProps) => (
  <Flex
    width="100%"
    justifyContent="space-between"
    gap={3}
    background="neutral0"
    borderColor="neutral200"
    borderStyle="solid"
    borderWidth="1px"
    hasRadius
    paddingTop={3}
    paddingBottom={3}
    paddingLeft={4}
    paddingRight={4}
    {...props}
  />
);

/** Danger-tinted row for destructive actions */
export const DangerRow = (props: FlexProps) => (
  <AccountRow background="danger100" borderColor="danger200" {...props} />
);

/** Role badge for organization memberships */
export const RoleBadge = ({
  memberRole,
  children,
}: {
  memberRole?: string;
  children: ReactNode;
}) => (
  <Badge
    size="S"
    variant={
      memberRole === "owner"
        ? "primary"
        : memberRole === "admin"
          ? "success"
          : "neutral"
    }
  >
    {children}
  </Badge>
);
