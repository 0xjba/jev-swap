"""Shared layout for the jev-swap site: styles, page navigation, footer."""
import iso

CSS = """
*{box-sizing:border-box}
body{margin:0;background:#19191B;color:#ECEDEF;font-family:"DM Sans","Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:#F386A1}a:hover{color:#F9B3C5}
input[type=range]{accent-color:#F386A1}
input:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid #F386A1;outline-offset:2px}
::selection{background:#D45BB6;color:#FFFFFF}
.mono{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace}
.wrap{padding:0 16px;background:#19191B}
.frame{max-width:1280px;margin:0 auto;border-left:1px solid #2B2C30;border-right:1px solid #2B2C30;border-bottom:1px solid #2B2C30}
.sec{padding:112px 48px;display:flex;flex-direction:column;gap:48px}
.row{display:flex;flex-wrap:wrap;gap:40px 64px}
.eyebrow{margin:0;font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:13px;letter-spacing:.04em;color:#F386A1}
.h1{margin:0;font-size:68px;font-weight:500;line-height:1.02;letter-spacing:-.035em;color:#ECEDEF;text-wrap:balance}
.h2{margin:0;font-size:48px;font-weight:500;line-height:1.06;letter-spacing:-.03em;color:#ECEDEF;text-wrap:balance}
.h3{margin:0;font-size:22px;font-weight:500;letter-spacing:-.01em;color:#ECEDEF}
.body{margin:0;font-size:18px;line-height:1.65;color:#A1A3A9}
.small{margin:0;font-size:13px;line-height:1.6;color:#8E9199}
.pink{color:#F386A1}
.panel{background:#111113;border:1px solid #2B2C30;border-radius:4px}
.code{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:.88em;color:#FCD9E3}
pre{margin:0;font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:14px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere;color:#ECEDEF}
.c-com{color:#7C7F87}.c-kw{color:#E3C07A}.c-str{color:#F386A1}
.btn{display:inline-flex;align-items:center;gap:10px;min-height:44px;padding:0 20px;border-radius:3px;font-weight:500;font-size:15px;text-decoration:none;white-space:nowrap}
.btn-fill{background:#DADCE1;color:#111113}.btn-fill:hover{background:#FFFFFF;color:#111113}
.btn-line{border:1px solid #ECEDEF;color:#ECEDEF}.btn-line:hover{color:#FFFFFF;border-color:#FFFFFF}
.btn-pink{background:#F386A1;color:#1E1E1E}.btn-pink:hover{background:#F9B3C5;color:#1E1E1E}
.btn-dark{background:#111113;color:#ECEDEF}.btn-dark:hover{background:#000000;color:#FFFFFF}
.kbd{display:inline-flex;width:22px;height:22px;background:#111113;color:#DADCE1;border-radius:2px;align-items:center;justify-content:center;font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:12px}

/* nav */
.top{padding:16px 16px 0;background:#19191B}
.nav{max-width:1280px;margin:0 auto;border:1px solid #2B2C30;display:flex;align-items:stretch}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#ECEDEF;padding:14px 24px;border-right:1px solid #2B2C30}
.wordmark{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-weight:600;font-size:17px;letter-spacing:-.02em;color:#ECEDEF}
.wm-dim{color:#8E9199;font-weight:500}
/* the logo's switch flips on once when the page loads */
.brand .sw-knob{animation:swon .7s cubic-bezier(.3,.7,.25,1) .3s both}
@keyframes swon{from{transform:translateX(-9px);fill:#6C6F77}60%{fill:#6C6F77}to{transform:translateX(0);fill:#F386A1}}
@media (prefers-reduced-motion:reduce){.brand .sw-knob{animation:none}}
.links{display:flex;align-items:center;gap:32px;padding:0 28px;flex:1 1 auto;font-size:15px;overflow-x:auto;white-space:nowrap;scrollbar-width:none}
.links::-webkit-scrollbar{display:none}
.links a{color:#C9CBD0;text-decoration:none;padding:14px 0}.links a:hover{color:#FFFFFF}
.actions{display:flex;align-items:center;gap:10px;padding:8px 12px;border-left:1px solid #2B2C30}

/* hero */
.hero-head{padding:88px 48px 24px;align-items:flex-end;justify-content:space-between}
.hero-copy{flex:1 1 560px;display:flex;flex-direction:column;gap:22px}
.hero-side{flex:1 1 380px;max-width:460px;display:flex;flex-direction:column;gap:24px}
.hero-art{padding:8px 32px 32px}
.hero-art .m{display:none}
.hero-foot{padding:0 48px 32px}

/* facts */
.facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
.fact{display:flex;flex-direction:column;gap:10px;padding:32px 28px;border-left:1px solid #2B2C30}
.fact:first-child{border-left:0}
.fact-big{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:34px;line-height:1;letter-spacing:-.02em;color:#ECEDEF}
.fact-txt{font-size:15px;line-height:1.55;color:#A1A3A9}
.fact-big.pink{color:#F386A1}
.src{font-size:12px;color:#8E9199}
.proof{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px}
.pchip{font-size:15px;color:#C9CBD0;border:1px solid #3A3B40;border-radius:3px;padding:6px 12px}
.pchip strong{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;color:#F386A1;font-weight:500;margin-right:4px}

/* race */
.race{padding:32px;display:flex;flex-direction:column;gap:30px}
.lane{display:grid;grid-template-columns:110px minmax(0,1fr) 110px;gap:8px 20px;align-items:center}
.lane-name{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:14px}
.track{position:relative;height:12px;background:repeating-linear-gradient(90deg,#3A3B40 0 1px,transparent 1px 10%);border-top:1px dashed #3A3B40;margin-top:6px}
.runner{position:absolute;top:-7px;left:0;width:12px;height:12px;border-radius:50%}
.runner-llm{background:#FFFFFF;animation:rl 6s linear infinite}
.runner-jev{background:#F386A1;box-shadow:0 0 12px rgba(243,134,161,.7);animation:rj 6s linear infinite}
@keyframes rl{0%,5%{left:0}70%,100%{left:calc(100% - 12px)}}
@keyframes rj{0%,5%{left:0}18%,100%{left:calc(100% - 12px)}}
.flag{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:12px;text-align:center;padding:5px 0;border-radius:3px;opacity:.25}
.flag-llm{border:1px solid #6B6E75;color:#ECEDEF;animation:fl 6s linear infinite}
.flag-jev{border:1px solid #F386A1;color:#F386A1;background:#3A1E2C;animation:fj 6s linear infinite}
@keyframes fl{0%,69%{opacity:.25}71%,94%{opacity:1}98%,100%{opacity:.25}}
@keyframes fj{0%,17%{opacity:.25}19%,94%{opacity:1}98%,100%{opacity:.25}}
.lane-note{grid-column:2 / 4;font-size:13px;color:#8E9199;margin:-2px 0 0}
.costs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid #2B2C30;border-radius:4px}
.cost{padding:28px;display:flex;flex-direction:column;gap:10px;border-left:1px solid #2B2C30}
.cost:first-child{border-left:0}
.cost-big{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:34px;letter-spacing:-.02em;overflow-wrap:anywhere}
.cost-hi{background:#3A1E2C}

/* grids */
.g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.g2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.card{padding:28px;display:flex;flex-direction:column;gap:16px}
.icon{height:150px;display:flex;align-items:center;justify-content:center}.icon>div{width:190px}
.cmd{margin-top:auto;font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:13px;color:#FCD9E3;background:#19191B;border:1px solid #2B2C30;padding:12px 14px;border-radius:3px;overflow-wrap:anywhere}

/* calculator */
.calc{display:flex;flex-wrap:wrap;gap:24px;align-items:stretch}
.calc-in{flex:1 1 440px;padding:32px;display:flex;flex-direction:column;gap:22px}
.calc-out{flex:1 1 440px;background:#111113;border:1px solid #D45BB6;border-radius:4px;padding:36px;display:flex;flex-direction:column;gap:28px}
.field{display:flex;flex-direction:column;gap:8px;min-width:0}
.lbl{font-size:15px;font-weight:500;color:#ECEDEF}
.in{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:16px;padding:12px 14px;border:1px solid #3A3B40;border-radius:3px;background:#111113;color:#ECEDEF;width:100%;min-height:44px}
.chips{display:flex;flex-wrap:wrap;gap:10px}
.chip{min-height:44px;padding:10px 14px;border-radius:3px;font-family:inherit;font-size:14px;cursor:pointer;border:1px solid #3A3B40;background:#111113;color:#ECEDEF}
.chip[aria-pressed=true]{border-color:#F386A1;background:#3A1E2C;color:#FCD9E3}
.save{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:60px;line-height:1;color:#F386A1;letter-spacing:-.03em;overflow-wrap:anywhere}
.bar{height:12px;background:#26272B;border-radius:2px;overflow:hidden}
.bar>div{height:100%}
.bar-row{display:flex;justify-content:space-between;gap:12px;font-size:15px;color:#ECEDEF}

/* report */
.tbl-wrap{overflow-x:auto;min-width:0;max-width:100%}
.sec>*{min-width:0}
ul.clean li,.body,.small{overflow-wrap:anywhere}
table{width:100%;border-collapse:collapse;font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:14px;min-width:380px;font-variant-numeric:tabular-nums}
th{padding:10px;font-weight:500;color:#A1A3A9;text-align:left}
td{padding:11px 10px;color:#ECEDEF}
tr{border-bottom:1px solid #2B2C30}
tr.hi{background:#3A1E2C}tr.hi td:first-child{color:#FCD9E3}
.tag{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:12px;color:#E3C07A;border:1px solid #5A4A26;padding:4px 10px;border-radius:3px}

/* faq */
.qa{border-top:1px solid #2B2C30;padding:26px 0;display:flex;flex-direction:column;gap:10px}
.qa:last-child{border-bottom:1px solid #2B2C30}
.q{margin:0;font-size:19px;font-weight:500;color:#ECEDEF}

/* cta */
.cta{background:#F386A1;padding:104px 48px;display:flex;flex-wrap:wrap;gap:48px;align-items:center}
.cta .h2{color:#1E1E1E;font-size:54px}
.cta pre{flex:1 1 440px;background:#111113;border-radius:4px;padding:28px;line-height:1.85}

/* iso animations */
.tile{fill:#3C3D42}
.t-match{animation:tm 7s linear infinite}.t-mirror{animation:tmi 7s linear infinite}.t-compare{animation:tc 7s linear infinite}
.t-latency{animation:tl 7s linear infinite}.t-cost{animation:tco 7s linear infinite}
@keyframes tm{0%,10%{fill:#3C3D42}13%,17%{fill:#F386A1}21%,100%{fill:#3C3D42}}
@keyframes tmi{0%,13%{fill:#3C3D42}15%,19%{fill:#F386A1}24%,100%{fill:#3C3D42}}
@keyframes tc{0%,33%{fill:#3C3D42}35%,39%{fill:#F386A1}43%,59%{fill:#3C3D42}61%,66%{fill:#F386A1}70%,100%{fill:#3C3D42}}
@keyframes tl{0%,61%{fill:#3C3D42}63%,69%{fill:#F386A1}73%,100%{fill:#3C3D42}}
@keyframes tco{0%,63%{fill:#3C3D42}65%,71%{fill:#F386A1}75%,100%{fill:#3C3D42}}
.slab{opacity:.38}
.slab-jev{animation:sj 7s ease-out infinite}.slab-llm{animation:sl 7s ease-out infinite}
.slab-agree{animation:sa 7s ease-out infinite}.slab-more{animation:sm 7s ease-out infinite}
@keyframes sj{0%,33%{opacity:.38;transform:translateY(-14px)}37%,93%{opacity:1;transform:translateY(0)}98%,100%{opacity:.38;transform:translateY(-14px)}}
@keyframes sl{0%,59%{opacity:.38;transform:translateY(-14px)}63%,93%{opacity:1;transform:translateY(0)}98%,100%{opacity:.38;transform:translateY(-14px)}}
@keyframes sa{0%,63%{opacity:.38;transform:translateY(-14px)}67%,93%{opacity:1;transform:translateY(0)}98%,100%{opacity:.38;transform:translateY(-14px)}}
@keyframes sm{0%,66%{opacity:.38;transform:translateY(-14px)}70%,93%{opacity:1;transform:translateY(0)}98%,100%{opacity:.38;transform:translateY(-14px)}}
.scanline{animation:scan 3s ease-in-out infinite}
@keyframes scan{0%,100%{transform:translateY(22px)}50%{transform:translateY(-22px)}}

/* tablet */
@media (max-width:900px){
.sec{padding:80px 28px;gap:40px}
.hero-head{padding:64px 28px 16px}
.hero-art{padding:8px 16px 24px}
.hero-foot{padding:0 28px 28px}
.h1{font-size:52px}
.h2{font-size:38px}
.facts{grid-template-columns:repeat(2,minmax(0,1fr))}
.fact:nth-child(3){border-left:0}
.fact:nth-child(n+3){border-top:1px solid #2B2C30}
.g3,.g2{grid-template-columns:minmax(0,1fr)}
.costs{grid-template-columns:minmax(0,1fr)}
.cost{border-left:0;border-top:1px solid #2B2C30}.cost:first-child{border-top:0}
.cta{padding:80px 28px}.cta .h2{font-size:42px}
.links{gap:24px;padding:0 20px}
.actions .btn-line{display:none}
}
/* phone */
@media (max-width:560px){
.top{padding:10px 10px 0}
.wrap{padding:0 10px}
.nav{flex-wrap:wrap}
.brand{padding:12px 16px;flex:1 1 auto;border-right:0}
.actions{border-left:0;padding:6px 8px}
.links{order:3;flex:1 1 100%;border-top:1px solid #2B2C30;padding:0 16px;gap:22px}
.sec{padding:64px 20px;gap:32px}
.hero-head{padding:48px 20px 8px;gap:24px}
.hero-copy,.hero-side{flex-basis:100%}
.hero-art{padding:8px 4px 16px}
.hero-art .d{display:none}.hero-art .m{display:block}
.hero-foot{padding:0 20px 24px}
.h1{font-size:40px}
.h2{font-size:31px}
.body{font-size:17px}
.facts{grid-template-columns:minmax(0,1fr)}
.fact{border-left:0;border-top:1px solid #2B2C30;padding:24px 20px}.fact:first-child{border-top:0}
.fact-big{font-size:30px}
.race{padding:22px 18px}
.lane{grid-template-columns:minmax(0,1fr) 92px;gap:10px 14px}
.lane-name{grid-column:1 / 3}
.lane .track{grid-column:1 / 2}
.lane-note{grid-column:1 / 3}
.cost{padding:22px 20px}.cost-big{font-size:28px}
.calc-in,.calc-out{padding:22px 18px}
.save{font-size:40px}
pre{font-size:12.5px}
.cta{padding:64px 20px}.cta .h2{font-size:32px}
.cta pre{padding:20px}
.btn{padding:0 16px}
}
@media (prefers-reduced-motion:reduce){
.pulse{animation:none!important;opacity:0}
.tile,.slab,.scanline,.runner,.flag{animation:none!important}
.slab,.flag{opacity:1}
.runner{left:calc(100% - 12px)!important}
}

/* page nav */
.links a[aria-current=page]{color:#FFFFFF;box-shadow:inset 0 -2px 0 #F386A1}
.foot-links{display:flex;flex-wrap:wrap;gap:12px 28px;font-size:15px}
.foot-links a{color:#ECEDEF;text-decoration:none}.foot-links a:hover{color:#F386A1}
.credit{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px;padding-top:18px;border-top:1px solid #2B2C30;color:#ECEDEF;font-size:15px}
.heart{vertical-align:-2px;margin:0 2px}
/* teasers */
.stat-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid #2B2C30;border-radius:4px}
.stat{padding:24px;display:flex;flex-direction:column;gap:8px;border-left:1px solid #2B2C30}.stat:first-child{border-left:0}
.stat-big{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:32px;letter-spacing:-.02em;color:#ECEDEF}
.trailer{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,420px);gap:40px;align-items:center}
/* explorer */
.g-repos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.rc{padding:22px;display:flex;flex-direction:column;gap:18px}
.rc-head{display:flex;align-items:center;gap:12px;min-width:0}
.av{width:40px;height:40px;border-radius:6px;background:#26272B;flex:none}
.av-s{width:22px;height:22px;border-radius:4px;vertical-align:middle;margin-right:10px}
.rc-id{display:flex;flex-direction:column;gap:2px;min-width:0}
.rc-name{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:16px;font-weight:600;color:#ECEDEF;text-decoration:none;overflow-wrap:anywhere}
.rc-name:hover{color:#F386A1}.rc-owner{color:#8E9199;font-weight:400}
.meta{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:12px;color:#8E9199}
.rc-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid #2B2C30;border-radius:4px}
.rc-stats>div{padding:12px 14px;display:flex;flex-direction:column;gap:2px;border-left:1px solid #2B2C30}.rc-stats>div:first-child{border-left:0}
.rc-big{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:24px;letter-spacing:-.02em;color:#ECEDEF}
.rc-lbl{font-size:12px;color:#8E9199}
.cls{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px}
.cl{display:flex;flex-direction:column;gap:6px}
.cl-top{display:flex;justify-content:space-between;align-items:center;gap:10px;min-width:0}
.cl-file{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:13px;color:#ECEDEF;text-decoration:none;overflow-wrap:anywhere;min-width:0}
.cl-file:hover{color:#F386A1}.cl-line{color:#8E9199}
.cl-badges{display:flex;gap:4px;flex:none}
.dt{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:10.5px;line-height:1;padding:4px 6px;border-radius:3px;border:1px solid #3A3B40;color:#C9CBD0;cursor:help}
.dt-choice{border-color:#5A3E6B;color:#E0B8F0}.dt-noul{border-color:#2F5A4A;color:#9FE0C2}.dt-score{border-color:#5A4A26;color:#E3C07A}
.cl-bar{height:6px;background:#26272B;border-radius:3px;overflow:hidden}
.cl-bar>span{display:block;height:100%;border-radius:3px}
.cl-bar>.cheaper{background:#F386A1}.cl-bar>.same{background:#E3C07A}
.cl-meta{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:12.5px;color:#8E9199}
.cl-vs{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0;overflow-wrap:anywhere}
.rt{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:10.5px;padding:2px 5px;border-radius:3px;background:#26272B;color:#A1A3A9;cursor:help}
.cl-figs{display:flex;gap:10px;flex:none;font-family:"JetBrains Mono",ui-monospace,Menlo,monospace}
.cl-pct{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:13px}
.cl-pct.cheaper{color:#F386A1}.cl-pct.same{color:#E3C07A}.cl-pct.none{color:#8E9199}
.cl-x{font-size:13px;color:#ECEDEF}
.more summary{cursor:pointer;font-size:13px;color:#A1A3A9;list-style:none;padding:4px 0}
.more summary::-webkit-details-marker{display:none}
.more summary::before{content:"+ ";color:#F386A1}.more[open] summary::before{content:"− "}
.more .cls{margin-top:12px}
.tools{display:flex;flex-wrap:wrap;gap:16px 32px;align-items:flex-end}
.filter{flex:1 1 260px;max-width:360px}
.seg{display:flex;gap:6px;flex-wrap:wrap}
.trepo{display:inline-flex;align-items:center;color:#ECEDEF;text-decoration:none}.trepo:hover{color:#F386A1}
.all-table td,.all-table th{white-space:nowrap;vertical-align:middle}
.all-table .num{text-align:right;font-variant-numeric:tabular-nums}
th.num,td.num{text-align:right;font-variant-numeric:tabular-nums}
td.pink{color:#F386A1}
.tsave{display:flex;align-items:center;gap:10px;min-width:160px}.tsave .cl-bar{flex:1 1 auto;min-width:80px}
.formula{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:13.5px;color:#FCD9E3;background:#111113;border:1px solid #2B2C30;border-radius:3px;padding:12px 14px;overflow-x:auto;white-space:pre}
ul.clean{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:10px;color:#A1A3A9;font-size:16px;line-height:1.6}
@media (max-width:900px){
.stat-row{grid-template-columns:repeat(2,minmax(0,1fr))}
.stat:nth-child(3){border-left:0}.stat:nth-child(n+3){border-top:1px solid #2B2C30}
.trailer{grid-template-columns:minmax(0,1fr)}
.g-repos{grid-template-columns:minmax(0,1fr)}
}
@media (max-width:560px){
.stat-row{grid-template-columns:minmax(0,1fr)}
.stat{border-left:0;border-top:1px solid #2B2C30}.stat:first-child{border-top:0}
.stat-big{font-size:28px}
.rc{padding:16px}.rc-big{font-size:20px}.rc-stats>div{padding:10px}
}
"""

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&amp;family=JetBrains+Mono:wght@400;500;600&amp;display=swap">')

