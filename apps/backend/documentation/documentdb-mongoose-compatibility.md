# DocumentDB + Mongoose Compatibility Reference

Reference for Mongoose ODM APIs and features that are incompatible with, or require special handling on, Amazon DocumentDB. Intended for developers and for agents reviewing backend database code.

## Metadata


| Field         | Value                                                             |
| ------------- | ----------------------------------------------------------------- |
| Target engine | Amazon DocumentDB **8.0** (see `awscdk/crdcdh/app/documentdb.py`) |
| ODM / driver  | **Mongoose 9.6.1** (nested MongoDB Node driver **7.x**)           |
| Other drivers | Top-level `mongodb@5` remains for sessions (`connect-mongo`) and migration scripts — separate from Mongoose’s nested driver |
| Last reviewed | 2026-07-20                                                        |




### Authoritative sources

Re-check these when DocumentDB or Mongoose versions change:

- [Supported MongoDB APIs, operations, and data types](https://docs.aws.amazon.com/documentdb/latest/developerguide/mongo-apis.html)
- [Functional differences: Amazon DocumentDB and MongoDB](https://docs.aws.amazon.com/documentdb/latest/developerguide/functional-differences.html)
- [Transactions in Amazon DocumentDB](https://docs.aws.amazon.com/documentdb/latest/developerguide/transactions.html)
- [Amazon DocumentDB compatibility overview](https://docs.aws.amazon.com/documentdb/latest/developerguide/compatibility.html)
- [AWS DocumentDB compat tool](https://github.com/awslabs/amazon-documentdb-tools/tree/master/compat-tool) — scan source for unsupported operators

---



## For agents (code review)

When reviewing diffs that touch Mongoose connection setup, schemas, queries, aggregation, sessions/transactions, change streams, or index definitions in `apps/backend/`, apply this checklist. Prefer citing this document over inventing compatibility claims.

### Checklist

1. **Connection**
  - [ ] `mongoose.connect` / connection URI includes `retryWrites=false` (or equivalent option). Retryable writes are **not** supported on DocumentDB.
     [ ] TLS is configured for DocumentDB (`tls=true`, `tlsCAFile` / CA bundle as required). DocumentDB 8.0 requires TLS 1.2+.
     [ ] If auth fails with an unsupported mechanism under driver 7.x, set `authMechanism=SCRAM-SHA-1` on the **DocumentDB** URI only (not the Prisma/MongoDB URI).
2. **Aggregation** (`Model.aggregate`, `Query.prototype.pipeline`, aggregation plugins)
  - [ ] Pipeline must **not** use `$facet`, `$graphLookup`, `$unionWith`, `$bucketAuto`, `$setWindowFields`, `$planCacheStats`, `$listSessions`, or `$listLocalSessions`.
     [ ] Prefer `$lookup` (supported) over graph-style traversal.
3. **Transactions / sessions**
  - [ ] `startSession`, `withTransaction`, `session.startTransaction` must respect DocumentDB limits (1-minute transaction timeout, no cursors in a transaction, no creating collections inside a transaction, 32 MB transaction log limit).
     [ ] Do not rely on retryable commit/abort.
4. **Change streams**
  - [ ] `Model.watch()` / `collection.watch()` is supported on instance-based clusters with DocumentDB-specific limits — flag unbounded or Atlas-only assumptions.
5. **Query operators**
  - [ ] Flag `$where` (unsupported).
     [ ] Flag Atlas Search / Atlas Vector Search plugins; DocumentDB does not support `$vectorSearch` as an independent operator (use DocumentDB vector search via `$search` if needed).
6. **Indexes / schema**
  - [ ] Flag hashed indexes, wildcard indexes, and `2d` (non-sphere) geospatial indexes — unsupported.
     [ ] Text / partial indexes are supported on 8.0; confirm schema options match intended DocumentDB behavior.
7. **Bulk writes**
  - [ ] `bulkWrite` / `insertMany` / `updateMany` / `deleteMany`: individual ops are atomic; the **batch as a whole** is not unless wrapped in an explicit transaction.

If unsure whether an operator is supported, check the AWS 8.0 matrix linked above or run the AWS compat tool against the changed files.

---



## Connection configuration

Mongoose uses the MongoDB Node.js driver under the hood. DocumentDB connection requirements apply to `mongoose.connect(uri, options)`.


| Mongoose / driver setting                               | DocumentDB 8.0          | Notes / alternative                                                                                                                    |
| ------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `retryWrites: true` (driver default for modern drivers) | **Not supported**       | Always set `retryWrites=false` in the URI or connect options                                                                           |
| TLS / SSL                                               | **Required** (TLS 1.2+) | Use `tls=true` and provide the Amazon DocumentDB CA bundle (`tlsCAFile` or equivalent)                                                 |
| Replica set / discovery options                         | Partial                 | DocumentDB is MongoDB-compatible over the wire but is not a full MongoDB replica set; prefer DocumentDB-documented connection patterns |
| `directConnection`                                      | Use with care           | Follow AWS DocumentDB connection guidance for your topology                                                                            |
| Auth mechanisms beyond SCRAM                            | Limited                 | Stick to username/password SCRAM unless AWS docs confirm otherwise. Newer Node drivers may negotiate SCRAM-SHA-256; if DocumentDB rejects it, set `authMechanism=SCRAM-SHA-1` on the DocumentDB URI |


Example URI shape (also used in this repo’s DocumentDB restore docs):

```
mongodb://username:password@host:port/?tls=true&tlsCAFile=/path/to/global-bundle.pem&retryWrites=false&authMechanism=SCRAM-SHA-1
```

**Driver note:** Mongoose 9.6.1 ships with MongoDB Node driver 7.x. The backend still declares top-level `mongodb@^5.5.0` for `connect-mongo` sessions and migration scripts. Do not assume a single driver version for all Mongo clients in this process.
```javascript
await mongoose.connect(process.env.DATABASE_URL, {
  // Prefer putting retryWrites=false in the URI; options reinforce intent
  retryWrites: false,
});
```

---



## Incompatible Mongoose features

These Mongoose APIs map to MongoDB operations that DocumentDB 8.0 does **not** support (or does not support in the form Mongoose/Atlas typically uses). Flag them in review.


| Mongoose API / pattern                                               | Underlying MongoDB | DocDB 8.0                 | Alternative                                                                                     |
| -------------------------------------------------------------------- | ------------------ | ------------------------- | ----------------------------------------------------------------------------------------------- |
| `Model.aggregate([{ $facet: ... }])`                                 | `$facet` stage     | **No**                    | Run separate aggregations/queries (e.g. count + page), or reshape the pipeline without `$facet` |
| `Model.aggregate([{ $graphLookup: ... }])`                           | `$graphLookup`     | **No**                    | Application-level traversal, recursive queries, or denormalized graph data                      |
| `Model.aggregate([{ $unionWith: ... }])`                             | `$unionWith`       | **No**                    | Multiple queries merged in application code, or `$lookup` / denormalization                     |
| `Model.aggregate([{ $bucketAuto: ... }])`                            | `$bucketAuto`      | **No**                    | Precompute buckets, or use `$bucket` (supported on 8.0) with fixed boundaries                   |
| `Model.aggregate([{ $setWindowFields: ... }])`                       | `$setWindowFields` | **No**                    | Application-side windowing, or `$group` / `$sort` patterns                                      |
| Query with `$where`                                                  | `$where`           | **No**                    | Express the predicate with `$expr`, `$regex`, or other supported operators                      |
| Atlas Search plugins / `$searchMeta` (Atlas-only)                    | Atlas Search       | **No**                    | DocumentDB text index + `$text` (supported on 8.0), or external search                          |
| Aggregate `$vectorSearch` as a top-level stage (MongoDB Atlas style) | `$vectorSearch`    | **Not as independent op** | DocumentDB vector search via `$search` (see AWS vector search docs)                             |
| Schema index `{ field: 'hashed' }`                                   | Hashed index       | **No**                    | Regular single-field / compound index                                                           |
| Schema index wildcard (`$**`)                                        | Wildcard index     | **No**                    | Explicit indexes on known paths                                                                 |
| Schema index `{ loc: '2d' }`                                         | `2d` index         | **No**                    | Use `2dsphere`                                                                                  |
| Capped collections / `capped: true`                                  | Capped collections | **No**                    | TTL indexes or application-managed retention                                                    |
| Relying on retryable writes after `save()` / `updateOne()` failures  | Retryable writes   | **No**                    | Application-level retry with idempotent writes; `retryWrites=false`                             |


---



## Supported with caveats

These are available on DocumentDB 8.0 but behave differently from MongoDB Atlas / self-hosted MongoDB. Safe to use only with the listed constraints.


| Mongoose API / pattern                                                | Underlying MongoDB          | Caveat                                                                                                                                           |
| --------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `doc.save()`, `Model.create()`, `updateOne`, `findOneAndUpdate`, etc. | CRUD commands               | Works; do **not** enable retryable writes                                                                                                        |
| `Model.insertMany()`, `updateMany()`, `deleteMany()`, `bulkWrite()`   | Bulk / multi-doc writes     | Each sub-operation is atomic; the **entire bulk** is not unless you use an explicit transaction                                                  |
| `startSession()` / `withTransaction()`                                | Multi-document transactions | See [Transactions and sessions](#transactions-and-sessions)                                                                                      |
| `Model.watch()`                                                       | Change streams              | Supported on instance-based clusters; not on elastic clusters; observe DocumentDB change-stream limits                                           |
| `$text` queries / text indexes on schema                              | `$text` + text index        | Supported on 8.0 (not elastic); ranking/`$meta` behavior may differ from MongoDB                                                                 |
| `Model.aggregate` + `$lookup`                                         | `$lookup`                   | Supported — preferred join mechanism                                                                                                             |
| `Model.aggregate` + `$merge` / `$out`                                 | `$merge`, `$out`            | Supported on 8.0 instance clusters (not elastic)                                                                                                 |
| GridFS via `mongoose.mongo.GridFSBucket`                              | GridFS                      | Supported on 8.0 instance clusters (not elastic)                                                                                                 |
| Collation on queries / indexes                                        | Collation                   | Supported on 8.0 (not elastic); verify Planner v3 / DocumentDB collation docs                                                                    |
| Views (`createView`)                                                  | Views                       | Supported on 8.0                                                                                                                                 |
| Sparse unique indexes                                                 | Sparse + unique             | Sparse indexes require `$exists` in the query to be used; some sparse+unique multi-key combinations are unsupported — see AWS sparse-index notes |


---



## Aggregation (`Model.aggregate` / `pipeline()`)

Mongoose aggregation is a thin wrapper over MongoDB aggregation pipelines. Compatibility is entirely determined by DocumentDB’s stage/operator matrix.

### Unsupported stages on DocumentDB 8.0 (do not use)


| Stage                                  | Notes                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `$facet`                               | Common pagination anti-pattern on DocumentDB — split into two pipelines |
| `$graphLookup`                         | No recursive graph traversal                                            |
| `$unionWith`                           | No pipeline union                                                       |
| `$bucketAuto`                          | Use fixed `$bucket` instead if needed                                   |
| `$setWindowFields`                     | No window functions                                                     |
| `$planCacheStats`                      | Not supported                                                           |
| `$listSessions` / `$listLocalSessions` | Not supported                                                           |




### Commonly used stages that **are** supported on 8.0

`$match`, `$project`, `$addFields` / `$set`, `$unset`, `$group`, `$sort`, `$skip`, `$limit`, `$count`, `$unwind`, `$lookup`, `$replaceRoot` / `$replaceWith`, `$sample`, `$redact`, `$geoNear`, `$bucket`, `$merge`, `$out`, `$sortByCount` (8.0.1+).

Always verify new operators against the AWS matrix before merging.

### Mongoose example — avoid `$facet` pagination

```javascript
// INCOMPATIBLE with DocumentDB
const [result] = await Model.aggregate([
  { $match: filter },
  {
    $facet: {
      total: [{ $count: 'count' }],
      results: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
    },
  },
]);

// COMPATIBLE pattern — two aggregations (or find + countDocuments)
const [totalRow] = await Model.aggregate([{ $match: filter }, { $count: 'count' }]);
const results = await Model.aggregate([
  { $match: filter },
  { $sort: sort },
  { $skip: skip },
  { $limit: limit },
]);
```

---



## Indexes and schema features

Mongoose schema indexes (`schema.index(...)`, field `index: true`, `unique: true`, etc.) create MongoDB indexes. DocumentDB 8.0 support:


| Index / property                   | DocDB 8.0         | Mongoose guidance                                                |
| ---------------------------------- | ----------------- | ---------------------------------------------------------------- |
| Single-field, compound, multikey   | Yes               | OK                                                               |
| Unique                             | Yes               | OK                                                               |
| TTL (`expires`)                    | Yes               | OK                                                               |
| Sparse                             | Yes               | Queries must include `$exists` on sparse fields to use the index |
| Partial filter expression          | Yes               | OK on 8.0                                                        |
| Text index                         | Yes               | OK on 8.0 (not elastic)                                          |
| Collation / case-insensitive index | Yes               | OK on 8.0 (not elastic)                                          |
| `2dsphere`                         | Yes               | Prefer over `2d`                                                 |
| `2d`                               | **No**            | Do not use                                                       |
| Hashed                             | **No**            | Do not use                                                       |
| Wildcard                           | **No**            | Do not use                                                       |
| Vector index property              | Yes (not elastic) | Use DocumentDB vector search APIs, not Atlas-only plugins        |
| Hidden index                       | Yes (8.0.1+)      | OK when engine patch supports it                                 |
| Capped collection                  | **No**            | Do not set `capped` on schemas                                   |


---



## Transactions and sessions

Mongoose session APIs (`mongoose.startSession()`, `session.withTransaction()`, passing `session` into `save` / `findOneAndUpdate`) map to MongoDB multi-document transactions.

DocumentDB supports transactions (4.0+), with these limits:


| Constraint                                  | Detail                                                        |
| ------------------------------------------- | ------------------------------------------------------------- |
| Execution timeout                           | **1 minute** per transaction                                  |
| Session timeout                             | **30 minutes**                                                |
| Cursors in a transaction                    | **Not supported** — avoid large `find()` cursors inside a txn |
| Collection creation                         | **Not supported** inside a transaction                        |
| Transaction log size                        | Must be under **32 MB**                                       |
| Retryable writes / retryable commit / abort | **Not supported**                                             |
| Concurrent open transactions                | Instance-class dependent upper bound                          |




### Review guidance

- Keep transactions short and small.
- Prefer `countDocuments()` over `count()` inside transactions when driver support is uncertain.
- Do not assume MongoDB Atlas retry/transaction semantics.

```javascript
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    await ModelA.create([{ ... }], { session });
    await ModelB.updateOne({ _id }, { $set: { ... } }, { session });
  });
} finally {
  await session.endSession();
}
```

---



## Change streams


| Mongoose API                                          | Underlying                       | DocDB 8.0                                                         |
| ----------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| `Model.watch()`, `connection.collection(...).watch()` | Change streams / `$changeStream` | Supported on instance-based clusters; **not** on elastic clusters |


DocumentDB change streams have engine-specific limits (event size, retention, and operational constraints). Do not assume full MongoDB Atlas change-stream feature parity (e.g. certain pipeline stages or cluster topologies). Prefer reading current AWS change-streams documentation when adding `watch()` usage.

---



## Maintaining this document

Update this file when:

1. The DocumentDB engine version in CDK changes (currently `8.0.0`).
2. AWS publishes new supported operators or removes functional differences.
3. The team introduces Mongoose (or a Mongoose-based library) into `apps/backend`.
4. A code review finds a new incompatible pattern not listed here.

Suggested maintenance steps:

1. Diff this document against the current [AWS supported APIs](https://docs.aws.amazon.com/documentdb/latest/developerguide/mongo-apis.html) matrix for version **8.0**.
2. Optionally run the [AWS compat tool](https://github.com/awslabs/amazon-documentdb-tools/tree/master/compat-tool) against `apps/backend`:
  ```bash
   python3 compat.py --version 8.0 --directory apps/backend
  ```
3. Update the **Last reviewed** date in Metadata.
4. Keep the agent checklist in sync with any new high-risk rows.

---



## Quick status legend


| Status                 | Meaning                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| **No** / Incompatible  | Do not use against DocumentDB 8.0                                  |
| Supported with caveats | Allowed, but behavior or limits differ from MongoDB                |
| Yes                    | Supported on DocumentDB 8.0 instance-based clusters per AWS matrix |


