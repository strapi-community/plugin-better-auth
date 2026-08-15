export interface Config {
  table_prefix?: string;
  /**
   * Better Auth content types (users, sessions, accounts, ...) carry business logic that
   * needs to run alongside their CRUD operations (e.g. creating a complementary account
   * when a user is created). By default, direct writes to these content types through
   * Strapi's document service (`strapi.documents(...)`) are blocked for anything other
   * than the Better Auth adapter itself, so that logic can't be bypassed.
   *
   * Set this to `true` to disable that restriction and allow unrestricted document
   * service writes to Better Auth's content types.
   */
  unsafe_document_service?: boolean;
}

const config: {
  default: Config;
  validator: (config: Config) => void;
} = {
  default: {
    table_prefix: "ba_",
    unsafe_document_service: false,
  },
  validator(config) {
    if (config.table_prefix !== undefined) {
      if (
        typeof config.table_prefix !== "string" ||
        config.table_prefix.length === 0
      ) {
        throw new Error("table_prefix must be a non-empty string");
      }

      if (!/^[a-z][a-z0-9]*(_[a-z0-9]+)*_$/.test(config.table_prefix)) {
        throw new Error(
          'table_prefix must be snake_case and end with an underscore (e.g. "ba_")',
        );
      }
    }

    if (
      config.unsafe_document_service !== undefined &&
      typeof config.unsafe_document_service !== "boolean"
    ) {
      throw new Error("unsafe_document_service must be a boolean");
    }
  },
};

export default config;
