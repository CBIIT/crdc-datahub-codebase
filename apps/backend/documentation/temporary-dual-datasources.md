# Temporary dual datasources (Prisma MongoDB + Mongoose DocumentDB)

**Status:** TEMPORARY — remove after the Prisma → DocumentDB / Mongoose migration is complete.

During migration, the backend can run Prisma (and native Mongo drivers) against MongoDB while Mongoose uses Amazon DocumentDB. When DocumentDB is not fully configured, both share the MongoDB connection.

**Driver split:** Mongoose **9.8.0** uses a nested MongoDB Node driver **7.5.x**. Prisma, `connect-mongo` sessions, and migration scripts continue to use the top-level `mongodb@5` dependency. Treat these as separate client stacks.

Related: [DocumentDB + Mongoose Compatibility Reference](./documentdb-mongoose-compatibility.md)

## Behavior

- **Dual mode:** all six `DOCUMENTDB_*` env vars are set → Prisma uses `MONGO_DB_*` / `DATABASE_URL`; Mongoose uses DocumentDB.
- **Single mode:** any `DOCUMENTDB_*` var is missing → Mongoose falls back to the same URI as Prisma (`MONGO_DB_*`). No per-field mixing.
- Startup logs once: dual vs single datasource mode.

## Environment variables (DocumentDB / Mongoose)

| Variable | Purpose |
|---|---|
| `DOCUMENTDB_USER` | DocumentDB user |
| `DOCUMENTDB_PASSWORD` | DocumentDB password |
| `DOCUMENTDB_HOST` | DocumentDB host |
| `DOCUMENTDB_PORT` | DocumentDB port |
| `DOCUMENTDB_NAME` | DocumentDB database name |
| `DOCUMENTDB_CA_FILE` | TLS CA bundle path (`tls=true` + `tlsCAFile`) |

Also used in single-datasource DocumentDB scenarios:

| Variable | Purpose |
|---|---|
| `MONGO_DB_CA_FILE` | Optional TLS CA when `MONGO_DB_*` points at DocumentDB |

## Inventory of temporary changes (reverse checklist)

Search the codebase for `TEMPORARY (Prisma→DocumentDB migration)` to find all marked sites.

### [`config.js`](../config.js)

- [ ] Remove `DOCUMENTDB_ENV_KEYS`, `isDocumentDbFullyConfigured`, `buildDocumentDbConnectionString`, `logDatasourceMode`
- [ ] Remove dual-URI selection (`usesDualDatasources`, `mongooseConnectionString`, `mongooseTlsCaFile`)
- [ ] Remove config fields: `documentdb_*`, `uses_dual_datasources`, `mongoose_tls_ca_file`, `mongoose_connection_string`
- [ ] Keep a single connection string builder for `MONGO_DB_*` → `DATABASE_URL` / `mongo_db_connection_string`
- [ ] Decide whether to keep `MONGO_DB_CA_FILE` / `retryWrites=false` / TLS query params for the final DocumentDB-only connection (likely yes for DocumentDB; remove only if no longer needed)

### [`mongoose/connection.js`](../mongoose/connection.js)

- [ ] Remove the optional `tlsCAFile` argument from `connectMongoose` / `getMongooseConnectOptions` **or** keep TLS options if Mongoose still needs a CA against DocumentDB
- [ ] After dual mode is gone, connect with the shared URI and DocumentDB TLS options derived from the remaining env (e.g. `MONGO_DB_CA_FILE` or a permanent CA var)

### [`app.js`](../app.js)

- [ ] Change `connectMongoose(configuration.mongoose_connection_string, configuration.mongoose_tls_ca_file)` back to a single shared connection string (and TLS options as needed)
- [ ] Remove the TEMPORARY comment above the call

### [`routers/graphql-router.js`](../routers/graphql-router.js)

- [ ] Same as `app.js`: drop `mongoose_connection_string` / `mongoose_tls_ca_file` dual wiring
- [ ] Remove the TEMPORARY comment above the call

### [`env.template`](../env.template)

- [ ] Remove the commented `DOCUMENTDB_*` block and TEMPORARY notes
- [ ] Keep or rename `MONGO_DB_CA_FILE` depending on the final DocumentDB connection design

### This document

- [ ] Delete [`temporary-dual-datasources.md`](./temporary-dual-datasources.md) once dual mode is fully removed

## Suggested post-migration end state

1. One datasource: DocumentDB for both Prisma and Mongoose (or Mongoose only if Prisma is fully retired).
2. One set of connection env vars (likely `MONGO_DB_*` or renamed DocumentDB vars — pick one naming scheme).
3. TLS via CA file still required for DocumentDB; `retryWrites=false` remains required.
4. No dual-mode startup log; no `uses_dual_datasources` / `mongoose_connection_string` split.
