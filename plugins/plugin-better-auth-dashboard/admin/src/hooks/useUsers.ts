import { useIntl } from "react-intl";
import { useQuery } from "react-query";
import { client } from "../client";
import { getTranslation } from "../utils/getTranslation";

type RawUsers = Awaited<ReturnType<typeof client.dash.listUsers>>;
export type DashUser = NonNullable<RawUsers["data"]>["users"][number];

export interface UseUsersOptions {
  limit?: number;
  offset?: number;
  search?: string;
}

export function useUsers(options: UseUsersOptions = {}) {
  const { limit = 25, offset = 0, search } = options;
  const { formatMessage } = useIntl();

  return useQuery({
    queryKey: ["dash-users", limit, offset, search],
    queryFn: async () => {
      const whereClause = search
        ? JSON.stringify([
            {
              field: "email",
              operator: "contains",
              value: search,
              connector: "OR",
            },
            {
              field: "name",
              operator: "contains",
              value: search,
              connector: "OR",
            },
          ])
        : undefined;

      const result = await client.dash.listUsers({
        query: {
          limit,
          offset,
          sortBy: "createdAt",
          sortOrder: "desc",
          ...(whereClause ? { where: whereClause } : {}),
        },
      });

      if (result.error) {
        throw new Error(
          result.error.message ??
            formatMessage({
              id: getTranslation("common.errors.loadUsers"),
              defaultMessage: "Failed to load users",
            }),
        );
      }
      return result.data;
    },
    keepPreviousData: true,
  });
}
