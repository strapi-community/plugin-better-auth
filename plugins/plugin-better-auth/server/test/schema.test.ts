import type { Core } from "@strapi/strapi";
import type { BetterAuthDBSchema } from "better-auth/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  transformSchema,
  transformTable,
} from "../src/adapter/transformers/schema/transformer";
import { generateNames } from "../src/adapter/transformers/schema/utils";

// Minimal strapi mock — only what the schema utilities actually read.
function makeStrapi(
  prefix = "ba_",
  contentTypes: Record<string, unknown> = {},
) {
  return {
    config: {
      get(key: string, defaultValue: unknown) {
        if (key === "plugin::better-auth.table_prefix") return prefix;
        return defaultValue;
      },
    },
    contentTypes,
  } as unknown as Core.Strapi;
}

// Minimal BA table with one required text field.
function makeTable(overrides: Partial<BetterAuthDBSchema[string]> = {}) {
  return {
    modelName: undefined,
    fields: {
      name: { type: "string" as const, required: true },
    },
    disableMigrations: false,
    ...overrides,
  } satisfies BetterAuthDBSchema[string];
}

// ---------------------------------------------------------------------------
// generateNames
// ---------------------------------------------------------------------------

describe("generateNames — table prefix", () => {
  beforeEach(() => {
    vi.stubGlobal("strapi", makeStrapi("ba_"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies the default ba_ prefix to collectionName", () => {
    const names = generateNames("user", "better-auth");
    expect(names.collectionName).toBe("ba_user");
  });

  it("applies a custom prefix to collectionName", () => {
    vi.stubGlobal("strapi", makeStrapi("better_auth_"));
    const names = generateNames("user", "better-auth");
    expect(names.collectionName).toBe("better_auth_user");
  });

  it("uid always uses modelKey, never tableName", () => {
    vi.stubGlobal("strapi", makeStrapi("ba_"));
    const names = generateNames("user", "better-auth", "my_users");
    expect(names.uid).toBe("plugin::better-auth.user");
  });

  it("collectionName uses tableName when provided", () => {
    vi.stubGlobal("strapi", makeStrapi("ba_"));
    const names = generateNames("user", "better-auth", "my_users");
    expect(names.collectionName).toBe("ba_my_users");
  });

  it("collectionName uses modelKey when tableName is omitted", () => {
    vi.stubGlobal("strapi", makeStrapi("ba_"));
    const names = generateNames("session", "better-auth");
    expect(names.collectionName).toBe("ba_session");
  });
});

// ---------------------------------------------------------------------------
// transformTable
// ---------------------------------------------------------------------------

describe("transformTable — collectionName", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets collectionName with default prefix for a new content type", () => {
    const strapi = makeStrapi("ba_");
    vi.stubGlobal("strapi", strapi);

    const result = transformTable(strapi, "user", makeTable());
    expect(result.contentType.collectionName).toBe("ba_user");
    expect(result.contentType.action).toBe("create");
  });

  it("sets collectionName with custom prefix for a new content type", () => {
    const strapi = makeStrapi("better_auth_");
    vi.stubGlobal("strapi", strapi);

    const result = transformTable(strapi, "user", makeTable());
    expect(result.contentType.collectionName).toBe("better_auth_user");
  });

  it("produces a collectionName with the new prefix when prefix changes", () => {
    const uid = "plugin::better-auth.user";
    const strapi = makeStrapi("better_auth_", {
      [uid]: {
        collectionName: "ba_user",
        attributes: {},
        pluginOptions: {},
      },
    });
    vi.stubGlobal("strapi", strapi);

    const result = transformTable(strapi, "user", makeTable());
    expect(result.contentType.collectionName).toBe("better_auth_user");
  });

  it("produces empty changeDetails when nothing has changed", () => {
    const uid = "plugin::better-auth.user";
    const strapi = makeStrapi("ba_", {
      [uid]: {
        collectionName: "ba_user",
        attributes: {
          name: {
            type: "string",
            required: true,
            pluginOptions: { "better-auth": { managed: true } },
          },
        },
        pluginOptions: {},
      },
    });
    vi.stubGlobal("strapi", strapi);

    const result = transformTable(strapi, "user", makeTable());
    expect(result.changeDetails).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// transformSchema — always includes all content types
// ---------------------------------------------------------------------------

describe("transformSchema — always includes all tables", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("includes all tables in the output with the correct collectionName", () => {
    const uid = "plugin::better-auth.user";
    const strapi = makeStrapi("better_auth_", {
      [uid]: {
        collectionName: "ba_user",
        attributes: {},
        pluginOptions: {},
        info: {
          singularName: "user",
          pluralName: "users",
          displayName: "Users",
        },
      },
    });
    vi.stubGlobal("strapi", strapi);

    const tables: BetterAuthDBSchema = { user: makeTable() };
    const result = transformSchema(strapi, tables);

    expect(result.schema.contentTypes).toHaveLength(1);
    expect(result.schema.contentTypes[0].collectionName).toBe(
      "better_auth_user",
    );
  });

  it("includes all tables even when nothing has changed", () => {
    const uid = "plugin::better-auth.user";
    const strapi = makeStrapi("ba_", {
      [uid]: {
        collectionName: "ba_user",
        attributes: {},
        pluginOptions: {},
        info: {
          singularName: "user",
          pluralName: "users",
          displayName: "Users",
        },
      },
    });
    vi.stubGlobal("strapi", strapi);

    const tables: BetterAuthDBSchema = { user: makeTable() };
    const result = transformSchema(strapi, tables);

    expect(result.schema.contentTypes).toHaveLength(1);
  });
});
