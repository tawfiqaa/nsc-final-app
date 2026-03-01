const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'scripts', 'service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkV2Logs() {
    console.log("Checking all users for V2 lessons...");
    const usersSnap = await db.collection('users').get();

    let anyFound = false;

    for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const email = userDoc.data().email || 'No email';
        const role = userDoc.data().role || 'unknown';

        const lessonsSnap = await db.collection('users').doc(uid).collection('lessons').count().get();
        const count = lessonsSnap.data().count;

        if (count > 0) {
            anyFound = true;
            console.log(`Email: ${email} (Role: ${role}, UID: ${uid}) -> ${count} lessons stored in V2`);
        }
    }

    if (!anyFound) {
        console.log("No V2 lessons found for any user in the entire database.");
    }
}
checkV2Logs().catch(console.error);
