import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = join(HERE, theme === "light" ? "hitchhikers-guide-light.html" : "hitchhikers-guide.html");

// Entries are paraphrased, short, and written for this page.
const ENTRIES = [
  { name: "Don't Panic", text: "Large, friendly letters on the cover of the Guide. The most useful instruction in the book.", lines: [0.92, 0.7, 0.86, 0.4] },
  { name: "Babel fish", text: "Small, yellow and leech-like. It sits in your ear and translates whatever you hear.", lines: [0.8, 0.95, 0.6] },
  { name: "Towel", text: "Possibly the most useful thing a hitchhiker can carry.", lines: [0.7, 0.55] },
  { name: "Earth", text: "Mostly harmless.", lines: [0.5] },
  { name: "Vogons", text: "Bureaucratic and unlovely. Their poetry is not recommended, even by them.", lines: [0.9, 0.6, 0.76, 0.5, 0.3] },
  { name: "Improbability drive", text: "Turns the impossible into the likely, and back again, without warning.", lines: [0.6, 0.86, 0.7] },
  { name: "Gargle blaster", text: "A drink that tastes of very bad decisions, very well made.", lines: [0.86, 0.64, 0.9] },
  { name: "42", text: "The answer to the Ultimate Question. The question was never printed.", lines: [0.4, 0.8, 0.6, 0.95] },
];

const WIDTH = 600;
const HEIGHT = 400;

const PLATE = { x: -108, y: -70, w: 226, d: 140, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

const BODY = { x: -88, y: -54, w: 150, d: 108, r: 10 };
const BODY_H = 14;
const BODY_TOP = BODY_H;
const GLASS_Z = BODY_TOP + 0.8;
const GLASS_TOP = GLASS_Z + 0.4;

const SCREEN = { x: -80, y: -46, w: 96, d: 84, r: 6 };
const GLASS = { x: -77, y: -43, w: 90, d: 78, r: 4 };
const ROW_Y = [28, 20, 12, 4, -4];
const LINE_X0 = -70;
const LINE_MAX = 78;

const TAB_Y0 = -36;
const TAB_STEP = 10.3;
const TAB_COUNT = ENTRIES.length;
const TAB_Y = ENTRIES.map((_, i) => TAB_Y0 + i * TAB_STEP);
const TAB_X = BODY.x + BODY.w - 1;
const TAB_W = 11;
const TAB_D = 6.8;
const TAB_Z = 3;
const TAB_H = 7;
const TAB_LIFT = 5;

const TRACK = { x: 46, y: -40, w: 6, d: 80, r: 2.5 };
const KNOB = { x: 43, y: -3, w: 12, d: 6, r: 1.6 };
const KNOB_H = 4;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    ...k.boxCorners(BODY, 0, BODY_H),
    [TAB_X + TAB_W, TAB_Y[TAB_COUNT - 1], TAB_Z + TAB_H + TAB_LIFT],
  ],
  WIDTH,
  HEIGHT,
  { pad: 28, azimuth: 42 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const strip = { x: PLATE.x + 12, y: PLATE.y + PLATE.d - 15, w: PLATE.w - 24, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  return out.join("");
}

function body() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(BODY, 4), 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(BODY, 0, BODY_H, P, 8, 2.2), { tone: "mid", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(BODY, 4), BODY_TOP, P, 8), { tone: "faint" }));
  const corners = k.corners(BODY, 5);
  out.push(D(corners.map(([x, y]) => at([x, y, BODY_TOP])), { size: 0.45, tone: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([BODY.x + 12, 46], BODY_TOP, P, "x"), "DON'T PANIC", { size: 2.6, tone: "lo", anchor: "start" }));
  const grille = [];
  for (let c = 0; c < 4; c++) for (let r = 0; r < 3; r++) grille.push([31 + c * 4, 40 + r * 3.4]);
  out.push(D(grille.map(([x, y]) => at([x, y, BODY_TOP])), { size: 0.32, tone: "lo" }));
  return out.join("");
}

