// Builds the ready-made lists for Front Row: data/lists.json (which titles are on which list) and data/pool.json
// (the titles themselves: poster, year, genres, people, IMDb rating). The app reads these first, so Discover,
// the Seen-it blitz and "Recommended for you" open instantly instead of asking Wikidata live.
// Run by .github/workflows/lists.yml every week, or by hand: node tools/build-lists.mjs
// Wikidata is asked a handful of simple, fast questions (big pools of well-known titles); the sorting into genres,
// decades, countries and networks happens here.
import fs from "node:fs";

const UA = "FrontRowListBuilder/1.1 (https://github.com/btb993/front-row-)";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NOW = new Date().getFullYear();
const FILM = "wd:Q11424 wd:Q202866", TV = "wd:Q5398426 wd:Q1259759 wd:Q581714 wd:Q63952888";

async function get(url, opt = {}){
  for (let a = 0; a < 5; a++) {
    try {
      const r = await fetch(url, { ...opt, headers: { "User-Agent": UA, ...(opt.headers || {}) } });
      if (r.status === 429 || r.status >= 500) throw new Error("HTTP " + r.status);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) { if (a === 4) throw e; await sleep(4000 * (a + 1)); }
  }
}
const sparql = q => get("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: { Accept: "application/sparql-results+json" } })
  .then(j => j.results.bindings.map(b => ({ q: String(b.item?.value || "").split("/").pop(), n: Number(b.n?.value || 0), y: b.y ? Number(String(b.y.value).slice(0, 4)) : 0 })).filter(x => /^Q\d+$/.test(x.q)));
async function entities(ids, props){
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const u = "https://www.wikidata.org/w/api.php?" + new URLSearchParams({ action: "wbgetentities", format: "json", ids: ids.slice(i, i + 50).join("|"), props, languages: "en|mul", sitefilter: "enwiki" });
    try { Object.assign(out, (await get(u)).entities || {}); } catch (e) { console.warn("entities", e.message); }
    if (i % 2500 === 0) console.log(`  entities ${i}/${ids.length}`);
    await sleep(80);
  }
  return out;
}
async function posters(titles){
  const out = {};
  for (let i = 0; i < titles.length; i += 50) {
    const u = "https://en.wikipedia.org/w/api.php?" + new URLSearchParams({ action: "query", format: "json", titles: titles.slice(i, i + 50).join("|"), prop: "pageimages", piprop: "thumbnail", pithumbsize: "400", pilicense: "any", pilimit: "50", redirects: "1" });
    try {
      const j = await get(u), back = {};
      for (const x of [...(j.query?.normalized || []), ...(j.query?.redirects || [])]) back[x.to] = back[x.from] || x.from;
      for (const pg of Object.values(j.query?.pages || {})) if (pg.thumbnail?.source) out[back[pg.title] || pg.title] = pg.thumbnail.source;
    } catch (e) { console.warn("posters", e.message); }
    await sleep(80);
  }
  return out;
}
async function ratings(ids){
  const out = {};
  for (let i = 0; i < ids.length; i += 100) {
    const u = new URL("https://api.agregarr.org/api/ratings"); ids.slice(i, i + 100).forEach(id => u.searchParams.append("id", id));
    try { const j = await get(u.toString()); (Array.isArray(j) ? j : []).forEach(x => { if (x?.imdbId && x.rating) out[x.imdbId] = { r: x.rating, v: x.votes || 0 }; }); } catch (e) { console.warn("ratings", e.message); }
    await sleep(120);
  }
  return out;
}
const claims = (e, p) => (e?.claims?.[p] || []).filter(c => c.rank !== "deprecated");
const ids = (e, p) => { const cs = claims(e, p), pref = cs.filter(c => c.rank === "preferred"); return (pref.length && p !== "P161" && p !== "P136" ? pref : cs).map(c => c.mainsnak?.datavalue?.value?.id).filter(Boolean); };
const strs = (e, p) => claims(e, p).map(c => c.mainsnak?.datavalue?.value).filter(v => typeof v === "string");
const label = e => e?.labels?.en?.value || e?.labels?.mul?.value || "";
const years = (e, p) => claims(e, p).map(c => +String(c.mainsnak?.datavalue?.value?.time || "").slice(1, 5)).filter(Boolean);
const minutes = e => { for (const c of claims(e, "P2047")) { const v = c.mainsnak?.datavalue?.value; if (!v?.amount) continue; let n = Math.abs(parseFloat(v.amount)); if (/Q11574$/.test(v.unit)) n /= 60; else if (/Q25235$/.test(v.unit)) n *= 60; if (n > 0) return Math.round(n); } return 0; };
const count = (e, p) => { let m = 0; for (const c of claims(e, p)) { const n = parseFloat(c.mainsnak?.datavalue?.value?.amount); if (n > m) m = n; } return Math.round(m); };
const cleanGenre = l => { const s = String(l || "").replace(/\b(feature |television |tv |web |streaming )?(film|movie|series|program(?:me)?|television|show)s?\b/gi, "").replace(/\s{2,}/g, " ").replace(/^[\s-]+|[\s-]+$/g, "").trim(); return !s || /^category:/i.test(s) ? "" : s[0].toUpperCase() + s.slice(1); };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

