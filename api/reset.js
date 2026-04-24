const admin = require('firebase-admin');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Ensure Firebase Admin is initialized
  try {
    if (!admin.apps.length) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId || !clientEmail || !privateKey || privateKey === 'undefined') {
        return res.status(500).json({ error: 'Missing Environment Variables: Please ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set in your Vercel Dashboard.' });
      }
      
      // Fix formatting issues: replace literal \n with actual newlines, remove surrounding quotes
      privateKey = privateKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        })
      });
    }
  } catch (error) {
    console.error('Firebase admin init error:', error);
    return res.status(500).json({ error: 'Firebase Init Error: ' + error.message });
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
