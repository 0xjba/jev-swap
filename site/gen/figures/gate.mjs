// Fig 2 · The confidence gate as a gauging station.
// Every Jev answer is a puck whose height is its confidence. Pucks ride a roller track to a dial gauge; the
// needle reads the height against a threshold pointer. A puck that reaches the threshold rolls straight on to
// the Jev lane; a shorter one is pushed sideways onto the lane that goes to your LLM. Moving the threshold
// re-sorts the same eight pucks, and the readout counts them from the same list.
import { k, tools, basePlate, rulerStrip, labelPlate, writeFigure } from "./common.mjs";

const WIDTH = 640;
const HEIGHT = 430;

// ---------- the model ----------
// Eight example confidences (illustrative, not measured). 0.7 is the default threshold jev-swap writes.
const CONF = [0.93, 0.58, 0.88, 0.97, 0.74, 0.46, 0.91, 0.82];
const N = CONF.length;
const CYCLE = 2.3;
const THRESHOLDS = [0.7, 0.9, 0.5]; // the idle tour's settings
const RANGE = [0.4, 0.95];

// ---------- the world ----------
const PLATE = { x: -150, y: -56, w: 262, d: 164, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;
const BED = 6; // top of the roller beds
const PITCH = 10.9;
const R = 5.2;
const heightOf = (c) => 4 + 12 * c;

const STATION = -44;
const MAIN = { x: -140, y: -10, w: 242, d: 20, r: 2 };
const SIDE = { x: -10, y: 10, w: 20, d: 92, r: 2 };
const JEV_END = 93;
const LLM_END = 93;

const POST = [STATION, -36];
const DIAL = [STATION, 0];
const DIAL_R = 16;
const DIAL_Z = 58;
const DIAL_H = 8;
const DIAL_TOP = DIAL_Z + DIAL_H;
const TIP_UP = 28; // the plunger's tip when lifted clear of the tallest puck
const SWEEP = [-135, 270]; // needle: degrees at 0, and degrees per unit

const HOUSING = { x: -9, y: -46, w: 18, d: 28, r: 2.5 };
const HEAD_REST = -13;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [DIAL[0], DIAL[1] - DIAL_R, DIAL_TOP + 4], [POST[0], POST[1], DIAL_TOP + 6]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50 },
);
const { at, S, L, D, byDepth, halo, axes } = tools(P);
const rad = (deg) => (deg * Math.PI) / 180;

// ---------- static parts ----------
function base() {
  const out = [basePlate(PLATE, PLATE_H, FOOT_H, P)];
  out.push(rulerStrip({ x: -140, y: 20, w: 104, d: 7, r: 1 }, 0, P));
  out.push(labelPlate({ x: -140, y: 33, w: 40, d: 10, r: 1.5 }, 0, P));
  out.push(k.faceTextSvg(k.topMatrix([56, 24], 0, P, "x"), "jev", { size: 8, tone: "mid", anchor: "middle" }));
  out.push(k.faceTextSvg(k.topMatrix([-27, 60], 0, P, "x"), "llm", { size: 8, tone: "mid", anchor: "middle" }));
  return out.join("");
}

function gaugeBack() {
  const out = [];
  const ped = { x: POST[0] - 13, y: POST[1] - 11, w: 26, d: 22, r: 3 };
  out.push(halo(k.insetPlan(ped, 2), 0, 0.1, 4));
  out.push(S(k.slabOf(ped, 0, 9, P, 5, 0.8), { tone: "mid" }));
  out.push(D(k.corners(ped, 3.5).map(([x, y]) => at([x, y, 9])), { size: 0.45 }));
  out.push(S(k.cylinder(POST[0], POST[1], 5, 9, 3, P, 26), { tone: "mid" }));
  out.push(S(k.cylinder(POST[0], POST[1], 3, 12, DIAL_Z - 12 - 4, P, 24), { tone: "mid", crease: "none" }));
  out.push(L([26, 40].map((z) => k.sideArc(POST[0], POST[1], 3, z, P, 14)).join(""), { tone: "faint" }));
  return out.join("");
}

