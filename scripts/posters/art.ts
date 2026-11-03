import {
  at,
  blurFilter,
  circle,
  confetti,
  ellipse,
  flame,
  FLAME_DEFS,
  group,
  H,
  linear,
  path,
  poster,
  quad,
  radial,
  rect,
  rng,
  sparkle,
  TAU,
  W,
} from "./svg";

// The gallery posters, drawn as code (M4 spec, "The poster replaces the background"). Each is a
// function of nothing: the same SVG every time it is built, its randomness seeded by its id.
// `pnpm posters` (build.ts) writes each to public/posters/ under `file`, its content's name, and
// measures it. Its id, occasion, accent and look are in src/themes/posters.ts. No text, no
// external references: the title is the page's, set in the host's chosen font.

export type Art = { id: string; file: string; draw: () => string };

const n = (value: number) => Number(value.toFixed(1));

// Soft round glows of one colour, scattered over a box: the out-of-focus lights of a photo.
function orbs(
  random: () => number,
  count: number,
  gradients: string[],
  box: { x: number; y: number; w: number; h: number },
  size: [number, number],
  opacity: [number, number] = [0.5, 1],
) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const radius = size[0] + random() * (size[1] - size[0]);
    const alpha = opacity[0] + random() * (opacity[1] - opacity[0]);
    out += circle(box.x + random() * box.w, box.y + random() * box.h, radius, `url(#${gradients[i % gradients.length]})`, ` opacity="${alpha.toFixed(2)}"`);
  }
  return out;
}

// A soft glow: a colour fading to nothing from the middle of whatever it fills.
const glow = (id: string, colour: string, strength = 1) =>
  radial(id, [
    [0, colour, strength],
    [1, colour, 0],
  ]);

// Small round stars over a box.
function stars(random: () => number, count: number, box: { x: number; y: number; w: number; h: number }, size = 1) {
  let out = "";
  for (let i = 0; i < count; i++)
    out += circle(box.x + random() * box.w, box.y + random() * box.h, (0.8 + random() * 2.4) * size, "#ffffff", ` opacity="${(0.25 + random() * 0.7).toFixed(2)}"`);
  return out;
}

// A shadow under a raised shape, for the things that sit on a table.
const DROP = `<filter id="drop" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#3c140a" flood-opacity="0.3"/></filter>`;

// ---------------------------------------------------------------- Birthday

function candles() {
  const r = rng("candles");
  const colours = ["#ffd6e0", "#bde0fe", "#fff1a8", "#caffbf", "#ffc8dd", "#a0c4ff", "#ffadad"];
  const defs =
    radial(
      "bg",
      [
        [0, "#7d3a72"],
        [0.5, "#41194a"],
        [1, "#170a1d"],
      ],
      0.5,
      0.62,
      0.78,
    ) +
    glow("orbWarm", "#ffbe8a", 0.55) +
    glow("orbPink", "#ff8fb8", 0.45) +
    glow("floor", "#ffb070", 0.5) +
    FLAME_DEFS +
    `<pattern id="stripes" width="54" height="54" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)"><rect width="16" height="54" fill="#ffffff" fill-opacity="0.72"/></pattern>` +
    linear(
      "candleShade",
      [
        [0, "#000000", 0.24],
        [0.38, "#ffffff", 0.16],
        [0.6, "#ffffff", 0],
        [1, "#000000", 0.32],
      ],
      0,
      0,
      1,
      0,
    );
  let body = rect("url(#bg)") + orbs(r, 30, ["orbWarm", "orbPink"], { x: 0, y: 0, w: W, h: H * 0.72 }, [40, 150]);
  body += ellipse(W / 2, H * 1.02, W * 0.75, H * 0.32, "url(#floor)");
  const count = 7;
  const gap = W / (count + 1);
  const heights = [560, 680, 500, 740, 540, 640, 590];
  for (let i = 0; i < count; i++) {
    const x = gap * (i + 1);
    const height = heights[i] + r() * 40;
    const top = H - height;
    const width = 74;
    body += rect(colours[i], x - width / 2, top, width, height + 40, ` rx="14"`);
    body += rect("url(#stripes)", x - width / 2, top, width, height + 40, ` rx="14"`);
    body += rect("url(#candleShade)", x - width / 2, top, width, height + 40, ` rx="14"`);
    // A drop of wax run down from the top.
    body += path(`M${n(x - 18)} ${n(top + 2)} q4 34 0 52 q-6 12 -10 0 q-2 -30 -4 -52z`, "#ffffff", ` opacity="0.55"`);
    body += path(`M${n(x)} ${n(top)} L${n(x + 1)} ${n(top - 24)}`, "none", ` stroke="#2b1a1a" stroke-width="5" stroke-linecap="round"`);
    body += group(at(x, top - 64), flame(30, "flameGlow"));
  }
  for (let i = 0; i < 18; i++) body += group(at(r() * W, r() * H * 0.6), sparkle(4 + r() * 10, "#fff4dc"), ` opacity="${(0.4 + r() * 0.5).toFixed(2)}"`);
  return poster(defs, body);
}

function balloons() {
  const r = rng("balloons");
  const defs =
    linear("bg", [
      [0, "#ffbf9b"],
      [0.5, "#ff8193"],
      [1, "#c4467a"],
    ]) +
    radial(
      "shine",
      [
        [0, "#ffffff", 0.62],
        [0.32, "#ffffff", 0],
        [0.75, "#28002a", 0.05],
        [1, "#28002a", 0.3],
      ],
      0.34,
      0.3,
      0.75,
    ) +
    glow("haze", "#ffe3c8", 0.5);
  let body = rect("url(#bg)") + ellipse(W * 0.5, H * 0.2, W * 0.7, H * 0.25, "url(#haze)");
  body += confetti(r, 130, ["#ffd166", "#ffffff", "#06d6a0", "#118ab2", "#ef476f"], { x: 0, y: 0, w: W, h: H }, 1.1);
  const all: [number, number, string][] = [
    [300, 470, "#ffd166"],
    [600, 330, "#ef476f"],
    [910, 490, "#06d6a0"],
    [450, 720, "#118ab2"],
    [770, 740, "#ffffff"],
    [170, 860, "#f78c6b"],
    [1040, 870, "#9b5de5"],
  ];
  const knot = { x: W * 0.5, y: H * 1.02 };
  for (const [x, y] of all) {
    const bend = (r() - 0.5) * 140;
    body += path(
      `M${x} ${y + 186} C${n(x + bend)} ${y + 420} ${n(knot.x + (x - knot.x) * 0.2)} ${n(knot.y - 300)} ${knot.x} ${knot.y}`,
      "none",
      ` stroke="#ffffff" stroke-opacity="0.75" stroke-width="3"`,
    );
  }
  for (const [x, y, colour] of all) {
    body += group(
      at(x, y, (r() - 0.5) * 10),
      ellipse(0, 0, 136, 168, colour) + ellipse(0, 0, 136, 168, "url(#shine)") + path("M-16 184 L16 184 L0 164Z", colour) + ellipse(-48, -70, 22, 40, "#ffffff", ` opacity="0.55" transform="rotate(-24 -48 -70)"`),
    );
  }
  return poster(defs, body);
}

