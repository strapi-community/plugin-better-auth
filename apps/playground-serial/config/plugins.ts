export default ({ env }) => ({
  // Opt into the Better Auth dashboard MCP tools. Requires Strapi's own MCP
  // server to be enabled too (config/server.ts). Both are gated on STRAPI_MCP
  // so the default test/boot behaviour is unchanged.
  "better-auth-dashboard": {
    config: {
      mcp: {
        enabled: env.bool("STRAPI_MCP", false),
      },
      // Third-party HTTP gateway to the Better Auth dash() endpoints,
      // authenticated with a Strapi API token. Set STRAPI_DASH_API=true.
      dashApi: {
        enabled: env.bool("STRAPI_DASH_API", false),
      },
    },
  },
});
