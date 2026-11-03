import { Modal } from "@strapi/design-system";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import styled, { keyframes } from "styled-components";
import { getTranslation } from "../utils/getTranslation";

// Side-sheet built on the design-system Modal (Radix Dialog), modelled after
// the `SheetDialog` from strapi-design-extended.

const slideIn = keyframes`
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
`;

const slideOut = keyframes`
  from { transform: translateX(0); opacity: 1; }
  to   { transform: translateX(100%); opacity: 0; }
`;

const Content = styled(Modal.Content)<{ $width: string }>`
  && {
    top: 0;
    right: 0;
    bottom: 0;
    left: auto;
    transform: none;
    width: min(${(p) => p.$width}, 95vw);
    max-width: none;
    height: 100%;
    max-height: none;
    border-radius: 0;
    box-shadow: ${({ theme }) => theme.shadows.popupShadow};

    @media (prefers-reduced-motion: no-preference) {
      &[data-state='open'] {
        animation: ${slideIn} ${({ theme }) => theme.motion.timings["200"]}
          ${({ theme }) => theme.motion.easings.authenticMotion};
      }
      &[data-state='closed'] {
        animation: ${slideOut} ${({ theme }) => theme.motion.timings["120"]}
          ${({ theme }) => theme.motion.easings.easeOutQuad};
      }
    }
  }
`;

const Body = styled(Modal.Body)`
  flex: 1 1 auto;
  min-height: 0;
`;

const Footer = styled(Modal.Footer)`
  flex: 0 0 auto;
`;

interface SheetDialogProps {
  title: ReactNode;
  children: ReactNode;
  actionButtons?: ReactNode;
  onClose: () => void;
  width?: string;
  "data-testid"?: string;
}

export function SheetDialog({
  title,
  children,
  actionButtons,
  onClose,
  width = "760px",
  "data-testid": testId,
}: SheetDialogProps) {
  const { formatMessage } = useIntl();

  return (
    <Modal.Root
      defaultOpen
      onOpenChange={(open: boolean) => !open && onClose()}
    >
      <Content $width={width} data-testid={testId}>
        <Modal.Header
          closeLabel={formatMessage({
            id: getTranslation("components.sheet.closeLabel"),
            defaultMessage: "Close panel",
          })}
        >
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Body>{children}</Body>
        {actionButtons && <Footer>{actionButtons}</Footer>}
      </Content>
    </Modal.Root>
  );
}
