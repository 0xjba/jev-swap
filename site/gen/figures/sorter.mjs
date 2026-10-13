// Fig 1 · The card sorter: jev-swap's scan as a machine.
// A deck of twelve cards, one per LLM call in a demo codebase, waits in a spring-fed hopper. A picker lifts the
// top card, carries it over a scanner, and drops it in a pocket: choice, yes/no or score when the call is a
// decision, the pass tray when it is not. The readout, the pocket stacks and the picker all read one timeline.
import { k, tools, basePlate, rulerStrip, labelPlate, writeFigure } from "./common.mjs";

const WIDTH = 640;
const HEIGHT = 350;

// ---------- the model: the same twelve files as the scan output beside the hero ----------
const POCKETS = ["choice", "yes/no", "score", "pass tray"];
const CALLS = [
  ["triage.ts", "category", 0], ["api.ts", "", 3], ["spam.py", "is_spam", 1], ["db.py", "", 3],
  ["chat.ts", "", 3], ["moderate.ts", "action", 0], ["utils.py", "", 3], ["summarize.ts", "", 3],
  ["auth.ts", "", 3], ["refunds.py", "fraud_risk 1-5", 2], ["billing.ts", "", 3], ["route.ts", "intent", 0],
].map(([file, field, pocket]) => ({ file, field, pocket }));
const N = CALLS.length;
const CYCLE = 2.6; // seconds per card

// ---------- the world (units of about 1 px; x along the machine, y toward the viewer, z up) ----------
const PLATE = { x: -152, y: -52, w: 272, d: 104, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

const CARD = { w: 30, d: 40, h: 1.2 };
const cardPlan = (cx) => ({ x: cx - CARD.w / 2, y: -CARD.d / 2, w: CARD.w, d: CARD.d, r: 1.5 });

const HOP_X = -118;
const HOP_BLOCK = { x: HOP_X - 20, y: -25, w: 40, d: 50, r: 3 };
const HOP_BLOCK_H = 6;
const SLEEVE_TOP = 22;
const STACK_TOP = 40; // the top face of the top card, whatever is left in the hopper
const GUIDE_TOP = 46;
const GUIDES = [[HOP_X - 17, -22], [HOP_X - 17, 22], [HOP_X + 17, -22], [HOP_X + 17, 22]];

const SCAN_X = -66;
const SCAN_BLOCK = { x: SCAN_X - 15, y: -17, w: 30, d: 34, r: 3 };
const SCAN_TOP = 42;

const TRAY = { x: -42, y: -26, w: 148, d: 52, r: 2 };
const TRAY_H = 2;
const WALL_TOP = 20;
const DIVIDERS = [-40, -4, 32, 68, 104];
const POCKET_X = [-22, 14, 50, 86];

const FLY = 50; // the carried card's underside while it travels
const BEAM = { x: -148, y: -40, w: 262, d: 6, r: 1.2 };
const BEAM_Z = 74;
const BEAM_H = 8;
const POSTS = [[-143, -37], [109, -37]];
const BODY_Z = 68; // underside of the picker's cylinder: the rod disappears into it
const ROD = 64;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [POSTS[0][0], POSTS[0][1], BEAM_Z + BEAM_H + 8], [POSTS[1][0], POSTS[1][1], BEAM_Z + BEAM_H + 8]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 56 },
);
const { at, S, L, D, byDepth, halo, axes } = tools(P);

// ---------- static parts ----------
function base() {
  const out = [basePlate(PLATE, PLATE_H, FOOT_H, P)];
  out.push(rulerStrip({ x: -138, y: PLATE.y + PLATE.d - 15, w: 84, d: 7, r: 1 }, 0, P));
  out.push(labelPlate({ x: -136, y: 27, w: 36, d: 9, r: 1.5 }, 0, P));
  // The one place words are engraved: a name on the plate in front of each pocket.
  POCKETS.forEach((name, p) => out.push(k.faceTextSvg(k.topMatrix([POCKET_X[p], 38], 0, P, "x"), name.replace(" tray", ""), { size: 6.5, tone: "mid", anchor: "middle" })));
  return out.join("");
}

