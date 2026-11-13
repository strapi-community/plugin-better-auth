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

/** Wrap a JSON-serializable payload in the MCP tool-result envelope. */
export function toolResult(payload: unknown): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

/** Wrap an error message in an MCP error result. */
export function toolError(message: string): McpToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Best-effort message from a Better Auth `APIError` (or any thrown value). */
export function dashErrorMessage(e: unknown): string {
  if (e && typeof e === "object") {
    const anyE = e as { message?: unknown; body?: { message?: unknown } };
    if (anyE.body?.message) return String(anyE.body.message);
    if (anyE.message) return String(anyE.message);
  }
  return String(e);
}

/** True when a thrown Better Auth error represents a 404 / not-found. */
export function isNotFoundError(e: unknown): boolean {
  const anyE = e as { statusCode?: number; status?: unknown };
  return anyE?.statusCode === 404 || anyE?.status === "NOT_FOUND";
}

/** Zod shape of a Better Auth user as returned by the dash() endpoints. */
export const dashUserOutput = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  emailVerified: z.boolean().nullable().optional(),
  image: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  banned: z.boolean().nullable().optional(),
  banReason: z.string().nullable().optional(),
  banExpires: z.union([z.string(), z.number()]).nullable().optional(),
  createdAt: z.union([z.string(), z.number()]).nullable().optional(),
  updatedAt: z.union([z.string(), z.number()]).nullable().optional(),
});

export type DashUserOut = z.infer<typeof dashUserOutput>;

/** Project a raw dash() user object onto the public {@link dashUserOutput} shape. */
export function mapDashUser(u: Record<string, unknown>): DashUserOut {
  return {
    id: u.id as string | number,
    name: (u.name as string | null) ?? null,
    email: (u.email as string | null) ?? null,
    emailVerified: (u.emailVerified as boolean | null) ?? null,
    image: (u.image as string | null) ?? null,
    role: (u.role as string | null) ?? null,
    banned: (u.banned as boolean | null) ?? null,
    banReason: (u.banReason as string | null) ?? null,
    banExpires: (u.banExpires as string | number | null) ?? null,
    createdAt: (u.createdAt as string | number | null) ?? null,
    updatedAt: (u.updatedAt as string | number | null) ?? null,
  };
}