// ---------- 1) pools of well-known titles ----------
const pool = new Map(); // qid -> { type, n }
const addPool = (rows, type) => rows.forEach(r => { const p = pool.get(r.q); if (!p || r.n > p.n) pool.set(r.q, { type, n: r.n }); });
const step = async (name, q, type, cap = 0) => { try { let rows = await sparql(q); if (cap) rows = rows.sort((a, b) => b.n - a.n).slice(0, cap); addPool(rows, type); console.log(`${name}: ${rows.length}`); return rows; } catch (e) { console.warn(`${name} failed: ${e.message}`); return []; } finally { await sleep(1500); } };
await step("films", `SELECT ?item ?n WHERE { VALUES ?t { ${FILM} } ?item wdt:P31 ?t; wikibase:sitelinks ?n. FILTER(?n >= 18) }`, "movie");
await step("series", `SELECT ?item ?n WHERE { VALUES ?t { ${TV} } ?item wdt:P31 ?t; wikibase:sitelinks ?n. FILTER(?n >= 10) }`, "tv");
await step("new films", `SELECT ?item ?n WHERE { ?item wdt:P31 wd:Q11424; wdt:P577 ?d; wikibase:sitelinks ?n. FILTER(?d >= "${NOW - 2}-01-01T00:00:00Z"^^xsd:dateTime && ?d <= "${NOW}-12-31T00:00:00Z"^^xsd:dateTime && ?n >= 10) }`, "movie");
await step("new series", `SELECT ?item ?n WHERE { ?item wdt:P31 wd:Q5398426; wdt:P580 ?d; wikibase:sitelinks ?n. FILTER(?d >= "${NOW - 2}-01-01T00:00:00Z"^^xsd:dateTime && ?d <= "${NOW}-12-31T00:00:00Z"^^xsd:dateTime && ?n >= 5) }`, "tv");
const COUNTRIES = [["Q28", "Hungarian"], ["Q403", "Serbian"], ["Q224", "Croatian"], ["Q884", "Korean"], ["Q17", "Japanese"], ["Q142", "French"], ["Q183", "German"], ["Q38", "Italian"], ["Q29", "Spanish"], ["Q145", "British"], ["Q668", "Indian"], ["Q96", "Mexican"], ["Q155", "Brazilian"], ["Q20", "Norwegian"], ["Q34", "Swedish"], ["Q35", "Danish"], ["Q43", "Turkish"], ["Q36", "Polish"], ["Q213", "Czech"], ["Q148", "Chinese"], ["Q414", "Argentine"], ["Q55", "Dutch"], ["Q33", "Finnish"], ["Q27", "Irish"], ["Q408", "Australian"]];
const countryRows = {};
for (const [c, n] of COUNTRIES) {
  countryRows["m" + c] = await step(`${n} films`, `SELECT ?item ?n WHERE { ?item wdt:P495 wd:${c}; wdt:P31 wd:Q11424; wikibase:sitelinks ?n. FILTER(?n >= 5) }`, "movie", 300);
  countryRows["t" + c] = await step(`${n} series`, `SELECT ?item ?n WHERE { ?item wdt:P495 wd:${c}; wdt:P31 wd:Q5398426; wikibase:sitelinks ?n. FILTER(?n >= 3) }`, "tv", 200);
}
const NETWORKS = [["Netflix", ["Netflix"]], ["HBO", ["HBO", "HBO Max", "Max"]], ["Apple TV+", ["Apple TV+"]], ["Prime Video", ["Amazon Prime Video", "Prime Video"]], ["Disney+", ["Disney+"]], ["Hulu", ["Hulu"]], ["BBC", ["BBC One", "BBC Two", "BBC Three", "BBC iPlayer"]], ["AMC", ["AMC"]], ["FX", ["FX", "FX on Hulu"]], ["Showtime", ["Showtime"]], ["Paramount+", ["Paramount+"]], ["Channel 4", ["Channel 4"]], ["Adult Swim", ["Adult Swim"]], ["Peacock", ["Peacock"]]];
const netRows = {};
for (const [n, labels] of NETWORKS) netRows[n] = await step(`${n} series`, `SELECT ?item ?n WHERE { VALUES ?bl { ${labels.map(l => `"${l}"@en`).join(" ")} } ?br rdfs:label ?bl. ?item wdt:P449 ?br; wdt:P31 ?t; wikibase:sitelinks ?n. VALUES ?t { ${TV} } FILTER(?n >= 3) }`, "tv");
const STUDIOS = [["Pixar", "Pixar"], ["Studio Ghibli", "Studio Ghibli"], ["Walt Disney Animation", "Walt Disney Animation Studios"], ["DreamWorks Animation", "DreamWorks Animation"], ["Marvel Studios", "Marvel Studios"], ["A24", "A24"], ["Blumhouse", "Blumhouse Productions"], ["Lucasfilm", "Lucasfilm"], ["Aardman", "Aardman Animations"], ["Searchlight", "Searchlight Pictures"], ["Neon", "Neon"], ["Laika", "Laika"]];
const studioRows = {};
for (const [n, l] of STUDIOS) studioRows[n] = await step(`${n} films`, `SELECT ?item ?n WHERE { ?co rdfs:label "${l}"@en. { ?item wdt:P272 ?co } UNION { ?item wdt:P750 ?co } ?item wdt:P31 ?t; wikibase:sitelinks ?n. VALUES ?t { ${FILM} } }`, "movie");
const AWARDS = [["Oscar winners: Best Picture", "Academy Award for Best Picture", "movie"], ["Oscar winners: Animated Feature", "Academy Award for Best Animated Feature", "movie"], ["Oscar winners: International Feature", "Academy Award for Best International Feature Film", "movie"], ["Palme d'Or winners", "Palme d'Or", "movie"], ["Golden Lion winners", "Golden Lion", "movie"], ["Golden Bear winners", "Golden Bear", "movie"], ["Emmy winners: Drama Series", "Primetime Emmy Award for Outstanding Drama Series", "tv"], ["Emmy winners: Comedy Series", "Primetime Emmy Award for Outstanding Comedy Series", "tv"], ["Emmy winners: Limited Series", "Primetime Emmy Award for Outstanding Limited or Anthology Series", "tv"]];
const awardRows = {};
for (const [n, l, type] of AWARDS) awardRows[n] = await step(n, `SELECT ?item ?n (MIN(YEAR(?d)) AS ?y) WHERE { ?aw rdfs:label "${l}"@en. ?item p:P166/ps:P166 ?aw; wikibase:sitelinks ?n. OPTIONAL { ?item wdt:${type === "tv" ? "P580" : "P577"} ?d } } GROUP BY ?item ?n`, type);
console.log(`pool: ${pool.size}`);

