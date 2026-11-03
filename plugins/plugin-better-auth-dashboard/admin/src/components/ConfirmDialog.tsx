import { Button, Dialog } from "@strapi/design-system";
import { WarningCircle } from "@strapi/icons";
import { useIntl } from "react-intl";
import { getTranslation } from "../utils/getTranslation";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { formatMessage } = useIntl();

  return (
    <Dialog.Root
      defaultOpen
      onOpenChange={(open: boolean) => !open && onCancel()}
    >
      <Dialog.Content>
        <Dialog.Header>{title}</Dialog.Header>
        <Dialog.Body
          icon={
            <WarningCircle
              fill={variant === "danger" ? "danger600" : "primary600"}
            />
          }
        >
          {message}
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Cancel>
            <Button fullWidth variant="tertiary" disabled={loading}>
              {formatMessage({
                id: getTranslation("components.confirmDialog.cancel"),
                defaultMessage: "Cancel",
              })}
            </Button>
          </Dialog.Cancel>
          <Button
            fullWidth
            variant={variant}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel ??
              formatMessage({
                id: getTranslation("components.confirmDialog.confirm"),
                defaultMessage: "Confirm",
              })}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
