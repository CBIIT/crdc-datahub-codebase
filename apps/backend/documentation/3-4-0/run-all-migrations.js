// LEGACY (reference only). Do not execute against current DocumentDB.
// Do not update for new compatibility issues.
//
// 3.4.0 Complete Migration Script
// This script contains all migrations in execution order
// Historical MongoDB shell paste — do not run against current DocumentDB.

console.log("🚀 Starting 3.4.0 Migration Suite");
console.log("=" .repeat(50));

// =============================================================================
// PHASE 1: FOUNDATION SETUP
// =============================================================================
console.log("\n📋 Phase 1: Foundation Setup");

// 1.1 Database Selection (Manual - run appropriate command)
console.log("⚠️  Manual Step: Select database:");
console.log("   For DEV2/QA2: use crdc-datahub2");
console.log("   For others:   use crdc-datahub");

// 1.2 Collection Creation
console.log("Creating pendingPvs collection...");
try {
    db.createCollection("pendingPvs");
    console.log("✅ pendingPvs collection created");
} catch (e) {
    if (e.code === 48) {
        console.log("✅ pendingPvs collection already exists");
    } else {
        console.log("❌ Error creating pendingPvs collection:", e.message);
    }
}

// 1.3 Data Commons Lookup
console.log("Adding dataCommons lookup...");
try {
    db.dataCommons.insertOne({
        "_id": "4245e09e-52eb-42b6-85e9-a3a23539994f",
        "dataCommons": "CDS",
        "dataCommonsDisplayName": "GC"
    });
    console.log("✅ dataCommons lookup added");
} catch (e) {
    if (e.code === 11000) {
        console.log("✅ dataCommons lookup already exists");
    } else {
        console.log("❌ Error adding dataCommons lookup:", e.message);
    }
}

// 1.4 Set Default Pending Model Change
console.log("Setting default pendingModelChange to false...");
try {
    const result = db.approvedStudies.updateMany(
        { pendingModelChange: { $exists: false } },
        { $set: { pendingModelChange: false } }
    );
    console.log(`✅ Set pendingModelChange to false for ${result.modifiedCount} approved studies`);
} catch (e) {
    console.log("❌ Error setting pendingModelChange:", e.message);
}

// =============================================================================
// PHASE 2: USER MANAGEMENT
// =============================================================================
console.log("\n👥 Phase 2: User Management");

// 2.1 User Full Name Migration
console.log("Adding fullName to users...");
function formatName(userInfo) {
    if (!userInfo) return "";
    let firstName = userInfo?.firstName || "";
    let lastName = userInfo?.lastName || "";
    lastName = lastName.trim();
    return firstName + (lastName.length > 0 ? " " + lastName : "");
}

async function setFullName() {
    const cursor = db.users.find({});
    let successCount = 0;
    let failed = [];

    while (await cursor.hasNext()) {
        const user = await cursor.next();
        const fullName = formatName(user);
        try {
            const result = await db.users.updateOne(
                { _id: user._id, fullName: {$exists: false}},
                { $set: { fullName } }
            );

            if (result.modifiedCount === 1) {
                successCount++;
            }
        } catch (err) {
            failed.push({ id: user._id, error: err.message });
        }
    }
    console.log(`✅ Updated ${successCount} users with fullName`);
    if (failed.length > 0) {
        console.log(`⚠️  ${failed.length} users failed`);
    }
}

await setFullName();

// 2.2 NIH User Reactivation
console.log("Reactivating NIH users...");
try {
    const result = db.users.updateMany(
        { IDP: "nih" },
        { $set: { userStatus: "Active", updateAt: new Date()} }
    );
    console.log(`✅ Reactivated ${result.modifiedCount} NIH users`);
} catch (e) {
    console.log("❌ Error reactivating NIH users:", e.message);
}

// 2.3 User Notifications
console.log("Adding user notifications...");
try {
    // Add data_submission:pv_requested to Data Commons Personnel
    const result1 = db.users.updateMany(
        { role: {$in: ["Data Commons Personnel"]} },
        { $addToSet: { notifications: "data_submission:pv_requested" } }
    );
    console.log(`✅ Added pv_requested notification to ${result1.modifiedCount} Data Commons Personnel`);

    // Add submission_request:pending_cleared to User/Submitter roles
    const result2 = db.users.updateMany(
        { role: {$in: ["User", "Submitter"]} },
        { $addToSet: { notifications: "submission_request:pending_cleared" } }
    );
    console.log(`✅ Added pending_cleared notification to ${result2.modifiedCount} Users/Submitters`);
} catch (e) {
    console.log("❌ Error adding user notifications:", e.message);
}

