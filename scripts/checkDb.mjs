import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'scripts', 'service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkData() {
    console.log("Checking users...");
    const usersSnap = await db.collection('users').get();
    for (const doc of usersSnap.docs) {
        if (doc.data().role === 'super_admin') {
            const uid = doc.id;
            console.log("Super Admin UID:", uid);
            console.log("User doc:", doc.data());

            const teacherDataSnap = await db.collection('teacherData').doc(uid).get();
            if (teacherDataSnap.exists) {
                const legacyData = teacherDataSnap.data();
                console.log(`Legacy teacherData: ${legacyData.attendanceLogs?.length || 0} logs, ${legacyData.schedules?.length || 0} schedules`);
            } else {
                console.log("Legacy teacherData NOT FOUND.");
            }

            const V2LessonsSnap = await db.collection('users').doc(uid).collection('lessons').get();
            const V2SchedulesSnap = await db.collection('users').doc(uid).collection('schedules').get();
            console.log(`V2 Data: ${V2LessonsSnap.size} lessons, ${V2SchedulesSnap.size} schedules`);
        }
    }
}
checkData().catch(console.error);
