# DocumentDB: Dotted Field Names — Implementation Guidelines

DocumentDB rejects documents with `.` in field names produced by an aggregation. Never emit them. Use DOT-safe keys in the pipeline and restore dotted names in application code.

The error string, so it can be searched, is:

```text
Document can't have '.' in field names: <name>
```

Filename kept so existing links keep working. Reference implementation: `ReleaseService.listReleasedDataRecords` in `apps/backend/services/release-service.js`.

Related: [documentdb-mongoose-compatibility.md](./documentdb-mongoose-compatibility.md).

MongoDB 5.0+ allows dotted field names, so local MongoDB and mongodb-memory-server will **not** reproduce this failure.

## Problem summary

1. **Dotted field names cannot be produced by an aggregation.** `$arrayToObject`, `$replaceRoot` / `$mergeObjects`, and computed `$project` / `$addFields` keys fail when a key contains `.`. Stored release documents do not have those keys either. This replaces the older guidance that told callers to read literal dotted root keys with `$getField` or `$objectToArray`.
2. **`$sort: { "a.b": 1 }` means a nested path.** It sorts `b` under `a`. It does not sort a field whose name is the string `a.b`.
3. **A second `$sort` from `MongoPagination` undoes a custom sort.** If the pipeline already sorted, `getPaginationPipeline()` must not sort again.

A dotted string stored as an **array value** (the all-properties pipeline, or `$addToSet` of `parentType.parentIDPropName`) is not a field name. Leave those alone.

A real nested path (`program.name`) is also not this problem. Remap it to a flat sort field and pass that field to `MongoPagination`. `SubmissionDAO` does this for joined sort keys.

## Strategy

### 1. Build DOT-safe keys where the field is created

Share one separator between the pipeline and `_dotToSafe`:

```javascript
const DOT_SAFE_SEPARATOR = "_DOT_";

_dotToSafe(field) {
    return field.split(".").join(DOT_SAFE_SEPARATOR);
}

// parent key inside $addFields / $map
k: { $concat: ["$$p.parentType", DOT_SAFE_SEPARATOR, "$$p.parentIDPropName"] }
```

`program` + `program_acronym` becomes `program_DOT_program_acronym`, not `program.program_acronym`.

### 2. Project and sort on DOT-safe keys only

After the parent merge, root keys are already DOT-safe. Project with a plain inclusion `$project` and sort on the safe name:

```javascript
{
    $project: {
        _id: 0,
        ...Object.fromEntries(properties.map((field) => [this._dotToSafe(field), 1])),
    },
}
{ $sort: { [this._dotToSafe(orderBy)]: direction } }
```

No `$objectToArray` over `$$ROOT`, and no second `$arrayToObject` that renames keys back to `a.b` inside the pipeline.

### 3. Restore in JS after the query

Never restore dotted names inside the pipeline. Rows are one page:

```javascript
format_dot_notation(record) {
    return Object.fromEntries(
        Object.entries(record).map(([key, value]) => [key.split(DOT_SAFE_SEPARATOR).join("."), value])
    );
}

nodes: (nodes || []).map((node) => format_dot_notation(node))
```

`program_DOT_program_acronym` becomes `program.program_acronym` in the GraphQL `nodes` JSON. The response shape stays the same.

### 4. Do not let MongoPagination re-sort after a custom sort

`MongoPagination.getPaginationPipeline()` adds `$sort` whenever `orderBy` is truthy. The properties branch sorts on the DOT-safe key before pagination, so pass **`null`** there. With no properties projection, pass the safe name and let pagination sort.

```javascript
const safeOrderBy = orderBy ? this._dotToSafe(orderBy) : orderBy;
const usesCustomSort = Boolean(orderBy && properties?.length > 0);
const paginationPipe = new MongoPagination(
    first,
    offset,
    usesCustomSort ? null : safeOrderBy,
    sortDirection
);
```

```text
Properties requested (custom sort already ran)
  → $sort on the DOT-safe key
  → MongoPagination(orderBy: null) → $skip / $limit only

No properties projection
  → MongoPagination(safeOrderBy) → $sort + $skip / $limit
  → a plain field such as study_id is unchanged by _dotToSafe
```

Do not add a skip/limit-only method to `MongoPagination` solely for this case. Call-site nulling is the established pattern (`listReleasedStudies` nulls pagination `orderBy` when it applies its own sort).

### 5. Validate caller-supplied field names

Drop any `properties` entry, and ignore any `orderBy`, that is empty or starts with `$`, before building `$project` or `$sort` keys. A `$`-prefixed name is invalid in those stages (DocumentDB error 16410).

## Tests to add when touching this logic

Assert pipeline shape. mongodb-memory-server cannot catch this class of bug, because MongoDB allows dotted field names.

1. No stage key in `$project`, `$addFields`, or `$sort` contains `.`.
2. The parent `$concat` separator is `"_DOT_"`, not `"."`.
3. The `$sort` key is DOT-safe (`study_DOT_study_id`), not `"study.study_id"`, `_sortKey`, or `$objectToArray`.
4. `MongoPagination` is constructed with the safe `orderBy` when there is no custom sort, and with `null` after a custom sort.
5. The JS restore turns `program_DOT_program_acronym` back into `program.program_acronym`.
6. Keep the no-`$facet` and count-pipeline assertions.

See `apps/backend/test/services/release-service.nofacet.test.js` for pipeline shape and restore through `listReleasedDataRecords`. See `apps/backend/test/services/dot-notation.test.js` for `format_dot_notation` itself (only `_DOT_` is replaced; non-objects are returned unchanged).

## Checklist for future changes

- [ ] No aggregation stage emits a field name containing `.` or starting with `$`.
- [ ] DOT-safe keys use the shared `DOT_SAFE_SEPARATOR` / `_dotToSafe`.
- [ ] Projection is an inclusion `$project` on DOT-safe keys. Dotted names are restored only in `format_dot_notation`.
- [ ] `$sort` uses the DOT-safe key.
- [ ] When a custom `$sort` already ran, `MongoPagination` gets `null` orderBy (skip/limit only). Otherwise it gets the safe `orderBy`.
- [ ] Caller-supplied names are non-empty and do not start with `$`.
- [ ] Tests assert stage keys, the `$concat` separator, pagination constructor args, and the JS restore.

## Reference locations

| Piece | Location |
| ----- | -------- |
| DOT-safe parent keys, project, sort, JS restore | `ReleaseService.listReleasedDataRecords` |
| `DOT_SAFE_SEPARATOR`, `format_dot_notation` | `utility/dot-notation.js` |
| `_dotToSafe` | `ReleaseService` |
| Precedent for nulling pagination sort | `ReleaseService.listReleasedStudies` |
| Pipeline and restore regression tests | `test/services/release-service.nofacet.test.js` |
| `format_dot_notation` unit tests | `test/services/dot-notation.test.js` |

## Background

The previous version of this doc (commit `88b58d62d`) recommended documents whose root field names literally contain dots, then reading them with `$objectToArray` because `$getField` was treated as unsupported. That failed on DocumentDB 8.0: Data Explorer `listReleasedDataRecords` returned "Failed to aggregate Release" on 2026-11-09. The aggregation error was `Document can't have '.' in field names: program.program_acronym`. The AWS operator matrix does not list this restriction. See the compatibility doc's maintenance notes.
