module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 12) || null;
  const configured = Boolean(
    process.env.SUPABASE_URL &&
    (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY)
  );
  return res.status(200).json({ status: 'ok', backendConfigured: configured, commit });
};
