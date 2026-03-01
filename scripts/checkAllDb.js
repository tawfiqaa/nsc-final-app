const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'scripts', 'service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkAllData() {
    console.log("Checking all users and their legacy data levels...");
    const usersSnap = await db.collection('users').get();

    for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const email = userDoc.data().email || 'No email';

        const teacherDataSnap = await db.collection('teacherData').doc(uid).get();
        const logs = teacherDataSnap.exists ? (teacherDataSnap.data().attendanceLogs?.length || 0) : 0;

        if (logs > 0) {
            console.log(`Found data: Email: ${email} -> ${logs} logs in V1`);
        }
    }
}
checkAllData().catch(console.error);
