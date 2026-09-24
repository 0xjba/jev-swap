// Generates the background track with Google Lyria 3 Pro via OpenRouter ($0.08 per track) -> public/music.mp3.
// Needs OPENROUTER_API_KEY. Output differs per run: listen, then retime MUSIC in src/Video.tsx (drop times) if needed.
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const PROMPT =
  "Instrumental only, no vocals. A 55-second background track for a premium software product launch video. " +
  "Modern, driving and sleek: a steady 118 BPM pulse from the very first second, a tight muted kick, crisp closed hi-hats, " +
  "a rhythmic plucked-synth ostinato, a warm analog bass line and airy cinematic pads, with a light layer added every " +
  "8 bars to keep momentum. Confident, optimistic, polished and premium, like a Stripe or Apple event product reel. " +
  "No EDM drops, no claps, no dubstep, no build-and-drop, no trailer hits, no risers; steady energy that sits under a " +
  "voiceover. Ends on a clean final chord with a short natural tail.";

const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "google/lyria-3-pro-preview", stream: true, modalities: ["text", "audio"], messages: [{ role: "user", content: PROMPT }] }),
});
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
const text = await res.text();
const b64 = text.split("\n").filter((l) => l.startsWith("data: {"))
  .map((l) => JSON.parse(l.slice(6)).choices?.[0]?.delta?.audio?.data ?? "").join("");
if (!b64) throw new Error("no audio in the response");
// Save, then normalize to -16 LUFS so mix levels in src/Video.tsx mean the same for any track.
const raw = new URL("../public/music.raw.mp3", import.meta.url).pathname;
const out = new URL("../public/music.mp3", import.meta.url).pathname;
fs.writeFileSync(raw, Buffer.from(b64, "base64"));
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-b:a", "192k", out]);
fs.unlinkSync(raw);
console.log("wrote public/music.mp3 (normalized to -16 LUFS)");
