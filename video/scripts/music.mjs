// Generates the background track with Google Lyria 3 Pro via OpenRouter ($0.08 per track) -> public/music.mp3.
// Needs OPENROUTER_API_KEY. Output differs per run: listen, then retime MUSIC in src/Video.tsx (drop times) if needed.
import fs from "node:fs";

const PROMPT =
  "Instrumental only, no vocals. A 50-second background track for a modern developer-tool product launch video. " +
  "Upbeat, confident, minimal electronic: crisp plucked synth arpeggio, soft sidechained pads, light punchy drums and claps, " +
  "warm sub bass, around 120 BPM, in a major key. Starts with a short airy intro, builds energy by 10 seconds, stays steady " +
  "and uplifting under a voiceover, ends on a clean resolving hit with a short tail. Polished, optimistic, tech-forward, " +
  "like an Apple or Linear launch video.";

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
fs.writeFileSync(new URL("../public/music.mp3", import.meta.url), Buffer.from(b64, "base64"));
console.log("wrote public/music.mp3");
