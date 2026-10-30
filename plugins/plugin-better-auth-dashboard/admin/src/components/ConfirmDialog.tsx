import { Button, Dialog } from "@strapi/design-system";
import { WarningCircle } from "@strapi/icons";

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
  confirmLabel = "Confirm",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
              Cancel
            </Button>
          </Dialog.Cancel>
          <Button
            fullWidth
            variant={variant}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
