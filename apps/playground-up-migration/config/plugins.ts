export default () => ({
  // This app exists to exercise the users-permissions → Better Auth migration,
  // so both plugins are installed at once. Enabling the `migration` option
  // relaxes Better Auth's boot guard (which otherwise refuses to run alongside
  // users-permissions) and runs the one-time migration at bootstrap.
  "better-auth": {
    config: {
      migration: {
        enabled: true,
        dryRun: false,
      },
    },
  },
});
