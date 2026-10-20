import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const feedPath = path.join(root, "published-content.json");
const outDir = path.join(root, "published-articles");
const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
if (!Array.isArray(feed.articles) || !Array.isArray(feed.elections)) throw new Error("Invalid newsroom feed shape");
fs.mkdirSync(outDir, { recursive: true });
const slugify = (value) => String(value || "article").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "article";
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const paragraphs = (body) => String(body || "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>").join("\n");
const liveSlugs = new Set();
for (const article of feed.articles) {
  if (!article.id || !article.headline || !article.body) continue;
  const slug = slugify(article.headline) + "-" + String(article.id).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 8);
  liveSlugs.add(slug + ".html");
  const image = article.image_url && /^https:\/\//i.test(article.image_url) ? '<img class="hero" src="' + esc(article.image_url) + '" alt="">' : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><title>${esc(article.headline)} — The Capitol News</title><link rel="stylesheet" href="../styles.css"><style>.published-article{max-width:820px;margin:40px auto;padding:0 22px 70px}.published-article h1{font-size:clamp(34px,6vw,60px);line-height:1.08}.published-article .dek{font-size:20px;color:#bbb;line-height:1.6}.published-article .body{font-size:18px;line-height:1.85}.published-article .body p{margin:1.2em 0}.published-article .hero{width:100%;max-height:440px;object-fit:cover}.published-article .meta{color:#bda16e;text-transform:uppercase;letter-spacing:.12em;font-size:12px}html,body{background:#fff!important;color:#111!important}.published-article{position:relative;isolation:isolate;z-index:1;background:#fff!important;background-image:none!important;color:#111!important;min-height:70vh}.published-article,.published-article *{background-image:none!important}.published-article h1,.published-article .body,.published-article .body p,.published-article a,.published-article footer,.published-article footer p{color:#111!important}.published-article .body,.published-article .body p{background:transparent!important}.published-article .dek{color:#555!important}.published-article .meta{color:#8a2020!important}.published-article .hero{position:relative;z-index:1}</style></head><body><header class="site-header"><a class="brand" href="../index.html"><img class="brand-logo-image" src="https://res.cloudinary.com/dtz0urit6/image/upload/q_auto:best,f_jpg/cloudinary-tools-uploads/kxuomhjwf1radlnk2r9k" alt="The Capitol News"></a><nav class="main-nav"><a href="../index.html">Top Stories</a><a href="../politics.html">Politics</a><a href="../world.html">World</a><a href="../elections.html">Elections</a></nav></header><main class="published-article"><p><a href="../index.html">← TCN home</a></p><p class="meta">${esc(article.category || "Top Stories")} · The Capitol News</p><h1>${esc(article.headline)}</h1><p class="dek">${esc(article.summary)}</p><p class="meta">By ${esc(article.byline || "TCN Newsroom")} · ${esc(article.approved_at ? new Date(article.approved_at).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric",timeZone:"UTC"}) : "")}</p>${image}<div class="body">${paragraphs(article.body)}</div><footer class="site-footer"><p class="parody-notice">This site is a parody.</p></footer></main></body></html>`;
  fs.writeFileSync(path.join(outDir, slug + ".html"), html + "\n");
}
for (const name of fs.readdirSync(outDir)) if (name.endsWith(".html") && !liveSlugs.has(name)) fs.unlinkSync(path.join(outDir, name));
fs.writeFileSync(feedPath, JSON.stringify(feed, null, 2) + "\n");
console.log(`Prepared ${feed.articles.length} approved articles and ${feed.elections.length} published election records.`);
