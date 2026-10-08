# 3.7.2 SDM Configuration Migration

This is a **manual, one-time migration**. It is intentionally not registered in the backend startup migration orchestrator, so SDM will not be added automatically at startup.

## Run

From `apps/backend`, after confirming the configured DocumentDB environment points to the intended database:

```bash
node documentation/3-7-2/add-sdm-data-commons.js
```

The script adds `SDM` to the existing `DATA_COMMONS_LIST` configuration while preserving its other entries. If that configuration does not exist, it creates one using the backend's default model list plus SDM.

The script records its completion in the `configuration` collection. Subsequent executions skip the update, including after SDM is intentionally removed from `DATA_COMMONS_LIST`. Keep the `MIGRATION_3_7_2_ADD_SDM_TO_DATA_COMMONS_LIST` marker document; deleting it permits the migration to run again.

## Verify

Confirm that the `DATA_COMMONS_LIST` document's `key` array contains `SDM`, and that the completion marker exists. To disable SDM later, remove it from the `key` array but leave the marker in place.
