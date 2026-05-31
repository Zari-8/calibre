import { createHash } from 'node:crypto';

const memoryVotes = new Set();
const allowedCriteria = new Set(['Control', 'Impact', 'Creativity']);

function getIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0] || 'unknown';
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function stableHash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}

async function upstash(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const response = await fetch(`${url}/${command.map(part => encodeURIComponent(part)).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Upstash request failed: ${response.status}`);
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const battleSlug = String(req.body?.battleSlug || '').trim();
  const criterion = String(req.body?.criterion || '').trim();
  const rating = Number(req.body?.rating);
  const accountId = String(req.body?.accountId || '').trim();

  if (!battleSlug || !allowedCriteria.has(criterion) || !Number.isInteger(rating) || rating < 1 || rating > 10) {
    return res.status(400).json({ error: 'Invalid vote payload' });
  }

  const identity = accountId ? `account:${stableHash(accountId)}` : `ip:${stableHash(getIp(req))}`;
  const dedupeKey = `calibre:vote:${battleSlug}:${criterion}:${identity}`;
  const tallyKey = `calibre:tally:${battleSlug}:${criterion}:${rating}`;
  const redisConfigured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

  try {
    if (redisConfigured) {
      const lock = await upstash(['set', dedupeKey, String(rating), 'nx', 'ex', '31536000']);
      if (!lock?.result) return res.status(200).json({ accepted: false, criterion, reason: 'duplicate' });
      await upstash(['incr', tallyKey]);
      return res.status(201).json({ accepted: true, criterion, rating, guard: accountId ? 'account' : 'ip', persistence: 'upstash' });
    }

    if (memoryVotes.has(dedupeKey)) return res.status(200).json({ accepted: false, criterion, reason: 'duplicate' });
    memoryVotes.add(dedupeKey);
    return res.status(201).json({ accepted: true, criterion, rating, guard: accountId ? 'account' : 'ip', persistence: 'server-memory-demo' });
  } catch (error) {
    return res.status(500).json({ error: 'Vote could not be recorded', message: error instanceof Error ? error.message : String(error) });
  }
}