function cake() {
  const r = rng("cake");
  const defs =
    linear("bg", [
      [0, "#ffe1ec"],
      [1, "#ffc2d6"],
    ]) +
    linear("sponge", [
      [0, "#fff6ea"],
      [1, "#f7dcc4"],
    ]) +
    linear(
      "stand",
      [
        [0, "#ffffff"],
        [1, "#e6d8e8"],
      ],
      0,
      0,
      0,
      1,
    ) +
    linear(
      "body",
      [
        [0, "#000000", 0.1],
        [0.35, "#ffffff", 0.12],
        [0.65, "#ffffff", 0],
        [1, "#000000", 0.14],
      ],
      0,
      0,
      1,
      0,
    ) +
    FLAME_DEFS +
    DROP;
  let body = rect("url(#bg)");
  // Polka dots.
  for (let y = 0; y < H + 60; y += 120)
    for (let x = (y / 120) % 2 ? 60 : 0; x < W + 60; x += 120) body += circle(x, y, 13, "#ffffff", ` opacity="0.6"`);
  const cx = W / 2;
  // The stand.
  body += path(`M${cx - 380} 1180 L${cx + 380} 1180 L${cx + 340} 1215 L${cx - 340} 1215Z`, "url(#stand)", ` filter="url(#drop)"`);
  body += path(`M${cx - 60} 1215 L${cx + 60} 1215 L${cx + 40} 1380 L${cx - 40} 1380Z`, "#e9dcea");
  body += ellipse(cx, 1385, 150, 26, "#e2d2e3");
  // Two tiers, each a body, a band of icing and drips.
  const tier = (top: number, half: number, height: number, icing: string) => {
    let out = rect("url(#sponge)", cx - half, top, half * 2, height, ` rx="18"`);
    out += rect("url(#body)", cx - half, top, half * 2, height, ` rx="18"`);
    out += rect("#ff9fbf", cx - half, top + height * 0.55, half * 2, 26);
    let drips = `M${cx - half - 8} ${top - 10} L${cx + half + 8} ${top - 10} L${cx + half + 8} ${top + 30}`;
    const count = Math.round(half / 34);
    for (let i = count; i > 0; i--) {
      const x = cx - half + (i / count) * half * 2;
      const depth = 40 + r() * 70;
      drips += ` Q${n(x - 8)} ${n(top + 30)} ${n(x - 14)} ${n(top + depth)} Q${n(x - 30)} ${n(top + depth + 26)} ${n(x - 46)} ${n(top + depth)} Q${n(x - 52)} ${top + 30} ${n(x - 68)} ${top + 30}`;
    }
    drips += ` L${cx - half - 8} ${top + 30}Z`;
    out += path(drips, icing);
    out += rect(icing, cx - half - 8, top - 22, half * 2 + 16, 40, ` rx="20"`);
    return out;
  };
  body += group("", tier(900, 320, 280, "#fffaf4"), ` filter="url(#drop)"`);
  body += group("", tier(640, 220, 250, "#ffffff"), ` filter="url(#drop)"`);
  // Sprinkles on the icing.
  const sprinkleColours = ["#ff6b8b", "#ffd166", "#5ec8f2", "#7ed6a5", "#b388eb"];
  for (let i = 0; i < 46; i++) {
    const onTop = i % 2 === 0;
    const x = cx + (r() - 0.5) * (onTop ? 400 : 600);
    const y = onTop ? 625 + r() * 30 : 885 + r() * 30;
    body += group(at(x, y, r() * 180), rect(sprinkleColours[i % 5], -9, -3.5, 18, 7, ` rx="3.5"`));
  }
  // Candles.
  const candleColours = ["#5ec8f2", "#ffd166", "#ff6b8b", "#7ed6a5", "#b388eb"];
  for (let i = 0; i < 5; i++) {
    const x = cx - 160 + i * 80;
    const height = 120 + (i % 2) * 20;
    body += rect(candleColours[i], x - 13, 620 - height, 26, height, ` rx="6"`);
    body += rect("#ffffff", x - 13, 620 - height + 20, 26, 12, ` opacity="0.7"`) + rect("#ffffff", x - 13, 620 - height + 60, 26, 12, ` opacity="0.7"`);
    body += path(`M${x} ${620 - height} L${x} ${600 - height}`, "none", ` stroke="#3a2420" stroke-width="4" stroke-linecap="round"`);
    body += group(at(x, 572 - height), flame(17, "flameGlow"));
  }
  body += confetti(r, 40, ["#ff6b8b", "#ffd166", "#5ec8f2", "#ffffff"], { x: 0, y: 0, w: W, h: 330 }, 1);
  return poster(defs, body);
}

// ---------------------------------------------------------------- Dinner

function candlelight() {
  const r = rng("candlelight");
  const defs =
    linear("bg", [
      [0, "#0c1530"],
      [0.6, "#1f1230"],
      [1, "#2a0f22"],
    ]) +
    glow("bokehWarm", "#ffc070", 0.55) +
    glow("bokehRose", "#ff8a7a", 0.4) +
    glow("pool", "#ffb060", 0.5) +
    linear(
      "wax",
      [
        [0, "#d4c09a"],
        [0.45, "#fff6e2"],
        [1, "#b49a72"],
      ],
      0,
      0,
      1,
      0,
    ) +
    linear(
      "brass",
      [
        [0, "#7a5222"],
        [0.4, "#f2c879"],
        [0.6, "#c99a4a"],
        [1, "#5e3c14"],
      ],
      0,
      0,
      1,
      0,
    ) +
    linear("cloth", [
      [0, "#4a2320"],
      [1, "#1d0c0c"],
    ]) +
    FLAME_DEFS;
  let body = rect("url(#bg)") + orbs(r, 46, ["bokehWarm", "bokehRose"], { x: -40, y: -40, w: W + 80, h: H * 0.7 }, [30, 160], [0.4, 1]);
  const table = H * 0.8;
  body += ellipse(W / 2, table - 40, W * 0.6, 260, "url(#pool)");
  body += rect("url(#cloth)", 0, table, W, H - table);
  body += rect("#ffd9a0", 0, table, W, 3, ` opacity="0.25"`);
  for (const [x, height] of [
    [W * 0.36, 400],
    [W * 0.5, 520],
    [W * 0.64, 340],
  ] as const) {
    const top = table - 60 - height;
    body += path(`M${n(x - 60)} ${table - 4} Q${n(x)} ${table - 30} ${n(x + 60)} ${table - 4}Z`, "url(#brass)");
    body += rect("url(#brass)", x - 14, table - 60, 28, 40, ` rx="6"`) + ellipse(x, table - 60, 42, 10, "url(#brass)");
    body += rect("url(#wax)", x - 22, top, 44, height, ` rx="10"`);
    body += path(`M${n(x + 8)} ${n(top + 2)} q6 50 0 80 q-8 14 -12 0 q-1 -44 -4 -80z`, "#fff8e8", ` opacity="0.8"`);
    body += path(`M${n(x)} ${n(top)} L${n(x)} ${n(top - 20)}`, "none", ` stroke="#1a1010" stroke-width="5" stroke-linecap="round"`);
    body += group(at(x, top - 56), flame(30, "flameGlow"));
  }
  return poster(defs, body);
}

