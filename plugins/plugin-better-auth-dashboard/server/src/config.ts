export interface Config {
  /**
   * Absolute URL of the public-facing client app that email links (email
   * verification, password reset) generated from the dashboard should
   * redirect back to once the user completes the flow.
   *
   * The Better Auth server has no knowledge of the client URL on its own
   * (aside from `trustedOrigins`), so without this the dashboard would have
   * to guess — previously it fell back to the current admin panel URL,
   * which is wrong for end users. Set this to your frontend's URL, e.g.
   * `https://app.example.com/login`.
   */
  email_callback_url?: string;

  /**
   * Opt-in integration with Strapi's native MCP server.
   *
   * When `enabled` is true (and Strapi's own MCP server is turned on via
   * `server.mcp.enabled`), this plugin registers a set of Better Auth admin
   * and analytics tools on `strapi.ai.mcp`, so AI clients can list/get/update
   * and ban users and read sign-up analytics. Every tool is still gated by the
   * admin API token's permissions, exactly like the dashboard UI.
   *
   * Disabled by default — mirrors Strapi's own `mcp: { enabled }` switch.
   */
  mcp?: {
    enabled?: boolean;
  };
}

const config: {
  default: Config;
  validator: (config: Config) => void;
} = {
  default: { mcp: { enabled: false } },
  validator(config) {
    if (
      config.mcp !== undefined &&
      config.mcp.enabled !== undefined &&
      typeof config.mcp.enabled !== "boolean"
    ) {
      throw new Error("mcp.enabled must be a boolean");
    }

    if (config.email_callback_url === undefined) return;

    if (
      typeof config.email_callback_url !== "string" ||
      config.email_callback_url.length === 0
    ) {
      throw new Error("email_callback_url must be a non-empty string");
    }

    try {
      new URL(config.email_callback_url);
    } catch {
      throw new Error("email_callback_url must be a valid absolute URL");
    }
  },
};

export default config;