// ---------- 2) details (in batches; only the compact fields are kept) ----------
const items = {}, raw = {}, refs = new Set();
const qids = [...pool.keys()];
for (let i = 0; i < qids.length; i += 50) {
  const batch = qids.slice(i, i + 50);
  const u = "https://www.wikidata.org/w/api.php?" + new URLSearchParams({ action: "wbgetentities", format: "json", ids: batch.join("|"), props: "labels|claims|sitelinks", languages: "en|mul", sitefilter: "enwiki" });
  let ents = {};
  try { ents = (await get(u)).entities || {}; } catch (e) { console.warn("entities", e.message); }
  for (const q of batch) {
    const e = ents[q]; if (!e || e.missing !== undefined) continue;
    const { type, n } = pool.get(q), tv = type === "tv", imdb = strs(e, "P345").find(x => /^tt\d+$/.test(x)) || "";
    const ys = tv ? (years(e, "P580").length ? years(e, "P580") : years(e, "P577")) : years(e, "P577"), ends = years(e, "P582");
    let cr = ids(e, tv ? "P170" : "P57"); if (!cr.length) cr = ids(e, tv ? "P57" : "P170");
    if (ids(e, "P31").some(c => c === "Q5" || c === "Q16334295" || c === "Q43229")) continue;   // people, groups, organisations (from award lists)
    if (!ys.length && !imdb) continue;
    const t = label(e) || e.sitelinks?.enwiki?.title || ""; if (!t) continue;
    raw[q] = { g: ids(e, "P136").slice(0, 6), cr: cr.slice(0, 2), co: ids(e, "P495").slice(0, 1) };
    [...raw[q].g, ...raw[q].cr, ...raw[q].co].forEach(x => refs.add(x));
    items[q] = { q, t, ty: tv ? "t" : "m", y: ys.length ? Math.min(...ys) : 0, n, w: e.sitelinks?.enwiki?.title || "", i: imdb, castIds: ids(e, "P161").slice(0, 3),
      rt: tv ? 0 : minutes(e), el: tv ? minutes(e) : 0, s: tv ? count(e, "P2437") : 0, e: tv ? count(e, "P1113") : 0, ey: tv && ends.length ? Math.max(...ends) : 0 };
  }
  if (i % 2500 === 0) console.log(`  details ${i}/${qids.length}`);
  await sleep(60);
}
console.log(`labels: ${refs.size}`);
const labs = await entities([...refs], "labels");
const L2 = id => { const s = label(labs[id]); return /^Category:/.test(s) ? "" : s; };
for (const [q, r] of Object.entries(raw)) {
  const it = items[q];
  it.g = [...new Set(r.g.map(L2).map(cleanGenre).filter(Boolean))].slice(0, 4);
  it.c = r.cr.map(L2).filter(Boolean).join(", ");
  it.co = L2(r.co[0]) || "";
}
const rate = await ratings(Object.values(items).map(x => x.i).filter(Boolean));
for (const x of Object.values(items)) { x.r = rate[x.i]?.r || 0; x.v = rate[x.i]?.v || 0; }
console.log(`items: ${Object.keys(items).length}, rated: ${Object.keys(rate).length}`);