function picnic() {
  const r = rng("picnic");
  const defs =
    `<pattern id="gingham" width="120" height="120" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)"><rect width="120" height="120" fill="#fbf3e6"/><rect width="60" height="120" fill="#d6403c" fill-opacity="0.42"/><rect width="120" height="60" fill="#d6403c" fill-opacity="0.42"/></pattern>` +
    radial(
      "plate",
      [
        [0, "#ffffff"],
        [0.85, "#f7f3ee"],
        [1, "#e9e2da"],
      ],
      0.45,
      0.4,
      0.6,
    ) +
    radial("lemonFlesh", [
      [0, "#fffbe0"],
      [1, "#ffe680"],
    ]) +
    radial(
      "glass",
      [
        [0, "#ffffff", 0.15],
        [1, "#ffffff", 0.6],
      ],
      0.5,
      0.5,
      0.5,
    ) +
    DROP;
  let body = rect("url(#gingham)");
  const plateX = W / 2;
  const plateY = H * 0.38;
  body += circle(plateX, plateY, 260, "url(#plate)", ` filter="url(#drop)"`);
  body += circle(plateX, plateY, 186, "none", ` stroke="#a07a5a" stroke-opacity="0.16" stroke-width="5"`);
  // A slice of cake on the plate: a wedge with a strawberry.
  body += path(`M${plateX - 110} ${plateY + 70} L${plateX + 120} ${plateY + 40} L${plateX + 40} ${plateY - 90}Z`, "#fff4e0");
  body += path(`M${plateX - 110} ${plateY + 70} L${plateX + 120} ${plateY + 40} L${plateX + 120} ${plateY + 70} L${plateX - 110} ${plateY + 100}Z`, "#f1d3a6");
  body += path(`M${plateX - 110} ${plateY + 82} L${plateX + 120} ${plateY + 52} L${plateX + 120} ${plateY + 60} L${plateX - 110} ${plateY + 90}Z`, "#e66a6a");
  body += path(`M${plateX + 10} ${plateY - 40} q28 -36 56 0 q-4 44 -28 56 q-24 -12 -28 -56z`, "#e8424f");
  body += path(`M${plateX + 30} ${plateY - 52} l8 -18 l8 18 l12 -10 l-6 16z`, "#4f9a52");
  // Fork and knife.
  const cutlery = (x: number, fork: boolean) => {
    let out = rect("#e4dfd7", x - 11, plateY - 60, 22, 330, ` rx="11"`);
    out += fork
      ? rect("#e4dfd7", x - 26, plateY - 210, 52, 130, ` rx="12"`) + [-15, -5, 5, 15].map((dx) => rect("#cfc8bf", x + dx - 2, plateY - 210, 4, 80)).join("")
      : path(`M${x - 18} ${plateY - 60} L${x - 18} ${plateY - 240} Q${x + 30} ${plateY - 200} ${x + 18} ${plateY - 60}Z`, "#e4dfd7");
    return group("", out, ` filter="url(#drop)"`);
  };
  body += cutlery(plateX - 340, true) + cutlery(plateX + 340, false);
  // Lemons, whole and halved.
  const lemonHalf = (x: number, y: number, radius: number) => {
    let out = circle(x, y, radius, "#ffd23f") + circle(x, y, radius * 0.86, "url(#lemonFlesh)");
    for (let a = 0; a < 10; a++) {
      const angle = (a / 10) * TAU;
      out += path(`M${x} ${y} L${n(x + Math.cos(angle) * radius * 0.82)} ${n(y + Math.sin(angle) * radius * 0.82)}`, "none", ` stroke="#ffd23f" stroke-width="5"`);
    }
    return group("", out + circle(x, y, radius * 0.12, "#fff6c8"), ` filter="url(#drop)"`);
  };
  body += lemonHalf(W * 0.2, H * 0.74, 100) + lemonHalf(W * 0.83, H * 0.86, 78);
  body += group(at(W * 0.36, H * 0.9, -20), ellipse(0, 0, 96, 70, "#ffd23f") + ellipse(-30, -24, 26, 14, "#fff3a8", ` opacity="0.7"`), ` filter="url(#drop)"`);
  // A glass of lemonade from above.
  body += circle(W * 0.7, H * 0.66, 104, "url(#glass)", ` filter="url(#drop)"`);
  body += circle(W * 0.7, H * 0.66, 84, "#fff1a0", ` opacity="0.75"`);
  body += circle(W * 0.7, H * 0.66, 104, "none", ` stroke="#ffffff" stroke-width="12" stroke-opacity="0.9"`);
  for (let i = 0; i < 6; i++) body += circle(W * 0.7 + (r() - 0.5) * 100, H * 0.66 + (r() - 0.5) * 100, 6 + r() * 6, "#ffffff", ` opacity="0.7"`);
  // Daisies on the cloth.
  const daisy = (x: number, y: number, size: number) => {
    let out = "";
    for (let p = 0; p < 8; p++) out += ellipse(0, -size * 0.6, size * 0.22, size * 0.5, "#ffffff", ` transform="rotate(${p * 45})"`);
    return group(at(x, y, r() * 40), out + circle(0, 0, size * 0.24, "#ffc93c"));
  };
  body += daisy(W * 0.12, H * 0.16, 70) + daisy(W * 0.9, H * 0.12, 54) + daisy(W * 0.58, H * 0.76, 50);
  return poster(defs, body);
}

// ---------------------------------------------------------------- Wedding

function botanical() {
  const r = rng("botanical");
  const defs = radial(
    "bg",
    [
      [0, "#fbf7ef"],
      [1, "#e7ddcb"],
    ],
    0.5,
    0.4,
    0.8,
  );
  const radius = W * 0.3;
  const cy = H * 0.42;
  const bottom = H * 0.97;
  let body = rect("url(#bg)");
  body += path(`M${W * 0.2} ${bottom} L${W * 0.2} ${cy} A${radius} ${radius} 0 0 1 ${W * 0.8} ${cy} L${W * 0.8} ${bottom}`, "none", ` stroke="#7d9a6f" stroke-opacity="0.35" stroke-width="6"`);
  const greens = ["#7d9a6f", "#a3b18a", "#588157", "#8aa37b", "#6b8f5e"];
  const leaf = (x: number, y: number, length: number, angle: number, colour: string) =>
    group(
      at(x, y, (angle * 180) / Math.PI),
      path(`M0 0 Q${n(length * 0.5)} ${n(-length * 0.34)} ${n(length)} 0 Q${n(length * 0.5)} ${n(length * 0.34)} 0 0Z`, colour) +
        path(`M0 0 L${n(length * 0.88)} 0`, "none", ` stroke="#ffffff" stroke-opacity="0.35" stroke-width="2"`),
    );
  const side = bottom - cy;
  const arc = Math.PI * radius;
  const total = 2 * side + arc;
  const point = (t: number): [number, number, number] => {
    let d = t * total;
    if (d < side) return [W * 0.2, bottom - d, -Math.PI / 2];
    d -= side;
    if (d < arc) {
      const angle = Math.PI + d / radius;
      return [W * 0.5 + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, angle + Math.PI / 2];
    }
    d -= arc;
    return [W * 0.8, cy + d, Math.PI / 2];
  };
  for (let i = 0; i < 130; i++) {
    const [x, y, direction] = point(i / 130);
    const turn = i % 2 ? 1 : -1;
    body += leaf(x + (r() - 0.5) * 18, y + (r() - 0.5) * 18, 52 + r() * 50, direction + turn * (0.6 + r() * 0.7), greens[Math.floor(r() * greens.length)]);
  }
  const flower = (x: number, y: number, size: number, colour: string) => {
    let out = "";
    for (let p = 0; p < 6; p++) out += ellipse(size * 0.55, 0, size * 0.5, size * 0.32, colour, ` transform="rotate(${p * 60})"`);
    for (let p = 0; p < 6; p++) out += ellipse(size * 0.3, 0, size * 0.28, size * 0.18, "#ffffff", ` opacity="0.45" transform="rotate(${p * 60 + 30})"`);
    return group(at(x, y, r() * 60), out + circle(0, 0, size * 0.22, "#f2cf7f"));
  };
  for (let i = 0; i < 16; i++) {
    const [x, y] = point(r());
    body += flower(x + (r() - 0.5) * 40, y + (r() - 0.5) * 40, 32 + r() * 26, r() < 0.5 ? "#e8b4b8" : "#f4d6cc");
  }
  // Small buds and berries.
  for (let i = 0; i < 30; i++) {
    const [x, y] = point(r());
    body += circle(x + (r() - 0.5) * 70, y + (r() - 0.5) * 70, 5 + r() * 5, r() < 0.5 ? "#c98f97" : "#f2cf7f", ` opacity="0.85"`);
  }
  return poster(defs, body);
}

