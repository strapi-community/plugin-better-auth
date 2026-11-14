---
"@strapi-community/plugin-better-auth": minor
---

feat(adapter): support atomic transactions

The adapter now exposes a `transaction` implementation that runs the callback
inside `strapi.db.transaction`. Strapi's document service joins that transaction
through async-local storage, so a group of writes is atomic and a thrown error
rolls the whole batch back.