function pusherBack() {
  const out = [halo(k.insetPlan(HOUSING, 2), 0, 0.1, 4)];
  out.push(S(k.slabOf(HOUSING, 0, 17, P, 4, 0.7), { tone: "mid" }));
  out.push(D(k.corners(HOUSING, 3).map(([x, y]) => at([x, y, 17])), { size: 0.45 }));
  out.push(L(k.planOutline(k.insetPlan(HOUSING, 5.5), 17, P, 3), { tone: "faint" }));
  const cap = [HOUSING.x + 9, HOUSING.y + 9];
  out.push(S(k.cylinder(cap[0], cap[1], 3, 17, 3, P, 18), { tone: "mid" }));
  out.push(L(k.knurl(cap[0], cap[1], 3, 17, 20, 16, P), { tone: "lo" }));
  return out.join("");
}
/** The ram: a head plate on a rod that slides out of the housing. Built at rest; the live code moves it in y. */
function ram() {
  const rod = S(k.slabOf({ x: -1.6, y: -42, w: 3.2, d: 42 + HEAD_REST - 1.5, r: 0.8 }, 9.5, 3, P, 3), { tone: "mid", crease: "none" });
  const head = S(k.slabOf({ x: -6.5, y: HEAD_REST - 2, w: 13, d: 2.4, r: 0.8 }, BED + 0.6, 11, P, 3, 0.3), { tone: "mid" });
  // The rod's tail stays inside the housing: clip it to the box in front of the housing's near face.
  const clip = k.slabOf({ x: -8, y: HOUSING.y + HOUSING.d, w: 16, d: 60, r: 0.5 }, 0, 40, P, 2).fill;
  return `<clipPath id="gate-ram"><path d="${clip}"/></clipPath><g clip-path="url(#gate-ram)"><g data-part="ram">${rod}${head}</g></g>`;
}

function beds() {
  const out = [];
  for (const [plan, along] of [[MAIN, "x"], [SIDE, "y"]]) {
    out.push(halo(k.insetPlan(plan, 1), 0, 0.1, 4));
    out.push(S(k.slabOf(plan, 0, BED, P, 3, 0.5), { tone: "mid" }));
  }
  // Rollers: one line per roller, edge to edge across each bed.
  const rollers = [];
  for (let x = MAIN.x + 5.75; x < MAIN.x + MAIN.w - 2; x += 5.75) {
    if (Math.abs(x) < 10.5) continue; // the junction is a plain transfer plate
    rollers.push(k.lineOnTop([x, MAIN.y], [x, MAIN.y + MAIN.d], BED, P));
  }
  for (let y = SIDE.y + 6.5; y < SIDE.y + SIDE.d - 2; y += 5.75) rollers.push(k.lineOnTop([SIDE.x, y], [SIDE.x + SIDE.w, y], BED, P));
  out.push(L(rollers.join(""), { tone: "lo" }));
  out.push(L(k.ring(0, 0, 7, BED, P, 28), { tone: "lo" }));
  out.push(D([[-7, -7], [7, -7], [-7, 7], [7, 7]].map(([x, y]) => at([x, y, BED])), { size: 0.4 }));
  // Drive boxes behind the main bed, each with a shaft stub into it.
  for (const x of [-104, 58]) {
    const box = { x: x - 8, y: MAIN.y - 13, w: 16, d: 11, r: 2 };
    out.unshift(S(k.slabOf(box, 0, 9, P, 3, 0.5), { tone: "mid" }) + D([at([x - 5, box.y + 3, 9]), at([x + 5, box.y + 3, 9])], { size: 0.4 }) + S(k.slabOf({ x: x - 1.5, y: MAIN.y - 2.2, w: 3, d: 2.2, r: 0.6 }, 1.5, 3, P, 2), { tone: "mid", crease: "none" }));
  }
  return out.join("");
}
/** End stops at the near ends of the lanes, in front of the pucks. */
function stops() {
  const out = [];
  out.push(S(k.slabOf({ x: MAIN.x + MAIN.w - 3, y: MAIN.y, w: 3, d: MAIN.d, r: 1 }, BED, 7, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([MAIN.x + MAIN.w - 1.5, -6, BED + 7]), at([MAIN.x + MAIN.w - 1.5, 6, BED + 7])], { size: 0.4 }));
  out.push(S(k.slabOf({ x: SIDE.x, y: SIDE.y + SIDE.d - 3, w: SIDE.w, d: 3, r: 1 }, BED, 7, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([-6, SIDE.y + SIDE.d - 1.5, BED + 7]), at([6, SIDE.y + SIDE.d - 1.5, BED + 7])], { size: 0.4 }));
  return out.join("");
}

