/**
 * Which dashboard permission each admin route needs.
 *
 * The rule is: an admin can call an endpoint if and only if the admin panel lets
 * them do the thing that calls it. So every entry below mirrors a gate in the
 * admin UI:
 *
 *  - Overview page                → `overview.read`
 *  - Users / Organizations list   → `user.read` / `organization.read`
 *  - "Create" dialogs             → `*.create`
 *  - Delete (single + bulk)       → `*.delete`
 *  - Detail drawers (and every
 *    action inside them)          → `*.update`
 *
 * Anything not listed here is denied. That includes `dash()` endpoints the
 * dashboard UI never calls (e.g. `execute-adapter`, `impersonate-user`,
 * `export-users`), so the admin route can never do more than the UI can.
 */
import { PLUGIN_ID } from "./utils";

export type DashAction =
  | "overview.read"
  | "user.create"
  | "user.read"
  | "user.update"
  | "user.delete"
  | "organization.create"
  | "organization.read"
  | "organization.update"
  | "organization.delete";

export const ALL_ACTIONS: DashAction[] = [
  "overview.read",
  "user.create",
  "user.read",
  "user.update",
  "user.delete",
  "organization.create",
  "organization.read",
  "organization.update",
  "organization.delete",
];

export const toActionId = (action: DashAction) =>
  `plugin::${PLUGIN_ID}.${action}`;

type Method = "GET" | "POST" | "PUT" | "DELETE";

type DashRule = {
  method: Method;
  /** Path below `/auth/dash/`. `:param` matches a single id segment. */
  path: string;
  /** The admin needs at least one of these. */
  anyOf: DashAction[];
};

const USER_DETAIL: DashAction[] = ["user.update"];
const ORG_DETAIL: DashAction[] = ["organization.update"];

const DASH_RULES: DashRule[] = [
  // Loaded on every dashboard page.
  { method: "GET", path: "config", anyOf: ALL_ACTIONS },
  { method: "GET", path: "organization/options", anyOf: ALL_ACTIONS },

  // Overview
  { method: "GET", path: "user-stats", anyOf: ["overview.read"] },
  { method: "GET", path: "user-graph-data", anyOf: ["overview.read"] },
  { method: "GET", path: "user-retention-data", anyOf: ["overview.read"] },

  // Lists. `list-users` also backs the user picker in the organization
  // create dialog and the organization detail drawer.
  {
    method: "GET",
    path: "list-users",
    anyOf: [
      "overview.read",
      "user.read",
      "organization.create",
      "organization.update",
    ],
  },
  {
    method: "GET",
    path: "list-organizations",
    anyOf: ["overview.read", "organization.read"],
  },

  // Users
  { method: "POST", path: "create-user", anyOf: ["user.create"] },
  { method: "POST", path: "delete-user", anyOf: ["user.delete"] },
  { method: "POST", path: "delete-many-users", anyOf: ["user.delete"] },
  { method: "POST", path: "ban-many-users", anyOf: USER_DETAIL },
  // User detail drawer
  { method: "GET", path: "user", anyOf: USER_DETAIL },
  { method: "GET", path: "user-organizations", anyOf: USER_DETAIL },
  { method: "POST", path: "update-user", anyOf: USER_DETAIL },
  { method: "POST", path: "set-password", anyOf: USER_DETAIL },
  { method: "POST", path: "unlink-account", anyOf: USER_DETAIL },
  { method: "POST", path: "ban-user", anyOf: USER_DETAIL },
  { method: "POST", path: "unban-user", anyOf: USER_DETAIL },
  { method: "POST", path: "sessions/revoke", anyOf: USER_DETAIL },
  { method: "POST", path: "sessions/revoke-all", anyOf: USER_DETAIL },
  { method: "POST", path: "send-verification-email", anyOf: USER_DETAIL },
  { method: "POST", path: "send-reset-password-email", anyOf: USER_DETAIL },
  { method: "POST", path: "enable-two-factor", anyOf: USER_DETAIL },
  { method: "POST", path: "disable-two-factor", anyOf: USER_DETAIL },
  { method: "POST", path: "generate-backup-codes", anyOf: USER_DETAIL },
  { method: "POST", path: "view-backup-codes", anyOf: USER_DETAIL },
  { method: "POST", path: "view-two-factor-totp-uri", anyOf: USER_DETAIL },

  // Organizations
  {
    method: "POST",
    path: "organization/create",
    anyOf: ["organization.create"],
  },
  {
    method: "POST",
    path: "organization/delete",
    anyOf: ["organization.delete"],
  },
  {
    method: "POST",
    path: "organization/delete-many",
    anyOf: ["organization.delete"],
  },
  // Organization detail drawer
  { method: "GET", path: "organization/:id", anyOf: ORG_DETAIL },
  { method: "GET", path: "organization/:id/members", anyOf: ORG_DETAIL },
  { method: "GET", path: "organization/:id/teams", anyOf: ORG_DETAIL },
  { method: "GET", path: "organization/:id/invitations", anyOf: ORG_DETAIL },
  { method: "GET", path: "organization/:id/sso-providers", anyOf: ORG_DETAIL },
  {
    method: "GET",
    path: "organization/:id/teams/:teamId/members",
    anyOf: ORG_DETAIL,
  },
  { method: "POST", path: "organization/update", anyOf: ORG_DETAIL },
  { method: "POST", path: "organization/add-member", anyOf: ORG_DETAIL },
  { method: "POST", path: "organization/remove-member", anyOf: ORG_DETAIL },
  {
    method: "POST",
    path: "organization/update-member-role",
    anyOf: ORG_DETAIL,
  },
  { method: "POST", path: "organization/invite-member", anyOf: ORG_DETAIL },
  {
    method: "POST",
    path: "organization/cancel-invitation",
    anyOf: ORG_DETAIL,
  },
  {
    method: "POST",
    path: "organization/resend-invitation",
    anyOf: ORG_DETAIL,
  },
  { method: "POST", path: "organization/create-team", anyOf: ORG_DETAIL },
  { method: "POST", path: "organization/delete-team", anyOf: ORG_DETAIL },
  { method: "POST", path: "organization/add-team-member", anyOf: ORG_DETAIL },
  {
    method: "POST",
    path: "organization/remove-team-member",
    anyOf: ORG_DETAIL,
  },
];

