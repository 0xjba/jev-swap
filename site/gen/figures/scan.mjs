// Fig 1 · jev-swap scan, as its own machine.
// Your codebase is a tray of twelve file tiles (the same files as the scan output on the page). A scan bar rides
// two rails across the tray. Each LLM call it reads as a decision lifts and lights; the tile stays where it is,
// because jev-swap never removes your call, and a card for it slides down the rail of its type into the Jev
// unit: choice, yes/no or score. The bar, the tiles, the cards, the pips and the readout read one timeline.
import { k, tools, basePlate, writeFigure } from "./common.mjs";

const WIDTH = 660;
const HEIGHT = 360;

// ---------- the model ----------
const TYPES = ["choice", "yes/no", "score"];
// [file, line, field, type] for decisions; rows run far to near, columns left to right.
const GRID = [
  [["triage.ts", 15, "category", 0], ["api.ts"], ["spam.py", 8, "is_spam", 1], ["db.py"]],
  [["chat.ts"], ["moderate.ts", 6, "action", 0], ["utils.py"], ["summarize.ts"]],
  [["auth.ts"], ["refunds.py", 9, "fraud_risk", 2], ["billing.ts"], ["route.ts", 21, "intent", 0]],
];
const COLS = 4;
const ROWS = 3;
const SWEEP = 6.4; // seconds for the bar to cross the tray
const TRAVEL = 1.5; // seconds for a card to reach the Jev unit
const TAIL = 1.9; // after the sweep: the last card arrives

// ---------- the world ----------
const PLATE = { x: -160, y: -60, w: 296, d: 120, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

const TRAY = { x: -150, y: -47, w: 118, d: 94, r: 4 };
const TRAY_TOP = 12;
const TILE = 22;
const colX = (c) => -128 + 26 * c;
const rowY = (r) => -27 + 27 * r;
const TILE_H = 3;
const LIFT = 5;

const RAIL_Y = [-43.5, 43.5];
const BAR_FROM = -141;
const BAR_TO = -41;
const BAR_Z = 30;

const LANE_Y = [-18, 0, 18];
const LANE_Z = 5;
const UNIT = { x: 40, y: -36, w: 84, d: 72, r: 5 };
const UNIT_TOP = 30;
const CARD = { w: 16, d: 11, h: 1.6 };
const CARD_FROM = TRAY.x + TRAY.w - CARD.w / 2 - 2; // hidden inside the tray's edge
const CARD_TO = UNIT.x + CARD.w / 2 + 4; // inside the unit

const P = k.fitProjection([...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BAR_FROM, RAIL_Y[0], BAR_Z + 8], [UNIT.x, UNIT.y, UNIT_TOP + 4]], WIDTH, HEIGHT, { pad: 14, azimuth: 56 });
const { at, S, L, D, byDepth, halo, axes } = tools(P);

// The finds, in the order the bar reaches them (column by column, far row first).
const FINDS = [];
for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (GRID[r][c].length > 1) FINDS.push({ r, c, file: GRID[r][c][0], line: GRID[r][c][1], field: GRID[r][c][2], type: GRID[r][c][3] });
const barAt = (c) => (colX(c) - BAR_FROM) / (BAR_TO - BAR_FROM); // share of the sweep when the bar is over column c
FINDS.forEach((f, n) => {
  f.at = barAt(f.c) * SWEEP;
  // Cards leave one at a time, a beat after the tile lights.
  f.leaves = Math.max(f.at + 0.35, n ? FINDS[n - 1].leaves + 0.55 : 0);
});
const TOTAL = Math.max(SWEEP, FINDS[FINDS.length - 1].leaves + TRAVEL) + 0.2;

