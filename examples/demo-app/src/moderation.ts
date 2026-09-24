import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function moderate(comment: string) {
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 200,
    system: "You moderate user comments on a community forum.",
    tools: [
      {
        name: "verdict",
        description: "Record the moderation verdict",
        input_schema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["allow", "review", "block"], description: "What should happen to this comment?" },
            contains_pii: { type: "boolean", description: "Does the comment contain personal information like a phone number or address?" },
          },
          required: ["action", "contains_pii"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "verdict" },
    messages: [{ role: "user", content: `Comment:\n${comment}` }],
  });
  return msg.content;
}