function rings() {
  const r = rng("rings");
  const defs =
    radial(
      "bg",
      [
        [0, "#fdeae4"],
        [0.6, "#eebcbc"],
        [1, "#c98b95"],
      ],
      0.5,
      0.36,
      0.85,
    ) +
    linear(
      "gold",
      [
        [0, "#fff1c2"],
        [0.3, "#d9a441"],
        [0.55, "#f7da8b"],
        [0.8, "#b8822a"],
        [1, "#8a5a14"],
      ],
      0,
      0,
      1,
      1,
    ) +
    glow("halo", "#ffffff", 0.55) +
    blurFilter("petalBlur", 6);
  const y = H * 0.4;
  const ring = (x: number) => circle(x, y, 250, "none", ` stroke="url(#gold)" stroke-width="56"`) + circle(x, y, 274, "none", ` stroke="#fff6d8" stroke-opacity="0.5" stroke-width="4"`);
  let body = rect("url(#bg)") + ellipse(W / 2, y, 560, 420, "url(#halo)");
  // Petals drifting.
  for (let i = 0; i < 22; i++) {
    const near = i % 4 === 0;
    body += group(
      at(r() * W, r() * H, r() * 180, near ? 1.6 : 1),
      ellipse(0, 0, 26, 16, r() < 0.5 ? "#ffffff" : "#f6c7cf", ` opacity="${near ? 0.55 : 0.8}"${near ? ` filter="url(#petalBlur)"` : ""}`),
    );
  }
  body += ring(W * 0.38) + ring(W * 0.62);
  // The left ring passes in front of the right at the bottom, so they are linked.
  body += `<clipPath id="front"><rect x="${W * 0.38}" y="${y}" width="${W * 0.24}" height="320"/></clipPath>`;
  body += group("", circle(W * 0.38, y, 250, "none", ` stroke="url(#gold)" stroke-width="56"`), ` clip-path="url(#front)"`);
  for (let i = 0; i < 26; i++) body += group(at(r() * W, r() * H), sparkle(8 + r() * 24, "#ffffff"), ` opacity="${(0.5 + r() * 0.5).toFixed(2)}"`);
  return poster(defs, body);
}

// Soft-focus roses: the 0.4 scene, at 4:5, with a few petals in focus.
function rose() {
  const r = rng("rose");
  const defs =
    linear(
      "bg",
      [
        [0, "#3a0f2e"],
        [1, "#160617"],
      ],
      0,
      0,
      1,
      1,
    ) +
    blurFilter("deep", 70) +
    blurFilter("soft", 10) +
    radial(
      "petal",
      [
        [0, "#ffd6e6"],
        [0.7, "#ff8fbf"],
        [1, "#c2487f"],
      ],
      0.35,
      0.3,
      0.8,
    );
  let body = rect("url(#bg)");
  body += group(
    "",
    ellipse(300, 380, 330, 260, "#ff7ab8", ` opacity="0.6"`) +
      ellipse(950, 580, 300, 330, "#ff9a6b", ` opacity="0.5"`) +
      ellipse(480, 1100, 380, 290, "#c2489a", ` opacity="0.6"`) +
      ellipse(1000, 1260, 260, 220, "#ffc48a", ` opacity="0.45"`),
    ` filter="url(#deep)"`,
  );
  // Out-of-focus roses: rings of soft petals.
  const bloom = (x: number, y: number, size: number, blur: boolean) => {
    let out = "";
    for (let ring = 0; ring < 3; ring++)
      for (let p = 0; p < 5; p++)
        out += ellipse(0, -size * (0.55 - ring * 0.16), size * (0.42 - ring * 0.08), size * (0.3 - ring * 0.05), "url(#petal)", ` transform="rotate(${p * 72 + ring * 36})"`);
    return group(at(x, y, r() * 72), out + circle(0, 0, size * 0.12, "#a8336b"), blur ? ` filter="url(#soft)" opacity="0.75"` : "");
  };
  body += bloom(230, 1260, 210, true) + bloom(1010, 300, 170, true) + bloom(880, 1180, 110, false);
  for (let i = 0; i < 14; i++) body += circle(r() * W, r() * H, 3 + r() * 6, "#ffd9e8", ` opacity="${(0.3 + r() * 0.4).toFixed(2)}"`);
  return poster(defs, body);
}

// ---------------------------------------------------------------- Kids

function playtime() {
  const r = rng("playtime");
  const defs = `<pattern id="dots" width="72" height="72" patternUnits="userSpaceOnUse"><circle cx="36" cy="36" r="5" fill="#3c280a" fill-opacity="0.13"/></pattern>`;
  let body = rect("#ffe7a3") + rect("url(#dots)");
  const colours = ["#ff6b6b", "#4d96ff", "#6bcb77", "#ff9f1c", "#b388eb"];
  // Shapes spread over a loose grid, so none piles on another.
  const cells: [number, number][] = [];
  for (let row = 0; row < 7; row++) for (let column = 0; column < 4; column++) cells.push([column, row]);
  cells.forEach(([column, row], i) => {
    const x = (column + 0.5 + (r() - 0.5) * 0.6) * (W / 4);
    const y = (row + 0.5 + (r() - 0.5) * 0.5) * (H / 7);
    const size = 52 + r() * 70;
    const colour = colours[i % colours.length];
    const kind = (i * 7) % 5;
    let shape: string;
    if (kind === 0) shape = circle(0, 0, size * 0.6, colour);
    else if (kind === 1) shape = path(`M0 ${n(-size * 0.7)} L${n(size * 0.65)} ${n(size * 0.5)} L${n(-size * 0.65)} ${n(size * 0.5)}Z`, colour, ` stroke="${colour}" stroke-width="16" stroke-linejoin="round"`);
    else if (kind === 2) {
      let d = `M${n(-size)} 0`;
      for (let j = 1; j <= 4; j++) d += ` Q${n(-size + ((j - 0.5) * size) / 2)} ${n((j % 2 ? -1 : 1) * size * 0.4)} ${n(-size + (j * size) / 2)} 0`;
      shape = path(d, "none", ` stroke="${colour}" stroke-width="18" stroke-linecap="round"`);
    } else if (kind === 3) shape = path(`M${n(-size * 0.6)} 0 A${n(size * 0.6)} ${n(size * 0.6)} 0 0 0 ${n(size * 0.6)} 0Z`, colour);
    else shape = rect(colour, -size * 0.5, -size * 0.5, size, size, ` rx="${n(size * 0.18)}"`);
    body += group(at(x, y, r() * 360), shape);
  });
  return poster(defs, body);
}

