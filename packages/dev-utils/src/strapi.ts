import fspromises from "node:fs/promises";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { threadId } from "node:worker_threads";
import type { Core } from "@strapi/strapi";
import { setupDb } from "./db";

// Packages in this monorepo live at packages/<name>; apps at apps/<name>.
export const appsDir = path.resolve(process.cwd(), "../../apps");
export const playgroundDir = path.join(appsDir, "playground");

export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      srv.close(() => resolve((addr as net.AddressInfo).port));
    });
    srv.on("error", reject);
  });
}

// threadId is unique per worker thread within a process; safe for parallel test files
const instanceId = `${process.pid}_${threadId}`;

let instance: Core.Strapi | undefined;

/**
 * Boot a Strapi app for tests. Defaults to apps/playground; pass `appDir` to
 * boot a different app (e.g. the users-permissions migration playground).
 */
export async function setupStrapi(options: { appDir?: string } = {}) {
  const appDir = options.appDir ?? playgroundDir;
  const port = await getFreePort();

  process.env.APP_KEYS ??=
    "test-app-key-1,test-app-key-2,test-app-key-3,test-app-key-4";
  process.env.API_TOKEN_SALT ??= "test-api-token-salt";
  process.env.ADMIN_JWT_SECRET ??= "test-admin-jwt-secret";
  process.env.TRANSFER_TOKEN_SALT ??= "test-transfer-token-salt";
  process.env.ENCRYPTION_KEY ??= "test-encryption-key-1234567890";
  process.env.JWT_SECRET ??= "test-jwt-secret";
  process.env.BETTER_AUTH_URL = `http://localhost:${port}`;
  // Read by the @better-auth/infra dash() plugin in the playground's auth config.
  process.env.STRAPI_URL = `http://localhost:${port}`;
  process.env.PORT = String(port);

  setupDb(instanceId);

  if (!instance) {
    const _require = createRequire(`${appDir}/package.json`);
    const { compileStrapi, createStrapi } = _require(
      "@strapi/strapi",
    ) as typeof import("@strapi/strapi");
    const appContext = await compileStrapi({
      appDir,
      ignoreDiagnostics: true,
    });
    const strapi = await createStrapi(appContext).load();
    await strapi.start();
    instance = strapi;
  }

  return instance;
}

export async function stopStrapi() {
  if (instance) {
    await instance.destroy();
    instance = undefined;
  }
}

export const cleanupDir = async (dir: string) => {
  if (
    !dir ||
    (await fspromises
      .access(dir)
      .then(() => false)
      .catch(() => true))
  ) {
    return;
  }

  try {
    const dirContent = await fspromises.readdir(dir);
    const validFilenames = dirContent.filter((f) => f !== "build");
    for (const filename of validFilenames) {
      await fspromises.rm(path.resolve(dir, filename), { recursive: true });
    }
  } catch {
    return;
  }
};
