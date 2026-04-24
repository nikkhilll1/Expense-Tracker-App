const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Replace literal \n with actual newlines to support Vercel environment variables
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      })
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

export default async function handler(req, res) {
  // CORS setup if needed, but since it's same-origin on Vercel it should be fine.
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { email, newPass } = req.body;
    
    if (!email || !newPass) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    // Lookup user by email to get their UID
    const userRecord = await admin.auth().getUserByEmail(email);
    
    // Forcefully update the user's password using the Admin SDK
    await admin.auth().updateUser(userRecord.uid, {
      password: newPass
    });

    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    return res.status(500).json({ error: error.message });
  }
}
