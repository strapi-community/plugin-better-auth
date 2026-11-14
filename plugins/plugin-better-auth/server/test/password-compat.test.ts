import bcrypt from "bcryptjs";
import { hashPassword } from "better-auth/crypto";
import { describe, expect, it } from "vitest";
import {
  isBcryptHash,
  usersPermissionsPasswordCompat,
} from "../src/migrations/users-permissions/password";

describe("isBcryptHash", () => {
  it("detects bcrypt hashes by their version prefix", async () => {
    const hash = await bcrypt.hash("secret", 10);
    expect(isBcryptHash(hash)).toBe(true);
    expect(isBcryptHash("$2a$10$abc")).toBe(true);
    expect(isBcryptHash("$2y$10$abc")).toBe(true);
  });

  it("returns false for Better Auth (scrypt) hashes", async () => {
    const hash = await hashPassword("secret");
    expect(isBcryptHash(hash)).toBe(false);
  });
});

describe("usersPermissionsPasswordCompat", () => {
  const { hash, verify } = usersPermissionsPasswordCompat();

  it("verifies a legacy bcrypt hash (as users-permissions stores it)", async () => {
    const stored = await bcrypt.hash("correct-horse", 10);

    await expect(
      verify({ hash: stored, password: "correct-horse" }),
    ).resolves.toBe(true);
    await expect(verify({ hash: stored, password: "wrong" })).resolves.toBe(
      false,
    );
  });

  it("verifies a scrypt hash so already-migrated passwords keep working", async () => {
    const stored = await hashPassword("new-password");

    await expect(
      verify({ hash: stored, password: "new-password" }),
    ).resolves.toBe(true);
    await expect(verify({ hash: stored, password: "nope" })).resolves.toBe(
      false,
    );
  });

  it("hashes new passwords with Better Auth's default (scrypt), not bcrypt", async () => {
    const stored = await hash("brand-new");

    expect(isBcryptHash(stored)).toBe(false);
    await expect(verify({ hash: stored, password: "brand-new" })).resolves.toBe(
      true,
    );
  });
});
