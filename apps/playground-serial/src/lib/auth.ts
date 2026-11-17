import { dash } from "@better-auth/infra";
import { strapiAdapter } from "@strapi-community/plugin-better-auth";
import { betterAuth } from "better-auth";
import { admin, jwt, organization, twoFactor } from "better-auth/plugins";

export const auth = betterAuth({
  trustedOrigins: ["http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    dash({
      apiUrl: process.env.STRAPI_URL || "http://localhost:1337",
      apiKey:
        process.env.BETTER_AUTH_DASHBOARD_SECRET ||
        "strapi-internal-dashboard-key",
    }),
    organization({
      teams: {
        enabled: true,
      },
    }),
    twoFactor(),
    jwt(),
    admin(),
  ],
  database: strapiAdapter(),
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["credential", "google", "github"],
    },
  },
  // The one intentional difference from apps/playground: Better Auth ids map
  // onto Strapi's numeric auto-increment `id` instead of the string `document_id`.
  advanced: {
    database: {
      generateId: "serial",
    },
  },
});
