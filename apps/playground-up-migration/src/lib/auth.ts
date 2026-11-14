import { strapiAdapter } from "@strapi-community/plugin-better-auth";
import {
  rehashBcryptOnSignIn,
  usersPermissionsPasswordCompat,
} from "@strapi-community/plugin-better-auth/migration";
import { betterAuth } from "better-auth";
import { admin, jwt, organization, twoFactor } from "better-auth/plugins";

export const auth = betterAuth({
  trustedOrigins: ["http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
    // Verify legacy users-permissions bcrypt hashes, and upgrade them to
    // Better Auth's default (scrypt) on the next successful sign-in.
    password: usersPermissionsPasswordCompat(),
  },
  hooks: {
    after: rehashBcryptOnSignIn,
  },
  plugins: [
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
  advanced: {
    database: {
      generateId: "serial",
    },
  },
});
