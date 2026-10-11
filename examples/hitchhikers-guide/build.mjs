import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

// The upright ivory handheld from the reference renders: a library screen on the
// left, a column of flat buttons with a red play key, an orange scroll wheel, a
// NAV cluster, a speaker grille under the screen and a side dial.
// Device space: u runs across the front (0..W), zd runs up (0..H), y is depth
// (the front face is y = T). Everything on the face is drawn in that plane.

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = join(HERE, theme === "light" ? "hitchhikers-guide-light.html" : "hitchhikers-guide.html");

// Entries are paraphrased and written for this page. Entry 0 is the cover.
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
const HEIGHT = 470;
const W = 120;
const H = 200;
const T = 20;
const Z0 = 22;
const FY = T;
const DIAL = { zd: 142, r: 4.4 };

const P = k.fitProjection(
  [
    ...k.boxCorners({ x: 0, y: 0, w: W, d: T }, Z0, Z0 + H),
    ...k.boxCorners({ x: -8, y: -8, w: W + 16, d: T + 16 }, 0, 0),
    [W + 1, T / 2, Z0 + DIAL.zd],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 58 },
);
const CAM = k.cameraOf(P);

const r3 = (value) => Math.round(value * 1000) / 1000;
const F = (u, zd, dy = 0) => k.iso([u, FY + dy, Z0 + zd], P);
const pts = (list, dy = 0) => list.map(([u, zd]) => F(u, zd, dy));
const wall = (list, dy = 0, closed = false) => k.pathOf(pts(list, dy), closed);
const rectOf = (u0, z0, u1, z1) => [[u0, z0], [u1, z0], [u1, z1], [u0, z1]];
const circleOf = (cu, cz, radius, steps = 18) =>
  Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return [cu + radius * Math.cos(a), cz + radius * Math.sin(a)];
  });

// Rounded outline in (u, zd), counter-clockwise, so each edge's outward normal is (dz, -du).
function roundOf(u0, z0, u1, z1, r, steps = 5) {
  const out = [];
  const arc = (cu, cz, a0, a1) => {
    for (let i = 0; i <= steps; i++) {
      const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
      out.push([cu + r * Math.cos(a), cz + r * Math.sin(a)]);
    }
  };
  arc(u0 + r, z0 + r, 180, 270);
  arc(u1 - r, z0 + r, 270, 360);
  arc(u1 - r, z1 - r, 0, 90);
  arc(u0 + r, z1 - r, 90, 180);
  return out;
}

// Extrude a rounded device-face outline from depth y0 to y1 and draw only the faces
// the camera can see. The front cap is the outline at y1; sides and tops come from
// each outline edge. This gives the rounded silhouette the kit's rectangular solids can't.
function prism(list, y0, y1, { cls = "", tone = "lo" } = {}) {
  const shades = [[], [], [], []];
  let top = "";
  const n = list.length;
  for (let i = 0; i < n; i++) {
    const a = list[i];
    const b = list[(i + 1) % n];
    const du = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(du, dz);
    if (len < 1e-9) continue;
    const nu = dz / len;
    const nz = -du / len;
    const dot = nu * CAM.cosA * CAM.cosE + nz * CAM.sinE;
    if (dot <= 0) continue;
    const quad = k.pathOf([k.iso([a[0], y0, Z0 + a[1]], P), k.iso([b[0], y0, Z0 + b[1]], P), k.iso([b[0], y1, Z0 + b[1]], P), k.iso([a[0], y1, Z0 + a[1]], P)], true);
    if (nz > 0.5) top += quad;
    else shades[Math.min(3, Math.max(0, Math.floor(((dot - 0.2) / 0.6) * 4)))].push(quad);
  }
  const front = k.pathOf(list.map(([u, zd]) => k.iso([u, y1, Z0 + zd], P)), true);
  const solid = {
    fill: front,
    shades: shades.map((s) => s.join("")),
    top,
    outline: front,
  };
  return k.solidSvg(solid, { tone, crease: "none", className: cls });
}

const faceMatrix = (u, zd, dy = 0) => {
  const o = F(u, zd, dy);
  const ux = F(u + 1, zd, dy);
  const vz = F(u, zd - 1, dy);
  return `matrix(${r3(ux[0] - o[0])} ${r3(ux[1] - o[1])} ${r3(vz[0] - o[0])} ${r3(vz[1] - o[1])} ${r3(o[0])} ${r3(o[1])})`;
};
const textAt = (u, zd, text, size, { dy = 0, anchor = "start", cls = "guide-ink" } = {}) =>
  `<g class="${cls}">${k.faceTextSvg(faceMatrix(u, zd, dy), text, { size, tone: "hi", anchor })}</g>`;
