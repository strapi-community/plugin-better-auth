import { Box, Button, Field, Flex, TextInput } from "@strapi/design-system";
import { Images } from "@strapi/icons";
import type React from "react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { getTranslation } from "../utils/getTranslation";
import {
  getMediaLibraryComponent,
  type StrapiMediaFile,
} from "../utils/strapiApp";

interface Props {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
  placeholder?: string;
  name?: string;
  required?: boolean;
}

export function MediaPickerField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  name,
  required,
}: Props) {
  const { formatMessage } = useIntl();
  const [showMedia, setShowMedia] = useState(false);
  const MediaLibraryDialog = getMediaLibraryComponent();

  const handleSelect = (assets: StrapiMediaFile[]) => {
    const asset = assets[0];
    if (!asset) return;
    const url =
      asset.formats?.small?.url ?? asset.formats?.thumbnail?.url ?? asset.url;
    onChange(url);
    setShowMedia(false);
  };

  return (
    <>
      <Field.Root style={{ width: "100%" }} hint={hint} required={required}>
        <Field.Label>{label}</Field.Label>
        <Flex gap={2} alignItems="center">
          <Box flex={1} minWidth={0}>
            <TextInput
              name={name}
              type="url"
              value={value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onChange(e.target.value)
              }
              placeholder={placeholder}
            />
          </Box>
          {MediaLibraryDialog && (
            <Button
              variant="secondary"
              size="S"
              startIcon={<Images />}
              onClick={() => setShowMedia(true)}
              style={{ flexShrink: 0 }}
            >
              {formatMessage({
                id: getTranslation("components.mediaPickerField.browse"),
                defaultMessage: "Browse",
              })}
            </Button>
          )}
        </Flex>
        {hint && <Field.Hint />}
      </Field.Root>

      {showMedia && MediaLibraryDialog && (
        <MediaLibraryDialog
          allowedTypes={["images"]}
          multiple={false}
          onClose={() => setShowMedia(false)}
          onSelectAssets={handleSelect}
        />
      )}
    </>
  );
}
