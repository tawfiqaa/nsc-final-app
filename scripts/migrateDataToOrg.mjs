// Migrates ALL user data into the org: schedules, lessons, attendance, schools, students, galleries
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
    readFileSync('C:/Users/tawfi/Downloads/nsc-final-app-firebase-adminsdk-fbsvc-ed2c230b40.json', 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const ORG_ID = 'lQ30d56uEFBb9iExrP2L';

async function main() {
    console.log('=== Migrating User Data → Org ===\n');
    console.log(`Target org: ${ORG_ID}\n`);

    // Verify org exists
    const orgDoc = await db.collection('orgs').doc(ORG_ID).get();
    if (!orgDoc.exists) {
        console.log('❌ Org not found!');
        return;
    }
    console.log(`Org name: ${orgDoc.data().name}\n`);

    // Get all members of this org
    const membersSnap = await db.collection('orgs').doc(ORG_ID).collection('members').get();
    const memberUids = [];
    membersSnap.forEach(doc => memberUids.push(doc.id));
    console.log(`Members to migrate: ${memberUids.length}\n`);

    let totalSchedules = 0;
    let totalLessons = 0;
    let totalAttendance = 0;
    let totalSchools = 0;
    let totalStudents = 0;
    let skippedDuplicates = 0;

    // Track what's already in the org to avoid duplicates
    const existingScheduleIds = new Set();
    const existingLessonIds = new Set();
    const existingSchoolIds = new Set();

    const existingSchedulesSnap = await db.collection('orgs').doc(ORG_ID).collection('schedules').get();
    existingSchedulesSnap.forEach(d => existingScheduleIds.add(d.id));

    const existingLessonsSnap = await db.collection('orgs').doc(ORG_ID).collection('lessons').get();
    existingLessonsSnap.forEach(d => existingLessonIds.add(d.id));

    const existingSchoolsSnap = await db.collection('orgs').doc(ORG_ID).collection('schools').get();
    existingSchoolsSnap.forEach(d => existingSchoolIds.add(d.id));

    for (const uid of memberUids) {
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = userDoc.data();
        if (!userData) {
            console.log(`⚠️ User ${uid} has no data, skipping`);
            continue;
        }
        const userName = userData.name || userData.email || uid;
        console.log(`\n--- Migrating: ${userName} (${uid}) ---`);

        // We'll batch writes (max 500 per batch)
        let batch = db.batch();
        let batchCount = 0;

        const flushBatch = async () => {
            if (batchCount > 0) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
            }
        };

        const addToBatch = (ref, data) => {
            batch.set(ref, data);
            batchCount++;
            if (batchCount >= 450) {
                // Will flush before hitting 500 limit
                return flushBatch();
            }
            return Promise.resolve();
        };

        // ── SCHEDULES ──
        const schedulesSnap = await db.collection('users').doc(uid).collection('schedules').get();
        let userSchedules = 0;
        for (const schedDoc of schedulesSnap.docs) {
            if (existingScheduleIds.has(schedDoc.id)) {
                skippedDuplicates++;
                continue;
            }
            const data = schedDoc.data();
            const orgData = {
                ...data,
                createdBy: uid,
                createdByName: userName,
                migratedFrom: `users/${uid}/schedules/${schedDoc.id}`,
            };
            const ref = db.collection('orgs').doc(ORG_ID).collection('schedules').doc(schedDoc.id);
            await addToBatch(ref, orgData);
            existingScheduleIds.add(schedDoc.id);
            userSchedules++;
            totalSchedules++;
        }
        if (userSchedules > 0) console.log(`  📅 Schedules: ${userSchedules}`);

        // ── LESSONS (attendance logs) ──
        const lessonsSnap = await db.collection('users').doc(uid).collection('lessons').get();
        let userLessons = 0;
        for (const lessonDoc of lessonsSnap.docs) {
            if (existingLessonIds.has(lessonDoc.id)) {
                skippedDuplicates++;
                continue;
            }
            const data = lessonDoc.data();
            const orgData = {
                ...data,
                createdBy: uid,
                createdByName: userName,
                migratedFrom: `users/${uid}/lessons/${lessonDoc.id}`,
            };
            const ref = db.collection('orgs').doc(ORG_ID).collection('lessons').doc(lessonDoc.id);
            await addToBatch(ref, orgData);
            existingLessonIds.add(lessonDoc.id);
            userLessons++;
            totalLessons++;

            // ── ATTENDANCE subcollection ──
            const attendanceSnap = await db.collection('users').doc(uid)
                .collection('lessons').doc(lessonDoc.id)
                .collection('attendance').get();

            for (const attDoc of attendanceSnap.docs) {
                const attData = attDoc.data();
                const attRef = db.collection('orgs').doc(ORG_ID)
                    .collection('lessons').doc(lessonDoc.id)
                    .collection('attendance').doc(attDoc.id);
                await addToBatch(attRef, attData);
                totalAttendance++;
            }
        }
        if (userLessons > 0) console.log(`  📝 Lessons: ${userLessons}`);
        if (totalAttendance > 0) console.log(`  ✋ Attendance records migrated so far: ${totalAttendance}`);

        // ── SCHOOLS (including galleries and students) ──
        const schoolsSnap = await db.collection('users').doc(uid).collection('schools').get();
        let userSchools = 0;
        let userStudents = 0;
        for (const schoolDoc of schoolsSnap.docs) {
            const schoolData = schoolDoc.data();
            const schoolRef = db.collection('orgs').doc(ORG_ID).collection('schools').doc(schoolDoc.id);

            if (existingSchoolIds.has(schoolDoc.id)) {
                // School already exists in org - merge galleries if needed
                const existingSchool = await schoolRef.get();
                if (existingSchool.exists) {
                    const existingGallery = existingSchool.data().gallery || [];
                    const newGallery = schoolData.gallery || [];
                    // Merge galleries (deduplicate URLs)
                    const mergedGallery = [...new Set([...existingGallery, ...newGallery])];
                    if (mergedGallery.length > existingGallery.length) {
                        await addToBatch(schoolRef, {
                            ...existingSchool.data(),
                            gallery: mergedGallery,
                            updatedAt: Date.now(),
                        });
                    }
                }
            } else {
                // New school
                const orgSchoolData = {
                    ...schoolData,
                    createdBy: uid,
                    createdByName: userName,
                    migratedFrom: `users/${uid}/schools/${schoolDoc.id}`,
                };
                await addToBatch(schoolRef, orgSchoolData);
                existingSchoolIds.add(schoolDoc.id);
                userSchools++;
                totalSchools++;
            }

            // ── STUDENTS subcollection ──
            const studentsSnap = await db.collection('users').doc(uid)
                .collection('schools').doc(schoolDoc.id)
                .collection('students').get();

            // Check existing students in org school
            const existingStudentsSnap = await db.collection('orgs').doc(ORG_ID)
                .collection('schools').doc(schoolDoc.id)
                .collection('students').get();
            const existingStudentIds = new Set();
            existingStudentsSnap.forEach(d => existingStudentIds.add(d.id));

            for (const studentDoc of studentsSnap.docs) {
                if (existingStudentIds.has(studentDoc.id)) {
                    skippedDuplicates++;
                    continue;
                }
                const studentData = studentDoc.data();
                const studentRef = db.collection('orgs').doc(ORG_ID)
                    .collection('schools').doc(schoolDoc.id)
                    .collection('students').doc(studentDoc.id);
                await addToBatch(studentRef, studentData);
                userStudents++;
                totalStudents++;
            }
        }
        if (userSchools > 0) console.log(`  🏫 Schools: ${userSchools}`);
        if (userStudents > 0) console.log(`  👩‍🎓 Students: ${userStudents}`);

        // Flush remaining writes
        await flushBatch();
    }

    // Also migrate V1 teacherData if any users have it
    console.log('\n--- Checking V1 teacherData ---');
    for (const uid of memberUids) {
        const tdDoc = await db.collection('teacherData').doc(uid).get();
        if (!tdDoc.exists) continue;
        const td = tdDoc.data();

        // V1 schedules (array in teacherData doc)
        if (td.weeklySchedule && Array.isArray(td.weeklySchedule)) {
            let v1Sched = 0;
            let batch2 = db.batch();
            let bc = 0;
            for (const sched of td.weeklySchedule) {
                if (!sched.id || existingScheduleIds.has(sched.id)) continue;
                const ref = db.collection('orgs').doc(ORG_ID).collection('schedules').doc(sched.id);
                batch2.set(ref, {
                    ...sched,
                    createdBy: uid,
                    migratedFrom: `teacherData/${uid}/weeklySchedule`,
                });
                existingScheduleIds.add(sched.id);
                v1Sched++;
                totalSchedules++;
                bc++;
                if (bc >= 450) { await batch2.commit(); batch2 = db.batch(); bc = 0; }
            }
            if (bc > 0) await batch2.commit();
            if (v1Sched > 0) console.log(`  V1 schedules from ${uid}: ${v1Sched}`);
        }

        // V1 attendance logs (array in teacherData doc)
        if (td.attendanceLogs && Array.isArray(td.attendanceLogs)) {
            let v1Logs = 0;
            let batch3 = db.batch();
            let bc = 0;
            for (const log of td.attendanceLogs) {
                if (!log.id || existingLessonIds.has(log.id)) continue;
                const ref = db.collection('orgs').doc(ORG_ID).collection('lessons').doc(log.id);
                batch3.set(ref, {
                    ...log,
                    createdBy: uid,
                    migratedFrom: `teacherData/${uid}/attendanceLogs`,
                });
                existingLessonIds.add(log.id);
                v1Logs++;
                totalLessons++;
                bc++;
                if (bc >= 450) { await batch3.commit(); batch3 = db.batch(); bc = 0; }
            }
            if (bc > 0) await batch3.commit();
            if (v1Logs > 0) console.log(`  V1 lessons from ${uid}: ${v1Logs}`);
        }
    }

    console.log('\n========================================');
    console.log('✅ Migration Complete!\n');
    console.log(`📅 Schedules migrated:   ${totalSchedules}`);
    console.log(`📝 Lessons migrated:     ${totalLessons}`);
    console.log(`✋ Attendance records:    ${totalAttendance}`);
    console.log(`🏫 Schools migrated:     ${totalSchools}`);
    console.log(`👩‍🎓 Students migrated:    ${totalStudents}`);
    console.log(`⏭️  Skipped duplicates:   ${skippedDuplicates}`);
    console.log(`\nAll data now in: orgs/${ORG_ID}/`);
}

main().catch(console.error);
