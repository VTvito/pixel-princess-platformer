// api/leaderboard.js — Vercel serverless endpoint for the GLOBAL time-attack leaderboard.
//
// A tiny, dependency-free function (CommonJS so it runs whether or not a package.json ships;
// global `fetch` is built in on Vercel's Node runtime). It talks to a Redis store provisioned
// through the Vercel Marketplace (Upstash Redis — the successor to the retired "Vercel KV";
// works on the free Hobby plan) over its REST API.
//
// Time-attack model — rank by the FASTEST net play time to finish the six levels; the run's
// score rides along as a secondary stat:
//   • a sorted set  KEY_TIME  (pj:lb:time)  member = nickname, score = net time in ms →
//     read back ascending (ZRANGE) so the quickest run is #1.
//   • a hash        KEY_SCORE (pj:lb:score) field  = nickname, value = the score of that
//     best-time run, so the standings can show the points alongside the time.
//   We keep each nickname's BEST (lowest) time via `ZADD LT` and only overwrite the stored score
//   when the time actually improved (the `CH` flag tells us whether it did).
//
//   GET  /api/leaderboard                      -> { top: [{ name, time, score }, ...] } (top 10, fast->slow)
//   POST /api/leaderboard {nickname, score, timeMs} -> { ok: true, top: [...] }        (best-time, then top)
//
// Note the fresh key namespace (pj:lb:*): the previous score-only leaderboard lived under
// "pj:leaderboard" and has no time field, so we start a clean board rather than mix the two.
//
// Provision the store in the Vercel dashboard (Storage -> Marketplace -> Redis) and link it to
// this project; it injects the credentials as env vars. We read either the Upstash-native names
// or the legacy KV ones so it keeps working across integration versions. Without them the
// endpoint replies 503 and the client silently hides the leaderboard (the game still plays).

const KEY_TIME = "pj:lb:time"; // sorted set: nickname -> best net time (ms), ranked ascending
const KEY_SCORE = "pj:lb:score"; // hash: nickname -> score of that best-time run
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

const MAX_TIME_MS = 24 * 60 * 60 * 1000; // 24h upper bound — reject nonsense / overflow times

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

// The top 10 fastest runs, each paired with the score it earned. ZRANGE (ascending) returns a
// flat [member, time, member, time, ...]; then one HMGET fetches every score in a single round-trip.
async function top10() {
  const flat = (await redis(["ZRANGE", KEY_TIME, "0", "9", "WITHSCORES"])) || [];
  const names = [];
  const times = [];
  for (let i = 0; i < flat.length; i += 2) {
    names.push(flat[i]);
    times.push(Number(flat[i + 1]) || 0);
  }
  // HMGET errors on an empty field list, so only ask when there's at least one name.
  const scores = names.length ? (await redis(["HMGET", KEY_SCORE, ...names])) || [] : [];
  return names.map((name, i) => ({ name, time: times[i], score: Number(scores[i]) || 0 }));
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
      const timeMs = Math.round(Number(body.timeMs));
      if (!name) {
        res.status(400).json({ error: "nickname mancante" });
        return;
      }
      if (!Number.isFinite(timeMs) || timeMs <= 0 || timeMs > MAX_TIME_MS) {
        res.status(400).json({ error: "tempo non valido" });
        return;
      }
      if (!Number.isFinite(score) || score < 0 || score > 1e7) {
        res.status(400).json({ error: "punteggio non valido" });
        return;
      }
      // Keep the best (fastest) time per nickname. LT only lowers an existing entry's time but
      // still inserts a brand-new one; CH makes ZADD report whether the entry changed (added or
      // improved). Only when it did do we overwrite the stored score, so the shown points always
      // belong to that best-time run. (Same nickname from two players competes for the fastest
      // time — acceptable for this scope.)
      const changed = await redis(["ZADD", KEY_TIME, "LT", "CH", String(timeMs), name]);
      if (changed) await redis(["HSET", KEY_SCORE, name, String(score)]);
      res.status(200).json({ ok: true, top: await top10() });
      return;
    }
    res.status(405).json({ error: "metodo non consentito" });
  } catch {
    res.status(502).json({ error: "leaderboard non raggiungibile" });
  }
};