const ink = (list, { dy = 0, tone = "hi", cls = "guide-ink", closed = false, free = true } = {}) =>
  k.lineSvg(wall(list, dy, closed), { tone, className: cls, free });
const fillOn = (list, dy, cls) => `<path class="${cls}" d="${wall(list, dy, true)}"/>`;

const body = [];

const bookLines = (cu, cz, s) => [
  [[cu - 0.2 * s, cz + 0.5 * s], [cu - s, cz + 0.8 * s], [cu - s, cz - 0.8 * s], [cu - 0.2 * s, cz - 0.5 * s]],
  [[cu + 0.2 * s, cz + 0.5 * s], [cu + s, cz + 0.8 * s], [cu + s, cz - 0.8 * s], [cu + 0.2 * s, cz - 0.5 * s]],
];

// Screen
const BEZEL = roundOf(4, 47, 84, 185, 5);
const GLASS = roundOf(7, 50, 81, 182, 2.5);
const GLASS_DY = 1.8;
body.push(prism(BEZEL, T, T + 1.2, { cls: "guide-bezel" }));
body.push(prism(GLASS, T, T + GLASS_DY, { cls: "guide-glass", tone: "mid" }));

// Screen furniture: header, library rail and the two views.
const headerDy = GLASS_DY;
body.push(textAt(11, 172, "42", 3.2, { dy: headerDy }));
{
  const cx = 46;
  const cz = 172;
  const ring = Array.from({ length: 22 }, (_, i) => {
    const t = (i / 22) * Math.PI * 2;
    const x = 4.2 * Math.cos(t);
    const z = 1.2 * Math.sin(t);
    return [cx + x * Math.cos(-0.35) - z * Math.sin(-0.35), cz + x * Math.sin(-0.35) + z * Math.cos(-0.35)];
  });
  body.push(ink(ring, { dy: headerDy, closed: true }));
  body.push(`<path class="guide-ink-fill" d="${wall(circleOf(cx, cz, 1.4, 12), headerDy, true)}"/>`);
}
body.push(ink(rectOf(72, 170.5, 77.5, 174.5), { dy: headerDy, closed: true }));
body.push(ink([[78, 171.8], [79, 171.8], [79, 173.2], [78, 173.2]], { dy: headerDy, closed: true }));
body.push(ink([[10, 165], [78, 165]], { dy: headerDy, tone: "lo" }));
body.push(textAt(11, 156, "LIBRARY", 3.6, { dy: headerDy }));

// Library rail
body.push(fillOn(rectOf(10, 127, 20, 137), headerDy, "guide-ink-fill"));
for (const shape of bookLines(15, 132, 2.6)) body.push(k.lineSvg(wall(shape, headerDy, true), { tone: "hi", className: "guide-on-dark" }));
body.push(ink([[13.6, 120.6], [16.6, 117.6]], { dy: headerDy, tone: "hi" }));
body.push(ink(circleOf(14.4, 115.2, 2.2, 14), { dy: headerDy, tone: "hi", closed: true }));
body.push(ink([[11.3, 101.3], [17.3, 101.3], [17.3, 104.6], [11.3, 104.6]], { dy: headerDy, tone: "hi", closed: true }));
body.push(ink([[17.3, 102.5], [18.8, 102.5], [18.8, 103.6], [17.3, 103.6]], { dy: headerDy, tone: "hi" }));
body.push(ink([[9.5, 100], [19.2, 100]], { dy: headerDy, tone: "hi" }));
body.push(ink(circleOf(14.5, 88.2, 2.4, 14), { dy: headerDy, tone: "hi", closed: true }));
body.push(ink(Array.from({ length: 16 }, (_, i) => {
  const t = (i / 16) * Math.PI * 2;
  const x = 4.6 * Math.cos(t);
  const z = 1.1 * Math.sin(t);
  return [14.5 + x * Math.cos(-0.35) - z * Math.sin(-0.35), 88.2 + x * Math.sin(-0.35) + z * Math.cos(-0.35)];
}), { dy: headerDy, tone: "hi", closed: true }));
body.push(k.dotsSvg([[14.5, 76.5], [14.5, 74.6], [14.5, 72.7]].map(([u, zd]) => F(u, zd, headerDy)), { size: 0.5, tone: "hi" }));
body.push(ink([[24, 70], [24, 146]], { dy: headerDy, tone: "lo" }));