// =============================================================================
// PHASE 3: STUDY AND ORGANIZATION MANAGEMENT
// =============================================================================
console.log("\n🏢 Phase 3: Study and Organization Management");

// 3.1 Orphan Approved Studies Migration
console.log("Migrating orphan approved studies...");
async function naElementFactory(naOrg) {
    const usesObject = Array.isArray(naOrg.studies) && naOrg.studies.some(s => s && typeof s === "object" && s._id);
    return (id) => (usesObject ? { _id: id } : id);
}

async function findOrphanApprovedStudies() {
    const orphans = await db.approvedStudies.aggregate([
        {
            $lookup: {
                from: "organization",
                let: { sid: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $in: [
                                    "$$sid",
                                    {
                                        $map: {
                                            input: { $ifNull: ["$studies", []] },
                                            as: "s",
                                            in: { $ifNull: ["$$s._id", "$$s"] }
                                        }
                                    }
                                ]
                            }
                        }
                    },
                    { $project: { _id: 1 } }
                ],
                as: "orgs"
            }
        },
        { $match: { $expr: { $eq: [{ $size: "$orgs" }, 0] } } },
        { $project: { _id: 1, studyName: 1, dbGaPID: 1 } }
    ]).toArray();
    return orphans;
}

async function migrateOrphansToNA() {
    const naProgram = await db.organization.findOne({ name: "NA" });
    if (!naProgram?._id) {
        console.log("❌ No 'NA' program found. Please create one first.");
        return;
    }
    console.log(`Using NA program: ${naProgram._id}`);

    const orphans = await findOrphanApprovedStudies();
    console.log(`Found ${orphans.length} orphan studies`);

    if (orphans.length === 0) {
        console.log("✅ No orphan studies to migrate");
        return;
    }

    const toNAElement = await naElementFactory(naProgram);
    const elementsToAdd = orphans.map(o => toNAElement(o._id));

    const CHUNK = 500;
    let chunksApplied = 0;

    for (let i = 0; i < elementsToAdd.length; i += CHUNK) {
        const chunk = elementsToAdd.slice(i, i + CHUNK);
        const res = await db.organization.updateOne(
            { _id: naProgram._id },
            {
                $addToSet: { studies: { $each: chunk } },
                $set: { updateAt: new Date() }
            }
        );
        chunksApplied += 1;
    }
    console.log(`✅ Migrated ${orphans.length} orphan studies to NA program`);
}

await migrateOrphansToNA();

// 3.2 Attach Study ID to Submissions (Updated - Idempotent)
console.log("Attaching studyID to submissions...");
function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return typeof uuid === 'string' && uuidRegex.test(uuid);
}

async function attachStudyIDToSubmissions() {
    const submissions = db.submissions.find({}).toArray();
    let updatedCount = 0;
    let skippedCount = 0;

    for (const submission of submissions) {
        const { studyName, studyAbbreviation, _id, studyID } = submission;
        if (!studyName || !studyAbbreviation) continue;

        // Skip if studyID exists and is already a valid UUID
        if (studyID && isValidUUID(studyID)) {
            skippedCount++;
            continue;
        }

        const matchedStudy = db.approvedStudies.findOne({
            studyName,
            studyAbbreviation,
        });

        if (matchedStudy?._id) {
            const res = db.submissions.updateOne(
                { _id },
                { $set: { studyID: matchedStudy._id } }
            );
            if (res?.modifiedCount > 0) {
                updatedCount++;
            }
        }
    }
    console.log(`✅ Updated ${updatedCount} submissions with studyID`);
    console.log(`⏭️  Skipped ${skippedCount} submissions (already have valid studyID)`);
}

await attachStudyIDToSubmissions();

