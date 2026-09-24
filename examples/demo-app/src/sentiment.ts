import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";

export const reviewSentiment = async (review: string) => {
  const { output } = await generateText({
    model: openai("gpt-5.6-terra"),
    output: Output.choice({ options: ["positive", "neutral", "negative"] }),
    prompt: `What is the sentiment of this product review?\n\n${review}`,
  });
  return output;
};