function screen() {
  const out = [];
  out.push(S(k.slabOf(SCREEN, BODY_TOP, 0.8, P, 6, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf(GLASS, GLASS_Z, 0.4, P, 6, 0.2), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(GLASS, GLASS_TOP, P, 6), { tone: "faint" }));
  const screws = [[SCREEN.x + 4, SCREEN.y + 4], [SCREEN.x + SCREEN.w - 4, SCREEN.y + 4], [SCREEN.x + 4, SCREEN.y + SCREEN.d - 4], [SCREEN.x + SCREEN.w - 4, SCREEN.y + SCREEN.d - 4]];
  out.push(D(screws.map(([x, y]) => at([x, y, BODY_TOP + 0.8])), { size: 0.4, tone: "lo" }));
  return out.join("");
}

function rows() {
  return ROW_Y.map((y, r) => {
    const first = ENTRIES[0].lines[r] ?? 0;
    const d = k.lineOnTop([LINE_X0, y], [LINE_X0 + first * LINE_MAX, y], GLASS_TOP + 0.05, P);
    return `<path data-row="${r}" class="iso-line" data-tone="hi" data-free="" d="${d}" style="opacity:${first > 0 ? 1 : 0}"/>`;
  }).join("");
}

function track() {
  const out = [];
  out.push(S(k.slabOf(TRACK, BODY_TOP, 0.8, P, 4, 0.4), { tone: "lo", crease: "none" }));
  out.push(D(TAB_Y.map((y) => at([TRACK.x + TRACK.w / 2, y, BODY_TOP + 0.9])), { size: 0.35, tone: "lo" }));
  for (const [x, y] of [[34, -24], [34, -10]]) {
    out.push(S(k.cylinder(x, y, 3.4, BODY_TOP, 2.2, P, 24, 0.5), { tone: "mid" }));
    out.push(L(k.ring(x, y, 2.2, BODY_TOP + 2.2, P, 20), { tone: "lo" }));
  }
  return out.join("");
}

function tabs() {
  return TAB_Y.map((y, i) => {
    const plan = { x: TAB_X, y: y - TAB_D / 2, w: TAB_W, d: TAB_D, r: 1.2 };
    const parts = [];
    parts.push(S(k.slabOf(plan, TAB_Z, TAB_H, P, 3, 0.6), { tone: "mid", crease: "lo" }));
    parts.push(L(k.lineOnTop([TAB_X, y], [TAB_X + TAB_W, y], TAB_Z + TAB_H + 0.1, P), { tone: "faint" }));
    return `<g data-tab="${i}" transform="${k.translateAlong(P, [0, 0, 0])}">${parts.join("")}</g>`;
  }).join("");
}

function knob() {
  const out = [];
  out.push(S(k.slabOf(KNOB, BODY_TOP + 0.8, KNOB_H, P, 4, 0.8), { tone: "hi", lit: true }));
  out.push(L(k.lineOnTop([KNOB.x, 0], [KNOB.x + KNOB.w, 0], BODY_TOP + 0.8 + KNOB_H + 0.1, P), { tone: "lo" }));
  return out.join("");
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "The Hitchhiker's Guide as a small handheld: a slab with a text screen on the left, a slider on a track to the right and eight thumb-index tabs along the edge. Sliding the knob raises the tab beneath it, and the screen rewrites itself as the entry changes.",
  body: [
    plate(),
    `<g data-part="body">${body()}</g>`,
    screen(),
    `<g data-part="rows">${rows()}</g>`,
    track(),
    tabs(),
    `<g data-part="knob" transform="${k.translateAlong(P, [0, TAB_Y[0], 0])}">${knob()}</g>`,
  ],
});