CALC_JS = """
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var n = function (v) { var x = parseFloat(v); return isFinite(x) && x >= 0 ? x : 0; };
  var money = function (v) {
    if (v >= 1000) return '$' + Math.round(v).toLocaleString('en-US');
    if (v >= 1) return '$' + v.toFixed(2);
    return '$' + v.toFixed(4);
  };
  function update() {
    var calls = n($('calls').value), tin = n($('tin').value), tout = n($('tout').value);
    var pin = n($('pin').value), pout = n($('pout').value), share = Math.min(100, n($('share').value));
    var llm = calls * (tin * pin + tout * pout) / 1e6;
    var jev = calls * tin * __JEV_IN__ / 1e6;
    var hybrid = jev + llm * (1 - share / 100);
    var save = Math.max(0, llm - hybrid);
    var pct = function (v) { return llm > 0 ? Math.max(0.5, Math.min(100, v / llm * 100)) : 0; };
    $('o-share').textContent = share;
    $('o-saveYear').textContent = money(save * 12);
    $('o-saveMonth').textContent = money(save);
    $('o-multiple').textContent = hybrid > 0 && llm > 0 ? (llm / hybrid).toFixed(1) + '×' : '–';
    $('o-llmMonth').textContent = money(llm);
    $('o-hybridMonth').textContent = money(hybrid);
    $('o-jevMonth').textContent = money(jev);
    $('o-hybridBar').style.width = pct(hybrid).toFixed(2) + '%';
    $('o-jevBar').style.width = pct(jev).toFixed(2) + '%';
    var sel = $('model'), opt = sel.options[sel.selectedIndex];
    if (opt && opt.value !== 'custom' && (n(opt.dataset.in) !== pin || n(opt.dataset.out) !== pout)) sel.value = 'custom';
  }
  ['calls', 'tin', 'tout', 'pin', 'pout', 'share'].forEach(function (id) { $(id).addEventListener('input', update); });
  $('model').addEventListener('change', function () {
    var o = this.options[this.selectedIndex];
    if (o.value !== 'custom') { $('pin').value = o.dataset.in; $('pout').value = o.dataset.out; }
    update();
  });
  update();
})();
"""

