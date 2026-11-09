# DocumentDB + Mongoose Compatibility Reference

Reference for Mongoose ODM APIs and features that are incompatible with, or require special handling on, Amazon DocumentDB. Intended for developers and for agents reviewing backend database code.

## Metadata


| Field         | Value                                                             |
| ------------- | ----------------------------------------------------------------- |
| Target engine | Amazon DocumentDB **8.0** (see `awscdk/crdcdh/app/documentdb.py`) |
| ODM / driver  | **Mongoose 9.8.0** (nested MongoDB Node driver **7.5.x**)         |
| Other drivers | Top-level `mongodb@5` remains for sessions (`connect-mongo`) and migration scripts — separate from Mongoose’s nested driver |
| Last reviewed | 2026-11-09                                                        |




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
     [ ] If auth fails with an unsupported mechanism under driver 7.x, set `authMechanism=SCRAM-SHA-1` on the shared `DOCDB_*` URI (applied automatically when `DOCDB_TLS` is enabled, which is the default, using `DOCDB_CA_FILE` or `resources/aws-documentdb-certificate/global-bundle.pem`).
2. **Aggregation** (`Model.aggregate`, `Query.prototype.pipeline`, aggregation plugins)
  - [ ] Pipeline must **not** use `$facet`, `$graphLookup`, `$unionWith`, `$bucketAuto`, `$setWindowFields`, `$planCacheStats`, `$listSessions`, or `$listLocalSessions`.
     [ ] Prefer equality `$lookup` (`localField` / `foreignField`) over graph-style traversal. Flag `$lookup` with `let` + `pipeline` + `$expr` (`$$` parent vars) — DocumentDB does **not** support correlated subqueries. Extra join predicates belong in a later `$filter` / `$addFields`.
     [ ] `$getField` is listed as supported on DocumentDB 8.0 in the AWS matrix (reviewed 2026-11-09) and unsupported on elastic clusters. `$objectToArray` + `$filter` + `$arrayElemAt` remains valid for a field name known only at run time. Do not use either pattern to create a field name that contains `.`.
     [ ] Flag any pipeline that can emit a field name containing '.' (or starting with '$'): $arrayToObject with computed k, $replaceRoot/$replaceWith of a computed object, $project/$addFields keys built from data or caller input. Use DOT-safe keys and restore in JS.
     [ ] Flag `$sortArray` outside `$project`. DocumentDB 8.0 allows `$sortArray` only in `$project` (Planner v3), not in `$set` / `$addFields`. See [AWS `$sortArray`](https://docs.aws.amazon.com/documentdb/latest/developerguide/sortArray.html) and the array-operators row in [Supported MongoDB APIs](https://docs.aws.amazon.com/documentdb/latest/developerguide/mongo-apis.html).
3. **Transactions / sessions**
  - [ ] `startSession`, `withTransaction`, `session.startTransaction` must respect DocumentDB limits (1-minute transaction timeout, no cursors in a transaction, no creating collections inside a transaction, 32 MB transaction log limit).
     [ ] Do not rely on retryable commit/abort.
4. **Change streams**
  - [ ] `Model.watch()` / `collection.watch()` is supported on instance-based clusters with DocumentDB-specific limits — flag unbounded or Atlas-only assumptions.
5. **Query operators**
  - [ ] Flag `$where` (unsupported).
     [ ] `$getField` is supported on DocumentDB 8.0 per the AWS matrix (reviewed 2026-11-09) and unsupported on elastic clusters. See the aggregation checklist.
     [ ] Flag Atlas Search / Atlas Vector Search plugins; DocumentDB does not support `$vectorSearch` as an independent operator (use DocumentDB vector search via `$search` if needed).
6. **Indexes / schema**
  - [ ] Flag hashed indexes, wildcard indexes, and `2d` (non-sphere) geospatial indexes — unsupported.
     [ ] Text / partial indexes are supported on 8.0; confirm schema options match intended DocumentDB behavior.
7. **Bulk writes**
  - [ ] `bulkWrite` / `insertMany` / `updateMany` / `deleteMany`: individual ops are atomic; the **batch as a whole** is not unless wrapped in an explicit transaction.
     [ ] Flag `updateOne` / `updateMany` / `findOneAndUpdate` when the update argument is an array (an aggregation-pipeline update). DocumentDB 8.0 does **not** support updates with an aggregation pipeline. Mongoose 9 rejects that array unless `{ updatePipeline: true }` is set; enabling the option does not make the operation DocumentDB-compatible. Use a standard update document (dotted `$set`, `$unset`, and other update operators).

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
| Auth mechanisms beyond SCRAM                            | Limited                 | Stick to username/password SCRAM unless AWS docs confirm otherwise. Newer Node drivers may negotiate SCRAM-SHA-256; if DocumentDB rejects it, set `authMechanism=SCRAM-SHA-1` on the shared URI (config does this when `DOCDB_TLS` is enabled, default on, with `DOCDB_CA_FILE` or the default PEM in the Docker image) |


Example URI shape (also used in this repo’s DocumentDB restore docs):

```
mongodb://username:password@host:port/?tls=true&tlsCAFile=/path/to/global-bundle.pem&retryWrites=false&authMechanism=SCRAM-SHA-1
```

**Driver note:** Mongoose 9.8.0 ships with MongoDB Node driver 7.5.x. The backend still declares top-level `mongodb@^5.5.0` for `connect-mongo` sessions and migration scripts. Do not assume a single driver version for all Mongo clients in this process. Native drivers and Mongoose share `config.document_db_connection_string` (from `DOCDB_*`).
```javascript
await mongoose.connect(configuration.document_db_connection_string, {
  // Prefer putting retryWrites=false in the URI; options reinforce intent
  retryWrites: false,
});
```

---



## Incompatible Mongoose features

These Mongoose APIs map to MongoDB operations that DocumentDB 8.0 does **not** support (or does not support in the form Mongoose/Atlas typically uses). Flag them in review.


| Mongoose API / pattern                                               | Underlying MongoDB | DocDB 8.0                 | Alternative                                                                                     |
| -------------------------------------------------------------------- | ------------------ | ------------------------- | ----------------------------------------------------------------------------------------------- |
| `updateOne` / `updateMany` / `findOneAndUpdate` with an array update | Update with an aggregation pipeline | **No** | Standard update document. Nested fields use dotted `$set` (for example `"s3FileInfo.status"`). Mongoose 9 also throws unless `{ updatePipeline: true }`; that option does not add DocumentDB support. |
| `Model.aggregate([{ $facet: ... }])`                                 | `$facet` stage     | **No**                    | Run separate aggregations/queries (e.g. count + page), or reshape the pipeline without `$facet` |
| `Model.aggregate([{ $lookup: { let, pipeline } }])`                  | Correlated `$lookup` | **No**                  | Equality `$lookup` (`localField` / `foreignField`), then `$filter` / `$addFields` on the parent pipeline. [AWS `$lookup` differences](https://docs.aws.amazon.com/documentdb/latest/devguide/functional-differences.html) |
| `$sortArray` inside `$set` / `$addFields`                            | `$sortArray`       | **No** (except `$project`) | DocumentDB 8.0 supports `$sortArray` **only** in `$project` (Planner v3). Prefer `$sort` before `$group`, or `$reduce` to pick min/max. [AWS `$sortArray`](https://docs.aws.amazon.com/documentdb/latest/developerguide/sortArray.html); [API matrix](https://docs.aws.amazon.com/documentdb/latest/developerguide/mongo-apis.html) |
| `Model.aggregate([{ $graphLookup: ... }])`                           | `$graphLookup`     | **No**                    | Application-level traversal, recursive queries, or denormalized graph data                      |
| `Model.aggregate([{ $unionWith: ... }])`                             | `$unionWith`       | **No**                    | Multiple queries merged in application code, or `$lookup` / denormalization                     |
| `Model.aggregate([{ $bucketAuto: ... }])`                            | `$bucketAuto`      | **No**                    | Precompute buckets, or use `$bucket` (supported on 8.0) with fixed boundaries                   |
| `Model.aggregate([{ $setWindowFields: ... }])`                       | `$setWindowFields` | **No**                    | Application-side windowing, or `$group` / `$sort` patterns                                      |
| Aggregation expression `$getField`                                   | `$getField`        | **Yes** on 8.0; **No** on elastic | AWS matrix (reviewed 2026-11-09) lists `$getField` as supported on 8.0. `$objectToArray` + `$filter` + `$arrayElemAt` still reads a name known only at run time. Do not emit dotted field names; see the next row. |
| Aggregation output with '.' in field names ($arrayToObject, $replaceRoot/$mergeObjects, computed $project/$addFields keys) | Dotted field names | **No** | Error "Document can't have '.' in field names: <name>". Build DOT-safe keys (e.g. a_DOT_b) in the pipeline; restore dotted names in application code after the query. MongoDB 5.0+ allows this, so local MongoDB / mongodb-memory-server will NOT reproduce it. |
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
| `Model.aggregate` + `$lookup`                                         | `$lookup`                   | Equality joins and uncorrelated subqueries only — **not** correlated `let` + `pipeline` + `$expr` |
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

`$match`, `$project`, `$addFields` / `$set`, `$unset`, `$group`, `$sort`, `$skip`, `$limit`, `$count`, `$unwind`, `$lookup` (equality / uncorrelated only), `$replaceRoot` / `$replaceWith`, `$sample`, `$redact`, `$geoNear`, `$bucket`, `$merge`, `$out`, `$sortByCount` (8.0.1+).

`$sortArray` is supported on 8.0 **only** inside `$project` (Planner v3). See [AWS `$sortArray`](https://docs.aws.amazon.com/documentdb/latest/developerguide/sortArray.html) and the array-operators row in [Supported MongoDB APIs](https://docs.aws.amazon.com/documentdb/latest/developerguide/mongo-apis.html).

Support for `$set` and `$mergeObjects` in `Model.aggregate` does **not** extend to the update command. Passing a pipeline array as the update to `updateOne`, `updateMany`, or `findOneAndUpdate` is a different MongoDB feature (updates with an aggregation pipeline) and is not supported on DocumentDB 8.0. Mongoose 9 rejects the array by default (`Cannot pass an array to query updates unless the updatePipeline option is set`). `{ updatePipeline: true }` only bypasses that Mongoose check.

```javascript
// INCOMPATIBLE — aggregation pipeline passed as the update
await Model.updateMany(
  { submissionID, s3FileInfo: { $exists: true, $ne: null } },
  [{ $set: { "s3FileInfo.status": "New" } }],
  { updatePipeline: true }
);

// COMPATIBLE — standard update document; dotted $set keeps the rest of s3FileInfo
await Model.updateMany(
  { submissionID, s3FileInfo: { $exists: true, $ne: null } },
  { $set: { "s3FileInfo.status": "New", updatedAt: new Date() } }
);
```

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

### Mongoose example — avoid correlated `$lookup`

DocumentDB supports equality `$lookup` and uncorrelated subqueries. It does **not** support correlated `$lookup` (`let` + `pipeline` + `$expr` with `$$` parent variables). See [Functional differences — `$lookup`](https://docs.aws.amazon.com/documentdb/latest/devguide/functional-differences.html).

```javascript
// INCOMPATIBLE with DocumentDB
{
  $lookup: {
    from: "users",
    let: { id: "$_id" },
    pipeline: [
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ["$institution._id", "$$id"] },
              { $eq: ["$role", "Submitter"] },
            ],
          },
        },
      },
    ],
    as: "submitters",
  },
}

// COMPATIBLE pattern — paginate the parent collection, then $group counts on the child
// (do not $lookup full child documents onto each parent; that can exceed the 16MB BSON limit).
// Valid only when not sorting/paginating on the computed child count; listInstitution branches
// to count-all-then-JS-sort when orderBy is submitterCount.
await InstitutionModel.aggregate([
  { $match: institutionFilters },
  { $skip: offset },
  { $limit: first },
]);
await UserModel.aggregate([
  { $match: { role: "Submitter", "institution._id": { $in: institutionIDs } } },
  { $group: { _id: "$institution._id", submitterCount: { $sum: 1 } } },
]);
// Merge submitterCount onto each institution in application code (missing key → 0).
```

### Mongoose example — avoid `$sortArray` outside `$project`

```javascript
// INCOMPATIBLE with DocumentDB ($set / $addFields)
{
  $set: {
    latest: {
      $first: {
        $sortArray: { input: "$events", sortBy: { timestamp: -1 } },
      },
    },
  },
}

// COMPATIBLE — $reduce to pick max/min
{
  $set: {
    latest: {
      $reduce: {
        input: "$events",
        initialValue: null,
        in: {
          $cond: [
            {
              $or: [
                { $eq: ["$$value", null] },
                { $gt: ["$$this.timestamp", "$$value.timestamp"] },
              ],
            },
            "$$this",
            "$$value",
          ],
        },
      },
    },
  },
}

// COMPATIBLE — case-insensitive array order via $sort before $group $push
{ $addFields: { nameLower: { $toLower: "$mappedDisplayName" } } },
{ $sort: { nameLower: 1 } },
{ $group: { _id: "$_id", names: { $push: "$mappedDisplayName" } } }
```

### Mongoose example — read a field name known only at run time

The AWS matrix (reviewed 2026-11-09) lists `$getField` as supported on DocumentDB 8.0 and unsupported on elastic clusters. `$objectToArray` + `$filter` + `$arrayElemAt` is still a valid way to read a key whose name is known only at run time. It does not require the document to have a dotted root key.

```javascript
// Direct read when $getField is available (DocumentDB 8.0 per the AWS matrix; not elastic)
{ $getField: { field: "runtimeFieldName", input: "$$ROOT" } }

// Also valid — name known only at run time, no $getField
{
  $arrayElemAt: [
    {
      $map: {
        input: {
          $filter: {
            input: { $objectToArray: "$$ROOT" },
            as: "kv",
            cond: { $eq: ["$$kv.k", "runtimeFieldName"] },
          },
        },
        as: "m",
        in: "$$m.v",
      },
    },
    0,
  ],
}
```

### Mongoose example — avoid producing dotted field names

DocumentDB rejects a document whose field names contain `.` when an aggregation produces it (`$arrayToObject`, `$replaceRoot` / `$mergeObjects`, computed `$project` / `$addFields` keys). The error is `Document can't have '.' in field names: <name>`. MongoDB 5.0+ allows those names, so local MongoDB and mongodb-memory-server will not reproduce the failure.

Reference: `ReleaseService.listReleasedDataRecords`. Sort, project, and pagination strategy: [documentdb-literal-dotted-keys.md](./documentdb-literal-dotted-keys.md).

```javascript
// INCOMPATIBLE — $arrayToObject / $replaceRoot emit a field named "program.program_acronym"
k: { $concat: ["$$p.parentType", ".", "$$p.parentIDPropName"] }
// ... $arrayToObject → $replaceRoot { $mergeObjects: ["$props", "$merged"] }

// COMPATIBLE — DOT-safe key in the pipeline; restore after the query
k: { $concat: ["$$p.parentType", "_DOT_", "$$p.parentIDPropName"] }
// $sort: { program_DOT_program_acronym: 1 }
// JS: format_dot_notation(node)  // utility/dot-notation.js
```

`$sort: { "a.b": 1 }` means the nested path `a.b`, not a literal field named `a.b`. Sort on the DOT-safe key.

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
5. A CloudWatch or other runtime error reveals a DocumentDB restriction that is not an operator in the AWS matrix (for example field-name rules).

The [supported APIs matrix](https://docs.aws.amazon.com/documentdb/latest/developerguide/mongo-apis.html) lists stages and operators. It does not list field-name restrictions. Also check [Functional differences](https://docs.aws.amazon.com/documentdb/latest/developerguide/functional-differences.html). As of 2026-11-09 that page's "Dollar($) and dot(.) in field names" section only covers querying `$`-prefixed fields with `$in`, `$nin`, and `$all` inside nested objects. It does not mention the storage error `Document can't have '.' in field names` (error code 163, "A field or name is not valid for storage"). Treat runtime errors as a source for new rows.

Reviewed 2026-11-09 against those two AWS pages. This repo's cluster is `8.0.0` (`awscdk/crdcdh/app/documentdb.py`). On that date the 8.0 column listed `$getField` as Yes (elastic: No) and `$graphLookup` as Yes. `$facet`, `$bucketAuto`, and `$setWindowFields` were Yes only on 8.0.2+, so they stay incompatible for this cluster. The results pipeline in `ReleaseService.listReleasedDataRecords` uses only stages and operators marked Yes on 8.0 with no patch qualifier (`$match`, `$addFields`, `$unwind`, `$group`, `$project`, `$arrayToObject`, `$setUnion`, `$replaceRoot`, `$mergeObjects`, `$sort`, `$skip`, `$limit`, `$count`).

Suggested maintenance steps:

1. Diff this document against the current [AWS supported APIs](https://docs.aws.amazon.com/documentdb/latest/developerguide/mongo-apis.html) matrix for version **8.0**.
2. Check [Functional differences](https://docs.aws.amazon.com/documentdb/latest/developerguide/functional-differences.html) as well. Field-name restrictions are not operators in the matrix.
3. Optionally run the [AWS compat tool](https://github.com/awslabs/amazon-documentdb-tools/tree/master/compat-tool) against `apps/backend`:
  ```bash
   python3 compat.py --version 8.0 --directory apps/backend
  ```
4. Update the **Last reviewed** date in Metadata.
5. Keep the agent checklist in sync with any new high-risk rows.

---



## Quick status legend


| Status                 | Meaning                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| **No** / Incompatible  | Do not use against DocumentDB 8.0                                  |
| Supported with caveats | Allowed, but behavior or limits differ from MongoDB                |
| Yes                    | Supported on DocumentDB 8.0 instance-based clusters per AWS matrix |


