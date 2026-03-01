const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

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
                console.log(`Legacy teacherData logs: ${legacyData.attendanceLogs?.length || 0}`);
            } else {
                console.log("Legacy teacherData NOT FOUND.");
            }

            const V2LessonsSnap = await db.collection('users').doc(uid).collection('lessons').get();
            console.log(`V2 Data lessons: ${V2LessonsSnap.size}`);
        }
    }
}
checkData().catch(console.error);