// Ids are plain tokens; this also rules out `.`/`..` segments, which the URL
// parser would otherwise resolve into a different endpoint after the check.
const ID_SEGMENT = "[A-Za-z0-9_-]+";

const COMPILED_DASH_RULES = DASH_RULES.map((rule) => ({
  ...rule,
  regex: new RegExp(
    `^${rule.path
      .split("/")
      .map((segment) => (segment.startsWith(":") ? ID_SEGMENT : segment))
      .join("/")}$`,
  ),
}));

/**
 * Permissions needed to call `dash()` endpoint `path` (the part after
 * `/auth/dash/`) with `method`, or `null` when the dashboard never makes that
 * call and it must be denied.
 */
export function getDashRule(
  method: string,
  path: string | undefined,
): DashAction[] | null {
  if (!path) return null;
  const rule = COMPILED_DASH_RULES.find(
    (r) => r.method === method && r.regex.test(path),
  );
  return rule ? rule.anyOf : null;
}

type DbOperation = "list" | "update" | "delete";

/**
 * Better Auth content types the dashboard reads or writes through
 * `/better-auth-dashboard/db`, and the permissions each operation needs.
 * Better Auth types not listed here (`account`, `verification`, `jwks`,
 * `two-factor`, ...) can't be reached through it.
 */
const DB_RULES: Record<string, Partial<Record<DbOperation, DashAction[]>>> = {
  "plugin::better-auth.user": {
    // Overview "active users" feed, and the user detail drawer.
    list: ["overview.read", "user.update"],
    update: USER_DETAIL,
  },
  "plugin::better-auth.session": {
    // Overview "recent sessions" feed, and the user detail drawer.
    list: ["overview.read", "user.update"],
  },
  "plugin::better-auth.passkey": {
    list: USER_DETAIL,
    delete: USER_DETAIL,
  },
  "plugin::better-auth.organization": {
    list: ORG_DETAIL,
    update: ORG_DETAIL,
  },
};

export const isBetterAuthUid = (uid: string) =>
  uid.startsWith("plugin::better-auth.");

/** Permissions needed for `op` on `uid`, or `null` when it's not allowed. */
export function getDbRule(uid: string, op: DbOperation): DashAction[] | null {
  return DB_RULES[uid]?.[op] ?? null;
}

/**
 * Searching a custom relation field's target (any non-Better-Auth content
 * type) happens from inside a user or organization detail drawer. On top of
 * this, the admin needs Content Manager read access to the target itself,
 * exactly like the Content Manager's own relation picker.
 */
export const RELATION_SEARCH_ACTIONS: DashAction[] = [
  "user.update",
  "organization.update",
];
