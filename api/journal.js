// Vercel Serverless API Endpoint with Live Cloud Database Persistence
// Path: api/journal.js

const DB_URL = 'https://jsonblob.com/api/jsonBlob/019fb297-c286-7609-8165-90d10a10452c';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const dbRes = await fetch(DB_URL);
      if (dbRes.ok) {
        const data = await dbRes.json();
        return res.status(200).json(data);
      }
    } catch (e) {}
    return res.status(200).json([]);
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const bodyData = req.body;
    let payload = null;

    if (Array.isArray(bodyData)) {
      payload = bodyData;
    } else if (bodyData && Array.isArray(bodyData.entries)) {
      payload = bodyData.entries;
    }

    if (!payload) {
      return res.status(400).json({ error: 'Missing or invalid entries array' });
    }

    try {
      const saveRes = await fetch(DB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (saveRes.ok) {
        return res.status(200).json({ status: 'saved', count: payload.length });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).end();
}