function rainbow() {
  const defs =
    linear("bg", [
      [0, "#bfe3ff"],
      [1, "#ffd9ea"],
    ]) +
    `<filter id="cloudShadow" x="-20%" y="-30%" width="140%" height="180%"><feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#505a8c" flood-opacity="0.2"/></filter>`;
  const cx = W / 2;
  const cy = H * 0.64;
  let body = rect("url(#bg)");
  const bands = ["#ff8fa3", "#ffb86b", "#ffe06b", "#8fe3a1", "#8fc9ff", "#b9a3ff"];
  bands.forEach((colour, i) => {
    const radius = 440 - i * 52;
    body += path(`M${cx - radius} ${cy} A${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`, "none", ` stroke="${colour}" stroke-width="54"`);
  });
  const cloud = (x: number, y: number, size: number) => {
    const puffs = [
      [-0.9, 0, 0.6],
      [-0.3, -0.35, 0.75],
      [0.45, -0.2, 0.65],
      [1, 0.05, 0.5],
    ]
      .map(([dx, dy, radius]) => circle(x + dx * size, y + dy * size, radius * size, "#ffffff"))
      .join("");
    return group("", puffs + rect("#ffffff", x - size * 0.9, y, size * 1.9, size * 0.55, ` rx="${n(size * 0.27)}"`), ` filter="url(#cloudShadow)"`);
  };
  body += cloud(cx - 330, cy + 20, 140) + cloud(cx + 350, cy + 20, 140) + cloud(W * 0.2, H * 0.15, 92) + cloud(W * 0.82, H * 0.24, 76);
  const r = rng("rainbow");
  for (let i = 0; i < 14; i++) body += group(at(r() * W, r() * H * 0.45), sparkle(8 + r() * 14, "#ffffff"), ` opacity="${(0.6 + r() * 0.4).toFixed(2)}"`);
  // Little hearts low on the page.
  for (let i = 0; i < 9; i++) {
    const s = 16 + r() * 14;
    body += group(
      at(r() * W, H * 0.8 + r() * H * 0.18, (r() - 0.5) * 40),
      path(`M0 ${n(s * 0.35)} C${n(-s)} ${n(-s * 0.4)} ${n(-s * 0.4)} ${n(-s)} 0 ${n(-s * 0.35)} C${n(s * 0.4)} ${n(-s)} ${n(s)} ${n(-s * 0.4)} 0 ${n(s * 0.35)}Z`, bands[i % 6]),
    );
  }
  return poster(defs, body);
}

// ---------------------------------------------------------------- Night out

function disco() {
  const r = rng("disco");
  const cx = W / 2;
  const cy = H * 0.33;
  const radius = 260;
  const defs =
    radial(
      "bg",
      [
        [0, "#2c1652"],
        [1, "#0e0620"],
      ],
      0.5,
      0.33,
      0.8,
    ) +
    radial(
      "ballShade",
      [
        [0, "#ffffff", 0.55],
        [0.45, "#ffffff", 0],
        [1, "#0a001e", 0.75],
      ],
      0.33,
      0.3,
      0.75,
    ) +
    glow("ballGlow", "#c9a6ff", 0.45) +
    `<clipPath id="ball"><circle cx="${cx}" cy="${cy}" r="${radius}"/></clipPath>`;
  let body = rect("url(#bg)");
  for (let i = 0; i < 28; i++) {
    const a0 = (i / 28) * TAU;
    const a1 = a0 + Math.PI / 28;
    const far = H * 1.4;
    body += path(
      `M${cx} ${cy} L${n(cx + Math.cos(a0) * far)} ${n(cy + Math.sin(a0) * far)} L${n(cx + Math.cos(a1) * far)} ${n(cy + Math.sin(a1) * far)}Z`,
      i % 2 ? "#ff78c8" : "#8c6eff",
      ` opacity="${i % 2 ? 0.1 : 0.13}"`,
    );
  }
  body += circle(cx, cy, radius * 2, "url(#ballGlow)");
  body += path(`M${cx} 0 L${cx} ${cy - radius}`, "none", ` stroke="#ffffff" stroke-opacity="0.5" stroke-width="4"`);
  // The mirror tiles, in rows that narrow towards the poles, so the ball reads as a sphere.
  let tiles = "";
  const tile = 34;
  for (let y = cy - radius; y < cy + radius; y += tile) {
    const middle = y + tile / 2 - cy;
    const half = Math.sqrt(Math.max(0, radius * radius - middle * middle));
    const width = tile * Math.max(0.35, half / radius);
    for (let x = cx - half; x < cx + half; x += width) {
      const light = 38 + r() * 55;
      tiles += rect(`hsl(${Math.round(250 + r() * 60)} 32% ${Math.round(light)}%)`, x + 1.5, y + 1.5, width - 3, tile - 3);
    }
  }
  body += group("", rect("#1a0c33", cx - radius, cy - radius, radius * 2, radius * 2) + tiles + rect("url(#ballShade)", cx - radius, cy - radius, radius * 2, radius * 2), ` clip-path="url(#ball)"`);
  for (let i = 0; i < 18; i++) body += group(at(cx + (r() - 0.5) * W * 0.95, cy + (r() - 0.5) * H * 0.7), sparkle(12 + r() * 30, "#ffffff"), ` opacity="${(0.6 + r() * 0.4).toFixed(2)}"`);
  const dots = ["#ff7ac8", "#9a7bff", "#ffffff", "#7af0ff"];
  for (let i = 0; i < 70; i++) body += circle(r() * W, H * 0.6 + r() * H * 0.4, 4 + r() * 10, dots[i % 4], ` opacity="${(0.2 + r() * 0.4).toFixed(2)}"`);
  return poster(defs, body);
}

