import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Note: To run this script, you must have a valid service-account.json file 
// in the same directory, and the firebase-admin package installed.
// Setup instructions:
// 1. Download service account key from Firebase Console -> Project Settings -> Service Accounts
// 2. Save it as `scripts/service-account.json`
// 3. Ensure 'firebase-admin' is installed (`npm install firebase-admin`)
// 4. Run `node scripts/migrateToV2.mjs`

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'scripts', 'service-account.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(`Error: Service account key not found at ${SERVICE_ACCOUNT_PATH}`);
    console.error('Please download your service account key from Firebase Console and place it there.');
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function migrateAllUsers() {
    console.log("======================================");
    console.log(" Starting Firestore V2 Migration...");
    console.log("======================================");

    const usersSnap = await db.collection('users').get();

    console.log(`Found ${usersSnap.size} user(s) to check for migration.`);
    if (usersSnap.empty) {
        console.log("No users found.");
        process.exit(0);
    }

    let stats = { processed: 0, logsMigrated: 0, schedulesMigrated: 0, schoolsMigrated: 0, mismatches: 0, failures: 0, skipped: 0 };

    for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        console.log(`\nProcessing user: ${uid} (${userDoc.data().email})`);

        try {
            const teacherDataSnap = await db.collection('teacherData').doc(uid).get();
            if (!teacherDataSnap.exists) {
                console.log(`  - No teacherData found. Skipping.`);
                stats.skipped++;
                continue;
            }

            const legacyData = teacherDataSnap.data();
            const logs = legacyData.attendanceLogs || [];
            const schedules = legacyData.schedules || [];
            const galleries = legacyData.schoolGalleries || {};

            console.log(`  - Found: ${logs.length} logs, ${schedules.length} schedules, ${Object.keys(galleries).length} schools`);

            const earlyLessonsCountSnap = await db.collection('users').doc(uid).collection('lessons').count().get();
            const earlyLessonsCount = earlyLessonsCountSnap.data().count;
            if (earlyLessonsCount === logs.length && logs.length > 0) {
                console.log(`  - Already fully migrated (${earlyLessonsCount} lessons). Skipping to save writes.`);
                stats.skipped++;
                continue;
            }

            let batch = db.batch();
            let opCount = 0;

            // 1. Process Schools
            for (const schoolName of Object.keys(galleries)) {
                // Generate a deterministic ID based on the name (simplified slug) or user's prefix
                // Since this is a subcollection users/{uid}/schools/{schoolId}, we can generate unique but stable ID
                // Alternatively, let Firestore auto-generate, but user requested 'slug' or gen
                const schoolSlug = schoolName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                const schoolId = schoolSlug || `school_${Date.now()}`;

                const schoolRef = db.collection('users').doc(uid).collection('schools').doc(schoolId);
                batch.set(schoolRef, {
                    id: schoolId,
                    name: schoolName,
                    gallery: galleries[schoolName],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }, { merge: true });
                opCount++;
                stats.schoolsMigrated++;
                if (opCount >= 450) {
                    await batch.commit();
                    batch = db.batch();
                    opCount = 0;
                }
            }

            // 2. Process Schedules
            for (const schedule of schedules) {
                // Idempotent write using legacy ID as doc ID
                const scheduleRef = db.collection('users').doc(uid).collection('schedules').doc(schedule.id);
                batch.set(scheduleRef, schedule, { merge: true });
                opCount++;
                stats.schedulesMigrated++;
                if (opCount >= 450) {
                    await batch.commit();
                    batch = db.batch();
                    opCount = 0;
                }
            }

            // 3. Process Lessons (Logs)
            for (const log of logs) {
                const docId = log.id || db.collection('temp').doc().id;
                const lessonRef = db.collection('users').doc(uid).collection('lessons').doc(docId);

                const lessonData = {
                    ...log,
                    // If we had to generate an ID, retain the old one in a specific field just in case
                    legacyId: log.id || docId
                };

                batch.set(lessonRef, lessonData, { merge: true });
                opCount++;
                if (opCount >= 450) {
                    await batch.commit();
                    batch = db.batch();
                    opCount = 0;
                }
            }

            // Commit any remaining writes
            if (opCount > 0) {
                await batch.commit();
            }

            // 4. Verification Step before marking complete
            const lessonsCountSnap = await db.collection('users').doc(uid).collection('lessons').count().get();
            const lessonsCount = lessonsCountSnap.data().count;

            console.log(`  - Verification: legacy logs=${logs.length}, migrated lessons subcollection=${lessonsCount}`);

            if (lessonsCount === logs.length) {
                // Safe: Sizes match
                console.log(`  - Verification passed! Marking user as migrated.`);
                await db.collection('users').doc(uid).update({
                    migratedToV2: true,
                    migrationVersion: 2,
                    migratedAt: FieldValue.serverTimestamp()
                });
                stats.logsMigrated += logs.length;
                stats.processed++;
            } else {
                console.error(`  - VERIFICATION FAILED: Mismatch for user ${uid}. Expected ${logs.length} lessons, found ${lessonsCount}. User NOT marked as migrated.`);
                stats.mismatches++;
            }

        } catch (error) {
            console.error(`  - ERROR processing user ${uid}:`, error);
            stats.failures++;
        }
    }

    console.log("\n======================================");
    console.log(" Migration Complete");
    console.log("======================================");
    console.log(`Users Processed (Success):   ${stats.processed}`);
    console.log(`Users Skipped (No Data):     ${stats.skipped}`);
    console.log(`Users Failed (Errors):       ${stats.failures}`);
    console.log(`Data Mismatches:             ${stats.mismatches}`);
    console.log(`Total Logs Migrated:         ${stats.logsMigrated}`);
    console.log(`Total Schedules Migrated:    ${stats.schedulesMigrated}`);
    console.log(`Total Schools Migrated:      ${stats.schoolsMigrated}`);

}

migrateAllUsers();
