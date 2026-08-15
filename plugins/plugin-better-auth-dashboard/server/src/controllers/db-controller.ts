import type { UID } from "@strapi/strapi";
import { runAsInternalCall } from "@strapi-community/plugin-better-auth";
import type { Context } from "koa";

/**
 * Generic CRUD controller for Strapi content types used by the dashboard.
 *
 * These admin routes proxy directly to the Strapi document service and are
 * protected by Strapi's own admin JWT — only authenticated admin users can
 * reach them, which is the same access level as the built-in content manager.
 *
 * Writes are wrapped in `runAsInternalCall` so they're exempt from
 * `plugin-better-auth`'s document service write restriction (see
 * https://github.com/strapi-community/plugin-better-auth/issues/18) — this
 * controller is first-party admin tooling, not the arbitrary application code
 * that restriction is meant to guard against.
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
      strapi
        .documents(uid as UID.CollectionType)
        .count({ filters: filters ?? {} }),
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

    const result = await runAsInternalCall(() =>
      // biome-ignore lint/suspicious/noExplicitAny: strapi global
      (strapi as any)
        .documents(uid)
        .update({
          documentId,
          data: ctx.request.body,
        }),
    );

    if (!result) {
      ctx.status = 404;
      ctx.body = { error: "Document not found" };
      return;
    }

    ctx.body = result;
  },
});

export default dbController;