function sunsetDrive() {
  const r = rng("sunset-drive");
  const horizon = H * 0.58;
  const cx = W / 2;
  const sun = 330;
  const defs =
    linear("sky", [
      [0, "#1b0b3d"],
      [0.6, "#6b1f6e"],
      [1, "#ff5e8a"],
    ]) +
    linear("sun", [
      [0, "#ffe27a"],
      [1, "#ff4f8b"],
    ]) +
    linear("haze", [
      [0, "#ff78c8", 0.6],
      [1, "#ff78c8", 0],
    ]) +
    linear("ground", [
      [0, "#21093f"],
      [1, "#0b0320"],
    ]) +
    `<clipPath id="sunTop"><rect x="0" y="0" width="${W}" height="${horizon}"/></clipPath>`;
  let body = rect("url(#sky)", 0, 0, W, horizon) + stars(r, 70, { x: 0, y: 0, w: W, h: horizon * 0.5 }, 1.2);
  // The sun, cut by bands of sky that thicken towards the horizon.
  let sunBody = circle(cx, horizon, sun, "url(#sun)");
  for (let k = 0; k < 7; k++) sunBody += rect("#7a2472", cx - sun, horizon - 26 - k * 44, sun * 2, 14 - k * 1.8);
  body += group("", sunBody, ` clip-path="url(#sunTop)"`);
  // Mountains in silhouette either side.
  body += path(`M0 ${horizon} L0 ${horizon - 120} L140 ${horizon - 210} L260 ${horizon - 110} L330 ${horizon - 150} L420 ${horizon}Z`, "#3a0f4f");
  body += path(`M${W} ${horizon} L${W} ${horizon - 160} L${W - 120} ${horizon - 240} L${W - 250} ${horizon - 120} L${W - 340} ${horizon - 170} L${W - 440} ${horizon}Z`, "#3a0f4f");
  body += rect("url(#ground)", 0, horizon, W, H - horizon);
  let grid = "";
  for (let i = 1; i < 15; i++) {
    const y = horizon + Math.pow(i / 14, 2) * (H - horizon);
    grid += `M0 ${n(y)} L${W} ${n(y)} `;
  }
  for (let i = -13; i <= 13; i++) grid += `M${n(cx + i * 28)} ${n(horizon)} L${n(cx + i * 220)} ${H} `;
  body += path(grid, "none", ` stroke="#ff5ac8" stroke-opacity="0.75" stroke-width="3"`);
  body += rect("url(#haze)", 0, horizon, W, 60);
  return poster(defs, body);
}

function cocktails() {
  const r = rng("cocktails");
  const defs =
    linear(
      "bg",
      [
        [0, "#0f4c5c"],
        [0.55, "#1b6f6a"],
        [1, "#123a4a"],
      ],
      0,
      0,
      1,
      1,
    ) +
    linear("drinkPink", [
      [0, "#ffb3c8"],
      [1, "#ff5f8f"],
    ]) +
    linear("drinkGold", [
      [0, "#ffe9a8"],
      [1, "#ffb84d"],
    ]) +
    linear(
      "glassEdge",
      [
        [0, "#ffffff", 0.75],
        [1, "#ffffff", 0.25],
      ],
      0,
      0,
      1,
      0,
    ) +
    glow("spot", "#ffe9c2", 0.4);
  let body = rect("url(#bg)") + ellipse(W / 2, H * 0.42, 640, 520, "url(#spot)");
  // Art deco fans behind the glasses.
  for (let i = 0; i < 9; i++) {
    const angle = Math.PI + (i / 8) * Math.PI;
    body += path(`M${W / 2} ${H * 0.98} L${n(W / 2 + Math.cos(angle) * 1400)} ${n(H * 0.98 + Math.sin(angle) * 1400)}`, "none", ` stroke="#f2c879" stroke-opacity="0.18" stroke-width="5"`);
  }
  for (let k = 1; k <= 3; k++) {
    const radius = 300 + k * 170;
    body += path(`M${W / 2 - radius} ${H * 0.98} A${radius} ${radius} 0 0 1 ${W / 2 + radius} ${H * 0.98}`, "none", ` stroke="#f2c879" stroke-opacity="0.16" stroke-width="5"`);
  }
  // A coupe: a shallow bowl on a stem, tilted towards the other.
  const coupe = (x: number, y: number, tilt: number, drink: string, garnish: string) => {
    let out = path(`M-190 0 Q-180 160 0 175 Q180 160 190 0Z`, "#ffffff", ` opacity="0.16"`);
    out += path(`M-176 26 Q-164 150 0 162 Q164 150 176 26Z`, drink);
    out += ellipse(0, 26, 176, 22, "#ffffff", ` opacity="0.35"`);
    out += path(`M-190 0 Q-180 160 0 175 Q180 160 190 0`, "none", ` stroke="url(#glassEdge)" stroke-width="6"`);
    out += ellipse(0, 0, 190, 22, "none", ` stroke="#ffffff" stroke-opacity="0.7" stroke-width="5"`);
    out += rect("#ffffff", -7, 172, 14, 300, ` opacity="0.55"`);
    out += ellipse(0, 480, 120, 22, "#ffffff", ` opacity="0.5"`);
    out += path(`M-150 40 Q-140 120 -60 150`, "none", ` stroke="#ffffff" stroke-opacity="0.55" stroke-width="10" stroke-linecap="round"`);
    out += garnish;
    return group(at(x, y, tilt), out);
  };
  const cherry = path(`M70 18 Q90 -70 150 -110`, "none", ` stroke="#4a2a14" stroke-width="5"`) + circle(70, 24, 30, "#d7263d") + circle(60, 12, 9, "#ffffff", ` opacity="0.6"`);
  const twist = path(`M-120 10 q30 -60 60 -10 q30 50 60 0 q30 -50 60 -4`, "none", ` stroke="#ffd23f" stroke-width="16" stroke-linecap="round"`);
  body += coupe(W * 0.36, H * 0.44, -12, "url(#drinkPink)", cherry);
  body += coupe(W * 0.66, H * 0.42, 12, "url(#drinkGold)", twist);
  // The clink: a burst of lines and bubbles between the rims.
  for (let i = 0; i < 7; i++) {
    const angle = -Math.PI / 2 + (i - 3) * 0.32;
    body += path(
      `M${n(W * 0.51 + Math.cos(angle) * 70)} ${n(H * 0.36 + Math.sin(angle) * 70)} L${n(W * 0.51 + Math.cos(angle) * 140)} ${n(H * 0.36 + Math.sin(angle) * 140)}`,
      "none",
      ` stroke="#fff4d6" stroke-width="7" stroke-linecap="round"`,
    );
  }
  for (let i = 0; i < 40; i++) body += circle(W * 0.2 + r() * W * 0.6, H * 0.08 + r() * H * 0.3, 4 + r() * 10, "none", ` stroke="#ffffff" stroke-opacity="${(0.3 + r() * 0.5).toFixed(2)}" stroke-width="3"`);
  return poster(defs, body);
}

// ---------------------------------------------------------------- Outdoors