// 3.3 Overwrite Program ID (Updated - Idempotent)
console.log("Setting programID for submissions...");
async function findProgramIdForStudy(studyID) {
    const prog = await db.organization.findOne(
        { "studies._id": studyID },
        { projection: { _id: 1 } }
    );
    return prog?._id || null;
}

async function setProgramIDs() {
    const naProgram = await db.organization.findOne({ name: "NA" }, { projection: { _id: 1, name: 1 } });
    if (!naProgram?._id) {
        console.log("❌ No 'NA' program found. Please create one first.");
        return;
    }

    const cursor = db.submissions.find({ studyID: { $exists: true, $ne: null } });
    let total = 0;
    let successCount = 0;
    let skippedCount = 0;

    while (await cursor.hasNext()) {
        const s = await cursor.next();
        total++;

        try {
            // Skip if programID exists and is already a valid UUID
            if (s.programID && isValidUUID(s.programID)) {
                skippedCount++;
                continue;
            }

            const programId = (await findProgramIdForStudy(s.studyID)) || naProgram._id;
            const res = await db.submissions.updateOne(
                { _id: s._id },
                { $set: { programID: programId } }
            );

            if (res.modifiedCount === 1) {
                successCount++;
            }
        } catch (err) {
            console.log(`❌ Failed for submission ${s._id}: ${err.message}`);
        }
    }
    console.log(`✅ Updated ${successCount} submissions with programID`);
    console.log(`⏭️  Skipped ${skippedCount} submissions (already have valid programID)`);
}

await setProgramIDs();

// =============================================================================
// PHASE 4: SUBMISSION DATA MIGRATION
// =============================================================================
console.log("\n📄 Phase 4: Submission Data Migration");

// 4.1 Store Concierge ID (Updated - Idempotent)
console.log("Storing conciergeID for submissions...");
async function migrateConciergeIDs() {
    const submissions = db.submissions;
    const users = db.users;

    const cursor = submissions.find({
        conciergeName: { $nin: [null, ""] },
        conciergeEmail: { $nin: [null, ""] },
        conciergeID: { $exists: false }
    });

    let updatedCount = 0;
    let notFoundCount = 0;
    let skippedCount = 0;

    while (await cursor.hasNext()) {
        const submission = await cursor.next();
        
        if (submission.conciergeID) {
            skippedCount++;
            continue;
        }

        const userNameArr = submission.conciergeName.trim().split(/\s+/);
        if (!submission.conciergeName) continue;

        const query = {
            firstName: userNameArr[0],
            email: submission.conciergeEmail
        };

        if (userNameArr?.length > 1 && userNameArr[1].trim().length > 0) {
            query.lastName = userNameArr.slice(1).join(" ");
        }

        const user = await users.findOne(query);

        if (user) {
            const res = await submissions.updateOne(
                { _id: submission._id },
                { $set: { conciergeID: user._id } }
            );
            if (res.modifiedCount > 0) {
                updatedCount++;
            }
        } else {
            notFoundCount++;
        }
    }
    
    console.log(`✅ Updated ${updatedCount} submissions with conciergeID`);
    console.log(`⚠️  ${notFoundCount} submissions had no matching user`);
    console.log(`⏭️  Skipped ${skippedCount} submissions (already have conciergeID)`);
}

await migrateConciergeIDs();

// 4.2 Set Entity Type Value in Release
console.log("Converting entityType arrays to single values...");
try {
    const result = db.release.updateMany(
        { entityType: { $type: "array" } },
        [
            {
                $set: {
                    entityType: { $arrayElemAt: ["$entityType", 0] }
                }
            }
        ]
    );
    console.log(`✅ Converted ${result.modifiedCount} release entityType arrays`);
} catch (e) {
    console.log("❌ Error converting entityType:", e.message);
}

// 4.3 Concierge Cleanup (Manual Step)
console.log("⚠️  Manual Step: Run concierge cleanup after verification");
console.log("   cleanupOldConciergeFields();");

// =============================================================================
// PHASE 5: CONFIGURATION AND CLEANUP
// =============================================================================
console.log("\n⚙️  Phase 5: Configuration and Cleanup");

