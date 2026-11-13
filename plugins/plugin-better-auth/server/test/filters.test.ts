import { describe, expect, it } from "vitest";
import { transformFilters } from "../src/adapter/transformers/filters";

const getFieldName = ({ field }: { model: string; field: string }) => field;

describe("transformFilters", () => {
  it("maps a single condition to a plain field filter", () => {
    expect(
      transformFilters(
        [{ field: "email", operator: "eq", value: "a@test.dev" }],
        "user",
        getFieldName,
      ),
    ).toEqual({ email: { $eq: "a@test.dev" } });
  });

  it("keeps both bounds of a range on the same field", () => {
    // Better Auth's dash() plugin counts sign-ups in a window like this. Merging
    // the conditions into one object kept only the last one (`lte end`), so the
    // count became the running total instead of the sign-ups in the window.
    const start = new Date("2026-11-07T00:00:00.000Z");
    const end = new Date("2026-11-08T00:00:00.000Z");

    expect(
      transformFilters(
        [
          { field: "createdAt", operator: "gt", value: start },
          { field: "createdAt", operator: "lte", value: end },
        ],
        "user",
        getFieldName,
      ),
    ).toEqual({
      $and: [{ createdAt: { $gt: start } }, { createdAt: { $lte: end } }],
    });
  });

  it("combines AND conditions on different fields", () => {
    expect(
      transformFilters(
        [
          { field: "userId", operator: "eq", value: "1" },
          { field: "providerId", operator: "eq", value: "github" },
        ],
        "account",
        getFieldName,
      ),
    ).toEqual({
      $and: [{ userId: { $eq: "1" } }, { providerId: { $eq: "github" } }],
    });
  });

  it("puts OR conditions in $or next to the AND conditions", () => {
    expect(
      transformFilters(
        [
          { field: "banned", operator: "eq", value: false },
          { field: "name", operator: "contains", value: "al", connector: "OR" },
          {
            field: "email",
            operator: "contains",
            value: "al",
            connector: "OR",
          },
        ],
        "user",
        getFieldName,
      ),
    ).toEqual({
      banned: { $eq: false },
      $or: [{ name: { $contains: "al" } }, { email: { $contains: "al" } }],
    });
  });
});
