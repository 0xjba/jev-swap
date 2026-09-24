// Negative example: free-text output, should NOT be flagged.
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI();

export async function summarize(doc: string) {
  const res = await openai.chat.completions.parse({
    model: "gpt-5.6-terra",
    messages: [{ role: "user", content: `Summarize:\n${doc}` }],
    response_format: zodResponseFormat(z.object({ summary: z.string(), title: z.string() }), "summary"),
  });
  return res.choices[0].message.parsed;
}
