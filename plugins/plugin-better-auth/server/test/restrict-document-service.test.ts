import type { Core, Modules } from "@strapi/strapi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAsInternalCall } from "../src/adapter/internal-context";
import restrictDocumentService from "../src/middlewares/restrict-document-service";

// Minimal strapi mock — only what the middleware actually reads.
function makeStrapi(unsafeDocumentService = false) {
  return {
    config: {
      get(key: string, defaultValue: unknown) {
        if (key === "plugin::better-auth.unsafe_document_service") {
          return unsafeDocumentService;
        }
        return defaultValue;
      },
    },
  } as unknown as Core.Strapi;
}

function makeContext(uid: string, action: string) {
  return {
    action,
    contentType: { uid },
  } as unknown as Modules.Documents.Middleware.Context;
}

describe("restrictDocumentService", () => {
  beforeEach(() => {
    vi.stubGlobal("strapi", makeStrapi());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lets non-better-auth content types through untouched", async () => {
    const next = vi.fn().mockResolvedValue("ok");

    const result = await restrictDocumentService(
      makeContext("api::article.article", "create"),
      next,
    );

    expect(result).toBe("ok");
    expect(next).toHaveBeenCalledOnce();
  });

  it.each([
    "findOne",
    "findMany",
    "count",
  ])("lets the %s read action through on a better-auth content type", async (action) => {
    const next = vi.fn().mockResolvedValue("ok");

    const result = await restrictDocumentService(
      makeContext("plugin::better-auth.user", action),
      next,
    );

    expect(result).toBe("ok");
    expect(next).toHaveBeenCalledOnce();
  });

  it.each([
    "create",
    "update",
    "delete",
    "createMany",
    "updateMany",
    "deleteMany",
  ])("blocks the %s write action on a better-auth content type by default", async (action) => {
    const next = vi.fn().mockResolvedValue("ok");

    await expect(
      restrictDocumentService(
        makeContext("plugin::better-auth.user", action),
        next,
      ),
    ).rejects.toThrow(/restricted/i);

    expect(next).not.toHaveBeenCalled();
  });

  it("allows a blocked write action once unsafe_document_service is enabled", async () => {
    vi.stubGlobal("strapi", makeStrapi(true));
    const next = vi.fn().mockResolvedValue("ok");

    const result = await restrictDocumentService(
      makeContext("plugin::better-auth.user", "create"),
      next,
    );

    expect(result).toBe("ok");
    expect(next).toHaveBeenCalledOnce();
  });

  it("allows a blocked write action when issued through runAsInternalCall", async () => {
    const next = vi.fn().mockResolvedValue("ok");

    const result = await runAsInternalCall(() =>
      restrictDocumentService(
        makeContext("plugin::better-auth.session", "delete"),
        next,
      ),
    );

    expect(result).toBe("ok");
    expect(next).toHaveBeenCalledOnce();
  });

  it("does not leak the internal-call marker to writes outside of runAsInternalCall", async () => {
    const next = vi.fn().mockResolvedValue("ok");

    // First call is internal and should pass...
    await runAsInternalCall(() =>
      restrictDocumentService(
        makeContext("plugin::better-auth.user", "create"),
        next,
      ),
    );

    // ...but a subsequent, unrelated call must be evaluated on its own merits.
    await expect(
      restrictDocumentService(
        makeContext("plugin::better-auth.user", "create"),
        next,
      ),
    ).rejects.toThrow(/restricted/i);
  });
});
