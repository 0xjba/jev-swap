// Keyless demo of `jev-swap proxy`.
// Starts a fake OpenAI/Anthropic upstream, runs the proxy in --mock mode against it,
// and sends a steady stream of requests shaped like the real SDKs send them.
// Everything here is simulated; it exists to show the pipeline and dashboard.
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";

const FAKE_PORT = 9901;
const PROXY_PORT = Number(process.env.PORT ?? 8787);
const PROXY = `http://127.0.0.1:${PROXY_PORT}`;
const cli = (args, opts = {}) => ["npx", ["tsx", "src/cli.ts", ...args], opts];

// ---------- fake upstream ----------
const has = (t, re) => re.test(t.toLowerCase());
function decideTicket(t) {
  const team = has(t, /charg|refund|invoice|billing|vat/) ? "billing" : has(t, /quote|pricing|seats|discount|plan/) ? "sales" : "technical";
  const urgent = has(t, /down|urgent|asap|whole team|outage|every request/);
  const priority = urgent ? 4 + (t.length % 2) : has(t, /error|fail|crash|wrong/) ? 3 : 1 + (t.length % 2);
  return { team, urgent, priority };
}
function llmAnswer(path, body) {
  const user = JSON.stringify(body.messages ?? body.input ?? "");
  const keys = JSON.stringify(body);
  if (path.endsWith("/messages")) {
    const pii = has(user, /\d{3}-\d{4}|street|st,|address|call me/);
    const action = has(user, /garbage|idiot|spam|buy followers/) ? "block" : pii ? "review" : "allow";
    return { anthropic: { type: "tool_use", id: "toolu_demo", name: "verdict", input: { action, contains_pii: pii } } };
  }
  if (path.endsWith("/responses")) {
    return { responsesText: has(user, /won|prize|cheap meds|click now|claim/) ? "yes" : "no" };
  }
  if (keys.includes('"fraud_risk"')) {
    const escalate = has(user, /third|again|empty/);
    const deny = has(user, /changed my mind/);
    return { toolArgs: { decision: escalate ? "escalate" : deny ? "deny" : "approve", fraud_risk: escalate ? 3 : deny ? 0 : 1, notes: "ok" } };
  }
  const d = decideTicket(user);
  if (keys.includes('"team"')) return { json: { ...d, summary: "short summary" } };
  return { json: { category: d.team, urgent: d.urgent, priority: d.priority, reason: "because" } };
}
const fake = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    const a = llmAnswer(req.url, body);
    const inTok = Math.ceil(raw.length / 4) + 120;
    let out;
    if (a.anthropic) out = { id: "msg_demo", type: "message", role: "assistant", content: [a.anthropic], usage: { input_tokens: inTok, output_tokens: 40 } };
    else if (a.responsesText) out = { id: "resp_demo", object: "response", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: a.responsesText }] }], usage: { input_tokens: inTok, output_tokens: 2 } };
    else if (a.toolArgs) out = { id: "chatcmpl_demo", object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "RefundReview", arguments: JSON.stringify(a.toolArgs) } }] } }], usage: { prompt_tokens: inTok, completion_tokens: 30 } };
    else out = { id: "chatcmpl_demo", object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(a.json) } }], usage: { prompt_tokens: inTok, completion_tokens: 45 } };
    // Simulated LLM latency.
    setTimeout(() => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(out));
    }, 350 + Math.random() * 1100);
  });
});

// ---------- traffic ----------
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const tickets = ["I was charged twice this month", "The API returns 500 on every request", "Can I get a quote for 50 seats?", "My invoice has the wrong VAT number", "Login page is down for our whole team", "Do you offer annual discounts?", "Refund still not processed after 2 weeks", "Webhook deliveries are delayed by hours", "App crashes when I upload a PDF"];
const comments = ["Great post, thanks!", "Call me at 555-0199 for a deal", "This is garbage and so are you", "Interesting take, I disagree though", "My address is 12 Elm St, come by", "Buy followers cheap at spam.example"];
const emails = ["You won a free cruise! Click now", "Team sync moved to 3pm", "Cheap meds, no prescription", "Your invoice for September", "Claim your prize before midnight", "Can you review my PR?"];
const refunds = ["Item never arrived", "Changed my mind", "Charged after cancelling", "Box was empty, third claim this month"];

