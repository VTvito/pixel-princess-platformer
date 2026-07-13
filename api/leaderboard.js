// api/leaderboard.js — Vercel serverless endpoint for the GLOBAL time-attack leaderboard.
//
// A tiny, dependency-free function (CommonJS so it runs whether or not a package.json ships;
// global `fetch` is built in on Vercel's Node runtime). It talks to a Redis store provisioned
// through the Vercel Marketplace (Upstash Redis — the successor to the retired "Vercel KV";
// works on the free Hobby plan) over its REST API.
//
// Time-attack model — rank by the FASTEST net play time to finish the six levels; the run's
// score rides along as a secondary stat. Every SUBMITTED RUN IS ITS OWN ROW: the board is a
// history, not a per-player best. (It used to key the sorted set by the bare nickname with
// `ZADD LT`, so a second run under the same name silently REPLACED the first and the old
// record vanished — the whole point of this rewrite.)
//   • a counter     KEY_SEQ   (pj:lb:seq)   an INCR per submission → a unique run id.
//   • a sorted set  KEY_TIME  (pj:lb:time)  member = "<id>:<nickname>", score = net time in ms →
//     read back ascending (ZRANGE) so the quickest run is #1. The id makes the member unique,
//     so the same nickname can legitimately appear many times.
//   • a hash        KEY_SCORE (pj:lb:score) field = that same member, value = the run's score.
//
// Because rows now accumulate, the board is PAGED and TRIMMED:
//   GET  /api/leaderboard?offset=0&limit=10  -> { rows: [{id, name, time, score}, ...], total, offset, limit }
//        (no query string → the first 10, fastest first)
//   POST /api/leaderboard {nickname, score, timeMs}
//        -> { ok: true, id, rank, total, rows, offset, limit }   (rows = the page CONTAINING the
//           new record, so the client can open straight on it instead of always showing the top)
// Only the MAX_ROWS fastest runs are kept (ZREMRANGEBYRANK), and the dropped members' score
// fields are HDEL'd first so the hash never accumulates orphans.
//
// Legacy rows: the pre-rewrite entries are bare nicknames with no "<id>:" prefix. parseMember()
// handles both shapes, so the existing board keeps rendering instead of being wiped.
//
// Moderation — because rows accumulate and nicknames are player-supplied, there has to be a way to
// take one down (an offensive name, a bogus time, a test row):
//   DELETE /api/leaderboard {id} | {member}   header: x-admin-token: <ADMIN_TOKEN>
//        -> { ok: true, removed, ...page }
// It FAILS CLOSED: with no ADMIN_TOKEN env var set, the endpoint answers 404 as if it didn't exist,
// so an unconfigured deploy can't be scraped for a delete route. The compare is timing-safe.
//
// Provision the store in the Vercel dashboard (Storage -> Marketplace -> Redis) and link it to
// this project; it injects the credentials as env vars. We read either the Upstash-native names
// or the legacy KV ones so it keeps working across integration versions. Without them the
// endpoint replies 503 and the client silently hides the leaderboard (the game still plays).

const KEY_TIME = "pj:lb:time"; // sorted set: "<id>:<nickname>" -> that run's net time (ms), ascending
const KEY_SCORE = "pj:lb:score"; // hash: same member -> that run's score
const KEY_SEQ = "pj:lb:seq"; // counter: hands out a unique id per submitted run
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

const ADMIN_TOKEN = process.env.LB_ADMIN_TOKEN || ""; // unset → DELETE doesn't exist (fails closed)

const MAX_TIME_MS = 24 * 60 * 60 * 1000; // 24h upper bound — reject nonsense / overflow times
const MAX_ROWS = 200; // how many runs the board remembers (the rest is trimmed away)
const DEFAULT_LIMIT = 10; // one page
const MAX_LIMIT = 50; // cap a caller-supplied page size

