import {
  Checkbox,
  Field,
  Flex,
  JSONInput,
  NumberInput,
  SingleSelect,
  SingleSelectOption,
  Textarea,
  TextInput,
} from "@strapi/design-system";
import type React from "react";
import { useIntl } from "react-intl";
import type { StrapiAttribute } from "../hooks/useModelSchema";
import { getTranslation } from "../utils/getTranslation";
import { FormSection, SectionLabel } from "./FormPrimitives";
import { RelationField } from "./RelationField";

export interface AdditionalFieldDef {
  name: string;
  attribute: StrapiAttribute;
}

interface DynamicFieldProps {
  field: AdditionalFieldDef;
  value: unknown;
  onChange: (name: string, value: unknown) => void;
  readOnly?: boolean;
}

function makeLabel(name: string) {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

const fieldStyle = { width: "100%" };

export function DynamicField({
  field,
  value,
  onChange,
  readOnly = false,
}: DynamicFieldProps) {
  const { name, attribute } = field;
  const { type, required, enum: enumValues } = attribute;
  const label = makeLabel(name);

  if (type === "boolean") {
    return (
      <Field.Root style={fieldStyle}>
        <Field.Label>{label}</Field.Label>
        <Checkbox
          checked={Boolean(value)}
          onCheckedChange={(checked: boolean) => onChange(name, checked)}
          disabled={readOnly}
        >
          {label}
        </Checkbox>
      </Field.Root>
    );
  }

  if (type === "enumeration" && Array.isArray(enumValues)) {
    return (
      <Field.Root style={fieldStyle}>
        <Field.Label>{label}</Field.Label>
        <SingleSelect
          value={value != null ? String(value) : ""}
          onChange={(v: string | number) => onChange(name, String(v))}
          disabled={readOnly}
          required={required}
          placeholder="—"
        >
          {enumValues.map((opt) => (
            <SingleSelectOption key={opt} value={opt}>
              {opt}
            </SingleSelectOption>
          ))}
        </SingleSelect>
      </Field.Root>
    );
  }

  if (
    type === "integer" ||
    type === "biginteger" ||
    type === "float" ||
    type === "decimal"
  ) {
    return (
      <Field.Root style={fieldStyle}>
        <Field.Label>{label}</Field.Label>
        <NumberInput
          value={value != null ? Number(value) : undefined}
          onValueChange={(v: number | undefined) => onChange(name, v)}
          disabled={readOnly}
          required={required}
        />
      </Field.Root>
    );
  }

  if (type === "json") {
    const jsonStr =
      value == null
        ? ""
        : typeof value === "string"
          ? value
          : JSON.stringify(value, null, 2);
    return (
      <Field.Root style={fieldStyle}>
        <Field.Label>{label}</Field.Label>
        <JSONInput
          value={jsonStr}
          onChange={(v: string) => {
            try {
              onChange(name, JSON.parse(v));
            } catch {
              onChange(name, v);
            }
          }}
          disabled={readOnly}
        />
      </Field.Root>
    );
  }

  if (type === "date") {
    const dateStr =
      value instanceof Date
        ? value.toISOString().slice(0, 10)
        : typeof value === "string"
          ? value.slice(0, 10)
          : "";
    return (
      <Field.Root style={fieldStyle}>
        <Field.Label>{label}</Field.Label>
        <TextInput
          type="date"
          value={dateStr}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange(name, e.target.value)
          }
          disabled={readOnly}
          required={required}
        />
      </Field.Root>
    );
  }

  if (type === "datetime" || type === "timestamp") {
    const dtStr =
      value instanceof Date
        ? value.toISOString().slice(0, 16)
        : typeof value === "string"
          ? value.slice(0, 16)
          : "";
    return (
      <Field.Root style={fieldStyle}>
        <Field.Label>{label}</Field.Label>
        <TextInput
          type="datetime-local"
          value={dtStr}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange(name, e.target.value)
          }
          disabled={readOnly}
          required={required}
        />
      </Field.Root>
    );
  }

  if (type === "text" || type === "richtext") {
    return (
      <Field.Root style={fieldStyle}>
        <Field.Label>{label}</Field.Label>
        <Textarea
          value={value != null ? String(value) : ""}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            onChange(name, e.target.value)
          }
          disabled={readOnly}
        />
      </Field.Root>
    );
  }

  if (type === "relation") {
    return (
      <RelationField
        name={name}
        label={label}
        attribute={attribute}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
      />
    );
  }

  // Default: string, email, uid, password, time, etc.
  const inputType =
    type === "email"
      ? "email"
      : type === "password"
        ? "password"
        : type === "time"
          ? "time"
          : "text";

  return (
    <Field.Root style={fieldStyle}>
      <Field.Label>{label}</Field.Label>
      <TextInput
        type={inputType}
        value={value != null ? String(value) : ""}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(name, e.target.value)
        }
        disabled={readOnly}
        required={required}
      />
    </Field.Root>
  );
}

// Types that should be skipped entirely in the dashboard
const SKIP_TYPES = new Set(["media", "dynamiczone", "blocks", "component"]);

interface CustomFieldsSectionProps {
  fields: AdditionalFieldDef[];
  data: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
}

export function CustomFieldsSection({
  fields,
  data,
  onChange,
}: CustomFieldsSectionProps) {
  const { formatMessage } = useIntl();
  const renderable = fields.filter((f) => !SKIP_TYPES.has(f.attribute.type));
  if (renderable.length === 0) return null;

  return (
    <FormSection>
      <SectionLabel>
        {formatMessage({
          id: getTranslation("components.dynamicField.customFields"),
          defaultMessage: "Custom fields",
        })}
      </SectionLabel>
      <Flex direction="column" gap={4} alignItems="stretch">
        {renderable.map((field) => (
          <DynamicField
            key={field.name}
            field={field}
            value={data[field.name]}
            onChange={onChange}
          />
        ))}
      </Flex>
    </FormSection>
  );
}
