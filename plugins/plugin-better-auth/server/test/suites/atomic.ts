import {
  createTestSuite,
  type TestEntry,
} from "@better-auth/test-utils/adapter";
import type { BetterAuthOptions } from "better-auth";
import { expect } from "vitest";

/**
 * Number of callers racing on the same row in the concurrency tests.
 */
const CONCURRENCY = 10;

type CounterUser = { id: string; counter: number; name: string };

/**
 * Adds a numeric `counter` field to the user model, as none of the core models
 * has a numeric field to increment.
 *
 * It's applied per test (`migrateBetterAuth`) instead of through the suite's
 * `defaultBetterAuthOptions`: the latter migrates in the suite's header test,
 * which runs under vitest's 5s default timeout, too short to reboot Strapi.
 * Tests sharing these options are grouped and migrate once, in the first test,
 * under the 30s per-test timeout.
 */
const counterOptions = {
  user: {
    additionalFields: {
      counter: { type: "number", required: false, defaultValue: 0 },
    },
  },
} satisfies BetterAuthOptions;

/**
 * Conformance tests for the atomic adapter methods introduced in Better Auth
 * 1.7: `consumeOne` and `incrementOne`.
 *
 * Better Auth uses them for single-use credentials (verification tokens,
 * one-time tokens, OTPs), 2FA attempt counters, the database rate limiter and
 * organization member/team counts. The upstream shared suites only cover their
 * sequential behavior; these tests also race several callers against the same
 * row, which is the guarantee these methods exist for. An adapter that relies
 * on Better Auth's snapshot-guarded fallback without atomic conditional writes
 * passes the sequential tests but fails the concurrent ones.
 */
export const atomicTestSuite = createTestSuite(
  "atomic",
  {},
  ({ adapter, generate, insertRandom }) => {
    const createCounterUser = async (counter = 0) =>
      adapter.create<Record<string, unknown>, CounterUser>({
        model: "user",
        data: { ...(await generate("user")), counter },
        forceAllowId: true,
      });

    const findUser = (id: string) =>
      adapter.findOne<CounterUser>({
        model: "user",
        where: [{ field: "id", value: id }],
      });

    const tests: Record<string, () => Promise<void>> = {
      "consumeOne - deletes and returns the matching row": async () => {
        const [verification] = await insertRandom("verification");

        const consumed = await adapter.consumeOne<typeof verification>({
          model: "verification",
          where: [{ field: "identifier", value: verification.identifier }],
        });

        expect(consumed).not.toBeNull();
        expect(consumed?.id).toBe(verification.id);
        expect(consumed?.value).toBe(verification.value);
        expect(
          await adapter.findOne({
            model: "verification",
            where: [{ field: "id", value: verification.id }],
          }),
        ).toBeNull();
      },

      "consumeOne - returns null when no row matches": async () => {
        const [verification] = await insertRandom("verification");

        const consumed = await adapter.consumeOne({
          model: "verification",
          where: [
            { field: "identifier", value: "identifier-that-does-not-exist" },
          ],
        });

        expect(consumed).toBeNull();
        expect(
          await adapter.findOne({
            model: "verification",
            where: [{ field: "id", value: verification.id }],
          }),
        ).not.toBeNull();
      },

      "consumeOne - deletes only one row when several match": async () => {
        const [first] = await insertRandom("verification");
        const second = await adapter.create({
          model: "verification",
          data: {
            ...(await generate("verification")),
            identifier: first.identifier,
          },
          forceAllowId: true,
        });

        const consumed = await adapter.consumeOne<typeof first>({
          model: "verification",
          where: [{ field: "identifier", value: first.identifier }],
        });

        expect(consumed).not.toBeNull();
        expect([first.id, second.id]).toContain(consumed?.id);
        expect(
          await adapter.count({
            model: "verification",
            where: [{ field: "identifier", value: first.identifier }],
          }),
        ).toBe(1);
      },

      "consumeOne - concurrent callers consume the row exactly once":
        async () => {
          const [verification] = await insertRandom("verification");

          const results = await Promise.all(
            Array.from({ length: CONCURRENCY }, () =>
              adapter.consumeOne({
                model: "verification",
                where: [
                  { field: "identifier", value: verification.identifier },
                ],
              }),
            ),
          );

          expect(results.filter((result) => result !== null)).toHaveLength(1);
          expect(
            await adapter.findOne({
              model: "verification",
              where: [{ field: "id", value: verification.id }],
            }),
          ).toBeNull();
        },

      "incrementOne - increments and returns the updated row": async () => {
        const user = await createCounterUser(5);

        const updated = await adapter.incrementOne<CounterUser>({
          model: "user",
          where: [{ field: "id", value: user.id }],
          increment: { counter: 2 },
        });

        expect(updated?.id).toBe(user.id);
        expect(updated?.counter).toBe(7);
        expect((await findUser(user.id))?.counter).toBe(7);
      },

      "incrementOne - applies a negative delta and set in one operation":
        async () => {
          const user = await createCounterUser(5);

          const updated = await adapter.incrementOne<CounterUser>({
            model: "user",
            where: [{ field: "id", value: user.id }],
            increment: { counter: -3 },
            set: { name: "decremented" },
          });

          expect(updated?.counter).toBe(2);
          expect(updated?.name).toBe("decremented");
          const after = await findUser(user.id);
          expect(after?.counter).toBe(2);
          expect(after?.name).toBe("decremented");
        },

      "incrementOne - returns null and changes nothing on a guard miss":
        async () => {
          const user = await createCounterUser(0);

          const updated = await adapter.incrementOne<CounterUser>({
            model: "user",
            where: [
              { field: "id", value: user.id },
              { field: "counter", value: 0, operator: "gt" },
            ],
            increment: { counter: -1 },
          });

          expect(updated).toBeNull();
          expect((await findUser(user.id))?.counter).toBe(0);
        },

      "incrementOne - concurrent increments are not lost": async () => {
        const user = await createCounterUser(0);

        const results = await Promise.all(
          Array.from({ length: CONCURRENCY }, () =>
            adapter.incrementOne<CounterUser>({
              model: "user",
              where: [{ field: "id", value: user.id }],
              increment: { counter: 1 },
            }),
          ),
        );

        // Every caller observes its own increment.
        const counters = results
          .map((result) => result?.counter)
          .sort((a, b) => (a ?? 0) - (b ?? 0));
        expect(counters).toEqual(
          Array.from({ length: CONCURRENCY }, (_, i) => i + 1),
        );
        expect((await findUser(user.id))?.counter).toBe(CONCURRENCY);
      },

      "incrementOne - concurrent guarded decrements never pass the guard":
        async () => {
          const remaining = 3;
          const user = await createCounterUser(remaining);

          const results = await Promise.all(
            Array.from({ length: CONCURRENCY }, () =>
              adapter.incrementOne<CounterUser>({
                model: "user",
                where: [
                  { field: "id", value: user.id },
                  { field: "counter", value: 0, operator: "gt" },
                ],
                increment: { counter: -1 },
              }),
            ),
          );

          expect(results.filter((result) => result !== null)).toHaveLength(
            remaining,
          );
          expect((await findUser(user.id))?.counter).toBe(0);
        },
    };

    return Object.fromEntries(
      Object.entries(tests).map(([name, test]) => [
        name,
        { migrateBetterAuth: counterOptions, test } satisfies TestEntry,
      ]),
    );
  },
);