# The mark: a lowercase j whose dot is a toggle switch, flipped on in pink. A yes/no decision in the letter.
def mark(size=28, favicon=False):
    # Heavier strokes at favicon size so the switch still reads at 16 px.
    ring, stem = (3.0, 3.6) if favicon else (2.2, 2.8)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 32 32" aria-hidden="true">'
            f'<rect x="7.5" y="3" width="18" height="9" rx="4.5" fill="none" stroke="#ECEDEF" stroke-width="{ring}"/>'
            '<circle class="sw-knob" cx="21" cy="7.5" r="2.9" fill="#F386A1"/>'
            f'<path d="M17 15.5V23.5Q17 29 11.5 29H9" fill="none" stroke="#ECEDEF" stroke-width="{stem}" stroke-linecap="round"/>'
            '</svg>')


LOGO = mark()
WORDMARK = '<span class="wordmark">jev<span class="wm-dim">-swap</span></span>'
FAVICON = ("data:image/svg+xml," + mark(32, favicon=True).replace('"', "'").replace("#", "%23").replace("<", "%3C").replace(">", "%3E"))


def code(t):
    return f'<code class="code">{t}</code>'


def wrap(inner, id_="", label="", extra=""):
    idattr = f' id="{id_}"' if id_ else ""
    aria = f' aria-label="{label}"' if label else ""
    return f'<section class="wrap"{idattr}{aria}><div class="frame{extra}">{inner}</div></section>'