// Cover view: the book, the title and DON'T PANIC.
{
  const cover = [];
  for (const shape of bookLines(52, 126, 9)) cover.push(ink(shape, { dy: headerDy, tone: "hi", closed: true }));
  cover.push(textAt(52, 108, "The Hitchhiker’s", 4.2, { dy: headerDy, anchor: "middle" }));
  cover.push(textAt(52, 101.5, "Guide", 4.2, { dy: headerDy, anchor: "middle" }));
  cover.push(ink([[36, 93], [78, 93]], { dy: headerDy, tone: "lo" }));
  cover.push(textAt(52, 84, "DON’T PANIC", 4, { dy: headerDy, anchor: "middle" }));
  body.push(`<g data-cover>${cover.join("")}</g>`);
}

// Entry view: the name and the rule lines that stand for its text.
{
  const entry = [];
  entry.push(`<g data-name-wrap>${k.faceTextSvg(faceMatrix(52, 117, headerDy), ENTRIES[1].name, { size: 4, tone: "hi", anchor: "middle" }).replace("<text ", '<text data-name ')}</g>`);
  const rows = [106, 99.5, 93, 86.5, 80];
  rows.forEach((zd, r) => {
    entry.push(`<path data-rule="${r}" class="iso-line guide-ink" data-tone="hi" data-free="" d="${wall([[36, zd], [78, zd]], headerDy)}"/>`);
  });
  body.push(`<g data-entry-view class="guide-ink" style="opacity:0">${entry.join("")}</g>`);
}

// Speaker grille under the screen
{
  const grille = [];
  for (let c = 0; c < 17; c++) for (let row = 0; row < 6; row++) grille.push(F(11 + c * 4.1, 17 + row * 4));
  body.push(k.dotsSvg(grille, { size: 0.42, tone: "mid" }));
}

// Column of flat buttons: play, menu, back, search, mark
const BUTTON_TOP = 182;
const BUTTON_STEP = 15.2;
const BUTTON_H = 14;
const LABELS = ["MENU", "BACK", "SEARCH", "MARK"];
for (let i = 0; i < 5; i++) {
  const top = BUTTON_TOP - i * BUTTON_STEP;
  const bottom = top - BUTTON_H;
  const mid = (top + bottom) / 2;
  body.push(prism(roundOf(89, bottom, 111, top, 2.2), T, T + 2.2, { cls: "guide-key" }));
  if (i === 0) {
    body.push(fillOn([[96.5, mid - 4.5], [96.5, mid + 4.5], [105.5, mid]], 2.2, "guide-red"));
  } else {
    body.push(textAt(100, mid - 0.9, LABELS[i - 1], 2.6, { dy: 2.2, anchor: "middle" }));
  }
}

// Orange scroll wheel in its slot
body.push(textAt(100, 100.5, "SCROLL", 2.4, { anchor: "middle", cls: "guide-orange-ink" }));
body.push(prism(roundOf(90, 56, 110, 96, 2.5), T, T + 1.0, { cls: "guide-slot", tone: "lo" }));
body.push(prism(roundOf(91.5, 58, 108.5, 94, 3), T, T + 3.6, { cls: "guide-orange", tone: "lo" }));
for (let zd = 61; zd <= 91; zd += 3) body.push(ink([[91.5, zd], [108.5, zd]], { dy: 3.6, tone: "lo", cls: "guide-rib" }));

// NAV cluster
body.push(textAt(100, 42.2, "NAV", 2.4, { anchor: "middle", cls: "guide-orange-ink" }));
body.push(prism(roundOf(89, 31, 111, 39.5, 1.5), T, T + 1.6, { cls: "guide-key" }));
body.push(prism(roundOf(89, 23, 99.6, 30.5, 1.4), T, T + 1.6, { cls: "guide-key" }));
body.push(prism(roundOf(100.4, 23, 111, 30.5, 1.4), T, T + 1.6, { cls: "guide-key" }));
body.push(prism(roundOf(89, 15, 111, 22.5, 1.5), T, T + 1.6, { cls: "guide-key" }));
body.push(ink([[96.5, 33.5], [100, 37], [103.5, 33.5]], { dy: 1.6, tone: "lo" }));
body.push(ink([[96, 29.5], [93, 26.75], [96, 24]], { dy: 1.6, tone: "lo" }));
body.push(ink([[104, 29.5], [107, 26.75], [104, 24]], { dy: 1.6, tone: "lo" }));
body.push(ink([[96.5, 20.5], [100, 17], [103.5, 20.5]], { dy: 1.6, tone: "lo" }));
body.push(fillOn(circleOf(100, 8, 1.1, 12), 0, "guide-led"));