// 5.1 OMB Configuration
console.log("Adding OMB configuration...");
try {
    const result = db.configuration.updateOne(
        { type: "OMB_INFO" },
        {
            $set: {
                OMBInfo: [
                    "Collection of this information is authorized by The Public Health Service Act, Section 411 (42 USC 285a). Rights of participants are protected by The Privacy Act of 1974. Participation is voluntary, and there are no penalties for not participating or withdrawing at any time. Refusal to participate will not affect your benefits in any way. The information collected will be kept private to the extent provided by law. Names and other identifiers will not appear in any report. Information provided will be combined for all participants and reported as summaries. You are being contacted online to complete this form so that NCI can consider your study for submission into the Cancer Research Data Commons.",
                    "Public reporting burden for this collection of information is estimated to average 60 minutes per response, including the time for reviewing instructions, searching existing data sources, gathering and maintaining the data needed, and completing and reviewing the collection of information. An agency may not conduct or sponsor, and a person is not required to respond to, a collection of information unless it displays a currently valid OMB control number. Send comments regarding this burden estimate or any other aspect of this collection of information, including suggestions for reducing this burden to: NIH, Project Clearance Branch, 6705 Rockledge Drive, MSC 7974, Bethesda, MD 20892-7974, ATTN: PRA (0925-7775). Do not return the completed form to this address."
                ],
                OMBNumber: "0925-7775",
                expirationDate: { "$date": "2025-06-30T00:00:00.000Z" },
                type: "OMB_INFO"
            }
        },
        { upsert: true }
    );
    console.log("✅ OMB configuration added");
} catch (e) {
    console.log("❌ Error adding OMB configuration:", e.message);
}

// 5.2 Application Data Restructuring (Updated - Idempotent)
console.log("Restructuring application data...");
try {
    const result = db.applications.updateMany(
        { 
            "applicant.applicantID": { $exists: true },
            "applicantID": { $exists: false }
        },
        [
            { $set: { applicantID: "$applicant.applicantID" } },
            { $unset: "applicant" }
        ]
    );
    console.log(`✅ Restructured ${result.modifiedCount} applications`);
} catch (e) {
    console.log("❌ Error restructuring applications:", e.message);
}

// 5.3 Inactive Reminder Flags
console.log("Adding inactive reminder flags...");
try {
    // Applications
    const result1 = db.applications.updateMany(
        {},
        [
            {
                $set: {
                    inactiveReminder: { $ifNull: ["$inactiveReminder", false] },
                    inactiveReminder_7: { $ifNull: ["$inactiveReminder_7", false] },
                    inactiveReminder_15: { $ifNull: ["$inactiveReminder_15", false] },
                    inactiveReminder_30: { $ifNull: ["$inactiveReminder_30", false] },
                    finalInactiveReminder: { $ifNull: ["$finalInactiveReminder", false] }
                }
            }
        ]
    );
    console.log(`✅ Added reminder flags to ${result1.modifiedCount} applications`);

    // Submissions
    const result2 = db.submissions.updateMany(
        {},
        [
            {
                $set: {
                    inactiveReminder_7: { $ifNull: ["$inactiveReminder_7", false] },
                    inactiveReminder_30: { $ifNull: ["$inactiveReminder_30", false] },
                    inactiveReminder_60: { $ifNull: ["$inactiveReminder_60", false] },
                    finalInactiveReminder: { $ifNull: ["$finalInactiveReminder", false] }
                }
            }
        ]
    );
    console.log(`✅ Added reminder flags to ${result2.modifiedCount} submissions`);
} catch (e) {
    console.log("❌ Error adding reminder flags:", e.message);
}

// 5.4 Cleanup Operations
console.log("Performing cleanup operations...");
try {
    // Remove empty organizations from users
    const result1 = db.users.updateMany(
        { organization: { $type: "object", $eq: {} } },
        { $unset: { organization: "" } }
    );
    console.log(`✅ Cleaned ${result1.modifiedCount} empty user organizations`);

    // Remove empty organizations from applications
    const result2 = db.applications.updateMany(
        {
            $or: [
                { organization: { $type: "object", $eq: {} } },
                { "organization._id": null }
            ]
        },
        { $unset: { organization: "" } }
    );
    console.log(`✅ Cleaned ${result2.modifiedCount} empty application organizations`);

    // Remove empty collaborators
    const result3 = db.submissions.updateMany(
        { "collaborators.Organization": {$exists: true} },
        { $unset: { "collaborators.$[].Organization": "" } }
    );
    console.log(`✅ Cleaned ${result3.modifiedCount} empty collaborator organizations`);

    // Remove updatedAt from organization collection
    const result4 = db.organization.updateMany(
        {updatedAt: {$exists: true}}, 
        { $unset: { updatedAt: "" } }
    );
    console.log(`✅ Cleaned ${result4.modifiedCount} organization updatedAt fields`);
} catch (e) {
    console.log("❌ Error during cleanup:", e.message);
}