function sunshine() {
  const cx = W / 2;
  const cy = H * 0.42;
  const defs = radial(
    "sunFace",
    [
      [0, "#ffb35c"],
      [1, "#ff8a3c"],
    ],
    0.4,
    0.38,
    0.7,
  );
  let body = rect("#ffd166");
  for (let i = 0; i < 32; i += 2) {
    const a0 = (i / 32) * TAU;
    const a1 = ((i + 1) / 32) * TAU;
    const far = H * 1.2;
    body += path(`M${cx} ${cy} L${n(cx + Math.cos(a0) * far)} ${n(cy + Math.sin(a0) * far)} L${n(cx + Math.cos(a1) * far)} ${n(cy + Math.sin(a1) * far)}Z`, "#ffbf3c");
  }
  body += circle(cx, cy, 300, "#ffe08a", ` opacity="0.6"`);
  body += circle(cx, cy, 250, "url(#sunFace)");
  body += circle(cx - 40, cy - 46, 160, "#ffc070", ` opacity="0.6"`);
  body += path(`M0 ${H} L0 ${H * 0.8} Q${W * 0.3} ${H * 0.66} ${W * 0.6} ${H * 0.8} Q${W * 0.85} ${H * 0.88} ${W} ${H * 0.77} L${W} ${H}Z`, "#7cc47f");
  body += path(`M0 ${H} L0 ${H * 0.9} Q${W * 0.45} ${H * 0.79} ${W} ${H * 0.92} L${W} ${H}Z`, "#4fa66a");
  // Flowers on the hills, and a few birds.
  const r = rng("sunshine");
  for (let i = 0; i < 26; i++) {
    const x = r() * W;
    const y = H * 0.86 + r() * H * 0.12;
    body += circle(x, y, 7 + r() * 5, i % 3 ? "#ffffff" : "#ff8fa3") + circle(x, y, 3, "#ffd166");
  }
  for (let i = 0; i < 4; i++) {
    const x = W * (0.12 + r() * 0.76);
    const y = H * (0.08 + r() * 0.14);
    const s = 18 + r() * 14;
    body += path(`M${n(x - s)} ${n(y)} Q${n(x - s / 2)} ${n(y - s * 0.6)} ${n(x)} ${n(y)} Q${n(x + s / 2)} ${n(y - s * 0.6)} ${n(x + s)} ${n(y)}`, "none", ` stroke="#7a4a1a" stroke-width="5" stroke-linecap="round"`);
  }
  return poster(defs, body);
}

function seaside() {
  const defs = linear("sky", [
    [0, "#ffe8c2"],
    [1, "#ffcfa6"],
  ]);
  let body = rect("url(#sky)");
  body += circle(W * 0.7, H * 0.2, 150, "#ffb37a", ` opacity="0.45"`) + circle(W * 0.7, H * 0.2, 130, "#ff9f5a");
  const r = rng("seaside");
  for (let i = 0; i < 3; i++) {
    const x = W * (0.12 + r() * 0.4);
    const y = H * (0.1 + r() * 0.14);
    const s = 20 + r() * 10;
    body += path(`M${n(x - s)} ${n(y)} Q${n(x - s / 2)} ${n(y - s * 0.6)} ${n(x)} ${n(y)} Q${n(x + s / 2)} ${n(y - s * 0.6)} ${n(x + s)} ${n(y)}`, "none", ` stroke="#9a5a3a" stroke-width="5" stroke-linecap="round"`);
  }
  const layers = ["#9fd8e8", "#5fb8d6", "#2f8fb8", "#18648f", "#0d3f63"];
  layers.forEach((colour, i) => {
    const base = H * 0.38 + i * H * 0.12;
    const wave = (x: number) => base + Math.sin(x / 120 + i * 1.3) * 28 + Math.sin(x / 46 + i) * 8;
    let line = "";
    for (let x = 0; x <= W; x += 20) line += `${x ? "L" : "M"}${x} ${n(wave(x))} `;
    body += path(`${line}L${W} ${H} L0 ${H}Z`, colour);
    body += path(line, "none", ` stroke="#ffffff" stroke-opacity="0.55" stroke-width="5"`);
  });
  // A sailing boat on the far water.
  body += group(at(W * 0.28, H * 0.37), path("M-70 0 L70 0 L48 26 L-48 26Z", "#ffffff") + path("M-4 -6 L-4 -140 L60 -10Z", "#ffffff") + path("M-12 -6 L-12 -110 L-60 -10Z", "#ff8f6b"));
  return poster(defs, body);
}

// The sun setting over the sea: the 0.4 scene, at 4:5.
function sunsetSea() {
  const defs =
    linear("sky", [
      [0, "#2b1a4a"],
      [0.45, "#c2496b"],
      [0.62, "#ff9a5a"],
      [0.7, "#ffd27a"],
    ]) +
    linear("sea", [
      [0, "#ffb37a"],
      [0.3, "#7a3b6a"],
      [1, "#1b0f2b"],
    ]) +
    radial("sun", [
      [0, "#fff2c2"],
      [0.6, "#ffcf6b"],
      [1, "#ffcf6b", 0],
    ]) +
    blurFilter("cloudBlur", 18);
  const horizon = 900;
  let body = rect("url(#sky)", 0, 0, W, horizon);
  body += group("", ellipse(300, 520, 260, 40, "#ffb5a0") + ellipse(900, 640, 220, 34, "#ffb5a0") + ellipse(560, 380, 180, 26, "#ffb5a0"), ` opacity="0.45" filter="url(#cloudBlur)"`);
  body += circle(600, horizon - 60, 260, "url(#sun)") + circle(600, horizon - 60, 150, "#ffe9a8");
  body += rect("url(#sea)", 0, horizon, W, H - horizon);
  body += group(
    "",
    rect("#ffd9a0", 420, horizon + 10, 360, 14) + rect("#ffd9a0", 460, horizon + 50, 280, 10) + rect("#ffd9a0", 500, horizon + 100, 200, 8) + rect("#ffd9a0", 530, horizon + 160, 140, 6) + rect("#ffd9a0", 555, horizon + 230, 90, 5),
    ` opacity="0.6" filter="url(#cloudBlur)"`,
  );
  return poster(defs, body);
}

// ---------------------------------------------------------------- Holiday

function stringLights() {
  const r = rng("string-lights");
  const defs =
    linear("bg", [
      [0, "#0a1733"],
      [1, "#1f3a6b"],
    ]) +
    glow("moonGlow", "#fff1c7", 0.4) +
    `<mask id="crescent"><rect width="${W}" height="${H}" fill="#fff"/><circle cx="${W * 0.78 + 50}" cy="${H * 0.19 - 34}" r="128" fill="#000"/></mask>`;
  const colours = ["#ffd36e", "#ff7a7a", "#8fe6c2", "#a5b4fc", "#ff9ec7"];
  let glows = "";
  colours.forEach((colour, i) => (glows += glow(`bulb${i}`, colour, 0.6)));
  let body = rect("url(#bg)") + stars(r, 170, { x: 0, y: 0, w: W, h: H }, 1.1);
  body += circle(W * 0.78, H * 0.19, 300, "url(#moonGlow)");
  body += circle(W * 0.78, H * 0.19, 140, "#fff1c7", ` mask="url(#crescent)"`);
  const garland = (y0: number, sag: number, phase: number) => {
    let out = path(`M-40 ${y0} Q${W / 2} ${y0 + sag * 2} ${W + 40} ${y0}`, "none", ` stroke="#06070f" stroke-opacity="0.9" stroke-width="4"`);
    for (let i = 0; i <= 12; i++) {
      const [x, y] = quad(i / 12, -40, y0, W / 2, y0 + sag * 2, W + 40, y0);
      const k = (i + phase) % colours.length;
      out += circle(x, y + 30, 70, `url(#bulb${k})`);
      out += rect("#222222", x - 8, y, 16, 14, ` rx="3"`);
      out += ellipse(x, y + 32, 14, 22, colours[k]);
      out += ellipse(x - 4, y + 26, 4, 8, "#ffffff", ` opacity="0.7"`);
    }
    return out;
  };
  body += garland(H * 0.04, 150, 0) + garland(H * 0.42, 120, 2);
  // Snow, near and far.
  for (let i = 0; i < 60; i++) body += circle(r() * W, r() * H, 3 + r() * 6, "#ffffff", ` opacity="${(0.25 + r() * 0.5).toFixed(2)}"`);
  return poster(defs + glows, body);
}

