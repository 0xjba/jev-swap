#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Command, InvalidArgumentError } from "commander";
import { applyThreshold, convert } from "./convert.js";
import { renderReport } from "./report.js";
import { scan } from "./scan.js";
import { shadow } from "./shadow.js";
import { startProxy } from "./proxy/server.js";
import { addRepos, buildDashboard, discover, scanQueue } from "./oss/pipeline.js";
import { fetchPrices, fetchSpeed, loadPrices, lookupPrice, savePrices } from "./oss/prices.js";
import type { Candidate, SampleRow } from "./types.js";

const num = (v: string) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new InvalidArgumentError("Not a number.");
  return n;
};

function loadCandidates(out: string): Candidate[] {
  const p = path.join(out, "candidates.json");
  if (!fs.existsSync(p)) throw new Error(`${p} not found. Run \`jev-swap scan\` first.`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const program = new Command()
  .name("jev-swap")
  .version(pkg.version)
  .description("Find LLM calls that are really decisions, convert them to TypeSafe Jev, and shadow-test on recorded data.");

program
  .command("scan")
  .argument("[dir]", "project to scan (TS/JS and Python)", ".")
  .option("-o, --out <dir>", "output directory", "jev-swap-out")
  .action((dir: string, opts: { out: string }) => {
    const candidates = scan(dir);
    fs.mkdirSync(opts.out, { recursive: true });
    fs.writeFileSync(path.join(opts.out, "candidates.json"), JSON.stringify(candidates, null, 2));
    if (!candidates.length) return console.log("No convertible LLM decision calls found.");
    console.log(`Found ${candidates.length} candidate(s):\n`);
    for (const c of candidates) {
      const fields = c.fields.map((f) => `${f.name}:${f.kind}`).join(", ");
      console.log(`  ${c.id}  ${c.file}:${c.line}  [${c.provider} ${c.api}] ${fields}${c.signal === "prompt-heuristic" ? "  (prompt heuristic, verify)" : ""}${c.droppedFields.length ? `  drops: ${c.droppedFields.join(", ")}` : ""}`);
    }
    console.log(`\nWrote ${path.join(opts.out, "candidates.json")}`);
  });

program
  .command("convert")
  .option("-o, --out <dir>", "output directory", "jev-swap-out")
  .action((opts: { out: string }) => {
    const files = convert(loadCandidates(opts.out), opts.out);
    files.forEach((f) => console.log(`  wrote ${f}`));
    console.log(`  wrote ${path.join(opts.out, "samples.template.jsonl")}`);
  });

program
  .command("shadow")
  .argument("<samples>", "JSONL of recorded calls: {candidate, state, llm, llm_usage?}")
  .option("-o, --out <dir>", "output directory", "jev-swap-out")
  .option("--mock", "use a simulated Jev (no API key needed)", false)
  .option("--mock-agreement <n>", "mock agreement rate with LLM labels", num, 0.9)
  .option("--target <n>", "agreement needed for the recommended threshold", num, 0.95)
  .option("--concurrency <n>", "parallel requests", num, 4)
  .option("--jev-price-in <n>", "Jev USD per 1M input tokens", num, 0.042)
  .option("--llm-price-in <n>", "your LLM's USD per 1M input tokens", num)
  .option("--llm-price-out <n>", "your LLM's USD per 1M output tokens", num)
  .option("--monthly-calls <n>", "project monthly cost at this volume", num)
  .action(async (samplesPath: string, opts: any) => {
    if (!opts.mock && !process.env.TYPESAFE_API_KEY) {
      console.error("TYPESAFE_API_KEY is not set. Set it, or pass --mock.");
      process.exit(1);
    }
    const candidates = loadCandidates(opts.out);
    const rows: SampleRow[] = fs.readFileSync(samplesPath, "utf8").split("\n").filter((l) => l.trim()).map((l, i) => {
      try { return JSON.parse(l); } catch { throw new Error(`${samplesPath}:${i + 1} is not valid JSON`); }
    });
    const o = {
      mock: opts.mock, mockAgreement: opts.mockAgreement, target: opts.target, concurrency: opts.concurrency,
      jevPriceIn: opts.jevPriceIn, llmPriceIn: opts.llmPriceIn, llmPriceOut: opts.llmPriceOut,
    };
    const results = await shadow(candidates, rows, o);
    fs.writeFileSync(path.join(opts.out, "results.json"), JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(opts.out, "REPORT.md"), renderReport(results, o, opts.monthlyCalls));

    // Real runs only: write the recommended threshold into the generated modules.
    if (!opts.mock) {
      for (const r of results) {
        if (r.recommended) applyThreshold(opts.out, r.id, r.recommended.threshold);
      }
    }
    for (const r of results) {
      console.log(`  ${r.id}: ${r.samples} samples, exact agreement ${(r.exactAgreement * 100).toFixed(1)}%, recommended threshold ${r.recommended?.threshold ?? "none"}`);
    }
    console.log(`\nWrote ${path.join(opts.out, "REPORT.md")}${opts.mock ? "  (SIMULATED)" : ""}`);
  });

program
  .command("proxy")
  .description("Forward your OpenAI/Anthropic traffic unchanged while mirroring decision calls to Jev, with a live dashboard.")
  .option("-o, --out <dir>", "output directory (needs candidates.json)", "jev-swap-out")
  .option("--port <n>", "port", num, 8787)
  .option("--host <host>", "interface to bind", "127.0.0.1")
  .option("--mock", "use a simulated Jev (no API key needed)", false)
  .option("--mock-agreement <n>", "mock agreement rate with LLM labels", num, 0.9)
  .option("--target <n>", "agreement needed for a threshold to be recommended", num, 0.95)
  .option("--min-samples <n>", "mirrored calls needed before a candidate can be marked ready", num, 50)
  .option("--jev-price-in <n>", "Jev USD per 1M input tokens", num, 0.042)
  .option("--llm-price-in <n>", "your LLM's USD per 1M input tokens", num)
  .option("--llm-price-out <n>", "your LLM's USD per 1M output tokens", num)
  .option("--openai-upstream <url>", "OpenAI API origin", "https://api.openai.com")
  .option("--anthropic-upstream <url>", "Anthropic API origin", "https://api.anthropic.com")
  .action((opts: any) => {
    if (!opts.mock && !process.env.TYPESAFE_API_KEY) {
      console.error("TYPESAFE_API_KEY is not set. Set it, or pass --mock.");
      process.exit(1);
    }
    const candidates = loadCandidates(opts.out);
    if (!candidates.length) {
      console.error("candidates.json has no candidates. Nothing to mirror.");
      process.exit(1);
    }
    startProxy(candidates, {
      host: opts.host, port: opts.port, out: opts.out, mock: opts.mock, mockAgreement: opts.mockAgreement,
      target: opts.target, minSamples: opts.minSamples, jevPriceIn: opts.jevPriceIn,
      llmPriceIn: opts.llmPriceIn, llmPriceOut: opts.llmPriceOut,
      openaiUpstream: opts.openaiUpstream, anthropicUpstream: opts.anthropicUpstream,
    });
  });

// ---------- public OSS savings dashboard ----------

const oss = program
  .command("oss")
  .description("Find public repos with LLM decision calls and estimate the % cost reduction of moving them to Jev.");

const requireGithubToken = () => {
  const t = process.env.GITHUB_TOKEN;
  if (!t) {
    console.error("GITHUB_TOKEN is not set. GitHub code search requires authentication.");
    process.exit(1);
  }
  return t;
};

oss
  .command("discover")
  .description("Queue well-known repos. Default: repository search by AI topic, sorted by stars (token optional). --code: code search for SDK patterns (needs GITHUB_TOKEN).")
  .option("-o, --out <dir>", "state directory", "oss-out")
  .option("--popular", "most-starred Python/TS/JS repos of any topic, in star bands (company products)", false)
  .option("--code", "use code search for SDK patterns instead of repository search", false)
  .option("-q, --query <q...>", "search queries (default: built-in list)")
  .option("--pages <n>", "result pages per query this run (100 results each; resumes where the last run stopped, up to page 10)", num, 3)
  .option("--min-stars <n>", "only queue repos with at least this many stars", num, 1000)
  .option("--orgs-only", "only queue organization-owned repos", false)
  .action(async (opts: { out: string; popular: boolean; code: boolean; query?: string[]; pages: number; minStars: number; orgsOnly: boolean }) => {
    const token = opts.code ? requireGithubToken() : process.env.GITHUB_TOKEN;
    if (!token) console.log("GITHUB_TOKEN not set: repository search runs unauthenticated (10 requests/min).");
    await discover(opts.out, {
      mode: opts.code ? "code" : opts.popular ? "popular" : "repos", token, queries: opts.query, maxPages: opts.pages,
      minStars: opts.minStars, orgsOnly: opts.orgsOnly,
    });
  });

oss
  .command("prices")
  .description("Refresh data/prices.json from OpenRouter: list prices for every model, and p50 latency/throughput for the models the dashboard uses.")
  .option("-o, --out <dir>", "state directory (to find the models scanned repos use)", "oss-out")
  .action(async (opts: { out: string }) => {
    let previous;
    try { previous = loadPrices(); } catch { /* first run */ }
    const t = await fetchPrices(previous);
    // Speed stats live on each model's page, so fetch only the models the dashboard can use.
    const ref = JSON.parse(fs.readFileSync(new URL("../data/reference-models.json", import.meta.url), "utf8"));
    const wanted = new Set<string>(Object.values<string[]>(ref.families).flat());
    const scans = path.join(opts.out, "scans");
    if (fs.existsSync(scans)) {
      for (const f of fs.readdirSync(scans).filter((x) => x.endsWith(".json"))) {
        for (const c of JSON.parse(fs.readFileSync(path.join(scans, f), "utf8")).candidates ?? []) {
          const k = c.model?.id ? lookupPrice(t, c.model.id)?.key : undefined;
          if (k) wanted.add(k);
        }
      }
    }
    let got = 0;
    for (const k of wanted) {
      if (!t.models[k]) continue;
      const sp = await fetchSpeed(k).catch(() => undefined);
      if (sp) { t.models[k].speed = sp; got++; }
      await new Promise((r) => setTimeout(r, 400)); // be polite to openrouter.ai
    }
    savePrices(t);
    console.log(`Saved ${Object.keys(t.models).length} model prices from OpenRouter; speed stats for ${got} of ${wanted.size} models in use; Jev $${t.jev.in} in / $${t.jev.out} out per 1M (checked ${t.jev.checked}).`);
  });

oss
  .command("add")
  .description("Queue repos by name, e.g. a maintainer claiming their project.")
  .argument("<repos...>", "owner/repo or https://github.com/owner/repo")
  .option("-o, --out <dir>", "state directory", "oss-out")
  .action((repos: string[], opts: { out: string }) => addRepos(opts.out, repos));

oss
  .command("scan")
  .description("Shallow-clone queued repos, scan them, count static tokens, then delete the clone.")
  .option("-o, --out <dir>", "state directory", "oss-out")
  .option("--limit <n>", "max repos this run", num, 50)
  .option("--concurrency <n>", "repos in parallel", num, 2)
  .option("--rescan", "rescan repos that already have a result", false)
  .option("--max-size-mb <n>", "skip repos larger than this (GitHub-reported size, full history)", num, 2000)
  .option("--timeout <s>", "per-repo clone and scan timeout in seconds", num, 300)
  .option("--require-license", "skip repos with no detected license (by default they're scanned; only file:line links and schema shapes are stored)", false)
  .option("--min-stars <n>", "skip repos with fewer stars", num, 1000)
  .option("--max-stars <n>", "only repos with fewer stars than this (sample less-known repos for the metrics)", num)
  .option("--orgs-only", "skip repos not owned by an organization", false)
  .option("--no-sdk-check", "clone even when production manifests list no LLM SDK")
  .option("--recheck-no-sdk", "re-scan only repos earlier skipped for having no LLM SDK (finds raw HTTP calls)", false)
  .action(async (opts: any) => {
    await scanQueue(opts.out, {
      limit: opts.limit, concurrency: opts.concurrency, rescan: opts.rescan, maxSizeMb: opts.maxSizeMb,
      timeoutSec: opts.timeout, includeUnlicensed: !opts.requireLicense, minStars: opts.minStars, maxStars: opts.maxStars, orgsOnly: opts.orgsOnly,
      skipSdkCheck: !opts.sdkCheck, recheckNoSdk: opts.recheckNoSdk, token: process.env.GITHUB_TOKEN,
    });
  });

oss
  .command("build")
  .description("Price every scanned candidate and write dashboard.json (percentages only, no dollars).")
  .option("-o, --out <dir>", "state directory", "oss-out")
  .option("--state-min <n>", "low end of assumed user-input tokens per call", num, 50)
  .option("--state-max <n>", "high end of assumed user-input tokens per call", num, 2000)
  .option("--featured-min-stars <n>", "repos shown individually; all repos count toward the metrics", num, 1000)
  .action((opts: { out: string; stateMin: number; stateMax: number; featuredMinStars: number }) => {
    const d = buildDashboard(opts.out, { stateMin: opts.stateMin, stateMax: opts.stateMax, featuredMinStars: opts.featuredMinStars });
    fs.writeFileSync(path.join(opts.out, "dashboard.json"), JSON.stringify(d, null, 2));
    const t = d.totals;
    const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
    console.log(`Repos: ${t.reposScanned} scanned, ${t.reposWithCandidates} with candidates, ${t.reposSkipped} skipped, ${t.reposErrored} errored`);
    console.log(`Candidates: ${t.candidates} (${t.byStatus.estimated} estimated, ${t.byStatus["partial-swap"]} partial swap, ${t.byStatus["model-unknown"]} model unknown, ${t.byStatus["price-unknown"]} no sourced price)`);
    const x = t.excludedNonProduction;
    console.log(`Excluded as non-production: ${x.example} in examples/demos/docs, ${x.eval} in evals/benchmarks/scripts, ${x.sampleRepo} in sample repos`);
    console.log(`Found as raw HTTP calls (no SDK): ${t.candidatesViaHttp}`);
    console.log(`Speed (estimated calls): median ${t.medianSpeedup === null ? "n/a" : t.medianSpeedup.toFixed(1) + "x"} faster on Jev (Jev at 285 ms, the midpoint of its reported 70-500 ms)`);
    console.log(`Runtime-model calls with a likely model where Jev saves cost or time: ${t.likely.calls} (median ${pct(t.likely.medianConservativeReductionLow)}, least favourable likely model per call)`);
    const f = t.featured;
    console.log(`Featured (>= ${f.minStars} stars): ${f.repos} repos, ${f.candidates} candidates, ${f.candidatesEstimated} estimated, median ${pct(f.medianReductionLow)}`);
    console.log(`Median all-Jev reduction (low end of range, estimated): ${pct(t.medianReductionLow)}`);
    console.log(`Wrote ${path.join(opts.out, "dashboard.json")}`);
  });

program.parseAsync().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