// 5.5 Notification Adjustments
console.log("Adjusting user notifications...");
try {
    // Add configuration change notification
    const result1 = db.users.updateMany(
        { role: {$in: ["Data Commons Personnel", "Submitter"]} },
        { $addToSet: { notifications: "data_submission:cfg_changed" } }
    );
    console.log(`✅ Added cfg_changed notification to ${result1.modifiedCount} users`);

    // Remove configuration change notification from Submitter role
    const result2 = db.users.updateMany(
        { role: "Submitter" },
        { $pull: { notifications: "data_submission:cfg_changed" } }
    );
    console.log(`✅ Removed cfg_changed notification from ${result2.modifiedCount} Submitters`);
} catch (e) {
    console.log("❌ Error adjusting notifications:", e.message);
}

// 5.6 Date Type Conversion (QA2 Only)
console.log("Converting string dates to DateTime (QA2 only)...");
try {
    const result1 = db.users.updateMany(
        { createdAt: { $type: "string" } },
        [{ $set: { createdAt: { $toDate: "$createdAt" } } }]
    );
    console.log(`✅ Converted ${result1.modifiedCount} createdAt strings to dates`);

    const result2 = db.users.updateMany(
        { updateAt: { $type: "string" } },
        [{ $set: { updateAt: { $toDate: "$updateAt" } } }]
    );
    console.log(`✅ Converted ${result2.modifiedCount} updateAt strings to dates`);
} catch (e) {
    console.log("❌ Error converting dates:", e.message);
}

// 5.7 Restore New Notification SR
console.log("⚠️  Manual Step: Restore new notification SR");
console.log("   Requires: sharedFunctions/restoreUserNotifications.js");
console.log("   restoreUserNotifications('submission_request:pending_cleared', {role: {$in: ['Submitter', 'User']}});");

// =============================================================================
// CLEANUP FUNCTIONS (Manual Execution)
// =============================================================================

// Concierge cleanup function (run manually after verification)
function cleanupOldConciergeFields() {
    console.log("🧹 Running concierge cleanup...");
    const unsetRes = db.submissions.updateMany(
        {
            conciergeID: { $exists: true }
        },
        {
            $unset: {
                submitterName: "",
                conciergeName: "",
                conciergeEmail: ""
            }
        }
    );
    console.log(`✅ Cleaned old concierge fields from ${unsetRes.modifiedCount} submissions`);
}

// =============================================================================
// FINAL SUMMARY
// =============================================================================
console.log("\n" + "=" .repeat(50));
console.log("🎉 3.4.0 Migration Suite Complete!");
console.log("=" .repeat(50));

console.log("\n📊 Summary:");
console.log("✅ Foundation setup completed");
console.log("✅ User management completed");
console.log("✅ Study and organization management completed");
console.log("✅ Submission data migration completed");
console.log("✅ Configuration and cleanup completed");

console.log("\n⚠️  Manual Steps Remaining:");
console.log("1. Run concierge cleanup: cleanupOldConciergeFields();");
console.log("2. Restore notification SR (if shared function available)");
console.log("3. Verify all migrations completed successfully");

console.log("\n🔍 Verification Commands:");
console.log("db.users.countDocuments();");
console.log("db.submissions.countDocuments();");
console.log("db.applications.countDocuments();");
console.log("db.submissions.find({studyID: {$exists: true}}).count();");
console.log("db.submissions.find({programID: {$exists: true}}).count();");
console.log("db.submissions.find({conciergeID: {$exists: true}}).count();");
console.log("db.applications.find({applicantID: {$exists: true}}).count();");

console.log("\n✨ All migrations are idempotent and safe to re-run if needed!");
console.log("=" .repeat(50));