// ---------- static parts ----------
function tray() {
  const out = [halo(k.insetPlan(TRAY, 2), 0, 0.1, 5)];
  out.push(S(k.slabOf(TRAY, 0, TRAY_TOP, P, 6, 1), { tone: "mid" }));
  out.push(L(k.sideSeam(TRAY, 4, P, 6), { tone: "faint" }));
  out.push(D(k.corners(TRAY, 4).map(([x, y]) => at([x, y, TRAY_TOP])), { size: 0.45 }));
  // The pocket each tile sits in.
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) out.push(L(k.planOutline({ x: colX(c) - TILE / 2 - 1, y: rowY(r) - TILE / 2 - 1, w: TILE + 2, d: TILE + 2, r: 2.5 }, TRAY_TOP, P, 3), { tone: "faint" }));
  // Three card exits in the edge that faces the Jev unit.
  for (const y of LANE_Y) out.push(L(k.segment([TRAY.x + TRAY.w, y - CARD.d / 2 - 1, LANE_Z + CARD.h + 0.8], [TRAY.x + TRAY.w, y + CARD.d / 2 + 1, LANE_Z + CARD.h + 0.8], P), { tone: "lo", free: true }));
  return out.join("");
}
function tile(r, c) {
  const [file, , , type] = GRID[r][c];
  const plan = { x: colX(c) - TILE / 2, y: rowY(r) - TILE / 2, w: TILE, d: TILE, r: 2 };
  const one = (lit) =>
    `<g data-lit="${lit ? 1 : 0}"${lit ? " hidden" : ""}>${S(k.slabOf(plan, TRAY_TOP, TILE_H, P, 3, 0.4), { tone: "mid", crease: "lo", lit })}${k.faceTextSvg(k.topMatrix([colX(c), rowY(r) + 1.2], TRAY_TOP + TILE_H, P, "x"), file, { size: 3.1, tone: "mid", anchor: "middle" }).replace("<text ", lit ? '<text style="fill:#1E1E1E" ' : "<text ")}</g>`;
  return type === undefined ? one(false) : `<g data-tile="${r}-${c}">${one(false)}${one(true)}</g>`;
}
function rails() {
  const out = [];
  for (const y of RAIL_Y) {
    out.push(S(k.slabOf({ x: TRAY.x + 3, y: y - 1.6, w: TRAY.w - 6, d: 3.2, r: 0.8 }, TRAY_TOP, 2, P, 3, 0.3), { tone: "mid" }));
    out.push(D([TRAY.x + 7, TRAY.x + TRAY.w - 7].map((x) => at([x, y, TRAY_TOP + 2])), { size: 0.4 }));
  }
  return out;
}
/** One leg of the scan bar, on its rail: a shoe, an upright and a cap. */
const leg = (y) =>
  S(k.slabOf({ x: BAR_FROM - 5, y: y - 2.6, w: 10, d: 5.2, r: 1.2 }, TRAY_TOP + 2, 3, P, 3, 0.3), { tone: "mid" }) +
  S(k.slabOf({ x: BAR_FROM - 2.2, y: y - 2, w: 4.4, d: 4, r: 1 }, TRAY_TOP + 5, BAR_Z - TRAY_TOP - 5, P, 3), { tone: "mid", crease: "none" });
function crossbar() {
  const bar = { x: BAR_FROM - 3.4, y: RAIL_Y[0] - 3, w: 6.8, d: RAIL_Y[1] - RAIL_Y[0] + 6, r: 1.4 };
  return [
    // The lamp under the bar: the lit line that reads the tiles.
    S(k.slabOf({ x: BAR_FROM - 1.2, y: RAIL_Y[0] + 4, w: 2.4, d: RAIL_Y[1] - RAIL_Y[0] - 8, r: 0.6 }, BAR_Z - 1.6, 1.6, P, 2), { tone: "hi", lit: true, crease: "none" }),
    S(k.slabOf(bar, BAR_Z, 5, P, 3, 0.5), { tone: "hi", crease: "lo" }),
    D([bar.y + 3, bar.y + bar.d - 3].map((y) => at([BAR_FROM, y, BAR_Z + 5])), { size: 0.45 }),
    L(k.lineOnTop([BAR_FROM, bar.y + 8], [BAR_FROM, bar.y + bar.d - 8], BAR_Z + 5, P), { tone: "faint", free: true }),
  ].join("");
}

