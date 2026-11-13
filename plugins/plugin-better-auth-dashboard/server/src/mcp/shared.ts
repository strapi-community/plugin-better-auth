import type { Core } from "@strapi/types";
import { z } from "@strapi/utils";

/**
 * Minimal local typings for Strapi's native MCP service (`strapi.ai.mcp`).
 *
 * This plugin is type-checked against `@strapi/types@5.45`, which predates the
 * `ai`/`mcp` namespace (added in 5.47). Depending on the richer types from
 * `@strapi/strapi` would both fail to resolve here and pull a second, full
 * Strapi type graph into the program (a large tsc memory/time regression). We
 * therefore describe only the slice of the API we use; the runtime (Strapi
 * >= 5.47) provides the real, fully-featured service.
 */
export type McpToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: unknown;
  isError?: boolean;
};

type McpToolDefinition = {
  name: string;
  title: string;
  description: string;
  auth: { policies: { action: string; subject?: string }[] };
  resolveInputSchema?: () => z.ZodType;
  resolveOutputSchema: () => z.ZodType;
  createHandler: (
    strapi: Core.Strapi,
    context: unknown,
    // biome-ignore lint/suspicious/noExplicitAny: args are validated at runtime by resolveInputSchema
  ) => (params: { args: any }) => Promise<McpToolResult>;
};

export type McpRegistrar = { registerTool: (tool: McpToolDefinition) => void };

/** Resolve `strapi.ai.mcp` if this Strapi version exposes it (>= 5.47). */
export function getMcp(strapi: Core.Strapi): McpRegistrar | undefined {
  // biome-ignore lint/suspicious/noExplicitAny: ai.mcp is absent from the pinned @strapi/types
  return (strapi as any).ai?.mcp;
}

/**
 * Loose document-service accessor. The Better Auth content types are generated
 * into the host app, so their UIDs are not in this plugin's compile-time
 * registry — mirror the approach used by `db-controller.ts` and type loosely.
 */
// biome-ignore lint/suspicious/noExplicitAny: generated content-type uid is not in the plugin's type registry
export function docs(strapi: Core.Strapi, uid: string): any {
  // biome-ignore lint/suspicious/noExplicitAny: see above
  return (strapi.documents as any)(uid);
}

/** Query-engine accessor, used for efficient `count` aggregations (analytics). */
// biome-ignore lint/suspicious/noExplicitAny: generated content-type uid is not in the plugin's type registry
export function query(strapi: Core.Strapi, uid: string): any {
  // biome-ignore lint/suspicious/noExplicitAny: see above
  return (strapi.db.query as any)(uid);
}

/** True when the generated `user` content type declares the given attribute. */
export function userHasAttribute(
  strapi: Core.Strapi,
  uid: string,
  attribute: string,
): boolean {
  const map = strapi.contentTypes as unknown as Record<
    string,
    { attributes?: Record<string, unknown> }
  >;
  return Boolean(map[uid]?.attributes && attribute in map[uid].attributes);
}

/** A user row returned by the MCP tools (all fields optional / nullable). */
export type UserOut = {
  documentId: string;
  id?: number;
  name?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

/** Zod shape of a user returned by the MCP tools. */
export const userOutput = z.object({
  documentId: z.string(),
  id: z.number().optional(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  emailVerified: z.boolean().nullable().optional(),
  role: z.string().nullable().optional(),
  banned: z.boolean().nullable().optional(),
  banReason: z.string().nullable().optional(),
  banExpires: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

/** Project a raw user document onto the public {@link UserOut} shape. */
export function mapUser(u: Record<string, unknown>): UserOut {
  return {
    documentId: u.documentId as string,
    id: u.id as number | undefined,
    name: (u.name as string | null) ?? null,
    email: (u.email as string | null) ?? null,
    emailVerified: (u.emailVerified as boolean | null) ?? null,
    role: (u.role as string | null) ?? null,
    banned: (u.banned as boolean | null) ?? null,
    banReason: (u.banReason as string | null) ?? null,
    banExpires: (u.banExpires as string | null) ?? null,
    createdAt: (u.createdAt as string | null) ?? null,
    updatedAt: (u.updatedAt as string | null) ?? null,
  };
}

/** Wrap a JSON-serializable payload in the MCP tool-result envelope. */
export function toolResult(payload: unknown): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}
