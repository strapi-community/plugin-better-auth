import { DateTimePicker, Field } from "@strapi/design-system";

interface TimestampFieldProps {
  label: string;
  name: "createdAt" | "updatedAt";
  value: unknown;
  onChange: (name: string, value: string) => void;
}

const toDate = (value: unknown): Date | null => {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Editable `createdAt` / `updatedAt` timestamp. Emits an ISO string, which the
 * dashboard db route writes straight to the table (the document service would
 * otherwise reset `updatedAt` to "now").
 */
export function TimestampField({
  label,
  name,
  value,
  onChange,
}: TimestampFieldProps) {
  return (
    <Field.Root name={name} style={{ width: "100%" }}>
      <Field.Label>{label}</Field.Label>
      <DateTimePicker
        value={toDate(value)}
        onChange={(date: Date | undefined) => {
          // Timestamps can't be empty; clearing the picker is a no-op.
          if (date) onChange(name, date.toISOString());
        }}
        data-testid={`timestamp-${name}`}
      />
    </Field.Root>
  );
}
