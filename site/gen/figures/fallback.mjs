// Fig 2 · The safety net: a rail with a gap.
// Jev's answers leave the Jev unit as bars; a bar's length is the answer's confidence. The rail to your app has
// a gap whose width is the threshold. A bar long enough bridges the gap and rides on: Jev's answer is used.
// A shorter bar falls through into your LLM, which answers instead and sends its own bar along the lower rail.
// Widening the gap is raising the threshold. Bars, pips and readout all come from the same eight confidences.
import { k, tools, basePlate, writeFigure } from "./common.mjs";

const WIDTH = 680;
const HEIGHT = 330;

// ---------- the model ----------
// Eight example confidences (illustrative, not measured). 0.7 is the default threshold jev-swap writes.
const CONF = [0.93, 0.58, 0.88, 0.97, 0.74, 0.46, 0.91, 0.82];
const N = CONF.length;
const CYCLE = 2.7; // seconds one answer takes from the Jev unit to your app, by the slow path
const STEP = 1.15; // seconds between answers
const TOUR = [0.7, 0.9, 0.5];
const RANGE = [0.4, 0.95];
const lengthOf = (c) => 12 + 26 * c; // a bar's length, and the gap that the same threshold opens

// ---------- the world ----------
const PLATE = { x: -166, y: -44, w: 332, d: 88, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

const JEV = { x: -156, y: -28, w: 56, d: 56, r: 5 };
const APP = { x: 104, y: -28, w: 52, d: 56, r: 5 };
const UNIT_TOP = 54;
const RAIL = 40; // top of the upper rail
const GAP = [-30, 10]; // the left rail's end, and the right rail's start
const LEFT = { x: JEV.x + JEV.w, y: -6, w: GAP[0] - JEV.x - JEV.w, d: 12, r: 1 };
const RIGHT = { x: GAP[1], y: -6, w: APP.x - GAP[1], d: 12, r: 1 };
const LLM = { x: -38, y: -20, w: 56, d: 40, r: 3 };
const LLM_TOP = 22;
const FLOOR = 2;
const LOW = 4; // top of the lower rail
const LOWER = { x: LLM.x + LLM.w, y: -6, w: APP.x - LLM.x - LLM.w, d: 12, r: 1 };
const BAR = { d: 8, h: 4 };

const P = k.fitProjection([...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [JEV.x, JEV.y, UNIT_TOP + 6], [APP.x + APP.w, APP.y, UNIT_TOP + 6]], WIDTH, HEIGHT, { pad: 14, azimuth: 58 });
const { at, S, L, D, byDepth, halo, axes } = tools(P);

// ---------- static parts ----------
function base() {
  const out = [basePlate(PLATE, PLATE_H, FOOT_H, P)];
  const word = (text, x) => out.push(k.faceTextSvg(k.topMatrix([x, PLATE.y + PLATE.d - 7], 0, P, "x"), text, { size: 6, tone: "mid", anchor: "middle" }));
  word("jev", JEV.x + JEV.w / 2);
  word("your llm", LLM.x + LLM.w / 2);
  word("your app", APP.x + APP.w / 2);
  return out.join("");
}
/** A unit: a cased block with two seams and corner screws. */
function unitBlock(plan) {
  return [
    halo(k.insetPlan(plan, 2), 0, 0.1, 6),
    S(k.slabOf(plan, 0, UNIT_TOP, P, 7, 1.2), { tone: "hi", crease: "lo" }),
    L(k.sideSeam(plan, 6, P, 7), { tone: "faint" }),
    L(k.sideSeam(plan, UNIT_TOP - 5, P, 7), { tone: "faint" }),
    D(k.corners(plan, 5).map(([x, y]) => at([x, y, UNIT_TOP])), { size: 0.5 }),
  ].join("");
}
function jevUnit() {
  const cx = JEV.x + JEV.w / 2;
  return [
    unitBlock(JEV),
    // The jev switch from the logo, on: the knob sits at the near end of its track, lit.
    L(k.planOutline({ x: cx - 10, y: -20, w: 20, d: 40, r: 10 }, UNIT_TOP, P, 10), { tone: "hi" }),
    S(k.cylinder(cx, 10, 6.4, UNIT_TOP, 2.4, P, 28, 0.5), { tone: "hi", crease: "lo", lit: true }),
  ].join("");
}
const post = (x, y) =>
  S(k.cylinder(x, y, 4.6, 0, 1.6, P, 22), { tone: "mid" }) + S(k.cylinder(x, y, 2.3, 1.6, RAIL - 4 - 1.6 - 3, P, 18), { tone: "mid", crease: "none" }) + L(k.sideArc(x, y, 2.3, 18, P, 12), { tone: "faint" });
function backPosts() {
  const out = [post(-52, 0)];
  // The right rail hangs off two posts behind it, so the lower rail runs clear underneath.
  for (const x of [34, 80]) out.push(post(x, -13) + S(k.slabOf({ x: x - 2.5, y: -15.5, w: 5, d: 10, r: 1 }, RAIL - 7, 3, P, 3, 0.3), { tone: "mid" }));
  return out.join("");
}
function hopperBack() {
  const out = [halo(k.insetPlan(LLM, 2), 0, 0.1, 6)];
  out.push(S(k.slabOf(LLM, 0, FLOOR, P, 4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: LLM.x, y: LLM.y, w: 2.4, d: LLM.d, r: 1 }, FLOOR, LLM_TOP - FLOOR, P, 3, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: LLM.x, y: LLM.y, w: LLM.w, d: 2.4, r: 1 }, FLOOR, LLM_TOP - FLOOR, P, 3, 0.3), { tone: "mid" }));
  return out.join("");
}
function hopperFront() {
  const out = [];
  const side = { x: LLM.x + LLM.w - 2.4, y: LLM.y, w: 2.4, d: LLM.d, r: 1 };
  const front = { x: LLM.x, y: LLM.y + LLM.d - 2.4, w: LLM.w, d: 2.4, r: 1 };
  out.push(S(k.slabOf(side, FLOOR, LLM_TOP - FLOOR, P, 3, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf(front, FLOOR, LLM_TOP - FLOOR, P, 3, 0.3), { tone: "mid" }));
  // Cooling slots in the front wall: the big, slow model.
  const slots = [];
  for (let x = LLM.x + 8; x < LLM.x + LLM.w - 6; x += 5) slots.push(k.segment([x, LLM.y + LLM.d, 6], [x, LLM.y + LLM.d, 16], P));
  out.push(L(slots.join(""), { tone: "lo", free: true }));
  out.push(D([LLM.x + 4, LLM.x + LLM.w - 4].map((x) => at([x, LLM.y + LLM.d - 1.2, LLM_TOP])), { size: 0.4 }));
  return out.join("");
}
function rail(plan, top) {
  const out = [S(k.slabOf(plan, top - 4, 4, P, 3, 0.4), { tone: "mid" })];
  const rollers = [];
  for (let x = plan.x + 4; x < plan.x + plan.w - 2; x += 4.6) rollers.push(k.lineOnTop([x, plan.y], [x, plan.y + plan.d], top, P));
  out.push(L(rollers.join(""), { tone: "lo" }));
  return out.join("");
}
/** The sliding tongue that sets the gap: built with its tip at the right rail's start, fully home. */
const tongue = () => S(k.slabOf({ x: GAP[1], y: -5, w: 34, d: 10, r: 1 }, RAIL - 3.4, 3.4, P, 3, 0.3), { tone: "hi", crease: "lo" });
function handle() {
  return [
    S(k.slabOf({ x: GAP[1] + 2, y: 5, w: 6, d: 9, r: 1.2 }, RAIL - 2.4, 2.4, P, 3, 0.3), { tone: "hi", crease: "lo" }),
    S(k.cylinder(GAP[1] + 5, 11, 2.6, RAIL, 4, P, 18), { tone: "hi", crease: "lo" }),
    L(k.knurl(GAP[1] + 5, 11, 2.6, RAIL, RAIL + 4, 16, P), { tone: "lo" }),
  ].join("");
}
function appUnit() {
  const out = [unitBlock(APP)];
  [["jev", -10], ["llm", 8]].forEach(([name, y]) => {
    out.push(k.faceTextSvg(k.topMatrix([APP.x + 5, y + 1.5], UNIT_TOP, P, "x"), name, { size: 4.4, tone: "mid" }));
    out.push(L(Array.from({ length: N }, (_, n) => k.ring(APP.x + 19.5 + n * 3.9, y, 1.3, UNIT_TOP, P, 12)).join(""), { tone: "lo" }));
  });
  return out.join("");
}
const pip = (row, n) => `<g data-pip="${row}-${n}" hidden>${S(k.cylinder(APP.x + 19.5 + n * 3.9, row ? 8 : -10, 1, UNIT_TOP, 0.7, P, 10), { tone: "hi", lit: !row, crease: "none" })}</g>`;

/** One answer bar, centred on x = 0 on the upper rail. */
function bar(j) {
  const len = lengthOf(CONF[j]);
  const plan = { x: -len / 2, y: -BAR.d / 2, w: len, d: BAR.d, r: 1.2 };
  const one = (lit) => `<g data-lit="${lit ? 1 : 0}"${lit ? " hidden" : ""}>${S(k.slabOf(plan, RAIL, BAR.h, P, 3, 0.3), { tone: "hi", crease: "lo", lit })}</g>`;
  return `<g data-bar="${j}" hidden>${one(false)}${one(true)}</g>`;
}
const hull = (id, x) => `<clipPath id="${id}"><path d="${k.slabOf({ x, y: -14, w: 340, d: 28, r: 0.5 }, 0, 70, P, 2).fill}"/></clipPath>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A rail with a gap, on a base plate. Bars leave a unit marked jev; each bar is as long as one answer's confidence. The rail to a unit marked your app has a gap set by a sliding tongue: the threshold. Longer bars bridge the gap and ride on. Shorter bars fall through into an open box marked your llm, which sends its own bar to your app along a lower rail.",
  body: [
    base(),
    jevUnit(),
    backPosts(),
    hopperBack(),
    `<g data-slot="hopper"></g>`,
    hopperFront(),
    rail(LOWER, LOW),
    hull("fall-lower", LLM.x + LLM.w),
    `<g clip-path="url(#fall-lower)"><g data-slot="lower"></g></g>`,
    rail(LEFT, RAIL),
    `<g data-part="tongue">${tongue()}</g>`,
    rail(RIGHT, RAIL),
    `<g data-part="handle">${handle()}</g>`,
    hull("fall-upper", JEV.x + JEV.w),
    `<g clip-path="url(#fall-upper)"><g data-slot="upper">${Array.from({ length: N }, (_, j) => bar(j)).join("")}</g></g>`,
    appUnit(),
    ...[0, 1].flatMap((row) => Array.from({ length: N }, (_, n) => pip(row, n))),
  ],
});

// ---------- live ----------
const live = `
var CONF=${JSON.stringify(CONF)},N=${N},CYCLE=${CYCLE},STEP=${STEP},TOURS=${JSON.stringify(TOUR)},RANGE=${JSON.stringify(RANGE)};
var AX=${JSON.stringify(axes.x)},AZ=${JSON.stringify(axes.z)};
var OUT=${JEV.x + JEV.w},EDGE=${GAP[0]},HOME=${GAP[1]},APP=${APP.x},LLM_OUT=${LLM.x + LLM.w},RAIL=${RAIL},FLOOR=${FLOOR},LOW=${LOW};
var stage=root.querySelector(".iso-stage"),svg=stage.querySelector("svg"),readout=root.querySelector("[data-readout]");
var q=function(s){return svg.querySelector(s)};
var tongue=q('[data-part="tongue"]'),handle=q('[data-part="handle"]'),slots={};
[].forEach.call(svg.querySelectorAll("[data-slot]"),function(g){slots[g.getAttribute("data-slot")]=g});
var bars=[].slice.call(svg.querySelectorAll("[data-bar]")).map(function(g){return {g:g,plain:g.querySelector('[data-lit="0"]'),lit:g.querySelector('[data-lit="1"]'),x:null,z:0,slot:"upper",on:false,shown:false}});
var pips=[[],[]];[0,1].forEach(function(r){for(var n=0;n<N;n++)pips[r].push(q('[data-pip="'+r+'-'+n+'"]'))});
var still=matchMedia("(prefers-reduced-motion: reduce)");
var clamp=function(v,a,b){return Math.min(b,Math.max(a,v))};
var ease=function(v){v=clamp(v,0,1);return v*v*(3-2*v)};
var span=function(u,a,b){return ease((u-a)/(b-a))};
var shift=function(el,x,z){el.setAttribute("transform","translate("+(AX[0]*x+AZ[0]*z).toFixed(2)+" "+(AX[1]*x+AZ[1]*z).toFixed(2)+")")};
var show=function(el,on){if(el.hasAttribute("hidden")===on)el.toggleAttribute("hidden",!on)};
var lengthOf=function(c){return 12+26*c};
var keeps=function(j,th){return CONF[j]>=th-1e-9};
var TOTAL=(N-1)*STEP+CYCLE;
/** Bar j at time t for a threshold: where it is, which layer it is in, and whether it has reached your app. */
function barAt(j,t,th){
  var u=(t-j*STEP)/CYCLE,len=lengthOf(CONF[j]),half=len/2,keep=keeps(j,th);
  if(u<=0)return {shown:false,done:0};
  if(u>=1)return {shown:false,done:keep?1:2};
  var x=OUT-half-1+(len+3)*span(u,0,0.18),z=RAIL,slot="upper",lit=false;
  if(keep){
    x+=(APP+half+2-(OUT+half+2))*span(u,0.18,0.62);lit=x>HOME-6;
    if(u>=0.62)return {shown:false,done:1};
  }else{
    var hang=EDGE+half;                                   // its tail has just left the rail: nothing under it
    x+=(hang-(OUT+half+2))*span(u,0.18,0.36);
    if(u>=0.36){var f=clamp((u-0.36)/0.12,0,1);z=RAIL+(FLOOR-RAIL)*f*f;slot="hopper"}
    if(u>=0.5&&u<0.72)return {shown:false,done:0};         // inside your LLM, which takes its time
    if(u>=0.72){slot="lower";z=LOW;x=LLM_OUT-half-1+(APP+half+2-(LLM_OUT-half-1))*span(u,0.72,0.97)}
    if(u>=0.97)return {shown:false,done:2};
  }
  return {shown:true,x:x,z:z,slot:slot,lit:lit,done:0};
}
var said="";
function draw(t,th,dt){
  var calm=still.matches||dt===0,viaJev=0,viaLlm=0;
  for(var j=0;j<N;j++){
    var b=bars[j],s=barAt(j,t,th);
    if(s.done===1)viaJev++;if(s.done===2)viaLlm++;
    if(s.shown!==b.shown){b.shown=s.shown;show(b.g,s.shown);b.x=null}
    if(!s.shown)continue;
    // A bar follows its place on the timeline; if the threshold moves under it, it eases to its new path.
    if(b.x===null||calm||s.slot!==b.slot){b.x=s.x;b.z=s.z}
    else{var f=1-Math.exp(-dt/0.07);b.x+=(s.x-b.x)*f;b.z+=(s.z-b.z)*f}
    if(s.slot!==b.slot){b.slot=s.slot;slots[s.slot].appendChild(b.g)}
    shift(b.g,b.x,b.z-RAIL);
    if(s.lit!==b.on){b.on=s.lit;show(b.lit,s.lit);show(b.plain,!s.lit)}
  }
  for(var n=0;n<N;n++){show(pips[0][n],n<viaJev);show(pips[1][n],n<viaLlm)}
  var ext=(HOME-EDGE)-lengthOf(th);                        // how far the tongue reaches into the gap
  shift(tongue,-ext,0);shift(handle,-ext,0);
  var k=0;for(var m=0;m<N;m++)if(keeps(m,th))k++;
  var text="threshold "+th.toFixed(2)+" \\u00b7 Jev answers "+k+" of "+N+" \\u00b7 LLM "+(N-k);
  if(text!==said){readout.textContent=text;said=text}
}
var t=0,th=TOURS[0],want=th,frame=0,last=0,visible=false,touring=!still.matches,idle=0,hold=0,lap=0;
function tick(now){
  var dt=last?Math.min((now-last)/1000,1/30):1/60;last=now;
  if(t>=TOTAL){hold+=dt;if(hold>2.4){hold=0;t=0;if(touring){lap=(lap+1)%TOURS.length;want=TOURS[lap]}}}
  else t=Math.min(TOTAL,t+dt);
  th=still.matches?want:th+(want-th)*(1-Math.exp(-dt/0.18));
  if(Math.abs(want-th)<0.0005)th=want;
  draw(t,th,dt);
  frame=visible&&!still.matches?requestAnimationFrame(tick):0;
}
var run=function(){if(!frame&&visible){last=0;frame=requestAnimationFrame(tick)}};
function steer(next){
  touring=false;want=clamp(Math.round(next*100)/100,RANGE[0],RANGE[1]);clearTimeout(idle);
  idle=setTimeout(function(){touring=!still.matches},6000);
  var k=0;for(var n=0;n<N;n++)if(keeps(n,want))k++;
  stage.setAttribute("aria-valuenow",want.toFixed(2));
  stage.setAttribute("aria-valuetext","Threshold "+want.toFixed(2)+": Jev answers "+k+" of "+N+", your LLM answers "+(N-k));
  if(still.matches){th=want;t=TOTAL;draw(t,th,0)}else run();
}
new IntersectionObserver(function(e){visible=e[e.length-1].isIntersecting;if(visible)run()},{rootMargin:"120px 0px"}).observe(stage);
var fromPointer=function(ev){var box=svg.getBoundingClientRect();return RANGE[0]+clamp(((ev.clientX-box.left)/box.width-0.15)/0.7,0,1)*(RANGE[1]-RANGE[0])};
stage.addEventListener("pointermove",function(ev){if(ev.pointerType!=="touch")steer(fromPointer(ev))});
stage.addEventListener("pointerdown",function(ev){if(ev.pointerType==="touch")steer(fromPointer(ev))});
stage.addEventListener("keydown",function(ev){
  var to=null,step=ev.shiftKey?0.1:0.05;
  if(ev.key==="ArrowRight"||ev.key==="ArrowUp")to=want+step;
  if(ev.key==="ArrowLeft"||ev.key==="ArrowDown")to=want-step;
  if(ev.key==="Home")to=RANGE[0];
  if(ev.key==="End")to=RANGE[1];
  if(to===null)return;
  ev.preventDefault();steer(to);
});
// For the visual checks: freeze at {t, th}.
stage.addEventListener("fig-seek",function(ev){touring=false;clearTimeout(idle);cancelAnimationFrame(frame);frame=1;t=ev.detail.t;th=want=ev.detail.th;draw(t,th,0)});
if(still.matches)t=TOTAL;
draw(t,th,0);
`;

writeFigure("fallback", {
  fig: "Fig 2",
  title: "The safety net",
  hint: "Hover to adjust",
  readout: "threshold 0.70 · Jev answers 6 of 8 · LLM 2",
  keys: [
    { mark: "lit", label: "A Jev answer confident enough to use" },
    { mark: "raised", label: "Not confident enough: your LLM answers instead" },
  ],
  caption:
    "Eight example answers. A bar is as long as its confidence and the gap is as wide as your threshold, so a confident answer bridges the gap and reaches your app as Jev's, and an unsure one falls back to the LLM you run today. Raise the threshold and the gap widens.",
  stage: `<div class="iso-stage" tabindex="0" role="slider" aria-label="The safety net: arrow keys move the threshold" aria-valuemin="${RANGE[0]}" aria-valuemax="${RANGE[1]}" aria-valuenow="0.70">${svg}</div>`,
  live,
});
