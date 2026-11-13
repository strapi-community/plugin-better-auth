export default ({ env }) => ({
  // Opt into the Better Auth dashboard MCP tools. Requires Strapi's own MCP
  // server to be enabled too (config/server.ts). Both are gated on STRAPI_MCP
  // so the default test/boot behaviour is unchanged.
  "better-auth-dashboard": {
    config: {
      mcp: {
        enabled: env.bool("STRAPI_MCP", false),
      },
    },
  },
});