// ---------- 3) the lists ----------
const lists = [];
const byN = (a, b) => b.n - a.n || b.v - a.v;
const of = (ty, f) => Object.values(items).filter(x => x.ty === ty && f(x));
const put = (group, key, title, type, arr, max = 100) => { const idsL = [...new Set(arr.map(x => x.q))].slice(0, max); if (idsL.length >= 6) lists.push({ group, key, title, type, ids: idsL }); };
const fromRows = rows => (rows || []).map(r => items[r.q]).filter(Boolean);
put("Popular", "m-popular", "Most popular films", "movie", of("m", () => true).sort(byN), 150);
put("Popular", "m-new", `New films (${NOW - 2}–${NOW})`, "movie", of("m", x => x.y >= NOW - 2).sort(byN));
put("Popular", "t-popular", "Most popular series", "tv", of("t", () => true).sort(byN), 150);
put("Popular", "t-new", `New series (${NOW - 2}–${NOW})`, "tv", of("t", x => x.y >= NOW - 2).sort(byN));
put("Top rated", "m-top", "Top rated films (IMDb)", "movie", of("m", x => x.v >= 60000).sort((a, b) => b.r - a.r || b.v - a.v), 150);
put("Top rated", "t-top", "Top rated series (IMDb)", "tv", of("t", x => x.v >= 20000).sort((a, b) => b.r - a.r || b.v - a.v), 150);
put("Top rated", "m-gems", "Hidden gem films", "movie", of("m", x => x.v >= 4000 && x.v < 60000 && x.r >= 7.4).sort((a, b) => b.r - a.r));
put("Top rated", "t-gems", "Hidden gem series", "tv", of("t", x => x.v >= 1500 && x.v < 20000 && x.r >= 7.8).sort((a, b) => b.r - a.r));
put("Top rated", "m-crowd", "Crowd pleasers (most voted on IMDb)", "movie", of("m", x => x.v > 0).sort((a, b) => b.v - a.v));
const DEC = [[1950, "1950s"], [1960, "1960s"], [1970, "1970s"], [1980, "1980s"], [1990, "1990s"], [2000, "2000s"], [2010, "2010s"], [2020, "2020s"]];
for (const [d, nm] of DEC) {
  put("Decades", `m-${d}`, `Films of the ${nm}`, "movie", of("m", x => x.y >= d && x.y <= d + 9).sort(byN));
  put("Top rated", `m-top-${d}`, `Best films of the ${nm}`, "movie", of("m", x => x.y >= d && x.y <= d + 9 && x.v >= 15000).sort((a, b) => b.r - a.r));
  if (d >= 1980) put("Decades", `t-${d}`, `Series of the ${nm}`, "tv", of("t", x => x.y >= d && x.y <= d + 9).sort(byN));
  if (d >= 1990) put("Top rated", `t-top-${d}`, `Best series of the ${nm}`, "tv", of("t", x => x.y >= d && x.y <= d + 9 && x.v >= 8000).sort((a, b) => b.r - a.r));
}
put("Decades", "m-classics", "Classics before 1950", "movie", of("m", x => x.y && x.y < 1950).sort(byN));
const G = (x, re) => x.g.some(g => re.test(g));
const MG = [["Drama", /drama/i], ["Comedy", /comedy/i], ["Thriller", /thriller/i], ["Horror", /horror|slasher/i], ["Sci-fi", /science fiction|sci-fi|cyberpunk|space opera/i], ["Action", /action|martial/i], ["Romance", /romance|romantic/i], ["Animation", /animat|anime/i], ["Crime", /crime|gangster|heist|neo-noir/i], ["Fantasy", /fantasy/i], ["Mystery", /mystery|detective|whodunit/i], ["Adventure", /adventure/i], ["Documentary", /documentary/i], ["War", /war film|war drama|war\b/i], ["Musical", /musical/i], ["Western", /western/i], ["Superhero", /superhero/i], ["Christmas", /christmas/i], ["LGBTQ+", /LGBT|lesbian|gay|queer/i], ["Family", /family|children/i], ["Biopic", /biograph/i], ["Sports", /sport/i], ["Disaster", /disaster/i], ["Coming of age", /coming-of-age|teen/i], ["Psychological", /psychological/i], ["Satire", /satir|black comedy|parody/i]];
for (const [g, re] of MG) put("Genres", `m-g-${slug(g)}`, `${g} films`, "movie", of("m", x => G(x, re)).sort(byN));
const TG = [["Drama", /drama/i], ["Comedy", /comedy|sitcom/i], ["Crime", /crime|police|detective/i], ["Sci-fi", /science fiction/i], ["Fantasy", /fantasy/i], ["Thriller", /thriller/i], ["Horror", /horror/i], ["Mystery", /mystery/i], ["Animated", /animat/i], ["Anime", /anime/i], ["Documentary", /documentary/i], ["Romance", /romance|romantic/i], ["Teen", /teen/i], ["Reality", /reality/i], ["LGBTQ+", /LGBT|lesbian|gay|queer/i], ["Historical", /historical|period/i], ["Medical", /medical/i], ["Legal", /legal/i], ["Superhero", /superhero/i]];
for (const [g, re] of TG) put("Genres", `t-g-${slug(g)}`, `${g} series`, "tv", of("t", x => G(x, re)).sort(byN));
put("Genres", "t-mini", "Miniseries", "tv", of("t", x => G(x, /miniseries|limited/i) || (x.s === 1 && x.ey && x.ey === x.y)).sort(byN));
for (const [c, nm] of COUNTRIES) {
  put("World cinema", `m-c-${c}`, `${nm} films`, "movie", fromRows(countryRows["m" + c]).sort(byN));
  put("World TV", `t-c-${c}`, `${nm} series`, "tv", fromRows(countryRows["t" + c]).sort(byN));
}
for (const [nm] of NETWORKS) put("Networks", `t-n-${slug(nm)}`, `${nm} series`, "tv", fromRows(netRows[nm]).sort(byN));
// years, directors, creators, actors, quick picks
for (let y = NOW; y >= NOW - 14; y--) {
  put("Years", `m-y-${y}`, `Best films of ${y}`, "movie", of("m", x => x.y === y).sort((a, b) => (b.v >= 3000) - (a.v >= 3000) || b.r - a.r || b.n - a.n), 60);
  put("Years", `t-y-${y}`, `Series that started in ${y}`, "tv", of("t", x => x.y === y).sort(byN), 60);
}
const top = (ty, key, max) => { const c = {}; of(ty, x => x.v >= 5000).forEach(x => String(x[key] || "").split(", ").filter(Boolean).forEach(p => { c[p] = (c[p] || 0) + 1 + x.n / 200; })); return Object.entries(c).filter(([, v]) => v >= 5).sort((a, b) => b[1] - a[1]).slice(0, max).map(x => x[0]); };
for (const d of top("m", "c", 60)) put("Directors", `m-d-${slug(d)}`, d, "movie", of("m", x => String(x.c).split(", ").includes(d)).sort((a, b) => b.y - a.y), 60);
for (const d of top("t", "c", 25)) put("Creators", `t-d-${slug(d)}`, d, "tv", of("t", x => String(x.c).split(", ").includes(d)).sort((a, b) => b.y - a.y), 60);
const actC = {}; of("m", x => x.v >= 5000).forEach(x => x.castIds.forEach(p => { actC[p] = (actC[p] || 0) + 1 + x.n / 200; }));
const topActors = Object.entries(actC).filter(([, v]) => v >= 6).sort((a, b) => b[1] - a[1]).slice(0, 60).map(x => x[0]);
put("Quick picks", "m-short", "Under 95 minutes", "movie", of("m", x => x.rt && x.rt <= 95 && x.r >= 6.8).sort(byN));
put("Quick picks", "m-epic", "Epics (2h45 and longer)", "movie", of("m", x => x.rt >= 165).sort(byN));
put("Quick picks", "t-weekend", "Finish it in a weekend (10 episodes or less)", "tv", of("t", x => x.e && x.e <= 10 && x.r >= 7).sort(byN));
put("Quick picks", "t-done", "Finished series worth starting", "tv", of("t", x => x.ey && x.ey < NOW && x.r >= 7.8).sort(byN));
put("Quick picks", "t-long", "Long-running comfort shows (150+ episodes)", "tv", of("t", x => x.e >= 150).sort(byN));
put("Quick picks", "m-feelgood", "Feel-good comedies", "movie", of("m", x => G(x, /comedy/i) && !G(x, /horror|black comedy|crime|war/i) && x.r >= 7).sort(byN));
put("Quick picks", "m-mindbend", "Mind-benders", "movie", of("m", x => G(x, /psychological|science fiction|mystery|neo-noir/i) && x.r >= 7.5).sort(byN));
for (const [nm] of STUDIOS) put("Studios", `m-s-${slug(nm)}`, `${nm} films`, "movie", fromRows(studioRows[nm]).sort((a, b) => b.y - a.y));
for (const [nm, , type] of AWARDS) put("Awards", `${type === "tv" ? "t" : "m"}-a-${slug(nm)}`, nm, type, fromRows(awardRows[nm]).filter(x => x.ty === (type === "tv" ? "t" : "m")).sort((a, b) => b.y - a.y), 150);

