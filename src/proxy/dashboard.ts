// Single-file dashboard served at "/". Renders with DOM APIs + textContent only:
// states come from real user traffic, so nothing is ever injected as HTML.
export const dashboardHtml = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>jev-swap live</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{--paper:#F4F1EA;--card:#FBF9F4;--line:#D8D2C4;--ink:#16150F;--muted:#5B574E;--accent:#B4410C;--accent-soft:#F6DCCB;--good:#166534;--good-soft:#DCEFE2;--bad:#8A300A;--dark:#16150F;--dark2:#22211A;--on-dark:#E9E4D8;--on-dark-muted:#A8A193;--peach:#F2A57A;--mint:#7FC49B}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"IBM Plex Sans","Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
.mono{font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace}
.serif{font-family:"Instrument Serif",Georgia,serif;font-weight:400}
header{border-bottom:1px solid var(--line)}
.wrap{max-width:1320px;margin:0 auto;padding:0 28px}
.bar{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;padding:16px 0}
.brand{display:flex;align-items:center;gap:10px;font-size:17px;font-weight:500}
.dot{width:9px;height:9px;border-radius:50%;background:var(--good);box-shadow:0 0 0 0 rgba(22,101,52,.5);animation:pulse 1.6s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(22,101,52,.45)}70%{box-shadow:0 0 0 9px rgba(22,101,52,0)}100%{box-shadow:0 0 0 0 rgba(22,101,52,0)}}
.pill{font-size:12px;padding:4px 10px;border-radius:999px;font-weight:500;letter-spacing:.02em}
.pill.sim{background:var(--accent-soft);color:var(--bad)}
.pill.live{background:var(--good-soft);color:var(--good)}
.urls{display:flex;flex-wrap:wrap;gap:8px;font-size:13px}
.urls code{background:#EDE8DC;padding:6px 10px;border-radius:5px}
.hero{background:var(--dark);color:var(--on-dark)}
.hero .wrap{display:grid;grid-template-columns:1.3fr 1fr 1fr 1.4fr;gap:28px;padding:36px 28px}
.k{font-size:13px;color:var(--on-dark-muted);text-transform:uppercase;letter-spacing:.06em}
.big{font-size:64px;line-height:1;color:var(--peach);margin-top:10px}
.mid{font-size:44px;line-height:1;margin-top:10px;color:#F4F1EA}
.sub{font-size:14px;color:var(--on-dark-muted);margin-top:10px;line-height:1.5}
.race{display:flex;flex-direction:column;gap:12px;margin-top:12px}
.race-row{display:grid;grid-template-columns:44px 1fr 72px;gap:10px;align-items:center;font-size:14px}
.track{height:12px;background:#2E2C24;border-radius:3px;overflow:hidden}
.fill{height:100%;border-radius:3px;transition:width .5s ease}
main .wrap{padding:32px 28px 64px;display:flex;flex-direction:column;gap:36px}
h2{margin:0 0 16px;font-size:34px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:22px;display:flex;flex-direction:column;gap:14px}
.card-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.card h3{margin:0;font-size:17px;font-weight:600;word-break:break-word}
.meta{font-size:13px;color:var(--muted);margin-top:4px}
.status{font-size:12px;padding:4px 10px;border-radius:999px;white-space:nowrap;font-weight:500}
.status.collecting{background:#EDE8DC;color:var(--muted)}
.status.ready{background:var(--good-soft);color:var(--good)}
.status.below-target{background:var(--accent-soft);color:var(--bad)}
.frow{display:grid;grid-template-columns:130px 1fr 56px;gap:10px;align-items:center;font-size:14px}
.ftrack{height:8px;background:#E6E0D2;border-radius:3px;overflow:hidden}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;font-size:13px;color:var(--muted)}
.stats b{display:block;font-size:18px;color:var(--ink);font-weight:500;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:6px 6px;border-bottom:1px solid #E6E0D2}
th{font-weight:500;color:var(--muted)}
tr.rec td{background:var(--accent-soft)}
button{min-height:44px;border-radius:6px;border:1px solid var(--ink);background:var(--ink);color:var(--paper);font:inherit;font-weight:500;padding:10px 16px;cursor:pointer}
button:disabled{background:transparent;color:var(--muted);border-color:var(--line);cursor:not-allowed}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.note{font-size:12.5px;color:var(--muted);line-height:1.5}
.cols{display:grid;grid-template-columns:1fr 1.25fr;gap:24px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 18px 14px;max-height:520px;overflow:auto}
.feed-row{display:grid;grid-template-columns:1fr 70px 70px 64px;gap:10px;padding:9px 0;border-bottom:1px solid #E6E0D2;font-size:13px;align-items:center}
.ok{color:var(--good);font-weight:500}.no{color:var(--bad);font-weight:500}
.dis{padding:14px 0;border-bottom:1px solid #E6E0D2;display:flex;flex-direction:column;gap:8px}
.dis .state{font-size:13.5px;line-height:1.5;background:#EDE8DC;padding:10px 12px;border-radius:6px;white-space:pre-wrap;word-break:break-word}
.vs{display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px}
.vs div{padding:8px 10px;border-radius:6px;border:1px solid var(--line);word-break:break-word}
.empty{padding:28px 0;color:var(--muted);font-size:14px;text-align:center}
.banner{background:var(--accent-soft);color:var(--bad);font-size:14px;padding:10px 14px;border-radius:8px;line-height:1.5}
@media (max-width:1000px){.hero .wrap{grid-template-columns:1fr 1fr}.cols{grid-template-columns:1fr}}
@media (max-width:560px){.hero .wrap{grid-template-columns:1fr}.big{font-size:48px}.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<header><div class="wrap bar">
  <div class="brand"><span class="dot" aria-hidden="true"></span><span class="mono">jev-swap</span><span>live shadow</span><span id="mode" class="pill"></span></div>
  <div class="urls" id="urls"></div>
</div></header>
<section class="hero" aria-label="Totals"><div class="wrap">
  <div><div class="k">Would have saved</div><div class="big serif" id="saved">–</div><div class="sub" id="savedSub"></div></div>
  <div><div class="k">Decisions mirrored</div><div class="mid serif" id="mirrored">0</div><div class="sub" id="counters"></div></div>
  <div><div class="k">Jev agreement</div><div class="mid serif" id="agree">–</div><div class="sub">exact match with your LLM, all fields</div></div>
  <div><div class="k">Median latency</div>
    <div class="race">
      <div class="race-row"><span>LLM</span><div class="track"><div class="fill" id="llmBar" style="background:#8C8677;width:0"></div></div><span class="mono" id="llmMs">–</span></div>
      <div class="race-row"><span>Jev</span><div class="track"><div class="fill" id="jevBar" style="background:var(--mint);width:0"></div></div><span class="mono" id="jevMs">–</span></div>
    </div>
    <div class="sub" id="speedup"></div>
  </div>
</div></section>
<main><div class="wrap">
  <div id="banner"></div>
  <section aria-labelledby="cands-h"><h2 id="cands-h" class="serif">Decision calls</h2><div class="grid" id="cards"></div></section>
  <div class="cols">
    <section aria-labelledby="feed-h"><h2 id="feed-h" class="serif">Live feed</h2><div class="panel" id="feed"></div></section>
    <section aria-labelledby="dis-h"><h2 id="dis-h" class="serif">Disagreement inbox</h2><div class="panel" id="dis"></div></section>
  </div>
</div></main>
<script>
(function () {
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) for (var k in props) {
      if (k === 'text') n.textContent = props[k];
      else if (k === 'cls') n.className = props[k];
      else if (k === 'style') n.setAttribute('style', props[k]);
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), props[k]);
      else if (props[k] !== false && props[k] != null) n.setAttribute(k, props[k] === true ? '' : props[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function $(id) { return document.getElementById(id); }
  function pct(x) { return x == null ? '–' : (x * 100).toFixed(1) + '%'; }
  function ms(x) { return x == null ? '–' : Math.round(x) + ' ms'; }
  function money(x) {
    if (x == null) return '–';
    if (x >= 1000) return '$' + Math.round(x).toLocaleString('en-US');
    if (x >= 1) return '$' + x.toFixed(2);
    return '$' + x.toFixed(4);
  }
  function val(v) { return typeof v === 'string' ? v : JSON.stringify(v); }
  function ago(t) { var s = Math.round((Date.now() - t) / 1000); return s < 60 ? s + 's ago' : Math.round(s / 60) + 'm ago'; }
  var lastApply = {};

  function card(c, s) {
    var statusText = c.status === 'collecting' ? 'Collecting ' + c.samples + '/' + s.minSamples
      : c.status === 'ready' ? (c.applied != null ? 'Applied ' + c.applied : 'Ready at ' + c.recommended.threshold)
      : 'Below ' + pct(s.target) + ' target';
    var fields = c.fields.map(function (f) {
      var a = c.fieldAgreement[f.name];
      return el('div', { cls: 'frow' }, [
        el('span', { cls: 'mono', text: f.name + ':' + f.kind }),
        el('div', { cls: 'ftrack' }, [el('div', { cls: 'fill', style: 'width:' + ((a || 0) * 100).toFixed(1) + '%;background:' + (a != null && a >= s.target ? 'var(--good)' : 'var(--accent)') })]),
        el('span', { cls: 'mono', text: pct(a) })
      ]);
    });
    var rows = c.curve.map(function (p) {
      var rec = c.recommended && c.recommended.threshold === p.threshold;
      return el('tr', { cls: rec ? 'rec' : '' }, [
        el('td', { cls: 'mono', text: p.threshold + (rec ? '  recommended' : '') }),
        el('td', { cls: 'mono', text: pct(p.coverage) }),
        el('td', { cls: 'mono', text: pct(p.agreement) })
      ]);
    });
    var reason = s.mode === 'mock' ? 'Simulated run: thresholds are not written from mock data.'
      : c.status === 'collecting' ? 'Needs ' + s.minSamples + ' samples first.'
      : c.status === 'below-target' ? 'No threshold meets the target yet.' : '';
    var btn = el('button', {
      type: 'button', disabled: !!reason, title: reason || false,
      onclick: function () {
        fetch('/api/apply/' + encodeURIComponent(c.id), { method: 'POST' }).then(function (r) { return r.json(); })
          .then(function (j) { lastApply[c.id] = j.ok ? 'Wrote THRESHOLD = ' + j.threshold + ' to ' + j.file : j.error; tick(); });
      }
    }, [c.applied != null ? 'Re-apply threshold' : 'Apply threshold to generated code']);
    return el('article', { cls: 'card' }, [
      el('div', { cls: 'card-top' }, [
        el('div', null, [el('h3', { cls: 'mono', text: c.id }), el('div', { cls: 'meta', text: c.file + ':' + c.line + ' · ' + c.language })]),
        el('span', { cls: 'status ' + c.status, text: statusText })
      ]),
      el('div', { cls: 'stats' }, [
        el('div', null, ['Samples', el('b', { text: String(c.samples) })]),
        el('div', null, ['LLM p50', el('b', { text: ms(c.llmP50) })]),
        el('div', null, ['Jev p50', el('b', { text: ms(c.jevP50) })])
      ]),
      el('div', null, fields),
      el('table', null, [
        el('thead', null, [el('tr', null, [el('th', { scope: 'col', text: 'Threshold' }), el('th', { scope: 'col', text: 'Jev handles' }), el('th', { scope: 'col', text: 'Agreement' })])]),
        el('tbody', null, rows)
      ]),
      el('div', { cls: 'stats' }, [
        el('div', null, ['LLM cost', el('b', { text: money(c.llmCost) })]),
        el('div', null, ['Hybrid cost', el('b', { text: money(c.hybridCost) })]),
        el('div', null, ['Saved', el('b', { text: money(c.saved) })])
      ]),
      btn,
      lastApply[c.id] ? el('div', { cls: 'note', role: 'status', text: lastApply[c.id] }) : (reason ? el('div', { cls: 'note', text: reason }) : null)
    ]);
  }

  function render(s) {
    $('mode').className = 'pill ' + (s.mode === 'mock' ? 'sim' : 'live');
    $('mode').textContent = s.mode === 'mock' ? 'SIMULATED JEV' : 'LIVE';
    var urls = $('urls'); urls.replaceChildren(
      el('code', { cls: 'mono', text: 'OPENAI_BASE_URL=' + s.baseUrls.openai }),
      el('code', { cls: 'mono', text: 'ANTHROPIC_BASE_URL=' + s.baseUrls.anthropic })
    );
    $('banner').replaceChildren.apply($('banner'), [
      s.mode === 'mock' ? el('div', { cls: 'banner', text: 'Simulated run: Jev answers and latency come from a mock that agrees with your LLM at a fixed rate. The pipeline is real; the accuracy and speed numbers are not. Run without --mock and with TYPESAFE_API_KEY for real results.' }) : null,
      !s.pricesKnown ? el('div', { cls: 'banner', style: 'margin-top:10px', text: 'Savings need your LLM prices: restart with --llm-price-in and --llm-price-out.' }) : null
    ].filter(Boolean));
    $('saved').textContent = s.pricesKnown ? money(s.totals.saved) : '–';
    $('savedSub').textContent = s.pricesKnown && s.totals.savedPerMonth != null ? money(s.totals.savedPerMonth) + ' / month at the current traffic rate' : 'vs sending every decision to your LLM';
    $('mirrored').textContent = s.counters.mirrored.toLocaleString('en-US');
    $('counters').textContent = s.counters.requests + ' requests proxied · ' + s.counters.unmatched + ' not decisions · ' + s.counters.streamingSkipped + ' streamed (skipped)';
    $('agree').textContent = pct(s.totals.exact);
    var l = s.totals.llmP50, j = s.totals.jevP50, mx = Math.max(l || 0, j || 0) || 1;
    $('llmMs').textContent = ms(l); $('jevMs').textContent = ms(j);
    $('llmBar').style.width = ((l || 0) / mx * 100) + '%'; $('jevBar').style.width = ((j || 0) / mx * 100) + '%';
    $('speedup').textContent = l && j ? (l / j).toFixed(1) + 'x faster on the same requests' : '';

    var cards = s.cards.slice().sort(function (a, b) { return b.samples - a.samples; });
    $('cards').replaceChildren.apply($('cards'), cards.map(function (c) { return card(c, s); }));

    var feed = s.feed.map(function (f) {
      return el('div', { cls: 'feed-row' }, [
        el('div', null, [el('div', { cls: 'mono', text: f.candidate }), el('div', { cls: 'note', text: ago(f.at) })]),
        el('span', { cls: 'mono', text: ms(f.llmMs) }),
        el('span', { cls: 'mono', text: f.error ? 'error' : ms(f.jevMs) }),
        el('span', { cls: f.error ? 'no' : f.exact ? 'ok' : 'no', text: f.error ? 'failed' : f.exact ? 'match' : 'differs' })
      ]);
    });
    $('feed').replaceChildren.apply($('feed'), feed.length ? [el('div', { cls: 'feed-row note' }, ['Call', 'LLM', 'Jev', 'Result'])].concat(feed)
      : [el('div', { cls: 'empty', text: 'Waiting for traffic. Point your SDK at the base URLs above.' })]);

    var dis = s.disagreements.map(function (d) {
      var keys = Object.keys(d.jev || {});
      var diff = keys.filter(function (k) { return val(d.llm[k]) !== val(d.jev[k]); });
      return el('div', { cls: 'dis' }, [
        el('div', { cls: 'meta' }, [el('span', { cls: 'mono', text: d.candidate }), ' · ' + ago(d.at) + ' · Jev confidence ' + (d.conf != null ? d.conf.toFixed(2) : '–')]),
        el('div', { cls: 'state', text: d.state }),
        el('div', { cls: 'vs' }, [
          el('div', null, [el('div', { cls: 'note', text: 'Your LLM' })].concat(diff.map(function (k) { return el('div', { cls: 'mono', text: k + ': ' + val(d.llm[k]) }); }))),
          el('div', null, [el('div', { cls: 'note', text: 'Jev' })].concat(diff.map(function (k) { return el('div', { cls: 'mono', text: k + ': ' + val(d.jev[k]) }); })))
        ])
      ]);
    });
    $('dis').replaceChildren.apply($('dis'), dis.length ? dis : [el('div', { cls: 'empty', text: 'No disagreements yet.' })]);
  }

  function tick() {
    fetch('/api/state', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(render).catch(function () {});
  }
  tick();
  setInterval(tick, 1000);
})();
</script>
</body>
</html>`;