function gantryBack() {
  const out = [];
  for (const [x, y] of byDepth(POSTS)) {
    out.push(S(k.cylinder(x, y, 7, 0, 1.8, P, 28), { tone: "mid" }));
    out.push(D([0, 1, 2, 3, 4, 5].map((n) => at([x + Math.cos(n * 1.047) * 5.2, y + Math.sin(n * 1.047) * 5.2, 1.8])), { size: 0.4 }));
    out.push(S(k.cylinder(x, y, 3, 1.8, BEAM_Z - 1.8, P, 24), { tone: "mid", crease: "none" }));
    out.push(L([20, 40, 60].map((z) => k.sideArc(x, y, 3, z, P, 14)).join(""), { tone: "faint" }));
  }
  out.push(S(k.slabOf(BEAM, BEAM_Z, BEAM_H, P, 3, 0.5), { tone: "mid" }));
  const ticks = k.topTicks(BEAM.x + 8, BEAM.x + BEAM.w - 8, 6, 5, BEAM.y + 0.6, BEAM_Z + BEAM_H, [1.6, 3], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  for (const x of [BEAM.x - 1, BEAM.x + BEAM.w - 3]) {
    out.push(S(k.slabOf({ x, y: BEAM.y - 1.5, w: 4, d: 9, r: 1 }, BEAM_Z - 1.5, BEAM_H + 3, P, 3, 0.4), { tone: "mid" }));
    out.push(D([at([x + 2, BEAM.y + 3, BEAM_Z + BEAM_H + 1.5])], { size: 0.45 }));
  }
  return out.join("");
}

function hopperBack() {
  const out = [halo(k.insetPlan(HOP_BLOCK, 2), 0, 0.1, 4)];
  out.push(S(k.slabOf(HOP_BLOCK, 0, HOP_BLOCK_H, P, 5, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(HOP_BLOCK, 3.5), HOP_BLOCK_H, P, 4), { tone: "faint" }));
  out.push(guide(GUIDES[0]));
  return out.join("");
}
function guide([x, y]) {
  return [
    S(k.cylinder(x, y, 2.4, HOP_BLOCK_H, 1.4, P, 16), { tone: "mid" }),
    S(k.cylinder(x, y, 1.2, HOP_BLOCK_H + 1.4, GUIDE_TOP - HOP_BLOCK_H - 1.4, P, 14), { tone: "mid", crease: "none" }),
    S(k.cylinder(x, y, 1.9, GUIDE_TOP, 1.4, P, 16), { tone: "mid" }),
  ].join("");
}
const liftRod = () => S(k.cylinder(HOP_X, 0, 1.8, HOP_BLOCK_H, STACK_TOP - N * CARD.h - 2 - HOP_BLOCK_H, P, 16), { tone: "mid", crease: "none" });
function sleeve() {
  return [
    S(k.cylinder(HOP_X, 0, 6, HOP_BLOCK_H, 1.6, P, 24), { tone: "mid" }),
    S(k.cylinder(HOP_X, 0, 4, HOP_BLOCK_H + 1.6, SLEEVE_TOP - HOP_BLOCK_H - 1.6, P, 22, 0.4), { tone: "mid" }),
    L(k.sideArc(HOP_X, 0, 4, 15, P, 14), { tone: "faint" }),
    L(k.ring(HOP_X, 0, 1.9, SLEEVE_TOP, P, 14), { tone: "lo" }),
  ].join("");
}
function liftPlate() {
  const plan = { x: HOP_X - 16, y: -21, w: 32, d: 42, r: 2 };
  const top = STACK_TOP - N * CARD.h;
  return S(k.slabOf(plan, top - 2, 2, P, 4, 0.4), { tone: "mid" }) + D(k.corners(plan, 3).map(([x, y]) => at([x, y, top])), { size: 0.4, tone: "lo" });
}
/** Hopper card j (0 = top, first to leave), drawn where it sits in a full deck. */
const hopperCard = (j) => S(k.slabOf(cardPlan(HOP_X), STACK_TOP - (j + 1) * CARD.h, CARD.h, P, 3), { tone: "hi", crease: "lo" });

function scanner() {
  const out = [halo(k.insetPlan(SCAN_BLOCK, 2), 0, 0.1, 4)];
  out.push(S(k.slabOf(SCAN_BLOCK, 0, 10, P, 5, 0.8), { tone: "mid" }));
  out.push(D(k.corners(SCAN_BLOCK, 3.5).map(([x, y]) => at([x, y, 10])), { size: 0.45 }));
  const vents = [-9, -5, -1, 3, 7].map((dy) => k.segment([SCAN_BLOCK.x + SCAN_BLOCK.w, dy, 3], [SCAN_BLOCK.x + SCAN_BLOCK.w, dy, 7.5], P));
  out.push(L(vents.join(""), { tone: "lo", free: true }));
  out.push(S(k.cylinder(SCAN_X, 0, 11, 10, 2, P, 40, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(SCAN_X, 0, 8.5, 12, SCAN_TOP - 16, P, 40), { tone: "mid", crease: "none" }));
  out.push(L([20, 28].map((z) => k.sideArc(SCAN_X, 0, 8.5, z, P, 24)).join(""), { tone: "faint" }));
  out.push(S(k.cylinder(SCAN_X, 0, 10, SCAN_TOP - 4, 4, P, 44, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(SCAN_X, 0, 10, SCAN_TOP - 3.4, SCAN_TOP - 0.4, 44, P, 0.3), { tone: "lo" }));
  out.push(L(k.ring(SCAN_X, 0, 7.4, SCAN_TOP, P, 40), { tone: "mid" }));
  out.push(L(k.ring(SCAN_X, 0, 4.6, SCAN_TOP, P, 28), { tone: "lo" }));
  return out.join("");
}
/** The scanner's lens: lit while it reads a card. */
const lens = (lit) => `<g data-part="lens-${lit ? "on" : "off"}"${lit ? " hidden" : ""}>${S(k.cylinder(SCAN_X, 0, 3, SCAN_TOP, 0.5, P, 24), { tone: "hi", lit })}</g>`;

function tray() {
  const out = [halo(k.insetPlan(TRAY, 3), 0, 0.1, 5)];
  out.push(S(k.slabOf(TRAY, 0, TRAY_H, P, 4, 0.5), { tone: "mid" }));
  out.push(S(k.slabOf({ x: TRAY.x, y: TRAY.y, w: TRAY.w, d: 2.4, r: 1 }, TRAY_H, WALL_TOP - TRAY_H, P, 3, 0.4), { tone: "mid" }));
  out.push(D(DIVIDERS.slice(0, -1).map((x) => at([x + 18, TRAY.y + 1.2, WALL_TOP])), { size: 0.4 }));
  return out.join("");
}
const divider = (x) =>
  S(k.slabOf({ x: x - 1, y: TRAY.y + 2.4, w: 2, d: TRAY.d - 2.4, r: 0.8 }, TRAY_H, WALL_TOP - TRAY_H - 4, P, 3, 0.3), { tone: "mid" }) +
  D([at([x, TRAY.y + TRAY.d - 3, WALL_TOP - 4])], { size: 0.4, tone: "lo" });
/** Pocket floor detail: the outline a card lands in. */
const seat = (p) => L(k.planOutline(k.insetPlan(cardPlan(POCKET_X[p]), -1.2), TRAY_H, P, 3), { tone: "faint" });
const pocketCard = (p, n) => S(k.slabOf(cardPlan(POCKET_X[p]), TRAY_H + n * CARD.h, CARD.h, P, 3), { tone: "hi", crease: "lo" });

// ---------- the picker: built at the hopper, flying; the live code moves it ----------
function hanging() {
  const cup = FLY + CARD.h;
  const card = (lit) => `<g data-part="card-${lit ? "lit" : "plain"}" hidden>${halo(k.insetPlan(cardPlan(HOP_X), 4), FLY, 0.1, 3)}${S(k.slabOf(cardPlan(HOP_X), FLY, CARD.h, P, 3), { tone: "hi", crease: "lo", lit })}</g>`;
  const rod = S(k.cylinder(HOP_X, 0, 1.1, cup + 3.4, ROD, P, 14), { tone: "mid", crease: "none" });
  const pad = S(k.cylinder(HOP_X, 0, 5, cup, 1.4, P, 24), { tone: "mid" }) + S(k.cylinder(HOP_X, 0, 2.6, cup + 1.4, 2, P, 18), { tone: "mid" });
  // The rod runs up into the cylinder body: clip it at the body's underside. A horizontal cut is exact, since
  // vertical edges stay vertical in this camera, and the body's bottom rim is drawn over the cut.
  const [, cutY] = at([HOP_X, 0, BODY_Z]);
  const clip = `<clipPath id="sorter-rod"><rect x="-200" y="${cutY.toFixed(1)}" width="${WIDTH + 400}" height="${HEIGHT + 400}"/></clipPath>`;
  return `${clip}<g clip-path="url(#sorter-rod)"><g data-part="drop">${card(false)}${card(true)}${rod}${pad}</g></g>`;
}
function carriage() {
  const out = [];
  out.push(S(k.slabOf({ x: HOP_X - 11, y: BEAM.y - 2, w: 22, d: 10, r: 2 }, BEAM_Z - 3, BEAM_H + 6, P, 4, 0.5), { tone: "mid" }));
  out.push(D([[-7, 0], [7, 0]].map(([dx]) => at([HOP_X + dx, BEAM.y + 3, BEAM_Z + BEAM_H + 3])), { size: 0.45 }));
  out.push(S(k.slabOf({ x: HOP_X - 3, y: BEAM.y + 8, w: 6, d: 30, r: 1.5 }, BEAM_Z + 3, 4, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(HOP_X, 0, 3.6, BODY_Z, BEAM_Z + 12 - BODY_Z, P, 22, 0.4), { tone: "mid" }));
  out.push(L(k.sideArc(HOP_X, 0, 3.6, BEAM_Z + 2, P, 14), { tone: "faint" }));
  out.push(S(k.cylinder(HOP_X, 0, 1.6, BEAM_Z + 12, 2.4, P, 14), { tone: "mid" }));
  const knob = [HOP_X + 7, BEAM.y + 3];
  out.push(S(k.cylinder(knob[0], knob[1], 2.4, BEAM_Z + BEAM_H + 3, 3, P, 18), { tone: "mid" }));
  out.push(L(k.knurl(knob[0], knob[1], 2.4, BEAM_Z + BEAM_H + 3, BEAM_Z + BEAM_H + 6, 16, P), { tone: "lo" }));
  return out.join("");
}

// ---------- assemble, back to front ----------
const slot = (name) => `<g data-slot="${name}"></g>`;
const body = [
  base(),
  gantryBack(),
  hopperBack(),
  liftRodGroup(),
  sleeve(),
  `<g data-part="stack">${liftPlate()}${Array.from({ length: N }, (_, j) => `<g data-card="${N - 1 - j}">${hopperCard(N - 1 - j)}</g>`).join("")}</g>`,
  slot("hopper"),
  ...byDepth(GUIDES.slice(1)).map(guide),
  scanner(),
  lens(false),
  lens(true),
  tray(),
  divider(DIVIDERS[0]),
  ...POCKET_X.map((_, p) => {
    const most = CALLS.filter((call) => call.pocket === p).length;
    return `${seat(p)}${Array.from({ length: most }, (_, n) => `<g data-pocket="${p}" data-n="${n}" hidden>${pocketCard(p, n)}</g>`).join("")}${slot("pocket" + p)}${divider(DIVIDERS[p + 1])}`;
  }),
  `<g data-part="hang">${hanging()}</g>`,
  slot("top"),
  `<g data-part="carriage">${carriage()}</g>`,
];
function liftRodGroup() {
  return `<g data-part="lift-rod">${liftRod()}</g>`;
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A card sorter on a base plate. A deck of twelve cards, one per LLM call, sits in a hopper on a rising lift plate. A picker on an overhead beam lifts the top card, carries it over a scanner column, and lowers it into one of four pockets: choice, yes or no, score, or the pass tray for calls that are not decisions. Five of the twelve cards end up in the three decision pockets.",
  body,
});

// ---------- live ----------
const live = `
var CALLS=${JSON.stringify(CALLS)},POCKETS=${JSON.stringify(POCKETS)},N=${N},CYCLE=${CYCLE};
var AX=${JSON.stringify(axes.x)},AZ=${JSON.stringify(axes.z)};
var HOP_X=${HOP_X},SCAN_X=${SCAN_X},POCKET_X=${JSON.stringify(POCKET_X)},FLY=${FLY},CARD_H=${CARD.h},STACK_TOP=${STACK_TOP},TRAY_H=${TRAY_H},CLEAR=${GUIDE_TOP + 1.4};
var stage=root.querySelector(".iso-stage"),svg=stage.querySelector("svg"),readout=root.querySelector("[data-readout]");
var q=function(s){return svg.querySelector(s)},qa=function(s){return [].slice.call(svg.querySelectorAll(s))};
var hang=q('[data-part="hang"]'),drop=q('[data-part="drop"]'),carriage=q('[data-part="carriage"]'),stack=q('[data-part="stack"]'),liftRod=q('[data-part="lift-rod"]');
var cardPlain=q('[data-part="card-plain"]'),cardLit=q('[data-part="card-lit"]'),lensOn=q('[data-part="lens-on"]'),lensOff=q('[data-part="lens-off"]');
var hopCards=qa("[data-card]"),pocketCards=qa("[data-pocket]"),slots={};
qa("[data-slot]").forEach(function(g){slots[g.getAttribute("data-slot")]=g});
var still=matchMedia("(prefers-reduced-motion: reduce)");
var clamp=function(v,a,b){return Math.min(b,Math.max(a,v))};
var ease=function(v){v=clamp(v,0,1);return v*v*(3-2*v)};
var span=function(u,a,b){return ease((u-a)/(b-a))};
var move=function(el,dx,dz){el.setAttribute("transform","translate("+(AX[0]*dx+AZ[0]*dz).toFixed(2)+" "+(AX[1]*dx+AZ[1]*dz).toFixed(2)+")")};
var show=function(el,on){if(el.hasAttribute("hidden")===on)el.toggleAttribute("hidden",!on)};
// How many cards lie in a pocket before card i arrives.
var before=function(i){var n=0;for(var j=0;j<i;j++)if(CALLS[j].pocket===CALLS[i].pocket)n++;return n};
var TOTAL=N*CYCLE;
/** Everything the figure shows at time t, from one timeline. */
function stateAt(t){
  if(t>=TOTAL-1e-6)return {i:N,x:HOP_X,z:FLY,held:false,lit:false,reading:false,taken:N,placed:N,slot:"top",u:1};
  var i=Math.floor(t/CYCLE),u=t/CYCLE-i,call=CALLS[i],px=POCKET_X[call.pocket];
  var rest=TRAY_H+before(i)*CARD_H;              // the underside of this card once it lies in its pocket
  var pick=STACK_TOP-CARD_H;                     // the underside of the top card in the hopper
  var x=HOP_X,z=FLY,held=false,slot="top";
  if(u<0.12){z=FLY+(pick-FLY)*span(u,0,0.12)}
  else if(u<0.24){z=pick+(FLY-pick)*span(u,0.12,0.24);held=true}
  else if(u<0.38){x=HOP_X+(SCAN_X-HOP_X)*span(u,0.24,0.38);held=true}
  else if(u<0.52){x=SCAN_X;held=true}
  else if(u<0.68){x=SCAN_X+(px-SCAN_X)*span(u,0.52,0.68);held=true}
  else if(u<0.80){x=px;z=FLY+(rest-FLY)*span(u,0.68,0.80);held=true}
  else if(u<0.88){x=px;z=rest+(FLY-rest)*span(u,0.80,0.88)}
  else{x=px+(HOP_X-px)*span(u,0.88,1)}
  if(z<CLEAR)slot=u<0.3?"hopper":"pocket"+call.pocket;
  return {i:i,u:u,call:call,x:x,z:z,held:held,slot:slot,
    lit:held&&u>=0.46&&call.pocket<3,reading:u>=0.38&&u<0.52,
    taken:i+span(u,0.12,0.24),placed:i+(u>=0.80?1:0)};
}
function textAt(s){
  if(s.i>=N)return "12 calls scanned \\u00b7 5 are decisions";
  var c=s.call,n=(s.i+1)+"/"+N+" \\u00b7 "+c.file;
  if(s.u<0.38)return n;
  if(s.u<0.46)return n+" \\u00b7 reading";
  return c.pocket<3?n+" \\u00b7 "+c.field+" \\u2192 "+POCKETS[c.pocket]:n+" \\u00b7 free text \\u2192 pass";
}
var said="",slotNow="";
function draw(t){
  var s=stateAt(t);
  move(carriage,s.x-HOP_X,0);move(hang,s.x-HOP_X,0);move(drop,0,s.z-FLY);
  if(s.slot!==slotNow){slots[s.slot].appendChild(hang);slotNow=s.slot}
  show(cardPlain,s.held&&!s.lit);show(cardLit,s.held&&s.lit);
  show(lensOn,s.reading);show(lensOff,!s.reading);
  move(stack,0,s.taken*CARD_H);move(liftRod,0,s.taken*CARD_H);
  var gone=s.i>=N?N:s.i+(s.u>=0.12?1:0);
  hopCards.forEach(function(g){show(g,+g.getAttribute("data-card")>=gone)});
  var counts=[0,0,0,0];for(var j=0;j<Math.min(s.placed,N);j++)counts[CALLS[j].pocket]++;
  pocketCards.forEach(function(g){show(g,+g.getAttribute("data-n")<counts[+g.getAttribute("data-pocket")])});
  var text=textAt(s);if(text!==said){readout.textContent=text;said=text}
}
var t=0,target=0,frame=0,last=0,visible=false,touring=!still.matches,idle=0,hold=0;
function tick(now){
  var dt=last?Math.min((now-last)/1000,1/30):1/60;last=now;
  if(touring){
    if(target>=TOTAL){hold+=dt;if(hold>3.2){hold=0;target=0;t=0}}
    else target=Math.min(TOTAL,target+dt);
    t=target;
  }else{
    t=still.matches?target:t+(target-t)*(1-Math.exp(-dt/0.22));
    if(Math.abs(target-t)<0.002)t=target;
  }
  draw(t);
  frame=visible&&(touring||t!==target)?requestAnimationFrame(tick):0;
}
var run=function(){if(!frame&&visible){last=0;frame=requestAnimationFrame(tick)}};
function steer(next){
  touring=false;target=clamp(next,0,TOTAL);clearTimeout(idle);
  idle=setTimeout(function(){if(still.matches)return;touring=true;target=t;run()},3600);
  stage.setAttribute("aria-valuenow",String(Math.min(N,Math.floor(target/CYCLE)+1)));
  stage.setAttribute("aria-valuetext",textAt(stateAt(Math.min(TOTAL,(Math.floor(target/CYCLE)+0.6)*CYCLE))));
  run();
}
new IntersectionObserver(function(e){visible=e[e.length-1].isIntersecting;if(visible)run()},{rootMargin:"120px 0px"}).observe(stage);
stage.addEventListener("pointermove",function(ev){
  if(ev.pointerType==="touch")return;
  var box=svg.getBoundingClientRect();
  steer(clamp(((ev.clientX-box.left)/box.width-0.1)/0.8,0,1)*TOTAL);
});
stage.addEventListener("pointerdown",function(ev){
  if(ev.pointerType!=="touch")return;
  steer((Math.floor(target/CYCLE)+1)%(N+1)*CYCLE+(Math.floor(target/CYCLE)+1>N?0:0.6*CYCLE));
});
stage.addEventListener("keydown",function(ev){
  var i=Math.floor(Math.min(target,TOTAL-0.001)/CYCLE),to=null;
  if(ev.key==="ArrowRight"||ev.key==="ArrowUp")to=target>=TOTAL?N:i+1;
  if(ev.key==="ArrowLeft"||ev.key==="ArrowDown")to=target>=TOTAL?N-1:i-1;
  if(ev.key==="Home")to=0;
  if(ev.key==="End")to=N;
  if(to===null)return;
  ev.preventDefault();
  to=clamp(to,0,N);
  steer(to>=N?TOTAL:(to+0.6)*CYCLE);
});
// For the visual checks: stage.dispatchEvent(new CustomEvent("fig-seek",{detail:seconds})) freezes the timeline there.
stage.addEventListener("fig-seek",function(ev){touring=false;clearTimeout(idle);target=t=ev.detail;draw(t)});
if(still.matches){target=TOTAL;t=TOTAL}
draw(t);
`;

writeFigure("sorter", {
  fig: "Fig 1",
  title: "jev-swap scan",
  hint: "Hover to scrub · arrows step",
  readout: "1/12 · triage.ts",
  keys: [
    { mark: "lit", label: "A call the scanner read as a decision" },
    { mark: "raised", label: "Pockets, left to right: choice, yes/no, score, pass" },
  ],
  caption:
    "A demo codebase with twelve LLM calls. The picker carries each one over the scanner; five return a label, a yes/no or a score and land in a decision pocket, and seven write free text and go to the pass tray.",
  stage: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Card sorter: arrow keys step through the twelve calls" aria-valuemin="1" aria-valuemax="12" aria-valuenow="1">${svg}</div>`,
  live,
});
