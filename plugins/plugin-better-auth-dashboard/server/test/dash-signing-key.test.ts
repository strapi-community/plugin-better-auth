import { setupStrapi, stopStrapi } from "@strapi-community/dev-utils";
import { afterAll, beforeAll, expect, it } from "vitest";
import { getAuth, signDashToken } from "../src/utils/dash";

/**
 * The dash() plugin caches the JWKS it fetches for 15 minutes and doesn't
 * refetch on an unknown key id, while the jwt() plugin creates its signing key
 * lazily without a lock. If concurrent first dash requests each create a key,
 * tokens end up signed with a key the cached JWKS doesn't contain and every dash
 * request fails until the cache expires. The plugin creates the key at boot to
 * prevent that; these tests pin the behaviour.
 */

const JWKS_UID = "plugin::better-auth.jwks";

type JwksApi = { getJwks: () => Promise<{ keys: Array<{ kid?: string }> }> };

/** The `kid` from a JWT's protected header. */
function kidOf(token: string): string | undefined {
  const [header] = token.split(".");
  return JSON.parse(Buffer.from(header, "base64url").toString("utf8")).kid;
}

beforeAll(async () => {
  // Each test file boots against a fresh database, so nothing but the plugin's
  // bootstrap can have created a key yet.
  await setupStrapi();
}, 120_000);

afterAll(async () => {
  await stopStrapi();
});

it("creates the dash signing key at boot, before any request", async () => {
  expect(await strapi.db.query(JWKS_UID).count()).toBe(1);
});

it("signs concurrent dash requests with a key in the JWKS fetched before them", async () => {
  const auth = getAuth(strapi);

  // The snapshot dash() would fetch and cache on its first verification.
  const { keys } = await (auth.api as unknown as JwksApi).getJwks();
  const cachedKids = keys.map((key) => key.kid);

  const tokens = await Promise.all(
    Array.from({ length: 10 }, () => signDashToken(auth)),
  );

  for (const token of tokens) {
    expect(cachedKids).toContain(kidOf(token));
  }
  expect(await strapi.db.query(JWKS_UID).count()).toBe(1);
});