const live = `
const P = ${JSON.stringify(P)};
const ENTRIES = ${JSON.stringify(ENTRIES)};
const N = ${ENTRIES.length};
const TAB_Y = ${JSON.stringify(TAB_Y)};
const TAB_Y0 = ${TAB_Y0}, TAB_STEP = ${TAB_STEP};
const ROW_Y = ${JSON.stringify(ROW_Y)};
const LINE_X0 = ${LINE_X0}, LINE_MAX = ${LINE_MAX}, GLASS_TOP = ${GLASS_TOP};
const TAB_LIFT = ${TAB_LIFT};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const knob = svg.querySelector('[data-part="knob"]');
const tabs = [...svg.querySelectorAll("[data-tab]")];
const rows = [...svg.querySelectorAll("[data-row]")];
const readout = document.querySelector("[data-readout]");
const entry = document.querySelector("[data-entry]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const len = (i, r) => ENTRIES[i].lines[r] ?? 0;

let pos = 0, target = 0, clock = 0, last = 0, frame = 0, visible = false, idleTimer = 0, shown = -1, touring = !still.matches;
const tourAt = (t) => Math.floor(t / 2.2) % N;

function draw() {
  knob.setAttribute("transform", translateAlong(P, [0, TAB_Y0 + pos * TAB_STEP, 0]));
  tabs.forEach((tab, i) => {
    const up = clamp(1 - Math.abs(pos - i), 0, 1) * TAB_LIFT;
    tab.setAttribute("transform", translateAlong(P, [0, 0, up]));
  });
  const i0 = Math.floor(pos), f = pos - i0, i1 = Math.min(N - 1, i0 + 1);
  rows.forEach((row, r) => {
    const amount = len(i0, r) * (1 - f) + len(i1, r) * f;
    row.setAttribute("d", lineOnTop([LINE_X0, ROW_Y[r]], [LINE_X0 + amount * LINE_MAX, ROW_Y[r]], GLASS_TOP + 0.05, P));
    row.style.opacity = amount > 0.01 ? "1" : "0";
  });
  const near = clamp(Math.round(pos), 0, N - 1);
  if (near !== shown) {
    shown = near;
    entry.textContent = ENTRIES[near].name + ". " + ENTRIES[near].text;
    stage.setAttribute("aria-valuenow", String(near + 1));
    stage.setAttribute("aria-valuetext", ENTRIES[near].name);
    readout.textContent = "Entry " + (near + 1) + " of " + N + " · " + ENTRIES[near].name;
  }
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) { clock += dt; target = tourAt(clock); }
  pos = still.matches ? target : pos + (target - pos) * (1 - Math.exp(-dt / 0.22));
  if (Math.abs(target - pos) < 0.001) pos = target;
  draw();
  const settled = pos === target && !touring;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}

const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => {
  touring = false;
  target = clamp(next, 0, N - 1);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 3600);
  run();
};

new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.2) / 0.6, 0, 1);
  steer(share * (N - 1));
});
stage.addEventListener("pointerleave", () => steer(target));
stage.addEventListener("keydown", (event) => {
  const here = Math.round(target);
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") to = here + 1;
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") to = here - 1;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = N - 1;
  if (to === null) return;
  event.preventDefault();
  steer(clamp(to, 0, N - 1));
});
draw();
`;

const body2 = k.plateHtml({
  fig: "Fig 1",
  title: "The Guide",
  hint: "Move across the card, or use the arrow keys",
  readout: `Entry 1 of ${ENTRIES.length} · ${ENTRIES[0].name}`,
  keys: [
    { mark: "lit", label: "The slider and the tab it lifts: the entry you are reading" },
    { mark: "raised", label: "Eight thumb-index tabs, one per entry" },
  ],
  caption:
    "A handheld Guide with eight entries. Slide the knob along the track and the tab under it rises; the screen rewrites its lines to match the entry, and the entry's text appears below.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="The Guide: arrow keys or pointer move through eight entries" aria-valuemin="1" aria-valuemax="${ENTRIES.length}" aria-valuenow="1" aria-valuetext="${ENTRIES[0].name}">${svg}</div>`,
});

const page =
  `<style>.guide-entry{margin:18px 0 0;font:15px/1.5 ui-serif,Georgia,serif;color:var(--anatomy-text)}.guide-entry strong{font-weight:600}</style>` +
  body2 +
  `<p class="guide-entry" data-entry aria-live="polite"><strong>${ENTRIES[0].name}.</strong> ${ENTRIES[0].text}</p>`;

writeFileSync(OUT, k.pageHtml({ title: "The Hitchhiker's Guide", theme, body: page, script: kitScript() + live }));
console.log("wrote", OUT);
