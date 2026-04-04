export default () => ({
  // Enabled only when running migrate-auth integration tests so that
  // the users-permissions auth strategy does not interfere with other test suites.
  ...(process.env.ENABLE_USERS_PERMISSIONS === "true" && {
    "users-permissions": { enabled: true },
  }),
});