// Side dial on the right edge
{
  const at = (y, zd) => k.iso([W + 0.3, y, Z0 + zd], P);
  const disk = Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2;
    return at(T / 2 + DIAL.r * Math.cos(a), DIAL.zd + DIAL.r * Math.sin(a));
  });
  body.push(`<path class="guide-dial" d="${k.pathOf(disk, true)}"/>`);
  const ridges = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const inner = at(T / 2 + 0.9 * Math.cos(a), DIAL.zd + 0.9 * Math.sin(a));
    const outer = at(T / 2 + DIAL.r * Math.cos(a), DIAL.zd + DIAL.r * Math.sin(a));
    ridges.push(`M${r3(inner[0])} ${r3(inner[1])}L${r3(outer[0])} ${r3(outer[1])}`);
  }
  body.push(`<path class="iso-line guide-ink" data-tone="lo" d="${ridges.join("")}"/>`);
  body.push(`<circle class="guide-ink-fill" cx="${r3(at(T / 2, DIAL.zd)[0])}" cy="${r3(at(T / 2, DIAL.zd)[1])}" r="0.8"/>`);
}

// Halo: the device floats above a soft shadow on the ground.
const shadow = k.haloOf({ x: 4, y: -4, w: W - 8, d: T + 8, r: 10 }, 0, 0.1, P);
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "The Hitchhiker's Guide as an upright ivory handheld. Its screen shows the library cover, with a book, the title and DON'T PANIC. A column of flat buttons runs down the right, with a red play key at the top, and an orange scroll wheel sits in its slot below. A NAV cluster and a speaker grille complete the front, and a dial is set into the right edge. Moving across the card scrolls through the entries.",
  body: [`<g data-part="device-body" class="guide-body"><path class="iso-halo" d="${shadow}" style="filter:blur(8px)"/></g>`, `<g class="guide-body">${prism(roundOf(0, 0, W, H, 16), 0, T, { cls: "guide-body", tone: "lo" })}</g>`, ...body.slice(0)],
});

const live = `
const P = ${JSON.stringify(P)};
const ENTRIES = ${JSON.stringify(ENTRIES)};
const N = ${ENTRIES.length};
const FY = ${FY}, Z0 = ${Z0};
const ROW_X0 = 36, ROW_MAX = 42;
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const cover = svg.querySelector("[data-cover]");
const entryView = svg.querySelector("[data-entry-view]");
const nameText = svg.querySelector("[data-name]");
const rules = [...svg.querySelectorAll("[data-rule]")];
const readout = document.querySelector("[data-readout]");
const entry = document.querySelector("[data-entry]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const len = (i, r) => ENTRIES[i].lines[r] ?? 0;
const rowZ = [106, 99.5, 93, 86.5, 80];
const line = (u0, zd, u1) => "M" + iso([u0, FY + ${GLASS_DY}, Z0 + zd], P).map((v) => v.toFixed(1)).join(" ") + "L" + iso([u1, FY + ${GLASS_DY}, Z0 + zd], P).map((v) => v.toFixed(1)).join(" ");

let pos = 0, target = 0, clock = 0, last = 0, frame = 0, visible = false, idleTimer = 0, shownNear = -1, shownName = -1, touring = !still.matches;
const tourAt = (t) => Math.floor(t / 2.2) % N;

function draw() {
  const coverAmount = clamp(1 - pos, 0, 1);
  cover.style.opacity = coverAmount.toFixed(3);
  entryView.style.opacity = (1 - coverAmount).toFixed(3);
  const a = clamp(Math.floor(pos), 1, N - 1), b = clamp(Math.ceil(pos), 1, N - 1), f = clamp(pos - Math.floor(pos), 0, 1);
  rules.forEach((row, r) => {
    const amount = len(a, r) * (1 - f) + len(b, r) * f;
    row.setAttribute("d", line(ROW_X0, rowZ[r], ROW_X0 + amount * ROW_MAX));
    row.style.opacity = amount > 0.01 ? "1" : "0";
  });
  const content = clamp(Math.round(pos), 1, N - 1);
  if (content !== shownName) { shownName = content; nameText.textContent = ENTRIES[content].name; }
  const near = clamp(Math.round(pos), 0, N - 1);
  if (near !== shownNear) {
    shownNear = near;
    entry.innerHTML = "<strong>" + ENTRIES[near].name + ".</strong> " + ENTRIES[near].text;
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
    { mark: "raised", label: "Ivory body, buttons and the speaker grille" },
    { mark: "lit", label: "Orange scroll wheel and the red play key" },
  ],
  caption:
    "The Hitchhiker’s Guide as an upright handheld: a library screen, a column of flat buttons, an orange scroll wheel and a side dial. Moving across the card turns through eight entries, and the screen changes to show each one.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="The Guide: arrow keys or pointer move through eight entries" aria-valuemin="1" aria-valuemax="${ENTRIES.length}" aria-valuenow="1" aria-valuetext="${ENTRIES[0].name}">${svg}</div>`,
});

