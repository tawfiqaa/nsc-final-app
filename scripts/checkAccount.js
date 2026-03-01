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
        const data = doc.data();
        console.log(`Found UID: ${uid}`);
        console.log(`Email: ${data.email}`);
        console.log(`migratedToV2 flag: ${data.migratedToV2}`);
        console.log(`migrationVersion: ${data.migrationVersion}`);

        // Check V2
        const v2Snap = await db.collection('users').doc(uid).collection('lessons').count().get();
        console.log(`V2 lessons subcollection count: ${v2Snap.data().count}`);
    }
}
checkAccount().catch(console.error);
