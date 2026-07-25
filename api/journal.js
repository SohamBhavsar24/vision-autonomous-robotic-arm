// Vercel Serverless API Endpoint with Zero-Config Cloud Persistence
// Path: api/journal.js

const KVDB_BUCKET = 'soham_robotic_arm_journal_v1';
const KVDB_URL = `https://kvdb.io/8xN93e5yR6fM2Z1a9qP7wK/${KVDB_BUCKET}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const kvRes = await fetch(KVDB_URL);
      if (kvRes.ok) {
        const data = await kvRes.json();
        if (Array.isArray(data) && data.length > 0) {
          return res.status(200).json(data);
        }
      }
    } catch (e) {}

    // Fallback to GitHub raw static default file
    try {
      const ghRes = await fetch('https://raw.githubusercontent.com/SohamBhavsar24/vision-autonomous-robotic-arm/main/dashboard/backend/journal_entries.json');
      if (ghRes.ok) {
        const data = await ghRes.json();
        return res.status(200).json(data);
      }
    } catch (e) {}

    return res.status(200).json([]);
  }

  if (req.method === 'POST') {
    const { entries } = req.body || {};
    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'Missing or invalid entries array' });
    }

    try {
      const kvPost = await fetch(KVDB_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entries)
      });
      if (kvPost.ok) {
        return res.status(200).json({ status: 'saved', count: entries.length });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }

    return res.status(200).json({ status: 'received', count: entries.length });
  }

  res.status(405).end();
}
