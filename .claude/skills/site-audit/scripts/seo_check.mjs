#!/usr/bin/env node
// Технические SEO-проверки сайта для skill site-audit.
// Запуск: node seo_check.mjs <url> [--old <старый-домен>] [--sample N] [--pages url1,url2] [--out файл.json]
// Пишет JSON (полные данные) в --out и короткую сводку в stdout.
// Только чтение: GET-запросы к публичным страницам через curl с его стандартным User-Agent, без обхода защиты.
// Почему curl, а не fetch: часть защит от ботов отдаёт заглушку встроенному fetch Node (по отпечатку соединения),
// а curl получает реальную страницу — как и простые роботы. Если заглушку получает и curl, это находка (2.16).

import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const UA = 'curl (default User-Agent)';
const TIMEOUT_S = 20;
const TMP = mkdtempSync(join(tmpdir(), 'site-audit-'));
let seq = 0;

function parseArgs(argv) {
  const a = { url: null, old: null, sample: 6, pages: [], out: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--old') a.old = argv[++i];
    else if (v === '--sample') a.sample = Number(argv[++i]);
    else if (v === '--pages') a.pages = argv[++i].split(',').filter(Boolean).map(p => {
      // Git Bash превращает "/путь/" в "C:/Program Files/Git/путь/". Передавайте полные URL или путь без ведущего слэша.
      const m = p.match(/^[a-z]:\/.*?\/Git\/(.*)$/i);
      if (m) { console.error(`warning: путь "${p}" искажён оболочкой, использую "/${m[1]}"`); return '/' + m[1]; }
      return p;
    });
    else if (v === '--out') a.out = argv[++i];
    else if (!a.url) a.url = v;
  }
  if (!a.url) {
    console.error('Usage: node seo_check.mjs <url> [--old <old-domain>] [--sample N] [--pages u1,u2] [--out file.json]');
    process.exit(2);
  }
  if (!/^https?:\/\//.test(a.url)) a.url = 'https://' + a.url;
  if (a.old && !/^https?:\/\//.test(a.old)) a.old = 'https://' + a.old;
  return a;
}

// new URL() кодирует кириллицу в путях — curl без кодирования получает 404 на рабочих страницах.
function norm(u, base) {
  try { return new URL(u.replace(/&amp;/g, '&'), base).href; } catch { return null; }
}

function get(url, { redirect = 'follow', keepBody = false } = {}) {
  const n = ++seq, bodyF = join(TMP, `b${n}`), hdrF = join(TMP, `h${n}`);
  const args = ['-sS', '--max-time', String(TIMEOUT_S), '-o', bodyF, '-D', hdrF, '-w', '%{json}'];
  if (redirect === 'follow') args.push('-L');
  args.push(url);
  return new Promise(resolve => {
    execFile('curl', args, { maxBuffer: 1 << 20, windowsHide: true }, (err, stdout) => {
      let w = {}; try { w = JSON.parse(stdout); } catch {}
      let body = ''; try { body = readFileSync(bodyF, 'utf8'); } catch {}
      let headers = {};
      try {
        const blocks = readFileSync(hdrF, 'utf8').trim().split(/\r?\n\r?\n/);
        for (const line of blocks.at(-1).split(/\r?\n/).slice(1)) { const i = line.indexOf(':'); if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim(); }
      } catch {}
      const status = w.http_code ?? w.response_code ?? 0;
      resolve({
        url, status, location: headers.location || w.redirect_url || null, finalUrl: w.url_effective || url,
        ms: Math.round((w.time_total || 0) * 1000), headers, body: redirect === 'manual' && !keepBody ? '' : body,
        error: status === 0 ? (w.errormsg || (err && err.message) || 'request failed') : undefined,
      });
    });
  });
}

const decode = s => (s || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
const attr = (tag, name) => { const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i')); return m ? decode(m[1]) : null; };
const metas = html => [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]);
const metaBy = (html, key, val) => { const t = metas(html).find(m => (attr(m, key) || '').toLowerCase() === val); return t ? attr(t, 'content') : null; };

function analyzePage(res) {
  const h = res.body || '';
  const title = decode((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
  const canonTag = (h.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i) || [])[0];
  const heads = lvl => [...h.matchAll(new RegExp(`<h${lvl}\\b[^>]*>([\\s\\S]*?)<\\/h${lvl}>`, 'gi'))].map(m => decode(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').slice(0, 100));
  const imgs = [...h.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  const jsonld = [...h.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m => {
    try { const j = JSON.parse(m[1]); const arr = Array.isArray(j) ? j : (j['@graph'] || [j]); return arr.map(x => x['@type']).flat(); } catch { return ['(invalid JSON-LD)']; }
  }).flat();
  const text = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const metrika = [...new Set([...h.matchAll(/ym\(\s*(\d{5,})/g)].map(m => m[1]))];
  // Признаки JS-заглушки защиты от ботов: маленькая страница без контента или характерный заголовок.
  const challenge = /секундочку|одну минуту|one moment|just a moment|checking your browser|ddos-guard|attention required/i.test(title) || (h.length < 3000 && text.trim().length < 200 && res.status === 200);
  return {
    url: res.url, status: res.status, error: res.error, ms: res.ms, bytes: h.length,
    title, description: metaBy(h, 'name', 'description'), canonical: canonTag ? attr(canonTag, 'href') : null,
    robotsMeta: metaBy(h, 'name', 'robots'),
    h1: heads(1), h2Count: heads(2).length, h3Count: heads(3).length,
    imgCount: imgs.length, imgWithAlt: imgs.filter(t => (attr(t, 'alt') || '').length > 0).length,
    jsonLdTypes: [...new Set(jsonld)], ogTitle: metaBy(h, 'property', 'og:title'),
    generator: metaBy(h, 'name', 'generator'), poweredBy: res.headers?.['x-powered-by'] || null,
    yandexVerification: metaBy(h, 'name', 'yandex-verification'), googleVerification: metaBy(h, 'name', 'google-site-verification'),
    metrika, serverTextChars: text.trim().length, looksLikeChallenge: challenge,
  };
}

async function mirrors(base) {
  const host = new URL(base).hostname.replace(/^www\./, '');
  const variants = [`http://${host}/`, `https://www.${host}/`, `http://www.${host}/`, `https://${host}/`];
  const out = [];
  for (const v of variants) {
    const r = await get(v, { redirect: 'manual', keepBody: true });
    // canonical на каждом зеркале: если зеркало отвечает 200 и canonical указывает на основное — это частично (◐), если на себя — ✗.
    const canonical = r.status === 200 ? analyzePage(r).canonical : null;
    out.push({ url: v, status: r.status, location: r.location, canonical, error: r.error });
  }
  return out;
}

async function sitemapUrls(base, robotsBody) {
  const fromRobots = [...(robotsBody || '').matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1]);
  const start = fromRobots.length ? fromRobots : [norm('/sitemap.xml', base)];
  const urls = []; const files = []; let lastmod = 0;
  const queue = [...start];
  while (queue.length && files.length < 20) {
    const sm = queue.shift();
    const r = await get(sm);
    files.push({ url: sm, status: r.status });
    if (r.status !== 200) continue;
    lastmod += (r.body.match(/<lastmod>/g) || []).length;
    const locs = [...r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => decode(m[1]));
    if (/<sitemapindex/i.test(r.body)) queue.push(...locs); else urls.push(...locs);
  }
  return { declaredInRobots: fromRobots.length > 0, files, urls, lastmodCount: lastmod };
}

// Дубли: одинаковый последний сегмент пути под разными разделами.
function duplicateSlugs(urls) {
  const bySlug = new Map();
  for (const u of urls) {
    let p; try { p = decodeURIComponent(new URL(u).pathname); } catch { continue; }
    const parts = p.split('/').filter(Boolean);
    if (parts.length < 2) continue;
    const slug = parts.at(-1).toLowerCase();
    if (!bySlug.has(slug)) bySlug.set(slug, new Set());
    bySlug.get(slug).add(parts.slice(0, -1).join('/'));
  }
  const dups = [...bySlug.entries()].filter(([, s]) => s.size > 1);
  const sections = {};
  for (const [, s] of dups) for (const sec of s) sections[sec] = (sections[sec] || 0) + 1;
  return { duplicatedSlugs: dups.length, sectionsInvolved: sections, examples: dups.slice(0, 3).map(([slug, s]) => ({ slug, sections: [...s] })) };
}

function spreadSample(list, n) {
  if (list.length <= n) return list;
  const step = list.length / n; return Array.from({ length: n }, (_, i) => list[Math.floor(i * step)]);
}

async function oldDomain(oldBase, newBase) {
  const home = await get(oldBase);
  const robots = await get(norm('/robots.txt', oldBase));
  const sm = await sitemapUrls(oldBase, robots.status === 200 ? robots.body : '');
  const sample = spreadSample(sm.urls, 6);
  const checks = [];
  for (const u of sample) {
    const r = await get(norm(u, oldBase), { redirect: 'manual' });
    checks.push({ url: u, status: r.status, location: r.location });
  }
  const newHost = new URL(newBase).hostname.replace(/^www\./, '');
  const hrefs = [...(home.body || '').matchAll(/href=["']([^"']*)["']/gi)].map(m => m[1]);
  const linksToNew = [...new Set(hrefs.filter(h => h.includes(newHost)))];
  const linkChecks = [];
  for (const l of linksToNew.slice(0, 10)) { const r = await get(norm(l, newBase)); linkChecks.push({ url: l, status: r.status }); }
  return {
    home: { status: home.status, finalUrl: home.finalUrl, redirectedToNew: (home.finalUrl || '').includes(newHost), title: analyzePage(home).title },
    sitemapUrlCount: sm.urls.length, sampleChecks: checks,
    sampleRedirectsToNew: checks.filter(c => [301, 308].includes(c.status) && (c.location || '').includes(newHost)).length,
    linksToNewSite: linkChecks,
  };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const base = new URL(a.url).origin + '/';
  const report = { checkedAt: new Date().toISOString(), site: base, userAgent: UA };

  report.mirrors = await mirrors(base);
  const robots = await get(norm('/robots.txt', base));
  report.robots = { status: robots.status, isText: !/<html/i.test(robots.body), lines: robots.status === 200 ? robots.body.split(/\r?\n/).slice(0, 40) : [] };
  const sm = await sitemapUrls(base, robots.status === 200 ? robots.body : '');
  report.sitemap = { declaredInRobots: sm.declaredInRobots, files: sm.files, urlCount: sm.urls.length, lastmodCount: sm.lastmodCount, duplicates: duplicateSlugs(sm.urls) };
  const llms = await get(norm('/llms.txt', base));
  report.llmsTxt = { status: llms.status };

  const pageUrls = [base, ...a.pages.map(p => norm(p, base)), ...spreadSample(sm.urls.filter(u => norm(u, base) !== base), a.sample).map(u => norm(u, base))].filter(Boolean);
  report.pages = [];
  for (const u of [...new Set(pageUrls)]) report.pages.push(analyzePage(await get(u)));
  const notFound = await get(norm('/site-audit-404-check-' + Date.now(), base));
  report.notFound = { status: notFound.status, title: analyzePage(notFound).title };

  const titles = report.pages.map(p => p.title);
  report.summary = {
    pagesChecked: report.pages.length,
    duplicateTitles: titles.filter((t, i) => t && titles.indexOf(t) !== i).length,
    titleEqualsDescription: report.pages.filter(p => p.title && p.title === p.description).length,
    pagesWithoutH1: report.pages.filter(p => p.h1.length === 0).length,
    pagesWithJsonLd: report.pages.filter(p => p.jsonLdTypes.length).length,
    challengePages: report.pages.filter(p => p.looksLikeChallenge).length,
    imgs: report.pages.reduce((s, p) => s + p.imgCount, 0), imgsWithAlt: report.pages.reduce((s, p) => s + p.imgWithAlt, 0),
  };
  if (a.old) report.oldDomain = await oldDomain(a.old, base);

  const json = JSON.stringify(report, null, 2);
  if (a.out) writeFileSync(a.out, json); else console.log(json);

  const s = report.summary, d = report.sitemap.duplicates;
  const lines = [
    `site: ${base}`,
    `mirrors: ${report.mirrors.map(m => `${m.url} → ${m.status}${m.location ? ' ' + m.location : ''}${m.canonical ? ' canonical ' + m.canonical : ''}`).join(' | ')}`,
    `robots.txt: ${report.robots.status}${report.robots.status === 200 ? '' : ' (нет)'} | sitemap in robots: ${sm.declaredInRobots} | llms.txt: ${report.llmsTxt.status}`,
    `sitemap: ${report.sitemap.urlCount} URL, lastmod ${report.sitemap.lastmodCount}, дубли slug: ${d.duplicatedSlugs} ${JSON.stringify(d.sectionsInvolved)}`,
    `pages: ${s.pagesChecked} (${a.pages.length ? 'включая --pages' : 'только выборка из sitemap — разделы и служебные страницы могли не попасть'}), без H1: ${s.pagesWithoutH1}, title=description: ${s.titleEqualsDescription}, повторы title: ${s.duplicateTitles}, с JSON-LD: ${s.pagesWithJsonLd}, заглушки: ${s.challengePages}`,
    `alt: ${s.imgsWithAlt}/${s.imgs} — только картинки в HTML; фото, которые подгружает JavaScript (галереи карточек), скрипт не видит — проверять в браузере`,
    `404: ${report.notFound.status}`,
  ];
  if (report.oldDomain) {
    const o = report.oldDomain;
    lines.push(`old: home ${o.home.status} → ${o.home.finalUrl} (на новый: ${o.home.redirectedToNew}), sitemap ${o.sitemapUrlCount} URL, выборка: ${o.sampleChecks.map(c => c.status).join(',')}, 301 на новый: ${o.sampleRedirectsToNew}/${o.sampleChecks.length}, ссылки на новый: ${o.linksToNewSite.map(l => l.status + ' ' + l.url).join('; ') || 'нет'}`);
  }
  if (report.robots.status === 200 && !report.robots.isText) lines.push('ВНИМАНИЕ: robots.txt вернул HTML — вероятно, заглушка защиты; данные недостоверны.');
  if (s.challengePages) lines.push(`ВНИМАНИЕ: ${s.challengePages} стр. похожи на заглушку защиты от ботов — проверить вручную (критерий 2.16).`);
  if (a.out) console.log(lines.join('\n'));
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { try { rmSync(TMP, { recursive: true, force: true }); } catch {} });