// Constant-time secret compare — a plain `===` leaks the token's prefix through response timing.
const { timingSafeEqual } = require("node:crypto");
function tokenOk(given) {
  if (!ADMIN_TOKEN || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(ADMIN_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

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

// Split a sorted-set member back into {id, name}. New members are "<id>:<nickname>"; the ":" is a
// safe separator because cleanNick() below never lets one into a nickname. A member WITHOUT a ":"
// is a legacy (pre-history) row — the whole thing is the nickname and it has no id.
function parseMember(member) {
  const cut = String(member).indexOf(":");
  if (cut < 0) return { id: null, name: String(member) };
  return { id: Number(member.slice(0, cut)) || null, name: member.slice(cut + 1) };
}

// One page of the board, fastest first, plus the total row count so the client can page.
// ZRANGE (ascending) returns a flat [member, time, member, time, ...]; a single HMGET then fetches
// every score in one round-trip. `rank` is GLOBAL (offset-based), so page 3 shows 21…30, not 1…10.
async function page(offset, limit) {
  const total = Number(await redis(["ZCARD", KEY_TIME])) || 0;
  const flat = (await redis(["ZRANGE", KEY_TIME, String(offset), String(offset + limit - 1), "WITHSCORES"])) || [];
  const members = [];
  const times = [];
  for (let i = 0; i < flat.length; i += 2) {
    members.push(flat[i]);
    times.push(Number(flat[i + 1]) || 0);
  }
  // HMGET errors on an empty field list, so only ask when there's at least one member.
  const scores = members.length ? (await redis(["HMGET", KEY_SCORE, ...members])) || [] : [];
  const rows = members.map((member, i) => {
    const { id, name } = parseMember(member);
    return { id, name, time: times[i], score: Number(scores[i]) || 0, rank: offset + i + 1 };
  });
  return { rows, total, offset, limit };
}

// Sanitise a player nickname. A Unicode whitelist (letters/digits/space + a little
// punctuation) keeps real names from every language while dropping control chars and emoji —
// and needs no literal control bytes in this source file. Note it also drops ":", which is what
// makes it safe as the id separator in a sorted-set member. Then collapse whitespace + cap length.
function cleanNick(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[^\p{L}\p{N} _.'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
}

// Read + clamp the paging query. Anything malformed falls back to the first page.
function readPaging(req) {
  const q = (req.query || {});
  const rawOffset = parseInt(q.offset, 10);
  const rawLimit = parseInt(q.limit, 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(MAX_LIMIT, Math.max(1, rawLimit)) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;
  return { offset, limit };
}

// Drop everything past the MAX_ROWS fastest runs. The hash fields go FIRST (we still need the
// member names to HDEL them) — otherwise the score hash would grow forever with orphan fields.
async function trim() {
  const dropped = (await redis(["ZRANGE", KEY_TIME, String(MAX_ROWS), "-1"])) || [];
  if (!dropped.length) return;
  await redis(["HDEL", KEY_SCORE, ...dropped]);
  await redis(["ZREMRANGEBYRANK", KEY_TIME, String(MAX_ROWS), "-1"]);
}

module.exports = async (req, res) => {
  if (!REST_URL || !REST_TOKEN) {
    res.status(503).json({ error: "leaderboard non configurata" });
    return;
  }
  try {
    if (req.method === "GET") {
      const { offset, limit } = readPaging(req);
      res.status(200).json(await page(offset, limit));
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

      // A fresh id per submission makes the member unique, so this run is ADDED to the history
      // instead of replacing the player's previous one. Plain ZADD — no LT/CH, nothing to merge.
      const id = Number(await redis(["INCR", KEY_SEQ]));
      const member = `${id}:${name}`;
      await redis(["ZADD", KEY_TIME, String(timeMs), member]);
      await redis(["HSET", KEY_SCORE, member, String(score)]);
      await trim();

      // Answer with the page that CONTAINS this run, so the client can land the player on her own
      // row rather than on the top 10. A run trimmed away (slower than all MAX_ROWS kept) has no
      // rank — fall back to the first page.
      const { limit } = readPaging(req);
      const rankIdx = await redis(["ZRANK", KEY_TIME, member]); // 0-based, or null if trimmed off
      const idx = Number.isFinite(Number(rankIdx)) && rankIdx !== null ? Number(rankIdx) : null;
      const offset = idx === null ? 0 : Math.floor(idx / limit) * limit;
      const body2 = await page(offset, limit);
      res.status(200).json({ ok: true, id, rank: idx === null ? null : idx + 1, ...body2 });
      return;
    }
    if (req.method === "DELETE") {
      // Fail closed: an unconfigured deploy must look like it has no delete route at all.
      if (!ADMIN_TOKEN || !tokenOk(req.headers["x-admin-token"])) {
        res.status(404).json({ error: "non trovato" });
        return;
      }
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }
      body = body || {};

      // Address a row either by its run id (what the board shows) or by the exact member string —
      // the latter is the only way to reach a LEGACY row, which has no id.
      let member = typeof body.member === "string" ? body.member : "";
      if (!member && body.id != null) {
        const id = Math.floor(Number(body.id));
        if (!Number.isFinite(id)) {
          res.status(400).json({ error: "id non valido" });
          return;
        }
        const all = (await redis(["ZRANGE", KEY_TIME, "0", "-1"])) || [];
        member = all.find((m) => parseMember(m).id === id) || "";
      }
      if (!member) {
        res.status(404).json({ error: "riga non trovata" });
        return;
      }
      const removed = Number(await redis(["ZREM", KEY_TIME, member])) || 0;
      await redis(["HDEL", KEY_SCORE, member]); // never leave an orphan score behind
      res.status(200).json({ ok: true, removed, ...(await page(0, DEFAULT_LIMIT)) });
      return;
    }
    res.status(405).json({ error: "metodo non consentito" });
  } catch {
    res.status(502).json({ error: "leaderboard non raggiungibile" });
  }
};
