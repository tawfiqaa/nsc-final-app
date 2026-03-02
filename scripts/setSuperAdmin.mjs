// Sets isSuperAdmin: true on the super admin user doc
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
    readFileSync('C:/Users/tawfi/Downloads/nsc-final-app-firebase-adminsdk-fbsvc-ed2c230b40.json', 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const SUPER_ADMIN_EMAIL = 'tawfiq.a.a@gmail.com';

async function main() {
    const usersSnap = await db.collection('users').where('email', '==', SUPER_ADMIN_EMAIL).get();

    if (usersSnap.empty) {
        console.log('❌ No user found with email:', SUPER_ADMIN_EMAIL);
        return;
    }

    for (const doc of usersSnap.docs) {
        const data = doc.data();
        console.log(`Found user: ${doc.id}`);
        console.log(`  email: ${data.email}`);
        console.log(`  role: ${data.role}`);
        console.log(`  isSuperAdmin (current): ${data.isSuperAdmin}`);

        if (data.isSuperAdmin === true) {
            console.log('  ✅ Already has isSuperAdmin: true');
        } else {
            await doc.ref.update({ isSuperAdmin: true });
            console.log('  ✅ Set isSuperAdmin: true');
        }
    }

    console.log('\nDone!');
}

main().catch(console.error);
