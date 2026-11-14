---
"@strapi-community/plugin-better-auth-dashboard": patch
---

fix(dashboard): don't crash when permission actions are already registered

`register` called `actionProvider.registerMany` unconditionally, which throws a
`Duplicated item key` error if the admin action registry already holds those
actions. That happens when Strapi re-registers within the same process — during
`strapi develop` watch-mode reloads and integration tests that reboot Strapi —
and crashed the boot. The actions that are already registered are now skipped.