def fact(big, small, sup):
    return f'<div class="fact"><div class="fact-big">{big}</div><div class="fact-txt">{small}<sup><a href="#sources">{sup}</a></sup></div></div>'


def step(n, cmd, title, body, icon, line):
    return (f'<article class="panel card"><div class="icon"><div>{icon}</div></div>'
            f'<div class="eyebrow">{n} · {cmd}</div><h3 class="h3">{title}</h3>'
            f'<p class="body" style="font-size: 16px; line-height: 1.6;">{body}</p><code class="cmd">{line}</code></article>')


def qa(q, a):
    return f'<div class="qa"><h3 class="q">{q}</h3><p class="body" style="font-size: 17px;">{a}</p></div>'



AUTHOR_GITHUB = "https://github.com/0xjba"
AUTHOR_EMAIL = "jobinb6444@gmail.com"
REPO_URL = "https://github.com/0xjba/jev-swap"
NPM_URL = "https://www.npmjs.com/package/jev-swap"

PAGES = [("explorer.html", "Explorer"), ("proxy.html", "Shadow proxy")]


def nav(active):
    cur = ' aria-current="page"'
    links = "".join(f'<a href="{href}"{cur if href == active else ""}>{label}</a>' for href, label in PAGES)
    return f'''<header class="top"><nav class="nav" aria-label="Main">
<a class="brand" href="index.html"{' aria-current="page"' if active == "index.html" else ""}>{LOGO}{WORDMARK}</a>
<div class="links">{links}</div>
<div class="actions"><a class="btn btn-line" href="{REPO_URL}">GitHub</a><a class="btn btn-fill" href="{NPM_URL}">npm</a></div>
</nav></header>'''