function lanes() {
  const out = [];
  LANE_Y.forEach((y) => {
    const plan = { x: TRAY.x + TRAY.w, y: y - 6.5, w: UNIT.x - TRAY.x - TRAY.w, d: 13, r: 1 };
    out.push(S(k.slabOf(plan, 0, LANE_Z, P, 3, 0.4), { tone: "mid" }));
    const rollers = [];
    for (let x = plan.x + 4; x < plan.x + plan.w - 2; x += 4.6) rollers.push(k.lineOnTop([x, plan.y], [x, plan.y + plan.d], LANE_Z, P));
    out.push(L(rollers.join(""), { tone: "lo" }));
  });
  return out.join("");
}
/** A card for one find, built at its lane's start; the clip hides the part still inside the tray. */
function card(n) {
  const y = LANE_Y[FINDS[n].type];
  const plan = { x: CARD_FROM - CARD.w / 2, y: y - CARD.d / 2, w: CARD.w, d: CARD.d, r: 1.4 };
  return `<g data-card="${n}" hidden>${S(k.slabOf(plan, LANE_Z, CARD.h, P, 3), { tone: "hi", lit: true, crease: "none" })}</g>`;
}
const cardClip = () => `<clipPath id="scan-cards"><path d="${k.slabOf({ x: TRAY.x + TRAY.w, y: -40, w: 200, d: 80, r: 0.5 }, 0, 30, P, 2).fill}"/></clipPath>`;

const PIPS = [3, 1, 1]; // how many decisions of each type the demo codebase holds
const pipAt = (type, n) => [UNIT.x + 12 + n * 6.5, LANE_Y[type]];
function unit() {
  const out = [halo(k.insetPlan(UNIT, 2), 0, 0.1, 6)];
  out.push(S(k.slabOf(UNIT, 0, UNIT_TOP, P, 7, 1.2), { tone: "hi", crease: "lo" }));
  out.push(L(k.sideSeam(UNIT, 6, P, 7), { tone: "faint" }), L(k.sideSeam(UNIT, UNIT_TOP - 5, P, 7), { tone: "faint" }));
  out.push(D(k.corners(UNIT, 5).map(([x, y]) => at([x, y, UNIT_TOP])), { size: 0.5 }));
  // Per type: a row of seats that fill as cards arrive, and the type's name.
  TYPES.forEach((name, type) => {
    out.push(L(Array.from({ length: PIPS[type] }, (_, n) => k.ring(...pipAt(type, n), 2.1, UNIT_TOP, P, 14)).join(""), { tone: "mid" }));
    out.push(k.faceTextSvg(k.topMatrix([UNIT.x + 34, LANE_Y[type] + 1.6], UNIT_TOP, P, "x"), name, { size: 4.6, tone: "mid" }));
  });
  // The jev switch from the logo: a pill track; its knob slides on when the first decision arrives.
  const pill = { x: UNIT.x + 58, y: -9, w: 18, d: 18, r: 9 };
  out.push(L(k.planOutline({ x: pill.x - 2, y: -22, w: 22, d: 44, r: 11 }, UNIT_TOP, P, 10), { tone: "hi" }));
  return out.join("");
}
const pip = (type, n) => `<g data-pip="${type}-${n}" hidden>${S(k.cylinder(...pipAt(type, n), 1.5, UNIT_TOP, 0.8, P, 12), { tone: "hi", lit: true, crease: "none" })}</g>`;
/** The switch knob, built in the off position (far end of the track). */
const knob = (lit) => `<g data-knob="${lit ? 1 : 0}"${lit ? " hidden" : ""}>${S(k.cylinder(UNIT.x + 67, -11, 6.5, UNIT_TOP, 2.4, P, 28, 0.5), { tone: "hi", crease: "lo", lit })}</g>`;
const KNOB_TRAVEL = 22;

function base() {
  const out = [basePlate(PLATE, PLATE_H, FOOT_H, P)];
  out.push(k.faceTextSvg(k.topMatrix([colX(1) + 13, TRAY.y + TRAY.d + 7.5], 0, P, "x"), "your codebase", { size: 5.4, tone: "mid", anchor: "middle" }));
  out.push(k.faceTextSvg(k.topMatrix([UNIT.x + UNIT.w / 2, UNIT.y + UNIT.d + 7.5], 0, P, "x"), "jev", { size: 6.4, tone: "mid", anchor: "middle" }));
  return out.join("");
}

