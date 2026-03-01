import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'scripts', 'service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function forceMigrationFlags() {
    console.log("Starting full V2 flagging...");
    const usersSnap = await db.collection('users').get();

    let batch = db.batch();
    let count = 0;

    for (const userDoc of usersSnap.docs) {
        batch.update(userDoc.ref, {
            migratedToV2: true,
            migrationVersion: 2,
            forceFlaggedAt: new Date().toISOString()
        });
        count++;
        if (count % 400 === 0) {
            await batch.commit();
            batch = db.batch();
        }
    }

    if (count % 400 !== 0) {
        await batch.commit();
    }

    console.log(`Successfully flagged ${count} users as V2.`);
}

forceMigrationFlags().catch(console.error);