const schema = (props, required) => ({ type: "object", properties: props, required, additionalProperties: false });
const requests = [
  () => ["/openai/v1/chat/completions", { model: "gpt-5.6-terra", messages: [{ role: "system", content: "You triage support tickets." }, { role: "user", content: `${pick(tickets)} (#${Math.floor(Math.random() * 1e4)})` }],
    response_format: { type: "json_schema", json_schema: { name: "ticket", strict: true, schema: schema({ category: { type: "string", enum: ["billing", "technical", "sales"] }, urgent: { type: "boolean" }, priority: { type: "integer", minimum: 1, maximum: 5 }, reason: { type: "string" } }, ["category", "urgent", "priority", "reason"]) } } }],
  () => ["/openai/v1/chat/completions", { model: "gpt-5.6-terra", messages: [{ role: "system", content: "You triage support tickets." }, { role: "user", content: `${pick(tickets)} [py ${Math.floor(Math.random() * 1e4)}]` }],
    response_format: { type: "json_schema", json_schema: { name: "TicketTriage", strict: true, schema: schema({ team: { type: "string", enum: ["billing", "technical", "sales"] }, urgent: { type: "boolean" }, priority: { type: "integer", minimum: 1, maximum: 5 }, summary: { type: "string" } }, ["team", "urgent", "priority", "summary"]) } } }],
  () => ["/anthropic/v1/messages", { model: "claude-haiku-4-5", max_tokens: 200, system: "You moderate user comments on a community forum.",
    tools: [{ name: "verdict", description: "Record the moderation verdict", input_schema: schema({ action: { type: "string", enum: ["allow", "review", "block"] }, contains_pii: { type: "boolean" } }, ["action", "contains_pii"]) }],
    tool_choice: { type: "tool", name: "verdict" }, messages: [{ role: "user", content: `Comment:\n${pick(comments)} [${Math.floor(Math.random() * 1e4)}]` }] }],
  () => ["/openai/v1/responses", { model: "gpt-5.6-terra", instructions: "Is this email spam? Answer only yes or no.", input: `${pick(emails)} #${Math.floor(Math.random() * 1e4)}` }],
  () => ["/openai/v1/chat/completions", { model: "gpt-5.6-terra", messages: [{ role: "user", content: `${pick(refunds)} (order ${Math.floor(Math.random() * 1e5)})` }],
    tools: [{ type: "function", function: { name: "RefundReview", parameters: schema({ decision: { type: "string", enum: ["approve", "deny", "escalate"] }, fraud_risk: { type: "integer", minimum: 0, maximum: 3 }, notes: { type: "string" } }, ["decision", "fraud_risk"]) } }],
    tool_choice: { type: "function", function: { name: "RefundReview" } } }],
];

async function send() {
  const [path, body] = pick(requests)();
  try {
    await fetch(PROXY + path, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer demo" }, body: JSON.stringify(body) });
  } catch {
    /* proxy not up yet */
  }
}

// ---------- run ----------
for (const args of [["scan", "examples/demo-app"], ["convert"]]) {
  const [cmd, a] = cli(args);
  const r = spawnSync(cmd, a, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
fake.listen(FAKE_PORT, "127.0.0.1");
const [cmd, a] = cli(["proxy", "--mock", "--port", String(PROXY_PORT), "--min-samples", "30",
  "--openai-upstream", `http://127.0.0.1:${FAKE_PORT}`, "--anthropic-upstream", `http://127.0.0.1:${FAKE_PORT}`,
  "--llm-price-in", "1", "--llm-price-out", "5"]);
const proxy = spawn(cmd, a, { stdio: "inherit" });
const timer = setInterval(send, 250);
const stop = () => { clearInterval(timer); proxy.kill(); fake.close(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
if (process.env.DEMO_SECONDS) setTimeout(stop, Number(process.env.DEMO_SECONDS) * 1000);
