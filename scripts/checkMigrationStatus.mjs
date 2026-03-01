import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'scripts', 'service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkStatus() {
    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
        const data = userDoc.data();
        const uid = userDoc.id;
        console.log(`User: ${uid} (${data.email})`);
        console.log(`  - migratedToV2: ${data.migratedToV2}`);

        const v1Doc = await db.collection('teacherData').doc(uid).get();
        console.log(`  - v1 exists: ${v1Doc.exists}`);

        const v2Lessons = await db.collection('users').doc(uid).collection('lessons').limit(1).get();
        console.log(`  - v2 lessons count (limit 1): ${v2Lessons.size}`);
    }
}

checkStatus();