// ---------- 4) keep what's on a list, add people and posters ----------
const plabsA = await entities(topActors, "labels");
for (const a of topActors) { const nm = label(plabsA[a]); if (nm) put("Actors", `m-a-${slug(nm)}`, nm, "movie", of("m", x => x.castIds.includes(a)).sort((x, y) => y.y - x.y), 60); }
const used = new Set(lists.flatMap(l => l.ids));
for (const q of Object.keys(items)) if (!used.has(q)) delete items[q];
const people = new Set(); Object.values(items).forEach(x => x.castIds.forEach(p => people.add(p)));
console.log(`cast labels: ${people.size}`);
const plabs = await entities([...people], "labels");
const pics = await posters([...new Set(Object.values(items).map(x => x.w).filter(Boolean))]);
// series: Wikipedia mostly has logos or title cards, so use TVmaze's posters (its full show index, matched by IMDb id)
const tvPics = {};
const wantTv = new Set(Object.values(items).filter(x => x.ty === "t" && x.i).map(x => x.i));
for (let page = 0; page < 600 && wantTv.size; page++) {
  let j = null;
  try { const r = await fetch(`https://api.tvmaze.com/shows?page=${page}`, { headers: { "User-Agent": UA } }); if (r.status === 404) break; if (r.status === 429) { await sleep(5000); page--; continue; } j = r.ok ? await r.json() : null; } catch {}
  for (const sh of j || []) { const i = sh.externals?.imdb; if (i && wantTv.has(i) && sh.image) { tvPics[i] = sh.image.medium || sh.image.original; wantTv.delete(i); } }
  await sleep(550);
}
console.log(`tvmaze posters: ${Object.keys(tvPics).length}`);
for (const x of Object.values(items)) {
  x.a = x.castIds.map(p => label(plabs[p])).filter(Boolean); delete x.castIds;
  x.p = (x.ty === "t" && tvPics[x.i]) || pics[x.w] || "";
  for (const k of Object.keys(x)) if (x[k] === 0 || x[k] === "" || (Array.isArray(x[k]) && !x[k].length)) delete x[k];
}
fs.mkdirSync("data", { recursive: true });
const built = new Date().toISOString();
fs.writeFileSync("data/pool.json", JSON.stringify({ built, items }));
fs.writeFileSync("data/lists.json", JSON.stringify({ built, lists }));
console.log(`done: ${lists.length} lists, ${Object.keys(items).length} titles`);
