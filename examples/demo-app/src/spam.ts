import OpenAI from "openai";

const client = new OpenAI();

export async function isSpam(email: string) {
  const res = await client.chat.completions.create({
    model: "gpt-5.6-terra",
    messages: [
      { role: "system", content: "Is this email spam? Answer only yes or no." },
      { role: "user", content: email },
    ],
  });
  return res.choices[0].message.content?.trim().toLowerCase() === "yes";
}