const page =
  `<style>
.guide-body .iso-fill{fill:#e6e4de}
.guide-body .iso-shade[data-shade="0"]{fill:#a4a29c}
.guide-body .iso-shade[data-shade="1"]{fill:#bab8b2}
.guide-body .iso-shade[data-shade="2"]{fill:#cbc9c3}
.guide-body .iso-shade[data-shade="3"]{fill:#dad8d2}
.guide-body .iso-top{fill:#f1f0eb}
.guide-key .iso-fill{fill:#e0ded8}
.guide-key .iso-shade[data-shade="0"]{fill:#9e9c96}
.guide-key .iso-shade[data-shade="1"]{fill:#b4b2ac}
.guide-key .iso-shade[data-shade="2"]{fill:#c4c2bc}
.guide-key .iso-shade[data-shade="3"]{fill:#d4d2cc}
.guide-key .iso-top{fill:#eeece7}
.guide-bezel .iso-fill{fill:#2b2b2d}
.guide-bezel .iso-shade{fill:#1c1c1e}
.guide-bezel .iso-top{fill:#38383b}
.guide-glass .iso-fill{fill:#cfd0c9}
.guide-glass .iso-shade[data-shade="0"]{fill:#a8a9a2}
.guide-glass .iso-shade[data-shade="1"]{fill:#b6b7b0}
.guide-glass .iso-shade[data-shade="2"]{fill:#c3c4bd}
.guide-glass .iso-shade[data-shade="3"]{fill:#ced0c8}
.guide-glass .iso-top{fill:#dadbd4}
.guide-slot .iso-fill{fill:#1f1f21}
.guide-slot .iso-shade{fill:#141416}
.guide-orange .iso-fill{fill:#d46a2c}
.guide-orange .iso-shade[data-shade="0"]{fill:#8d3d17}
.guide-orange .iso-shade[data-shade="1"]{fill:#a3491e}
.guide-orange .iso-shade[data-shade="2"]{fill:#b65a25}
.guide-orange .iso-shade[data-shade="3"]{fill:#c76a30}
.guide-orange .iso-top{fill:#e27d43}
.guide-dial{fill:#d2d1cb;stroke:#8a8983;stroke-width:.3}
.guide-led{fill:#e0823f}
.guide-body .iso-dots{}
.iso-dots circle{fill:#8c8a84}
.guide-red{fill:#d8402a;stroke:none}
.guide-ink-fill{fill:#25252a;stroke:none}
.iso-line.guide-ink{stroke:#25252a}
.guide-ink .iso-face-text{fill:#25252a}
.guide-ink-fill{fill:#25252a}
.guide-orange-ink .iso-face-text{fill:#c4541c}
.iso-line.guide-on-dark{stroke:#f2f1ec}
.iso-line.guide-rib{stroke:#7e3516}
.guide-ink text{fill:#25252a}
</style>` +
  body2 +
  `<p class="guide-entry" data-entry aria-live="polite"><strong>${ENTRIES[0].name}.</strong> ${ENTRIES[0].text}</p>` +
  `<style>.guide-entry{margin:18px 0 0;font:15px/1.5 ui-serif,Georgia,serif;color:var(--anatomy-text)}.guide-entry strong{font-weight:600}</style>`;

writeFileSync(OUT, k.pageHtml({ title: "The Hitchhiker’s Guide", theme, body: page, script: kitScript() + live }));
console.log("wrote", OUT);
