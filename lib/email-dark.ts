/**
 * Dark-mode adaptation for received email bodies.
 *
 * Email HTML is authored for white paper. Rendering it as-authored inside a dark
 * console drops a glaring white sheet into the UI; rendering it with a blanket
 * CSS `filter: invert()` destroys logos, photography and brand colour. This module
 * rewrites only the colour declarations, by role:
 *
 *   paper / near-white fills   -> transparent (the app surface reads through)
 *   light grey panels          -> one panel tone (PANEL)
 *   pale colour tints          -> the same hue at low lightness
 *   near-black or slate ink    -> INK
 *   grey secondary ink         -> MUTED
 *   saturated text and links   -> same hue, lifted to a legible lightness
 *   hairlines (#e5e7eb etc.)   -> white at 10-14%
 *   saturated blocks, images   -> left exactly as sent
 *
 * Everything is reversible: keep the unmodified HTML and re-render it on a white
 * sheet when the user asks for the original.
 */

export const DARK_INK = "#E4EAF1";
export const DARK_MUTED = "#9FA9B5";
export const DARK_PANEL = "#1B212B";
export const DARK_LINK = "#7FD3DF";

type Rgb = { r: number; g: number; b: number; a: number };

let probe: HTMLSpanElement | null = null;

/** Resolve any CSS colour (hex, rgb(), hsl(), named) to rgba numbers. */
export function toRgb(value: string | null | undefined): Rgb | null {
  if (!value || typeof document === "undefined") return null;
  const s = String(value).trim();
  if (!s || /^(transparent|inherit|initial|unset|none|currentcolor)$/i.test(s)) return null;
  if (!probe) {
    probe = document.createElement("span");
    probe.style.display = "none";
    document.body.appendChild(probe);
  }
  probe.style.color = "";
  probe.style.color = s;
  if (!probe.style.color) return null; // not a colour the browser understands
  const m = getComputedStyle(probe).color.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const n = m[1].split(",").map(parseFloat);
  return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 };
}

/** `sat` is the raw chroma spread (0-1): a better neutrality test than HSL S, which
 *  reports near-white greys such as #f9fafb as almost fully saturated. */
function hsl(c: Rgb) {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l, sat: d };
}

