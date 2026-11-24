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

type TimestampField = "createdAt" | "updatedAt";

function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Write `createdAt`/`updatedAt` straight to the table. The document service
 * can't do this: Strapi's timestamps lifecycle subscriber overwrites
 * `updatedAt` with "now" on every update, so the raw query also runs after
 * any regular update to make the submitted value stick.
 */
async function writeTimestamps(
  uid: string,
  documentId: string,
  timestamps: Partial<Record<TimestampField, Date>>,
) {
  const meta = strapi.db.metadata.get(uid as UID.Schema);
  const columnName = (attribute: string) =>
    (meta.attributes[attribute] as { columnName?: string } | undefined)
      ?.columnName ?? attribute;

  const values: Record<string, Date> = {};
  for (const [field, date] of Object.entries(timestamps)) {
    values[columnName(field)] = date;
  }

  await strapi.db
    .getConnection(meta.tableName)
    .where(columnName("documentId"), documentId)
    .update(values);
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
   *   populate       – "*" for all relations, or comma-separated field names
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

    const populateArg = populate
      ? populate === "*"
        ? "*"
        : populate
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
      : undefined;

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

    const { createdAt, updatedAt, ...data } = (ctx.request.body ??
      {}) as Record<string, unknown>;

    const timestamps: Partial<Record<TimestampField, Date>> = {};
    for (const [field, value] of [
      ["createdAt", createdAt],
      ["updatedAt", updatedAt],
    ] as const) {
      if (value === undefined) continue;
      const date = parseTimestamp(value);
      if (!date) {
        ctx.status = 400;
        ctx.body = { error: `${field} must be a valid date` };
        return;
      }
      timestamps[field] = date;
    }

    // biome-ignore lint/suspicious/noExplicitAny: strapi global
    const service = (strapi as any).documents(uid);

    let result = await (Object.keys(data).length > 0
      ? service.update({ documentId, data })
      : service.findOne({ documentId }));

    if (!result) {
      ctx.status = 404;
      ctx.body = { error: "Document not found" };
      return;
    }

    if (Object.keys(timestamps).length > 0) {
      await writeTimestamps(uid, documentId, timestamps);
      result = await service.findOne({ documentId });
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
