import path from "node:path";
import type { Auth } from "better-auth";
import { POSSIBLE_CONFIG_LOCATIONS } from "../utils";

function loadAuth(): Auth | null {
  for (const directory of [strapi.dirs.app.root, strapi.dirs.dist.root]) {
    for (const candidate of POSSIBLE_CONFIG_LOCATIONS) {
      try {
        const m = require(path.join(directory, candidate));
        const resolved = m.auth ?? m.default;
        if (resolved) return resolved;
      } catch {}
    }
  }
  return null;
}

export default () => ({
  getAuth() {
    return loadAuth();
  },

  /**
   * Whether Better Auth ids map onto Strapi's string `documentId` (the default
   * "native" strategy) rather than the numeric `id` (`generateId: "serial"`).
   *
   * This mirrors the adapter's own `useDocumentId` derivation and is the single
   * source of truth other plugins (e.g. the dashboard) can read to resolve a
   * Better Auth id to the right Strapi column.
   */
  usesDocumentId(): boolean {
    const auth = loadAuth();
    const generateId = auth?.options?.advanced?.database?.generateId;
    return generateId !== "serial";
  },
});
