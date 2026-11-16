// Front Row: "imdb" Edge Function
// IMDb doesn't let web pages ask it things directly, so this small function on your own Supabase
// project asks for the app: posters and details for any IMDb title, including brand-new releases.
//   GET ?ping=1               -> { ok: true, version }
//   GET ?q=harry potter       -> IMDb's search suggestions (titles, years, posters)
//   GET ?q=tt33362861         -> the same for one IMDb id
//   GET ?title=tt33362861     -> details from the title page: poster, genres, runtime, plot, rating, people
//   GET ?jw=Severance&year=2022&type=tv&imdb=tt11280740&country=HU
//                             -> where to watch it in that country (JustWatch): streaming, free, rent and buy offers
//   GET ?yt=Severance 2022 official trailer -> YouTube video ids for an in-app trailer
// Deploy it with "Verify JWT" turned OFF so the app can call it with its public key.

const VERSION = 2;
const ALLOWED = ["https://btb993.github.io"];
const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};
const cache = new Map<string, { t: number; v: unknown }>();
const HOUR = 3600_000;

function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(o) || o.startsWith("http://localhost") ? o : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (b: unknown, h: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...h, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });

async function cached<T>(key: string, ms: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ms) return hit.v as T;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  return v;
}

async function suggest(q: string) {
  const key = q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!key) return { d: [] };
  return cached("s:" + key, 6 * HOUR, async () => {
    const r = await fetch(`https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(key)}.json?includeVideos=0`, { headers: UA });
    return r.ok ? await r.json() : { d: [] };
  });
}

const minutes = (iso?: string) => {
  const m = String(iso || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  return m ? (Number(m[1] || 0) * 60 + Number(m[2] || 0)) || null : null;
};
const decode = (s: string) => String(s || "").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const names = (x: unknown) => (Array.isArray(x) ? x : x ? [x] : []).map((p: { name?: string }) => decode(p?.name || "")).filter(Boolean);

async function title(id: string) {
  return cached("t:" + id, 12 * HOUR, async () => {
    const r = await fetch(`https://www.imdb.com/title/${id}/`, { headers: { ...UA, Accept: "text/html" } });
    if (!r.ok) return { id, error: "imdb " + r.status };
    const h = await r.text();
    const og = (h.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || "";
    let ld: Record<string, any> = {};
    try { ld = JSON.parse((h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1] || "{}"); } catch { /* ignore */ }
    const type = ld["@type"] === "TVSeries" || ld["@type"] === "TVMiniSeries" ? "tv" : "movie";
    return {
      id,
      title: decode(ld.name || ""),
      type,
      poster: ld.image || og,
      genres: (Array.isArray(ld.genre) ? ld.genre : ld.genre ? [ld.genre] : []).map(decode),
      runtime: type === "movie" ? minutes(ld.duration) : null,
      epLength: type === "tv" ? minutes(ld.duration) : null,
      plot: decode(ld.description || ""),
      rating: ld.aggregateRating?.ratingValue ?? null,
      votes: ld.aggregateRating?.ratingCount ?? null,
      date: ld.datePublished || "",
      directors: names(ld.director),
      creators: names(ld.creator).filter((n) => !/^(Netflix|HBO|Apple|Amazon|Hulu|Disney)/.test(n)),
      actors: names(ld.actor).slice(0, 4),
    };
  });
}

const JW_QUERY = `query S($country: Country!, $language: Language!, $first: Int!, $filter: TitleFilter) {
  popularTitles(country: $country, first: $first, filter: $filter) { edges { node {
    objectType
    content(country: $country, language: $language) { title originalReleaseYear externalIds { imdbId } }
    offers(country: $country, platform: WEB) { monetizationType presentationType standardWebURL package { packageId clearName technicalName } }
  } } } }`;
async function justwatch(p: Record<string, string>) {
  const country = /^[A-Z]{2}$/.test(String(p.country || "")) ? p.country : "HU";
  const q = String(p.jw || "").slice(0, 100), year = Number(p.year) || 0, imdb = String(p.imdb || ""), type = p.type === "tv" ? "SHOW" : p.type === "movie" ? "MOVIE" : "";
  return cached(`jw:${country}:${imdb}:${q}:${year}:${type}`, 6 * HOUR, async () => {
    const r = await fetch("https://apis.justwatch.com/graphql", {
      method: "POST", headers: { ...UA, "Content-Type": "application/json" },
      body: JSON.stringify({ query: JW_QUERY, variables: { country, language: "en", first: 6, filter: { searchQuery: q, ...(type ? { objectTypes: [type] } : {}) } } }),
    });
    if (!r.ok) return { error: "justwatch " + r.status, offers: [] };
    const j = await r.json();
    const nodes = (j?.data?.popularTitles?.edges || []).map((e: any) => e.node);
    const norm = (s: string) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
    const node = (imdb && nodes.find((n: any) => n.content?.externalIds?.imdbId === imdb))
      || nodes.find((n: any) => norm(n.content?.title) === norm(q) && (!year || Math.abs((n.content?.originalReleaseYear || 0) - year) <= 1))
      || (imdb ? null : nodes[0]);
    if (!node) return { country, offers: [] };
    const seen = new Set<string>(), offers: unknown[] = [];
    for (const o of node.offers || []) {
      const key = o.package?.packageId + ":" + o.monetizationType;
      if (seen.has(key)) continue; seen.add(key);
      offers.push({ p: o.package?.clearName || "", id: o.package?.packageId, tech: o.package?.technicalName || "", t: o.monetizationType, url: o.standardWebURL || "" });
    }
    return { country, title: node.content?.title, year: node.content?.originalReleaseYear, offers };
  });
}
async function youtube(q: string) {
  const key = q.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120);
  if (!key) return { ids: [] };
  return cached("yt:" + key, 24 * HOUR, async () => {
    const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(key)}&hl=en`, { headers: { ...UA, Cookie: "SOCS=CAI; CONSENT=YES+1" } });
    if (!r.ok) return { ids: [] };
    const h = await r.text(), ids: string[] = [];
    for (const m of h.matchAll(/"videoRenderer":\{"videoId":"([\w-]{11})"/g)) { if (!ids.includes(m[1])) ids.push(m[1]); if (ids.length >= 4) break; }
    if (!ids.length) for (const m of h.matchAll(/"videoId":"([\w-]{11})"/g)) { if (!ids.includes(m[1])) ids.push(m[1]); if (ids.length >= 4) break; }
    return { ids };
  });
}

Deno.serve(async (req) => {
  const h = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  try {
    const u = new URL(req.url);
    let p: Record<string, any> = Object.fromEntries(u.searchParams);
    if (req.method === "POST") p = { ...p, ...(await req.json().catch(() => ({}))) };
    if (p.ping) return json({ ok: true, version: VERSION }, h);
    if (p.q) return json(await suggest(String(p.q)), h);
    if (p.title && /^tt\d{5,}$/.test(p.title)) return json(await title(p.title), h);
    if (p.jw) return json(await justwatch(p), h);
    if (p.yt) return json(await youtube(String(p.yt)), h);
    return json({ error: "Ask with ?q=…, ?title=tt…, ?jw=… or ?yt=…" }, h, 400);
  } catch (e) {
    return json({ error: String(e) }, h, 500);
  }
});
