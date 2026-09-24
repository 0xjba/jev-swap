import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI();

const TicketSchema = z.object({
  category: z.enum(["billing", "technical", "sales"]).describe("Which team should handle this ticket?"),
  urgent: z.boolean().describe("Does the customer convey urgency?"),
  priority: z.number().int().min(1).max(5).describe("How high is the priority, 1 (low) to 5 (critical)?"),
  reason: z.string(),
});

export async function classifyTicket(ticket: string) {
  const res = await openai.chat.completions.parse({
    model: "gpt-5.6-terra",
    messages: [
      { role: "system", content: "You triage support tickets." },
      { role: "user", content: ticket },
    ],
    response_format: zodResponseFormat(TicketSchema, "ticket"),
  });
  return res.choices[0].message.parsed;
}
