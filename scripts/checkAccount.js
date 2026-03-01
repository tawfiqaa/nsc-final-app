const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'scripts', 'service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkAccount() {
    console.log("Checking for tawfiq.a.a@gmail.com...");
    const usersSnap = await db.collection('users').where('email', '==', 'tawfiq.a.a@gmail.com').get();

    if (usersSnap.empty) {
        console.log("No user found with email tawfiq.a.a@gmail.com");
        return;
    }

    for (const doc of usersSnap.docs) {
        const uid = doc.id;
        console.log(`Found UID: ${uid}`);

        // Check V1
        const v1Snap = await db.collection('teacherData').doc(uid).get();
        const v1Logs = v1Snap.exists ? (v1Snap.data().attendanceLogs?.length || 0) : 0;
        console.log(`V1 logs: ${v1Logs}`);

        // Check V2
        const v2Snap = await db.collection('users').doc(uid).collection('lessons').count().get();
        console.log(`V2 lessons: ${v2Snap.data().count}`);

        // Check V2 Schedules
        const v2Schedules = await db.collection('users').doc(uid).collection('schedules').count().get();
        console.log(`V2 schedules: ${v2Schedules.data().count}`);

        // Check migration status
        const migratedToV2 = doc.data().migratedToV2;
        console.log(`migratedToV2 flag: ${migratedToV2}`);
    }
}
checkAccount().catch(console.error);