def footer(sources_html=""):
    src = f'<ol style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px;">{sources_html}</ol>' if sources_html else ""
    return f'''<footer class="wrap" id="sources" style="padding-bottom: 16px;"><div class="frame sec" style="padding-top: 56px; padding-bottom: 64px; gap: 20px; font-size: 14px; line-height: 1.7; color: #A1A3A9;">
<span style="display: flex; align-items: center; gap: 10px;">{LOGO}{WORDMARK}</span>
<nav class="foot-links" aria-label="Footer"><a href="index.html">jev-swap</a><a href="explorer.html">Explorer</a><a href="proxy.html">Shadow proxy</a><a href="{REPO_URL}">GitHub</a><a href="{NPM_URL}">npm</a></nav>
{src}
<div class="credit">
<p style="margin: 0;">Made with <svg class="heart" width="14" height="14" viewBox="0 0 24 24" aria-label="love" role="img"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z" fill="#F386A1"/></svg> by Jobin</p>
<nav class="foot-links" aria-label="Contact"><a href="{AUTHOR_GITHUB}">GitHub</a><a href="mailto:{AUTHOR_EMAIL}">{AUTHOR_EMAIL}</a></nav>
</div>
<p style="margin: 0;">Not affiliated with TypeSafe. Jev is a product of TypeSafe AI.</p>
</div></footer>'''


def page(title, description, active, body, extra_css="", script=""):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="theme-color" content="#19191B">
<link rel="icon" type="image/svg+xml" href="{FAVICON}">
{FONTS}
<style>{CSS}{"".join(iso.KEYFRAMES)}{extra_css}</style>
</head>
<body>
{nav(active)}
{body}
{script}
</body>
</html>
'''
