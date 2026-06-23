// api/leaderboard.js — Vercel serverless endpoint for the GLOBAL leaderboard.
//
// A tiny, dependency-free function (CommonJS so it runs whether or not a package.json ships;
// global `fetch` is built in on Vercel's Node runtime). It talks to a Redis store provisioned
// through the Vercel Marketplace (Upstash Redis — the successor to the retired "Vercel KV";
// works on the free Hobby plan) over its REST API: a single sorted set holds the best score
// per nickname, and the top 10 are read back with ZREVRANGE.
//
//   GET  /api/leaderboard            -> { top: [{ name, score }, ...] }   (top 10, high -> low)
//   POST /api/leaderboard {nickname, score}  -> { ok: true, top: [...] }  (best-score, then top)
//
// Provision the store in the Vercel dashboard (Storage -> Marketplace -> Redis) and link it to
// this project; it injects the credentials as env vars. We read either the Upstash-native names
// or the legacy KV ones so it keeps working across integration versions. Without them the
// endpoint replies 503 and the client silently hides the leaderboard (the game still plays).

const KEY = "pj:leaderboard";
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

// Send one Redis command as a JSON array to the REST root (avoids URL-encoding the member).
async function redis(command) {
  const res = await fetch(REST_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

// ZREVRANGE returns a flat [member, score, member, score, ...]; fold it into objects.
async function top10() {
  const flat = (await redis(["ZREVRANGE", KEY, "0", "9", "WITHSCORES"])) || [];
  const out = [];
  for (let i = 0; i < flat.length; i += 2) {
    out.push({ name: flat[i], score: Number(flat[i + 1]) || 0 });
  }
  return out;
}

// Sanitise a player nickname. A Unicode whitelist (letters/digits/space + a little
// punctuation) keeps real names from every language while dropping control chars and emoji —
// and needs no literal control bytes in this source file. Then collapse whitespace + cap length.
function cleanNick(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[^\p{L}\p{N} _.'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
}

module.exports = async (req, res) => {
  if (!REST_URL || !REST_TOKEN) {
    res.status(503).json({ error: "leaderboard non configurata" });
    return;
  }
  try {
    if (req.method === "GET") {
      res.status(200).json({ top: await top10() });
      return;
    }
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }
      body = body || {};
      const name = cleanNick(body.nickname);
      const score = Math.floor(Number(body.score));
      if (!name) {
        res.status(400).json({ error: "nickname mancante" });
        return;
      }
      if (!Number.isFinite(score) || score < 0 || score > 1e7) {
        res.status(400).json({ error: "punteggio non valido" });
        return;
      }
      // Keep the best score per nickname: GT only raises an existing entry, but still adds a
      // brand-new one. (Same nickname from two players overwrites — acceptable for this scope.)
      await redis(["ZADD", KEY, "GT", String(score), name]);
      res.status(200).json({ ok: true, top: await top10() });
      return;
    }
    res.status(405).json({ error: "metodo non consentito" });
  } catch {
    res.status(502).json({ error: "leaderboard non raggiungibile" });
  }
};
