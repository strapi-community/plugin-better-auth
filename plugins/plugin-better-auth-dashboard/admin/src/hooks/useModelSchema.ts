import { useFetchClient } from "@strapi/strapi/admin";
import { useIntl } from "react-intl";
import { useQuery } from "react-query";
import { getTranslation } from "../utils/getTranslation";

export interface StrapiAttribute {
  type: string;
  required?: boolean;
  unique?: boolean;
  default?: unknown;
  enum?: string[];
  target?: string;
  relation?: string;
  component?: string;
  repeatable?: boolean;
  pluginOptions?: Record<string, unknown>;
  [key: string]: unknown;
}

export type ModelSchema = Record<string, StrapiAttribute>;

const SYSTEM_FIELDS = new Set([
  "id",
  "documentId",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "createdBy",
  "updatedBy",
  "locale",
  "localizations",
]);

const MODEL_UID: Record<string, string> = {
  user: "plugin::better-auth.user",
  organization: "plugin::better-auth.organization",
};

interface ContentTypeDTO {
  uid: string;
  attributes: Record<string, StrapiAttribute>;
}

export function useModelSchema(model: "user" | "organization") {
  const { get } = useFetchClient();
  const { formatMessage } = useIntl();

  return useQuery<ModelSchema, Error>({
    queryKey: ["ba-model-schema", model],
    queryFn: async () => {
      const { data } = await get<{ data: ContentTypeDTO[] }>(
        "/content-manager/content-types",
      );
      const uid = MODEL_UID[model];
      const contentType = data.data.find((ct) => ct.uid === uid);
      if (!contentType)
        throw new Error(
          formatMessage(
            {
              id: getTranslation("common.errors.contentTypeNotFound"),
              defaultMessage: "Content type {uid} not found",
            },
            { uid },
          ),
        );

      const attributes: ModelSchema = {};
      for (const [name, attr] of Object.entries(contentType.attributes)) {
        if (SYSTEM_FIELDS.has(name)) continue;
        if (
          attr.type === "relation" &&
          typeof attr.target === "string" &&
          (attr.target.startsWith("plugin::users-permissions") ||
            attr.target.startsWith("admin::"))
        )
          continue;
        const baOptions = attr.pluginOptions?.["better-auth"] as
          | { managed?: boolean }
          | undefined;
        if (baOptions?.managed === true) continue;
        attributes[name] = attr;
      }
      return attributes;
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