/** One puck at the origin of the bed, as tall as its confidence. */
function puck(j) {
  const h = heightOf(CONF[j]);
  const one = (lit) =>
    `<g data-lit="${lit ? 1 : 0}"${lit ? " hidden" : ""}>${S(k.cylinder(0, 0, R, BED, h, P, 30, 0.4), { tone: "hi", crease: "lo", lit })}${L(k.ring(0, 0, 3.2, BED + h, P, 20), { tone: lit ? "hi" : "lo" })}</g>`;
  return `<g data-puck="${j}">${one(false)}${one(true)}</g>`;
}

function gaugeFront() {
  const out = [];
  const [x, y] = DIAL;
  const clamp = { x: POST[0] - 6, y: POST[1] - 6, w: 12, d: 12, r: 2.5 };
  out.push(S(k.slabOf(clamp, DIAL_Z - 4, 10, P, 4, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(POST[0], POST[1], 3, DIAL_Z + 6, 6, P, 24), { tone: "mid" }));
  const thumb = [POST[0] + 9, POST[1]];
  out.push(S(k.cylinder(thumb[0], thumb[1], 2.4, DIAL_Z - 2, 6, P, 18), { tone: "mid" }));
  out.push(L(k.knurl(thumb[0], thumb[1], 2.4, DIAL_Z - 2, DIAL_Z + 4, 16, P), { tone: "lo" }));
  out.push(S(k.slabOf({ x: x - 3, y: POST[1] + 6, w: 6, d: -POST[1] - 6 - DIAL_R + 2, r: 2 }, DIAL_Z, 4, P, 4, 0.5), { tone: "mid" }));
  out.push(D([at([x, POST[1] + 10, DIAL_Z + 4])], { size: 0.45 }));
  // Stem and guide sleeve under the dial: the plunger rod slides in it.
  out.push(S(k.cylinder(x, y, 2.6, DIAL_Z - 12, 12, P, 20), { tone: "mid" }));
  out.push(L(k.sideArc(x, y, 2.6, DIAL_Z - 6, P, 12), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, DIAL_R, DIAL_Z, DIAL_H, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, DIAL_R, DIAL_TOP - 3, DIAL_TOP, 72, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, DIAL_R, DIAL_TOP - 3, P, 40), { tone: "faint" }));
  out.push(L(k.ring(x, y, DIAL_R - 1.8, DIAL_TOP, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, DIAL_R - 2.6, 30, 5, DIAL_TOP, [1.2, 2.6], P, rad(SWEEP[0]), rad(SWEEP[1]));
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 1.5, DIAL_TOP, 0.8, P, 14), { tone: "hi" }));
  out.push(S(k.cylinder(x + DIAL_R + 2.4, y, 2.2, DIAL_Z + 1.5, 5, P, 16), { tone: "mid" }));
  return out.join("");
}
/** The plunger: a rod and a tip, built lifted; clipped where it enters the guide sleeve. */
function plunger() {
  const [x, y] = DIAL;
  const [, cutY] = at([x, y, DIAL_Z - 12]);
  const rod = S(k.cylinder(x, y, 1.1, TIP_UP + 2, 40, P, 12), { tone: "hi", crease: "none" }) + S(k.cylinder(x, y, 2.2, TIP_UP, 2, P, 16), { tone: "hi" });
  return `<clipPath id="gate-rod"><rect x="-200" y="${cutY.toFixed(1)}" width="${WIDTH + 400}" height="${HEIGHT + 400}"/></clipPath><g clip-path="url(#gate-rod)"><g data-part="plunger">${rod}</g></g>`;
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A gauging station on a base plate. Eight pucks, each as tall as one Jev answer's confidence, ride a roller track to a dial gauge. The dial's needle reads each puck against a threshold pointer. Pucks that reach the threshold roll straight on to a lane marked jev; shorter pucks are pushed sideways by a ram onto a lane marked llm.",
  body: [
    base(),
    gaugeBack(),
    pusherBack(),
    beds(),
    ram(),
    `<g data-part="pucks">${Array.from({ length: N }, (_, j) => puck(j)).join("")}</g>`,
    stops(),
    plunger(),
    gaugeFront(),
    `<path data-part="needle" class="iso-line" data-tone="hi" data-free="start" d="" style="stroke-width:1.1"/>`,
    `<path data-part="mark" class="iso-line" data-tone="lit" data-free="start" d="" style="stroke-width:2.2"/>`,
  ],
});

