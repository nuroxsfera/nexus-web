module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL || '';
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!url || !publicKey) {
    return res.status(503).json({ configured: false, reason: 'backend_not_configured' });
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return res.status(503).json({ configured: false, reason: 'invalid_backend_url' });
    }
  } catch {
    return res.status(503).json({ configured: false, reason: 'invalid_backend_url' });
  }

  // Publishable/anon keys are designed for browser use. Never return service-role keys here.
  return res.status(200).json({ configured: true, url, publicKey });
};