// The northern lights over mountains: the 0.4 scene, at 4:5.
function aurora() {
  const r = rng("aurora");
  const defs =
    linear("sky", [
      [0, "#03071a"],
      [1, "#0b1c3a"],
    ]) +
    blurFilter("veil", 40) +
    linear("far", [
      [0, "#0d1a38"],
      [1, "#050a1c"],
    ]);
  let body = rect("url(#sky)") + stars(r, 90, { x: 0, y: 0, w: W, h: H * 0.6 }, 1.1);
  body += group(
    "",
    path("M-100 480 C200 330 400 630 700 430 S1100 280 1300 480 L1300 680 C1000 580 800 830 500 680 S100 780 -100 680Z", "#3ee8b0", ` opacity="0.55"`) +
      path("M-100 720 C250 570 450 870 750 670 S1050 570 1300 770 L1300 920 C1000 820 700 1020 400 870 S100 920 -100 870Z", "#7a5cff", ` opacity="0.45"`) +
      path("M-100 290 C300 190 500 390 900 240 S1200 190 1300 310 L1300 410 C1000 370 700 490 300 390 S0 410 -100 390Z", "#2bd7d0", ` opacity="0.35"`),
    ` filter="url(#veil)"`,
  );
  body += path("M0 1100 L160 990 L300 1060 L480 920 L640 1040 L820 940 L980 1060 L1200 970 L1200 1500 L0 1500Z", "#0a1430");
  body += path("M0 1210 L180 1100 L320 1170 L520 1030 L700 1150 L900 1050 L1050 1170 L1200 1090 L1200 1500 L0 1500Z", "url(#far)");
  // Pines along the foot.
  for (let x = -20; x < W + 40; x += 46) {
    const h = 90 + r() * 110;
    const base = 1330 + r() * 60;
    body += path(`M${n(x)} ${n(base - h)} L${n(x + 30)} ${n(base)} L${n(x - 30)} ${n(base)}Z`, "#02050f");
  }
  body += rect("#02050f", 0, 1380, W, 120);
  return poster(defs, body);
}

// ---------------------------------------------------------------- Any occasion

// Warm lights out of focus: the 0.4 scene, at 4:5.
function bokeh() {
  const r = rng("bokeh");
  const defs =
    linear("bg", [
      [0, "#1a0b2e"],
      [1, "#0b0614"],
    ]) +
    blurFilter("lens", 22);
  const lights: [number, number, number, string][] = [
    [200, 280, 90, "#ffb26b"],
    [980, 200, 120, "#ff6b8a"],
    [640, 490, 70, "#ffd36b"],
    [1080, 660, 60, "#ff9a5a"],
    [140, 840, 110, "#c25aa0"],
    [520, 940, 50, "#ffe08a"],
    [860, 1080, 140, "#ff7a59"],
    [300, 1270, 80, "#ffb26b"],
    [1000, 1360, 60, "#ffd36b"],
    [700, 1310, 40, "#fff0c2"],
  ];
  let body = rect("url(#bg)");
  body += group("", lights.map(([x, y, radius, colour]) => circle(x, y, radius, colour)).join(""), ` filter="url(#lens)" opacity="0.85"`);
  // Sharper discs, as a lens draws them: a ring brighter than the middle.
  for (let i = 0; i < 16; i++) {
    const colour = ["#ffd9a8", "#ffb3c1", "#fff3d0"][i % 3];
    const radius = 18 + r() * 40;
    body += circle(r() * W, r() * H, radius, colour, ` opacity="${(0.12 + r() * 0.16).toFixed(2)}" stroke="${colour}" stroke-opacity="0.35" stroke-width="3"`);
  }
  for (const [x, y, radius] of [
    [420, 230, 14],
    [760, 720, 10],
    [220, 1110, 12],
    [1120, 940, 8],
  ])
    body += circle(x, y, radius, "#fff3d0", ` opacity="0.9"`);
  return poster(defs, body);
}

function streamers() {
  const r = rng("streamers");
  const defs =
    radial(
      "bg",
      [
        [0, "#7b5cff"],
        [0.6, "#4b2ccc"],
        [1, "#2a1580"],
      ],
      0.5,
      0.4,
      0.85,
    ) + glow("burst", "#ffd6f5", 0.35);
  const colours = ["#ffd166", "#ff6b9a", "#5ef2d2", "#ffffff", "#ff9f43", "#9be15d"];
  let body = rect("url(#bg)") + circle(W / 2, H * 0.42, 620, "url(#burst)");
  // Streamers curling out from the middle.
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * TAU + r() * 0.3;
    const length = 360 + r() * 260;
    const x0 = W / 2 + Math.cos(angle) * 120;
    const y0 = H * 0.42 + Math.sin(angle) * 120;
    const x1 = W / 2 + Math.cos(angle) * length;
    const y1 = H * 0.42 + Math.sin(angle) * length;
    const bend = (r() - 0.5) * 300;
    body += path(
      `M${n(x0)} ${n(y0)} Q${n((x0 + x1) / 2 + Math.cos(angle + Math.PI / 2) * bend)} ${n((y0 + y1) / 2 + Math.sin(angle + Math.PI / 2) * bend)} ${n(x1)} ${n(y1)}`,
      "none",
      ` stroke="${colours[i % colours.length]}" stroke-width="12" stroke-linecap="round" opacity="0.85"`,
    );
  }
  body += confetti(r, 230, colours, { x: 0, y: 0, w: W, h: H }, 1.4);
  for (let i = 0; i < 12; i++) body += group(at(r() * W, r() * H), sparkle(12 + r() * 22, "#ffffff"), ` opacity="${(0.6 + r() * 0.4).toFixed(2)}"`);
  return poster(defs, body);
}

// In the order the gallery shows them within each occasion (posters.ts orders the occasions).
export const ART: readonly Art[] = [
  { id: "candles", file: "birthday-candles", draw: candles },
  { id: "balloons", file: "balloons", draw: balloons },
  { id: "cake", file: "birthday-cake", draw: cake },
  { id: "candlelight", file: "candlelight", draw: candlelight },
  { id: "picnic", file: "picnic", draw: picnic },
  { id: "botanical", file: "botanical-arch", draw: botanical },
  { id: "rings", file: "rings", draw: rings },
  { id: "rose", file: "rose-garden", draw: rose },
  { id: "playtime", file: "playtime-shapes", draw: playtime },
  { id: "rainbow", file: "rainbow", draw: rainbow },
  { id: "disco", file: "disco-ball", draw: disco },
  { id: "sunset-drive", file: "sunset-drive", draw: sunsetDrive },
  { id: "cocktails", file: "cocktails", draw: cocktails },
  { id: "sunshine", file: "sunshine", draw: sunshine },
  { id: "seaside", file: "seaside", draw: seaside },
  { id: "sunset-sea", file: "sunset-sea", draw: sunsetSea },
  { id: "string-lights", file: "string-lights", draw: stringLights },
  { id: "aurora", file: "aurora", draw: aurora },
  { id: "bokeh", file: "bokeh", draw: bokeh },
  { id: "streamers", file: "streamers", draw: streamers },
];
