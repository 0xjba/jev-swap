import path from "node:path";
import { rawFile, repoTree, type Fetch } from "./github.js";

/**
 * Cheap pre-clone check: does the repo's production code depend on an LLM SDK the scanner understands?
 * Reads dependency manifests only (outside examples, tests, evals). Returns `uses: null` when it can't tell.
 */

const MANIFEST_RE = /(^|\/)(package\.json|requirements[^/]*\.txt|pyproject\.toml|setup\.py|setup\.cfg|Pipfile)$/;
const MAX_MANIFESTS = 80;

const JS_SDK = (name: string) =>
  ["openai", "@anthropic-ai/sdk", "ai", "langchain", "groq-sdk", "together-ai", "@azure/openai"].includes(name) ||
  name.startsWith("@ai-sdk/") || name.startsWith("@langchain/");
const PY_SDK_RE = /(^|["'\s,[(])(openai|anthropic|langchain(?:-[a-z]+)?|groq|together)\s*(?=[<>=~!;[\]"',\s)]|$)/gim;

function sdksIn(file: string, text: string): string[] {
  if (file.endsWith("package.json")) {
    try {
      const pkg = JSON.parse(text);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies, ...pkg.optionalDependencies };
      return Object.keys(deps).filter(JS_SDK);
    } catch {
      return [];
    }
  }
  return [...text.matchAll(PY_SDK_RE)].map((m) => m[2].toLowerCase());
}

export async function llmSdkCheck(
  repo: string, ref: string, token: string | undefined, isNonProduction: (p: string) => boolean, f: Fetch = fetch,
): Promise<{ uses: boolean | null; sdks: string[] }> {
  const tree = await repoTree(repo, ref, token, f);
  if (tree.truncated) return { uses: null, sdks: [] };
  const manifests = tree.paths
    .filter((p) => MANIFEST_RE.test(p) && !p.split("/").includes("node_modules") && !isNonProduction(p))
    .sort((a, b) => a.split("/").length - b.split("/").length);
  if (manifests.length > MAX_MANIFESTS) return { uses: null, sdks: [] };
  const found = new Set<string>();
  await Promise.all(manifests.map(async (m) => {
    const text = await rawFile(repo, tree.sha, m, f);
    if (text) for (const s of sdksIn(path.posix.basename(m), text)) found.add(s);
  }));
  return { uses: found.size > 0, sdks: [...found].sort() };
}