function hslCss(h: number, s: number, l: number, a = 1) {
  const base = `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  return a < 1 ? `hsl(${base} / ${a.toFixed(2)})` : `hsl(${base})`;
}

/** True when a surface colour is dark enough to need adapted email rendering. */
export function isDarkSurface(value: string | null | undefined): boolean {
  const c = toRgb(value);
  if (!c || c.a < 0.2) return false;
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b) < 0.22;
}

export function mapBackground(value: string): string {
  const c = toRgb(value);
  if (!c || c.a < 0.04) return "transparent";
  const { h, s, l, sat } = hsl(c);
  if (l > 0.975 && sat < 0.05) return "transparent";   // paper
  if (l > 0.8 && sat < 0.045) return DARK_PANEL;        // light grey panel
  if (l > 0.62) return hslCss(h, Math.min(s, 0.34), 0.145, c.a); // pale tint
  return value;                                         // brand / already dark
}

export function mapForeground(value: string): string {
  const c = toRgb(value);
  if (!c) return value;
  const { h, s, l, sat } = hsl(c);
  if (l < 0.26 && sat < 0.35) return DARK_INK;          // black + slate ink
  if (sat < 0.12) return l < 0.72 ? DARK_MUTED : value; // grey ink
  if (l < 0.62) return hslCss(h, Math.min(s, 0.72), 0.7, c.a); // coloured ink
  return value;
}

export function mapBorder(value: string): string {
  const c = toRgb(value);
  if (!c) return value;
  const { h, s, l, sat } = hsl(c);
  if (sat < 0.18) {
    if (l > 0.85) return "rgba(255,255,255,0.10)";
    if (l > 0.6) return "rgba(255,255,255,0.14)";
    return value;
  }
  if (l > 0.7) return hslCss(h, Math.min(s, 0.6), 0.32, c.a);
  return value;
}

const COLOUR_DECL =
  /(background-color|background|color|border-color|border-top-color|border-right-color|border-bottom-color|border-left-color)\s*:\s*([^;{}]+)/gi;

/** Rewrite colours inside an email's own <style> block. */
export function remapCssText(css: string): string {
  return css.replace(COLOUR_DECL, (whole, prop: string, val: string) => {
    if (/url\(|gradient/i.test(val)) return whole;
    const important = /!important/i.test(val) ? " !important" : "";
    const v = val.replace(/!important/i, "").trim();
    const p = prop.toLowerCase();
    const out = p === "color" ? mapForeground(v) : p.startsWith("border") ? mapBorder(v) : mapBackground(v);
    return `${prop}: ${out}${important}`;
  });
}

/** CSS the iframe needs regardless of theme: fixed-width tables and floated side
 *  columns are what make email bodies overlap and spill sideways in a narrow pane. */
export const EMAIL_FIT_CSS = `
img { max-width: 100%; height: auto; }
table { border-collapse: collapse; max-width: 100%; }
table[width], td[width] { max-width: 100% !important; }
@media (max-width: 560px) {
  table[width], td[width], table, td { width: auto !important; }
  [style*="float"] {
    float: none !important;
    width: auto !important;
    max-width: 100% !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
}`;

/** Text the sender hid by painting it white on white (preheaders, tracking copy).
 *  Left alone it reappears at the top of the message once the canvas goes dark. */
function isInvisible(el: HTMLElement, st: CSSStyleDeclaration): boolean {
  if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return true;
  const fs = parseFloat(st.fontSize || "");
  if (fs && fs <= 2) return true;
  if (parseFloat(st.maxHeight || "") === 0 && /hidden/.test(st.overflow || "")) return true;
  const col = toRgb(st.color);
  if (!col) return false;
  const ink = hsl(col);
  if (ink.l < 0.93 || ink.sat > 0.06) return false;
  let node: HTMLElement | null = el;
  let lightness: number | null = null;
  while (node) {
    const bg = toRgb(node.style.backgroundColor || node.getAttribute("bgcolor"));
    if (bg && bg.a > 0.1) { lightness = hsl(bg).l; break; }
    node = node.parentElement;
  }
  return lightness === null || lightness > 0.8;
}

/** Absolute mastheads, baked-in heights and fixed pixel widths are the usual cause
 *  of text landing on top of other text once the pane is narrower than 600px. */
function normalizeLayout(el: HTMLElement, st: CSSStyleDeclaration) {
  const tag = el.tagName;
  if (/^(absolute|fixed)$/i.test(st.position)) {
    st.position = "static";
    (["top", "right", "bottom", "left"] as const).forEach(k => { st[k] = ""; });
  }
  if (st.transform) st.transform = "none";
  (["marginTop", "marginRight", "marginBottom", "marginLeft"] as const).forEach(k => {
    if (st[k] && parseFloat(st[k]) < 0) st[k] = "0";
  });
  if (st.height && tag !== "IMG") { st.minHeight = ""; st.height = "auto"; }
  if (st.width && /px/.test(st.width)) {
    const w = parseFloat(st.width);
    st.maxWidth = "100%";
    if (w > 360) st.width = "100%";
  }
  const wAttr = el.getAttribute("width");
  if (wAttr && !/%$/.test(wAttr) && tag !== "IMG") {
    const w = parseInt(wAttr, 10);
    if (w > 0) {
      el.removeAttribute("width");
      st.maxWidth = "100%";
      st.width = w > 360 ? "100%" : `${w}px`;
    }
  }
  if (el.getAttribute("height") && tag !== "IMG") el.removeAttribute("height");
  if (tag === "IMG") { st.maxWidth = "100%"; st.height = "auto"; }
}

/**
 * Prepare a (already sanitised) email body for display.
 * Layout is normalised in both themes; colours are remapped only when `dark`.
 * Keep the original HTML so "show original" can re-render it untouched.
 */
export function prepareEmailHtml(
  html: string,
  opts: { dark?: boolean; logoPlate?: boolean } = {}
): string {
  if (!html || typeof DOMParser === "undefined") return html;
  const dark = !!opts.dark;
  const logoPlate = opts.logoPlate !== false;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const all = Array.from(doc.body.querySelectorAll<HTMLElement>("*"));

  all.forEach(el => {
    const st = el.style;
    if (dark && isInvisible(el, st)) { st.display = "none"; return; }
    normalizeLayout(el, st);
  });

  if (!dark) return doc.body.innerHTML;

  doc.querySelectorAll("style").forEach(el => {
    el.textContent = remapCssText(el.textContent || "");
  });

  all.forEach(el => {
    const bgAttr = el.getAttribute("bgcolor");
    if (bgAttr) {
      el.removeAttribute("bgcolor");
      el.style.backgroundColor = mapBackground(bgAttr);
    }
    if (el.tagName === "FONT" && el.getAttribute("color")) {
      el.style.color = mapForeground(el.getAttribute("color") as string);
      el.removeAttribute("color");
    }

    const st = el.style;
    if (st.backgroundColor && !/gradient/i.test(st.backgroundImage || "")) {
      st.backgroundColor = mapBackground(st.backgroundColor);
    }
    if (st.color) st.color = mapForeground(st.color);
    (["borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"] as const).forEach(k => {
      if (st[k]) st[k] = mapBorder(st[k]);
    });
    if (st.boxShadow) st.boxShadow = "none";

    // Logos and signature marks are usually dark-on-transparent, so they vanish on
    // a dark canvas. A white plate keeps them legible without touching photography.
    if (el.tagName === "IMG" && logoPlate) {
      const width = parseInt(el.getAttribute("width") || "0", 10);
      const looksLikeMark = /logo|icon|mark|signature|brand/i.test(
        `${el.getAttribute("alt") || ""} ${el.getAttribute("src") || ""}`
      );
      if (looksLikeMark || (width > 0 && width <= 220)) {
        el.style.background = "#ffffff";
        el.style.padding = "7px 10px";
        el.style.borderRadius = "8px";
      }
    }
  });

  return doc.body.innerHTML;
}
