import { Firestore } from '@google-cloud/firestore';

const firestore = new Firestore({
  projectId: 'flowsocial-498207'
});

async function main() {
  const email = 'vickyychaudharyy@gmail.com';
  console.log(`Updating credits for ${email} in Firestore...`);
  
  const userRef = firestore.collection('users').doc(email);
  const doc = await userRef.get();
  
  if (doc.exists) {
    await userRef.update({
      credits: 1000000,
      plan: 'business'
    });
    console.log('User credits successfully updated to 1,000,000!');
  } else {
    const snapshot = await firestore.collection('users').where('email', '==', email).get();
    if (snapshot.empty) {
      console.log(`User ${email} does not exist in Firestore yet. Creating a new user record...`);
      await userRef.set({
        uid: email,
        email: email,
        credits: 1000000,
        plan: 'business',
        createdAt: new Date().toISOString()
      });
      console.log('User created and credits set to 1,000,000!');
    } else {
      const userDoc = snapshot.docs[0];
      await userDoc.ref.update({
        credits: 1000000,
        plan: 'business'
      });
      console.log(`User credits successfully updated to 1,000,000 via query on doc: ${userDoc.id}`);
    }
  }
}

main().catch(console.error);
