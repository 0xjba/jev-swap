// Generates the background track with Google Lyria 3 Pro via OpenRouter ($0.08 per track) -> public/music.mp3.
// Needs OPENROUTER_API_KEY. Output differs per run: listen, then retime MUSIC in src/Video.tsx (drop times) if needed.
import fs from "node:fs";

const PROMPT =
  "Instrumental only, no vocals. A 55-second understated background score for a premium software product film, " +
  "in the style of Apple product videos and minimal developer-tool launches (Linear, Vercel, Stripe). " +
  "Minimal and elegant: a soft felt-piano motif, warm analog pads, a gentle pulsing synth bass, delicate glassy plucks, " +
  "very light textural percussion (soft ticks and shakers, no claps, no big kick drums). Around 100 BPM, major key, calm " +
  "and quietly optimistic. No EDM drops, no risers, no dubstep, no build-ups, no trailer hits: constant, restrained " +
  "energy with subtle layers added over time, sitting well under a voiceover. Ends on a soft resolving chord that rings out.";

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