// ---------- live ----------
const origin = at([0, 0, 0]);
const live = `
var CONF=${JSON.stringify(CONF)},N=${N},CYCLE=${CYCLE},TOUR=${JSON.stringify(THRESHOLDS)},RANGE=${JSON.stringify(RANGE)};
var O=${JSON.stringify(origin)},AX=${JSON.stringify(axes.x)},AY=${JSON.stringify(axes.y)},AZ=${JSON.stringify(axes.z)};
var STATION=${STATION},PITCH=${PITCH},R=${R},BED=${BED},JEV_END=${JEV_END},LLM_END=${LLM_END},TIP_UP=${TIP_UP};
var DIAL=${JSON.stringify(DIAL)},DIAL_R=${DIAL_R},DIAL_TOP=${DIAL_TOP},SWEEP=${JSON.stringify(SWEEP)};
var COSA=${Math.cos(rad(P.azimuth ?? 45)).toFixed(4)},SINA=${Math.sin(rad(P.azimuth ?? 45)).toFixed(4)};
var stage=root.querySelector(".iso-stage"),svg=stage.querySelector("svg"),readout=root.querySelector("[data-readout]");
var q=function(s){return svg.querySelector(s)};
var pucksG=q('[data-part="pucks"]'),ram=q('[data-part="ram"]'),plunger=q('[data-part="plunger"]'),needle=q('[data-part="needle"]'),mark=q('[data-part="mark"]');
var pucks=[].slice.call(svg.querySelectorAll("[data-puck]")).map(function(g){return {g:g,plain:g.querySelector('[data-lit="0"]'),lit:g.querySelector('[data-lit="1"]'),x:null,y:0,on:false}});
var still=matchMedia("(prefers-reduced-motion: reduce)");
var clamp=function(v,a,b){return Math.min(b,Math.max(a,v))};
var ease=function(v){v=clamp(v,0,1);return v*v*(3-2*v)};
var span=function(u,a,b){return ease((u-a)/(b-a))};
var pt=function(x,y,z){return [O[0]+AX[0]*x+AY[0]*y+AZ[0]*z,O[1]+AX[1]*x+AY[1]*y+AZ[1]*z]};
var shift=function(el,x,y,z){el.setAttribute("transform","translate("+(AX[0]*x+AY[0]*y+AZ[0]*z).toFixed(2)+" "+(AX[1]*x+AY[1]*y+AZ[1]*z).toFixed(2)+")")};
var heightOf=function(c){return 4+12*c};
var keeps=function(j,th){return CONF[j]>=th-1e-9};
var TOTAL=N*CYCLE;
/** Where everything is at time t for a threshold: one timeline, read by the parts and the readout. */
function stateAt(t,th){
  var done=t>=TOTAL-1e-6,i=done?N:Math.floor(t/CYCLE),u=done?0:t/CYCLE-i;
  var s={pos:[],lit:[],ram:0,tip:TIP_UP,read:0};
  var kept=0,sent=0;
  for(var j=0;j<N;j++){
    var keep=keeps(j,th);
    if(j<i){s.pos.push(keep?[JEV_END-PITCH*kept,0]:[0,LLM_END-PITCH*sent]);s.lit.push(keep);if(keep)kept++;else sent++;continue}
    if(j>i){s.pos.push([STATION-PITCH*(j-i+1-span(u,0,0.22)),0]);s.lit.push(false);continue}
    var x=STATION-PITCH*(1-span(u,0,0.22)),y=0;
    if(u>=0.5){
      x=STATION+(0-STATION)*span(u,0.5,0.62);
      if(keep)x+=(JEV_END-PITCH*kept)*span(u,0.62,0.95);
      else y=12*span(u,0.62,0.74)+(LLM_END-PITCH*sent-12)*span(u,0.74,0.95);
    }
    s.pos.push([x,y]);s.lit.push(keep&&u>=0.4);
    var down=span(u,0.24,0.32)-span(u,0.44,0.5);
    s.tip=TIP_UP+(BED+heightOf(CONF[j])-TIP_UP)*down;
    s.read=CONF[j]*down;
    if(!keep)s.ram=5.8*span(u,0.54,0.62)+12*span(u,0.62,0.74)-17.8*span(u,0.74,0.88);
  }
  return s;
}
var ang=function(v){return (SWEEP[0]+SWEEP[1]*v)*Math.PI/180};
var seg=function(a,b){return "M"+a[0].toFixed(1)+" "+a[1].toFixed(1)+"L"+b[0].toFixed(1)+" "+b[1].toFixed(1)};
var order="",said="";
function draw(t,th,dt){
  var s=stateAt(t,th),calm=still.matches||dt===0,ord=[];
  for(var j=0;j<N;j++){
    var p=pucks[j],want=s.pos[j];
    // A puck follows its place on the timeline; when the threshold moves, resting pucks slide to their new lane.
    if(p.x===null||calm){p.x=want[0];p.y=want[1]}
    else{var f=1-Math.exp(-dt/0.09);p.x+=(want[0]-p.x)*f;p.y+=(want[1]-p.y)*f}
    shift(p.g,p.x,p.y,0);
    if(p.on!==s.lit[j]){p.on=s.lit[j];p.lit.toggleAttribute("hidden",!p.on);p.plain.toggleAttribute("hidden",p.on)}
    ord.push([p.x*COSA+p.y*SINA,j]);
  }
  ord.sort(function(a,b){return a[0]-b[0]});
  var key=ord.map(function(o){return o[1]}).join();
  if(key!==order){order=key;ord.forEach(function(o){pucksG.appendChild(pucks[o[1]].g)})}
  shift(ram,0,s.ram,0);shift(plunger,0,0,s.tip-TIP_UP);
  var a=ang(s.read);
  needle.setAttribute("d",seg(pt(DIAL[0]-Math.sin(a)*3,DIAL[1]+Math.cos(a)*3,DIAL_TOP+1),pt(DIAL[0]+Math.sin(a)*(DIAL_R-4),DIAL[1]-Math.cos(a)*(DIAL_R-4),DIAL_TOP+1)));
  var m=ang(th);
  mark.setAttribute("d",seg(pt(DIAL[0]+Math.sin(m)*(DIAL_R-6.4),DIAL[1]-Math.cos(m)*(DIAL_R-6.4),DIAL_TOP),pt(DIAL[0]+Math.sin(m)*(DIAL_R-1.8),DIAL[1]-Math.cos(m)*(DIAL_R-1.8),DIAL_TOP)));
  var k=0;for(var n=0;n<N;n++)if(keeps(n,th))k++;
  var text="threshold "+th.toFixed(2)+" \\u00b7 Jev answers "+k+" of "+N+" \\u00b7 LLM "+(N-k);
  if(text!==said){readout.textContent=text;said=text}
}
var t=0,th=TOUR[0],want=th,frame=0,last=0,visible=false,touring=!still.matches,idle=0,hold=0,lap=0;
function tick(now){
  var dt=last?Math.min((now-last)/1000,1/30):1/60;last=now;
  if(t>=TOTAL){hold+=dt;if(hold>2.6){hold=0;t=0;if(touring){lap=(lap+1)%TOUR.length;want=TOUR[lap]}}}
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
  stage.setAttribute("aria-valuetext","Threshold "+want.toFixed(2)+": Jev answers "+k+" of "+N+", "+(N-k)+" go to your LLM");
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
stage.addEventListener("fig-seek",function(ev){touring=false;clearTimeout(idle);cancelAnimationFrame(frame);frame=1;t=ev.detail.t;th=want=ev.detail.th;pucks.forEach(function(p){p.x=null});draw(t,th,0)});
if(still.matches)t=TOTAL;
draw(t,th,0);
`;

writeFigure("gate", {
  fig: "Fig 2",
  title: "Confidence gate",
  hint: "Hover to adjust",
  readout: "threshold 0.70 · Jev answers 6 of 8 · LLM 2",
  keys: [
    { mark: "lit", label: "Answers Jev keeps, and the threshold pointer on the dial" },
    { mark: "raised", label: "Answers below the threshold, pushed to your LLM" },
  ],
  caption:
    "Eight example answers, each puck as tall as its confidence. The dial reads every puck against the threshold: at or above it Jev's answer is used, below it the ram sends the call to the LLM you run today. Raise the threshold and more calls fall back.",
  stage: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Confidence gate: arrow keys move the threshold" aria-valuemin="${RANGE[0]}" aria-valuemax="${RANGE[1]}" aria-valuenow="0.70">${svg}</div>`,
  live,
});
