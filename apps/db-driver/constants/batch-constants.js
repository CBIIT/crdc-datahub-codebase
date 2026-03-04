module.exports = Object.freeze({
    BATCH: {
        TYPE: {
            METADATA: "metadata",
            DATA_FILE: "data file"
        },
        INTENTION: {
            NEW: "Add",
            UPDATE: "Add/Change",
            DELETE: "Remove",
        },
        STATUSES: {
            UPLOADING: "Uploading",
            UPLOADED: "Uploaded",
            FAILED: "Upload Failed",
            LOADED: "Loaded",
            REJECTED: "Rejected"
        }
    },
    FILE: {
        UPLOAD_STATUSES: {
            NEW: "New",
            UPLOADED: "Uploaded",
            FAILED: "Failed",
        }
    }
});
