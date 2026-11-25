import type { UID } from "@strapi/strapi";
import type { Context } from "koa";

/**
 * Generic CRUD controller for Strapi content types used by the dashboard.
 *
 * These admin routes proxy directly to the Strapi document service and are
 * protected by Strapi's own admin JWT — only authenticated admin users can
 * reach them, which is the same access level as the built-in content manager.
 */

function assertValidUid(ctx: Context, uid: unknown): uid is string {
  if (
    typeof uid !== "string" ||
    (!uid.startsWith("plugin::") &&
      !uid.startsWith("api::") &&
      !uid.startsWith("admin::"))
  ) {
    ctx.status = 400;
    ctx.body = { error: "uid must be a valid Strapi content-type UID" };
    return false;
  }
  return true;
}

type AttributeLike = {
  type?: string;
  target?: string;
  component?: string;
};

function getAttributes(uid: string): Record<string, AttributeLike> | undefined {
  const schema =
    strapi.contentTypes[uid as UID.ContentType] ??
    strapi.components[uid as UID.Component];
  return schema?.attributes as Record<string, AttributeLike> | undefined;
}

/**
 * Relations the list endpoint may populate: top-level relation attributes
 * whose target isn't an `admin::` content type. Every content type has
 * `createdBy`/`updatedBy` relations to `admin::user`, and populating those
 * returns the raw admin user, password hash included.
 */
function getAllowedPopulate(uid: string, populate: unknown): string[] {
  if (typeof populate !== "string") return [];
  const attributes = getAttributes(uid) ?? {};
  return populate
    .split(",")
    .map((s) => s.trim())
    .filter((name) => {
      const attribute = attributes[name];
      return (
        attribute?.type === "relation" &&
        typeof attribute.target === "string" &&
        !attribute.target.startsWith("admin::")
      );
    });
}

/**
 * Whether `filters` reaches into an `admin::` content type through a relation
 * (e.g. `filters[createdBy][password][$startsWith]=...`), which would let a
 * caller probe admin password hashes one character at a time.
 */
function filtersReachAdmin(uid: string, filters: unknown): boolean {
  if (Array.isArray(filters)) {
    return filters.some((item) => filtersReachAdmin(uid, item));
  }
  if (!filters || typeof filters !== "object") return false;

  const attributes = getAttributes(uid) ?? {};
  for (const [key, value] of Object.entries(filters)) {
    if (key === "$and" || key === "$or" || key === "$not") {
      if (filtersReachAdmin(uid, value)) return true;
      continue;
    }
    if (key.startsWith("$")) continue;

    const attribute = attributes[key];
    if (
      attribute?.type === "relation" &&
      typeof attribute.target === "string"
    ) {
      if (attribute.target.startsWith("admin::")) return true;
      if (filtersReachAdmin(attribute.target, value)) return true;
    } else if (
      attribute?.type === "component" &&
      typeof attribute.component === "string"
    ) {
      if (filtersReachAdmin(attribute.component, value)) return true;
    }
  }
  return false;
}

/** Content types the dashboard may delete rows from directly. */
const DELETABLE_UIDS = new Set(["plugin::better-auth.passkey"]);

const dbController = () => ({
  /**
   * List documents.
   *
   * Query params (all optional):
   *   uid            – content-type UID, e.g. plugin::better-auth.session
   *   filters        – Strapi filter object, supports nested qs syntax:
   *                    ?filters[userId][$eq]=1
   *   sort           – sort string or array, e.g. sort[0]=createdAt:desc
   *   pagination[page]     – 1-indexed page number (default 1)
   *   pagination[pageSize] – items per page (default 50)
   *   populate       – comma-separated relation field names; relations to
   *                    `admin::` content types (createdBy/updatedBy) and
   *                    anything that isn't a top-level relation are ignored
   *
   * Response: { results: [...], pagination: { page, pageSize, total, pageCount } }
   */
  async list(ctx: Context) {
    const { uid, filters, pagination, populate } = ctx.query as {
      uid?: string;
      filters?: Record<string, unknown>;
      pagination?: { page?: string; pageSize?: string };
      populate?: string;
    };

    if (!assertValidUid(ctx, uid)) return;

    const page = Math.max(1, parseInt(pagination?.page ?? "1", 10));
    const pageSize = Math.min(
      200,
      Math.max(1, parseInt(pagination?.pageSize ?? "50", 10)),
    );

    if (filtersReachAdmin(uid, filters)) {
      ctx.status = 400;
      ctx.body = { error: "Filtering on admin relations is not allowed" };
      return;
    }

    const allowedPopulate = getAllowedPopulate(uid, populate);
    const populateArg =
      allowedPopulate.length > 0 ? allowedPopulate : undefined;

    // biome-ignore lint/suspicious/noExplicitAny: populate type is complex
    const service = strapi.documents(uid as UID.CollectionType) as any;

    const [results, total] = await Promise.all([
      service.findMany({
        filters: filters ?? {},
        sort: "createdAt:desc",
        limit: pageSize,
        start: (page - 1) * pageSize,
        ...(populateArg ? { populate: populateArg } : {}),
      }),
      service.count({ filters: filters ?? {} }),
    ]);

    ctx.body = {
      results,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Update a single document by its documentId (UUID).
   *
   * Query params:
   *   uid – content-type UID
   *
   * Body: partial field values to update.
   *
   * Response: updated document.
   */
  async update(ctx: Context) {
    const { uid } = ctx.query as { uid?: string };

    if (!assertValidUid(ctx, uid)) return;

    const { documentId } = ctx.params as { documentId: string };

    // biome-ignore lint/suspicious/noExplicitAny: strapi global
    const result = await (strapi as any).documents(uid).update({
      documentId,
      data: ctx.request.body,
    });

    if (!result) {
      ctx.status = 404;
      ctx.body = { error: "Document not found" };
      return;
    }

    ctx.body = result;
  },

  /**
   * Delete a single document owned by a given user.
   *
   * Only content types in `DELETABLE_UIDS` are accepted — today just
   * passkeys, which have no dash() endpoint and whose own delete endpoint
   * needs the user's session. Everything else (sessions, accounts, jwks,
   * verification, ...) must go through Better Auth's flows. The document must
   * belong to `userId`, so a request can only remove a record from the user
   * being viewed.
   *
   * Query params:
   *   uid    – content-type UID (must be in DELETABLE_UIDS)
   *   userId – id of the user who owns the document
   *
   * Response: 204 No Content.
   */
  async delete(ctx: Context) {
    const { uid, userId } = ctx.query as { uid?: string; userId?: string };

    if (!assertValidUid(ctx, uid)) return;
    if (!DELETABLE_UIDS.has(uid)) {
      ctx.status = 400;
      ctx.body = { error: `Deleting ${uid} documents is not allowed` };
      return;
    }
    if (typeof userId !== "string" || userId.length === 0) {
      ctx.status = 400;
      ctx.body = { error: "userId is required" };
      return;
    }

    const { documentId } = ctx.params as { documentId: string };

    // biome-ignore lint/suspicious/noExplicitAny: strapi global
    const service = (strapi as any).documents(uid);
    const existing = await service.findOne({ documentId });
    if (!existing || String(existing.userId) !== userId) {
      ctx.status = 404;
      ctx.body = { error: "Document not found" };
      return;
    }

    await service.delete({ documentId });
    ctx.status = 204;
  },
});

export default dbController;
