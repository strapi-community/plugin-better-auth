export default ({ env }) => ({
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1337),
  app: {
    keys: env.array("APP_KEYS"),
  },
  // Strapi's native MCP server. Set STRAPI_MCP=true to serve POST /mcp.
  // The better-auth-dashboard MCP tools also need their own flag (config/plugins.ts).
  mcp: {
    enabled: env.bool("STRAPI_MCP", false),
  },
});
