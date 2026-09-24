import type { CandidateResult, ShadowOptions } from "./shadow.js";

const p = (x: number | null | undefined) => (x === null || x === undefined || Number.isNaN(x) ? "–" : `${(x * 100).toFixed(1)}%`);
const usd = (x: number | null) => (x === null ? "–" : `$${x >= 1 ? x.toFixed(2) : x < 0.01 ? x.toPrecision(3) : x.toFixed(4)}`);

export function renderReport(results: CandidateResult[], o: ShadowOptions, monthlyCalls?: number): string {
  const L: string[] = [];
  L.push("# jev-swap shadow report", "");
  if (o.mock) {
    L.push(
      `> **SIMULATED RUN.** Jev responses came from a mock (agreement rate ${p(o.mockAgreement)}). These numbers demonstrate the pipeline only; they say nothing about Jev's real accuracy. Latency is not reported. Re-run without \`--mock\` and with \`TYPESAFE_API_KEY\` set for real results.`,
      "",
    );
  }
  L.push(`Target agreement for the recommended threshold: **${p(o.target)}**. Jev input price: $${o.jevPriceIn}/1M tokens, output free.`, "");

  L.push("## Summary", "", "| Candidate | Samples | Exact agreement | Rec. threshold | Jev handles | Agreement there | Cost/call Jev vs LLM |", "|---|---|---|---|---|---|---|");
  for (const r of results) {
    L.push(`| \`${r.id}\` (${r.file}:${r.line}) | ${r.samples}${r.errors ? ` (${r.errors} err)` : ""} | ${p(r.exactAgreement)} | ${r.recommended ? r.recommended.threshold : "none meets target"} | ${p(r.recommended?.coverage)} | ${p(r.recommended?.agreement)} | ${usd(r.jevCostPerCall)} vs ${usd(r.llmCostPerCall)} |`);
  }
  L.push("");

  for (const r of results) {
    L.push(`## \`${r.id}\``, "", `Source: \`${r.file}:${r.line}\``, "");
    L.push("**Per-field agreement with the recorded LLM output**", "");
    for (const [f, a] of Object.entries(r.fieldAgreement)) L.push(`- \`${f}\`: ${p(a)}`);
    L.push("", "**Confidence gate:** share of calls Jev would handle, and agreement on those", "", "| Threshold | Jev handles | Agreement |", "|---|---|---|");
    for (const c of r.curve) L.push(`| ${c.threshold} | ${p(c.coverage)} | ${p(c.agreement)} |`);
    L.push("");
    if (r.latencyMs) L.push(`**Latency:** p50 ${r.latencyMs.p50.toFixed(0)} ms, p95 ${r.latencyMs.p95.toFixed(0)} ms (includes network)`, "");
    L.push(`**Cost per call:** Jev ${usd(r.jevCostPerCall)} | LLM ${usd(r.llmCostPerCall)} | hybrid at recommended threshold ${usd(r.hybridCostPerCall)}`);
    if (r.llmCostPerCall === null) L.push("", "_LLM cost needs `llm_usage` in every sample plus `--llm-price-in` and `--llm-price-out`._");
    if (monthlyCalls && r.llmCostPerCall !== null && r.hybridCostPerCall !== null) {
      const save = (r.llmCostPerCall - r.hybridCostPerCall) * monthlyCalls;
      L.push("", `**At ${monthlyCalls.toLocaleString()} calls/month:** LLM ${usd(r.llmCostPerCall * monthlyCalls)} → hybrid ${usd(r.hybridCostPerCall * monthlyCalls)} (saves ${usd(save)}/month)`);
    }
    L.push("");
  }
  return L.join("\n");
}
