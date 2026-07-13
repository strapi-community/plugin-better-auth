/**
 * Dash JWT context separation utilities.
 *
 * The dash() server plugin validates certain fields (userId, organizationId, etc.)
 * from the JWT payload via its jwtMiddleware, not from the request body.
 * To keep the HTTP payload clean, we encode these context fields in a dedicated
 * header so the auth-controller can inject them into the signed JWT separately.
 */

export const DASH_CONTEXT_HEADER = "X-Dash-Context";

/**
 * Fields that the dash() jwtMiddleware reads from the JWT payload.
 * These are never part of the HTTP request body.
 */
export interface DashContext {
  userId?: string;
  sessionId?: string;
  organizationId?: string;
  memberId?: string;
  skipDefaultTeam?: boolean;
}

/**
 * Returns second-argument options for a better-auth client call that encode
 * the given context fields into the X-Dash-Context header.
 *
 * @example
 * // Fetching a specific user
 * await client.getDashUser({}, withContext({ userId }));
 *
 * @example
 * // Creating an org on behalf of a user
 * await client.createDashOrganization(
 *   { name, slug },
 *   withContext({ userId, skipDefaultTeam: false }),
 * );
 */
/**
 * Returns a ClientFetchOption-shaped object (second arg to client methods)
 * that encodes the given context fields into the X-Dash-Context header.
 *
 * @example
 * await client.dash.user({}, withContext({ userId }));
 * await client.dash.organization.create({ name, slug }, withContext({ userId }));
 * // Combine with URL params:
 * await client.dash.organization[":id"]({}, { ...withContext({ organizationId }), params: { id: organizationId } });
 */
export const withContext = (
  ctx: DashContext,
  headers?: Record<string, any>,
) => ({
  headers: {
    ...headers,
    [DASH_CONTEXT_HEADER]: btoa(JSON.stringify(ctx)),
  },
});
