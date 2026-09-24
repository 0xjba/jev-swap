// Generates the voiceover: one clip per narration line via OpenRouter's openai/gpt-audio (streaming pcm16),
// written to public/vo/*.wav, with timings in src/vo.json. Needs OPENROUTER_API_KEY. `--force` regenerates all.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.dirname(new URL(import.meta.url).pathname) + "/..";
const cfg = JSON.parse(fs.readFileSync(`${root}/narration.json`, "utf8"));
const force = process.argv.includes("--force");
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) throw new Error("OPENROUTER_API_KEY is not set");
const RATE = 24000; // gpt-audio pcm16: 24 kHz, mono, 16-bit

const norm = (s) => s.toLowerCase().replace(/[’']/g, "").replace(/-/g, " ").replace(/[^a-z0-9. ]/g, " ").replace(/\.(?!\d)/g, " ").replace(/\s+/g, " ").trim();

async function speak(text) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-audio",
      stream: true,
      modalities: ["text", "audio"],
      audio: { voice: cfg.voice, format: "pcm16" },
      messages: [
        { role: "system", content: `You are a voiceover artist in a recording booth. You never reply, answer or comment: you only read the script line you are given, aloud, word for word. Delivery: ${cfg.style}` },
        { role: "user", content: `Script line (read exactly this, nothing before or after):\n\n${text}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  let buf = "", transcript = "", cost = 0;
  const chunks = [];
  const dec = new TextDecoder();
  for await (const part of res.body) {
    buf += dec.decode(part, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data: {")) continue;
      const d = JSON.parse(line.slice(6));
      const a = d.choices?.[0]?.delta?.audio;
      if (a?.data) chunks.push(Buffer.from(a.data, "base64"));
      if (a?.transcript) transcript += a.transcript;
      if (d.usage?.cost) cost = d.usage.cost;
    }
  }
  return { pcm: Buffer.concat(chunks), transcript, cost };
}

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// Trim leading/trailing silence and level the voice (needs ffmpeg). Returns the new length in seconds.
export const FILTER = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000";
function polish(file) {
  const tmp = file.replace(/\.wav$/, ".tmp.wav");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-af", FILTER, "-ac", "1", tmp]);
  fs.renameSync(tmp, file);
  const s = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString();
  return Math.round(parseFloat(s) * 1000) / 1000;
}

const outPath = `${root}/src/vo.json`;
const prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : {};
const out = {};
let total = 0;
for (const sc of cfg.scenes) {
  for (const [i, line] of sc.lines.entries()) {
    const file = `vo/${sc.id}-${i}.wav`;
    const key = `${sc.id}-${i}`;
    if (!force && prev[key]?.say === line.say && fs.existsSync(`${root}/public/${file}`)) { out[key] = prev[key]; continue; }
    let got;
    for (let attempt = 1; attempt <= 4; attempt++) {
      got = await speak(line.say);
      total += got.cost;
      if (norm(got.transcript) === norm(line.say)) break;
      console.warn(`  retry ${key} (${attempt}): got "${got.transcript}"`);
      got = undefined;
    }
    if (!got) throw new Error(`${key}: the model kept changing the line`);
    fs.writeFileSync(`${root}/public/${file}`, wav(got.pcm));
    out[key] = { say: line.say, file, seconds: polish(`${root}/public/${file}`) };
    console.log(`  ${key}: ${out[key].seconds}s  "${got.transcript}"`);
    fs.writeFileSync(outPath, JSON.stringify({ ...prev, ...out }, null, 2) + "\n");
  }
}
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`done, OpenRouter cost this run: $${total.toFixed(4)}`);
