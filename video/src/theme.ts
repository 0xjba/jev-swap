import { loadFont as loadSans } from "@remotion/google-fonts/DMSans";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

// jev-swap's site typefaces and palette (site/gen/layout.py).
export const SANS = loadSans("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;
export const MONO = loadMono("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;

export const C = {
  bg: "#19191B",
  panel: "#111113",
  line: "#2B2C30",
  line2: "#3A3B40",
  mid: "#4A4B51",
  dim: "#6C6F77",
  muted: "#8E9199",
  body: "#A1A3A9",
  soft: "#C9CBD0",
  text: "#ECEDEF",
  pink: "#F386A1",
  pink2: "#D45BB6",
  pinkLight: "#F9B3C5",
  pinkPale: "#FCD9E3",
  kw: "#E3C07A",
  com: "#7C7F87",
};

export const FPS = 30;
export const W = 1920;
export const H = 1080;
