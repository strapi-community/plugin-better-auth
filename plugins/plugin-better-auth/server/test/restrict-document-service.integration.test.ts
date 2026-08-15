import { setupStrapi, stopStrapi } from "@strapi-community/dev-utils";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { runAsInternalCall } from "../src/adapter/internal-context";

const USER_UID = "plugin::better-auth.user";

let counter = 0;
function uniqueEmail() {
  counter += 1;
  return `restrict-document-service-${process.pid}-${counter}@example.com`;
}

// Bypasses the restriction the same way the Better Auth adapter itself does,
// so tests can set up/tear down fixtures without depending on the behavior
// under test.
function createUserInternally(email: string) {
  return runAsInternalCall(() =>
    strapi.documents(USER_UID).create({
      data: {
        name: "Restricted Doc Service Test",
        email,
        emailVerified: false,
      },
    }),
  );
}

function deleteUserInternally(documentId: string) {
  return runAsInternalCall(() =>
    strapi.documents(USER_UID).delete({ documentId }),
  );
}

beforeAll(async () => {
  await setupStrapi();
});

afterAll(async () => {
  await stopStrapi();
});

describe("restrict-document-service middleware (registered end-to-end)", () => {
  afterEach(() => {
    // Undo any config override a test may have made.
    strapi.config.set("plugin::better-auth.unsafe_document_service", false);
  });

  it("blocks a direct create through the document service by default", async () => {
    const email = uniqueEmail();

    await expect(
      strapi.documents(USER_UID).create({
        data: { name: "Direct Create", email, emailVerified: false },
      }),
    ).rejects.toThrow(/restricted/i);

    const found = await strapi
      .documents(USER_UID)
      .findFirst({ filters: { email } });
    expect(found).toBeNull();
  });

  it("blocks a direct update through the document service by default", async () => {
    const email = uniqueEmail();
    const user = await createUserInternally(email);

    await expect(
      strapi.documents(USER_UID).update({
        documentId: user.documentId,
        data: { name: "Modified By Direct Update" },
      }),
    ).rejects.toThrow(/restricted/i);

    const found = await strapi
      .documents(USER_UID)
      .findOne({ documentId: user.documentId });
    expect(found?.name).toBe("Restricted Doc Service Test");

    await deleteUserInternally(user.documentId);
  });

  it("blocks a direct delete through the document service by default", async () => {
    const email = uniqueEmail();
    const user = await createUserInternally(email);

    await expect(
      strapi.documents(USER_UID).delete({ documentId: user.documentId }),
    ).rejects.toThrow(/restricted/i);

    const found = await strapi
      .documents(USER_UID)
      .findOne({ documentId: user.documentId });
    expect(found).not.toBeNull();

    await deleteUserInternally(user.documentId);
  });

  it("leaves read actions unrestricted", async () => {
    const email = uniqueEmail();
    const user = await createUserInternally(email);

    await expect(
      strapi.documents(USER_UID).findFirst({ filters: { email } }),
    ).resolves.toMatchObject({ email });
    await expect(
      strapi.documents(USER_UID).findMany({ filters: { email } }),
    ).resolves.toHaveLength(1);
    await expect(
      strapi.documents(USER_UID).count({ filters: { email } }),
    ).resolves.toBe(1);

    await deleteUserInternally(user.documentId);
  });

  it("allows writes issued through runAsInternalCall, as the adapter does", async () => {
    const email = uniqueEmail();

    const user = await createUserInternally(email);
    expect(user.email).toBe(email);

    const updated = await runAsInternalCall(() =>
      strapi.documents(USER_UID).update({
        documentId: user.documentId,
        data: { name: "Updated Internally" },
      }),
    );
    expect(updated?.name).toBe("Updated Internally");

    await deleteUserInternally(user.documentId);
    const found = await strapi
      .documents(USER_UID)
      .findOne({ documentId: user.documentId });
    expect(found).toBeNull();
  });

  it("allows direct writes once unsafe_document_service is enabled", async () => {
    strapi.config.set("plugin::better-auth.unsafe_document_service", true);
    const email = uniqueEmail();

    const user = await strapi.documents(USER_UID).create({
      data: { name: "Unsafe Direct Create", email, emailVerified: false },
    });
    expect(user.email).toBe(email);

    await strapi.documents(USER_UID).delete({ documentId: user.documentId });
    const found = await strapi
      .documents(USER_UID)
      .findOne({ documentId: user.documentId });
    expect(found).toBeNull();
  });

  it("does not restrict writes on content types outside of the better-auth plugin", async () => {
    const ROLE_UID = "plugin::api-permissions.role";

    // A direct, unwrapped write on a non-better-auth content type must succeed,
    // proving the restriction is scoped to plugin::better-auth.* UIDs only.
    const role = await strapi.documents(ROLE_UID).create({
      data: {
        name: "Restrict Doc Service Test Role",
        type: "restrict-doc-service-test-role",
      },
    });

    await strapi.documents(ROLE_UID).delete({ documentId: role.documentId });
    const found = await strapi
      .documents(ROLE_UID)
      .findOne({ documentId: role.documentId });
    expect(found).toBeNull();
  });
});
