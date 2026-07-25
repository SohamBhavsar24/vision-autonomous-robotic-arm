// Vercel Serverless API Endpoint for Journal Sync
// Path: api/journal.js

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle GitHub API proxy or JSON storage
  const PAT = process.env.GITHUB_PAT;
  const REPO = 'SohamBhavsar24/vision-autonomous-robotic-arm';
  const FILE_PATH = 'dashboard/backend/journal_entries.json';

  if (req.method === 'GET') {
    try {
      const ghRes = await fetch(`https://raw.githubusercontent.com/${REPO}/main/${FILE_PATH}`);
      if (ghRes.ok) {
        const data = await ghRes.json();
        return res.status(200).json(data);
      }
    } catch (e) {}
    return res.status(200).json([]);
  }

  if (req.method === 'POST') {
    const { entries } = req.body || {};
    if (!entries) return res.status(400).json({ error: 'Missing entries' });

    if (PAT) {
      try {
        const apiUrl = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
        const getRes = await fetch(apiUrl, { headers: { Authorization: `token ${PAT}` } });
        let sha = '';
        if (getRes.ok) {
          const getJson = await getRes.json();
          sha = getJson.sha;
        }

        const contentStr = Buffer.from(JSON.stringify(entries, null, 2)).toString('base64');
        await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            Authorization: `token ${PAT}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'Auto-sync journal entry via Vercel Cloud API',
            content: contentStr,
            sha: sha || undefined
          })
        });
        return res.status(200).json({ status: 'committed', count: entries.length });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(200).json({ status: 'received', count: entries.length });
  }

  res.status(45).end();
}
