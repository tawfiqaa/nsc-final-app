import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'scripts', 'service-account.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(`Error: Service account key not found at ${SERVICE_ACCOUNT_PATH}`);
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function repairMigrations() {
    console.log("======================================");
    console.log(" Starting V2 Migration Repair...");
    console.log("======================================");

    const usersSnap = await db.collection('users').get();

    let stats = {
        totalUsersChecked: 0,
        repairedUsers: 0,
        usersAlreadyValid: 0,
        usersWithErrors: 0
    };

    for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const userData = userDoc.data();

        if (userData.migratedToV2 === true) {
            stats.totalUsersChecked++;
            console.log(`\nChecking user: ${uid} (email: ${userData.email})`);

            try {
                // Get legacy data
                const teacherDataSnap = await db.collection('teacherData').doc(uid).get();
                const legacyData = teacherDataSnap.exists ? teacherDataSnap.data() : null;
                const legacyLogs = legacyData?.attendanceLogs || [];
                const legacySchedules = legacyData?.schedules || [];
                const legacySchools = legacyData?.schoolGalleries ? Object.keys(legacyData.schoolGalleries) : [];

                // Get V2 data
                const lessonsCountSnap = await db.collection('users').doc(uid).collection('lessons').count().get();
                const v2LessonsCount = lessonsCountSnap.data().count;

                const schedulesCountSnap = await db.collection('users').doc(uid).collection('schedules').count().get();
                const v2SchedulesCount = schedulesCountSnap.data().count;

                const schoolsCountSnap = await db.collection('users').doc(uid).collection('schools').count().get();
                const v2SchoolsCount = schoolsCountSnap.data().count;

                let needsRepair = false;

                if (legacyData) {
                    if (legacyLogs.length > 0 && v2LessonsCount !== legacyLogs.length) needsRepair = true;
                    if (legacySchedules.length > 0 && v2SchedulesCount !== legacySchedules.length) needsRepair = true;
                    if (legacySchools.length > 0 && v2SchoolsCount !== legacySchools.length) needsRepair = true;
                }

                if (needsRepair) {
                    console.log(`  - CRITICAL: Mismatch found! Re-running migration for ${uid}.`);
                    console.log(`    Legacy: ${legacyLogs.length} logs, ${legacySchedules.length} schedules, ${legacySchools.length} schools.`);
                    console.log(`    V2: ${v2LessonsCount} lessons, ${v2SchedulesCount} schedules, ${v2SchoolsCount} schools.`);

                    let batch = db.batch();
                    let opCount = 0;

                    // Migrate Schools
                    if (legacyData?.schoolGalleries) {
                        for (const schoolName of Object.keys(legacyData.schoolGalleries)) {
                            const schoolSlug = schoolName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                            const schoolId = schoolSlug || `school_${Date.now()}`;
                            const schoolRef = db.collection('users').doc(uid).collection('schools').doc(schoolId);
                            batch.set(schoolRef, {
                                id: schoolId,
                                name: schoolName,
                                gallery: legacyData.schoolGalleries[schoolName],
                                createdAt: Date.now(),
                                updatedAt: Date.now()
                            }, { merge: true });
                            opCount++;
                            if (opCount >= 450) { await batch.commit(); batch = db.batch(); opCount = 0; }
                        }
                    }

                    // Migrate Schedules
                    for (const schedule of legacySchedules) {
                        const scheduleRef = db.collection('users').doc(uid).collection('schedules').doc(schedule.id);
                        batch.set(scheduleRef, schedule, { merge: true });
                        opCount++;
                        if (opCount >= 450) { await batch.commit(); batch = db.batch(); opCount = 0; }
                    }

                    // Migrate Lessons
                    for (const log of legacyLogs) {
                        const docId = log.id || db.collection('temp').doc().id;
                        const lessonRef = db.collection('users').doc(uid).collection('lessons').doc(docId);
                        batch.set(lessonRef, { ...log, legacyId: log.id || docId }, { merge: true });
                        opCount++;
                        if (opCount >= 450) { await batch.commit(); batch = db.batch(); opCount = 0; }
                    }

                    if (opCount > 0) {
                        await batch.commit();
                    }

                    // Strict Verification
                    const verifyLessons = await db.collection('users').doc(uid).collection('lessons').count().get();
                    if (verifyLessons.data().count === legacyLogs.length) {
                        console.log(`  - Repair successful. V2 now matches legacy.`);
                        stats.repairedUsers++;
                    } else {
                        console.log(`  - Repair FAILED. V2 lessons (${verifyLessons.data().count}) != Legacy logs (${legacyLogs.length}).`);
                        // Un-flag them to prevent data loss perception
                        await db.collection('users').doc(uid).update({ migratedToV2: false });
                        stats.usersWithErrors++;
                    }

                } else {
                    console.log(`  - Validated: User has matching V2 subcollections or has no legacy data.`);
                    stats.usersAlreadyValid++;
                }
            } catch (err) {
                console.error(`  - ERROR repairing user ${uid}:`, err);
                stats.usersWithErrors++;
            }
        }
    }

    console.log("\n======================================");
    console.log(" Migration Repair Complete");
    console.log("======================================");
    console.log(`totalUsersChecked: ${stats.totalUsersChecked}`);
    console.log(`repairedUsers:     ${stats.repairedUsers}`);
    console.log(`usersAlreadyValid: ${stats.usersAlreadyValid}`);
    console.log(`usersWithErrors:   ${stats.usersWithErrors}`);
}

repairMigrations().catch(console.error);
