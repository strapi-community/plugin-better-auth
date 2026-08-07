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
}

const config: {
  default: Config;
  validator: (config: Config) => void;
} = {
  default: {},
  validator(config) {
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