const tiles = [];
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) tiles.push({ r, c });
const [railFar, railNear] = rails();
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "jev-swap's scan as a machine. A tray holds twelve file tiles, your codebase. A scan bar rides two rails across the tray; the five tiles whose LLM call is a decision lift and light up as it passes. For each one a card slides down one of three rails, choice, yes or no, and score, into a unit marked jev, whose switch turns on.",
  body: [
    base(),
    tray(),
    railFar,
    `<g data-part="bar-back">${leg(RAIL_Y[0])}</g>`,
    ...byDepth(tiles.map(({ r, c }) => [colX(c), rowY(r), r, c])).map(([, , r, c]) => tile(r, c)),
    railNear,
    `<g data-part="bar-front">${crossbar()}${leg(RAIL_Y[1])}</g>`,
    lanes(),
    cardClip(),
    `<g clip-path="url(#scan-cards)">${FINDS.map((_, n) => card(n)).join("")}</g>`,
    unit(),
    ...TYPES.flatMap((_, type) => Array.from({ length: PIPS[type] }, (_, n) => pip(type, n))),
    `<g data-part="knob">${knob(false)}${knob(true)}</g>`,
  ],
});

// ---------- live ----------
const live = `
var FINDS=${JSON.stringify(FINDS)},TYPES=${JSON.stringify(TYPES)},SWEEP=${SWEEP},TRAVEL=${TRAVEL},TOTAL=${TOTAL.toFixed(3)};
var AX=${JSON.stringify(axes.x)},AY=${JSON.stringify(axes.y)},AZ=${JSON.stringify(axes.z)};
var BAR=${BAR_TO - BAR_FROM},LIFT=${LIFT},RUN=${CARD_TO - CARD_FROM},KNOB=${KNOB_TRAVEL};
var stage=root.querySelector(".iso-stage"),svg=stage.querySelector("svg"),readout=root.querySelector("[data-readout]");
var q=function(s){return svg.querySelector(s)};
var barBack=q('[data-part="bar-back"]'),barFront=q('[data-part="bar-front"]'),knob=q('[data-part="knob"]'),knobOff=q('[data-knob="0"]'),knobOn=q('[data-knob="1"]');
var parts=FINDS.map(function(f,n){var g=q('[data-tile="'+f.r+'-'+f.c+'"]');return {tile:g,plain:g.querySelector('[data-lit="0"]'),lit:g.querySelector('[data-lit="1"]'),card:q('[data-card="'+n+'"]')}});
var seen=[0,0,0];FINDS.forEach(function(f,n){parts[n].pip=q('[data-pip="'+f.type+'-'+seen[f.type]+'"]');seen[f.type]++});
var still=matchMedia("(prefers-reduced-motion: reduce)");
var clamp=function(v,a,b){return Math.min(b,Math.max(a,v))};
var ease=function(v){v=clamp(v,0,1);return v*v*(3-2*v)};
var shift=function(el,x,y,z){el.setAttribute("transform","translate("+(AX[0]*x+AY[0]*y+AZ[0]*z).toFixed(2)+" "+(AX[1]*x+AY[1]*y+AZ[1]*z).toFixed(2)+")")};
var show=function(el,on){if(el.hasAttribute("hidden")===on)el.toggleAttribute("hidden",!on)};
function textAt(t){
  var found=0,last=null,arrived=0;
  FINDS.forEach(function(f){if(t>=f.at){found++;last=f}if(t>=f.leaves+TRAVEL)arrived++});
  if(t>=TOTAL-0.05)return "Found 5 decisions in 12 files";
  if(!last)return "$ jev-swap scan ./app";
  return last.file+":"+last.line+" \\u00b7 "+last.field+" \\u2192 "+TYPES[last.type]+" \\u00b7 "+found+" found";
}
var said="";
function draw(t){
  var x=BAR*clamp(t/SWEEP,0,1);
  shift(barBack,x,0,0);shift(barFront,x,0,0);
  var arrived=0;
  FINDS.forEach(function(f,n){
    var p=parts[n],up=ease((t-f.at+0.18)/0.36),on=t>=f.at;
    shift(p.tile,0,0,LIFT*up);show(p.lit,on);show(p.plain,!on);
    var go=(t-f.leaves)/TRAVEL;
    show(p.card,go>0&&go<1);
    if(go>0&&go<1)shift(p.card,RUN*ease(go),0,0);
    show(p.pip,go>=0.94);if(go>=0.94)arrived++;
  });
  var first=FINDS[0].leaves+TRAVEL*0.94,slide=ease((t-first)/0.5);
  shift(knob,0,KNOB*slide,0);show(knobOn,slide>0.5);show(knobOff,slide<=0.5);
  var text=textAt(t);if(text!==said){readout.textContent=text;said=text}
}
var t=0,target=0,frame=0,last=0,visible=false,touring=!still.matches,idle=0,hold=0;
function tick(now){
  var dt=last?Math.min((now-last)/1000,1/30):1/60;last=now;
  if(touring){
    if(target>=TOTAL){hold+=dt;if(hold>3.4){hold=0;target=0}}
    else target=Math.min(TOTAL,target+dt);
    t=target;
  }else{
    t=still.matches?target:t+(target-t)*(1-Math.exp(-dt/0.2));
    if(Math.abs(target-t)<0.002)t=target;
  }
  draw(t);
  frame=visible&&(touring||t!==target)?requestAnimationFrame(tick):0;
}
var run=function(){if(!frame&&visible){last=0;frame=requestAnimationFrame(tick)}};
function steer(next){
  touring=false;target=clamp(next,0,TOTAL);clearTimeout(idle);
  idle=setTimeout(function(){if(still.matches)return;touring=true;target=t;run()},3600);
  stage.setAttribute("aria-valuenow",String(Math.round(target/TOTAL*100)));
  stage.setAttribute("aria-valuetext",textAt(target));
  run();
}
new IntersectionObserver(function(e){visible=e[e.length-1].isIntersecting;if(visible)run()},{rootMargin:"120px 0px"}).observe(stage);
var fromPointer=function(ev){var box=svg.getBoundingClientRect();return clamp(((ev.clientX-box.left)/box.width-0.08)/0.8,0,1)*TOTAL};
stage.addEventListener("pointermove",function(ev){if(ev.pointerType!=="touch")steer(fromPointer(ev))});
stage.addEventListener("pointerdown",function(ev){if(ev.pointerType==="touch")steer(fromPointer(ev))});
stage.addEventListener("keydown",function(ev){
  var stops=[0].concat(FINDS.map(function(f){return f.leaves+TRAVEL})),to=null;stops[stops.length-1]=TOTAL;
  var here=0;stops.forEach(function(s,i){if(target>=s-0.01)here=i});
  if(ev.key==="ArrowRight"||ev.key==="ArrowUp")to=stops[Math.min(stops.length-1,here+1)];
  if(ev.key==="ArrowLeft"||ev.key==="ArrowDown")to=stops[Math.max(0,here-1)];
  if(ev.key==="Home")to=0;
  if(ev.key==="End")to=TOTAL;
  if(to===null)return;
  ev.preventDefault();steer(to);
});
// For the visual checks: freeze the timeline at a time in seconds.
stage.addEventListener("fig-seek",function(ev){touring=false;clearTimeout(idle);target=t=ev.detail;draw(t)});
if(still.matches){target=TOTAL;t=TOTAL}
draw(t);
`;

writeFigure("scan", {
  fig: "Fig 1",
  title: "jev-swap scan",
  hint: "Hover to scrub · arrows step",
  readout: "$ jev-swap scan ./app",
  keys: [
    { mark: "lit", label: "An LLM call that only returns a label, a yes/no or a score" },
    { mark: "raised", label: "A call that writes free text: left as it is" },
  ],
  caption:
    "A demo codebase of twelve files. The scan bar reads every LLM call; the five that are really decisions light up, and each one gets a card on the rail of its type into Jev. The tiles stay in the tray: jev-swap writes new code beside your call and never removes it.",
  stage: `<div class="iso-stage" tabindex="0" role="slider" aria-label="jev-swap scan: arrow keys step through the five decisions it finds" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">${svg}</div>`,
  live,
});
