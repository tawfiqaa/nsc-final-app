// Checks for duplicate orgs and removes the second one
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
    readFileSync('C:/Users/tawfi/Downloads/nsc-final-app-firebase-adminsdk-fbsvc-ed2c230b40.json', 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
    const orgsSnap = await db.collection('orgs').get();
    console.log(`Found ${orgsSnap.size} org(s):\n`);

    const orgs = [];
    orgsSnap.forEach(doc => {
        const data = doc.data();
        orgs.push({ id: doc.id, ...data });
        console.log(`  ID: ${doc.id}`);
        console.log(`  Name: ${data.name}`);
        console.log(`  Created: ${new Date(data.createdAt).toISOString()}`);
        console.log('');
    });

    if (orgs.length <= 1) {
        console.log('✅ Only one org exists, nothing to clean up.');
        return;
    }

    // Keep the first one (earliest createdAt), delete the rest
    orgs.sort((a, b) => a.createdAt - b.createdAt);
    const keep = orgs[0];
    const toDelete = orgs.slice(1);

    console.log(`Keeping: ${keep.id} (${keep.name})`);

    for (const org of toDelete) {
        console.log(`Deleting duplicate: ${org.id}`);

        // Delete members subcollection
        const membersSnap = await db.collection('orgs').doc(org.id).collection('members').get();
        const batch = db.batch();
        membersSnap.forEach(doc => batch.delete(doc.ref));

        // Delete the org doc  
        batch.delete(db.collection('orgs').doc(org.id));
        await batch.commit();

        // Also clean up user mirror docs pointing to deleted org and fix activeOrgId
        const usersSnap = await db.collection('users').get();
        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            // Delete mirror membership for deleted org
            const mirrorRef = db.collection('users').doc(userDoc.id).collection('orgMemberships').doc(org.id);
            const mirrorSnap = await mirrorRef.get();
            if (mirrorSnap.exists) {
                await mirrorRef.delete();
                console.log(`  Cleaned mirror for user ${userDoc.id}`);
            }
            // If user's activeOrgId points to deleted org, fix it
            if (userData.activeOrgId === org.id) {
                await userDoc.ref.update({ activeOrgId: keep.id });
                console.log(`  Fixed activeOrgId for user ${userDoc.id}`);
            }
        }

        console.log(`  ✅ Deleted org ${org.id}`);
    }

    console.log('\n✅ Cleanup complete. Active org ID:', keep.id);
}

main().catch(console.error);
