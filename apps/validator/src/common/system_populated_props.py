
def backfill_missing_or_empty_properties(original: dict, updated: dict) -> dict:
    replaced_properties = {
        k: v for k, v in updated.items() \
        if (k not in original) or (original[k] in [None, ""])
    }
    return replaced_properties