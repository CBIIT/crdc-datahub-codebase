# DocumentDB: Literal Dotted Keys — Implementation Guidelines

How to sort, project, and paginate documents whose **root field names literally contain dots** (e.g. `"study.study_id"` after flattening parents into props). Reference implementation: `apps/backend/services/release-service.js` (`listReleasedDataRecords`).

Related: [documentdb-mongoose-compatibility.md](./documentdb-mongoose-compatibility.md) (`$getField` is unsupported).

## When this applies

Use these patterns when **all** of the following are true:

1. Aggregation runs against **DocumentDB** (or must stay DocumentDB-compatible).
2. Documents have (or will have) **literal root keys with dots** — not nested paths like `program.name`.
3. You need to **read**, **project**, or **`$sort`** by those literal keys.

Do **not** apply this pattern for ordinary nested paths. Those use normal `$`-paths (e.g. `"$program.name"`) and a single `$sort` via `MongoPagination`.

| Pattern | Example key | Approach |
| -------- | ----------- | -------- |
| Literal dotted root key | `"study.study_id"` on `$$ROOT` | This document |
| Nested path | `program.name` | Direct path / remap to a flat sort field, then paginate |
| Non-dotted root key | `title` | Direct `"$title"` path |

Other DAOs (`dataRecords`, `approvedStudy`, `institution`, `program`) generally do **not** need this unless they adopt the same flattened literal-key shape.

## Problem summary

1. **`$getField` is unsupported** on DocumentDB. You cannot read a literal dotted root key with `$getField`.
2. **`$sort: { "a.b": 1 }` treats `.` as nesting**. Sorting on a literal key named `"a.b"` requires a flat sort key first (DOT-safe rename or a temporary `_sortKey`).
3. **A second `$sort` from `MongoPagination` undoes custom sort**. If you already `$sort` on `_sortKey` / DOT-safe keys, then call `getPaginationPipeline()` with the raw dotted `orderBy`, pagination re-sorts with nested-path semantics and breaks ordering.

## Strategy

### 1. Read a literal dotted key — `_literalFieldValue`

Use `$objectToArray` + `$filter` + `$arrayElemAt` (see also the compatibility doc example):

```javascript
_literalFieldValue(field, input = "$$ROOT") {
    return {
        $arrayElemAt: [
            {
                $map: {
                    input: {
                        $filter: {
                            input: { $objectToArray: input },
                            as: "kv",
                            cond: { $eq: ["$$kv.k", field] },
                        },
                    },
                    as: "m",
                    in: "$$m.v",
                },
            },
            0,
        ],
    };
}
```

### 2. Project mixed keys — prefer direct paths for non-dotted fields

`$objectToArray` over the whole document is relatively expensive. Only use `_literalFieldValue` for dotted names; use a direct path otherwise:

```javascript
_buildKvPairsDotSafe(properties) {
    return properties.map(field => ({
        k: this._dotToSafe(field),           // "a.b" → "a_DOT_b"
        v: field.includes(".")
            ? this._literalFieldValue(field)
            : `$${field}`,
    }));
}
```

Typical flow when projecting a property list:

1. `$project` / `$arrayToObject` into DOT-safe keys (`a_DOT_b`).
2. `$sort` on the DOT-safe `orderBy` key if needed.
3. Restore original names (`a.b`) via a reverse kv map.

### 3. Sort by dotted `orderBy` without a properties projection

When there is no property projection, materialize a temporary flat key, sort, then remove it:

```javascript
{ $addFields: { _sortKey: this._literalFieldValue(orderBy) } },
{ $sort: { _sortKey: direction } },
{ $unset: "_sortKey" },
```

### 4. Do not let MongoPagination re-sort after a custom sort

`MongoPagination.getPaginationPipeline()` adds `$sort` whenever `orderBy` is truthy. If custom sort already ran, pass **`null`** as the pagination `orderBy` so only `$skip` / `$limit` are appended.

```javascript
const usesCustomSort = Boolean(
    orderBy && (properties?.length > 0 || orderBy.includes("."))
);
const paginationPipe = new MongoPagination(
    first,
    offset,
    usesCustomSort ? null : orderBy,
    sortDirection
);
```

Same idea as `listReleasedStudies`, which nulls pagination `orderBy` when a custom sort is applied for `dataCommonsDisplayNames`.

```text
Custom sort path (properties and/or dotted orderBy)
  → $sort on _sortKey or DOT-safe key
  → MongoPagination(orderBy: null) → $skip / $limit only

Plain orderBy, no properties projection
  → MongoPagination(orderBy) → $sort + $skip / $limit
```

Do **not** add a skip/limit-only method to `MongoPagination` solely for this case unless several call sites need it; call-site nulling is the established pattern.

## Tests to add when touching this logic

Assert pipeline shape, not only “no `$getField`”:

1. **No `$getField`**; dotted reads use `$objectToArray` / `$filter`.
2. **`MongoPagination` is constructed with `null` orderBy** when custom sort ran.
3. **Exactly one meaningful `$sort`**, keyed by `_sortKey` or a DOT-safe name — **not** the raw dotted string (e.g. not `"study.study_id"`).
4. Prefer a pagination mock that reflects constructor `orderBy` (emit `$sort` only when `orderBy` is non-null) so skip/limit-only behavior is visible in the pipeline.

See `apps/backend/test/services/release-service.nofacet.test.js`.

## Checklist for future changes

- [ ] Confirm keys are **literal dotted root names**, not nested paths.
- [ ] No `$getField` in the aggregation.
- [ ] Non-dotted projections use `"$field"`; dotted use `_literalFieldValue` (or equivalent).
- [ ] Dotted / DOT-safe `$sort` happens **before** pagination.
- [ ] When custom `$sort` already ran, `MongoPagination` gets `null` orderBy (skip/limit only).
- [ ] Tests assert `$sort` stage keys and pagination constructor args, not only operator absence.

## Reference locations

| Piece | Location |
| ----- | -------- |
| Custom sort + null pagination | `ReleaseService.listReleasedDataRecords` |
| `_literalFieldValue`, `_dotToSafe`, `_buildKvPairsDotSafe` | `ReleaseService` helpers |
| Precedent for nulling pagination sort | `ReleaseService.listReleasedStudies` |
| Regression tests | `test/services/release-service.nofacet.test.js` |
