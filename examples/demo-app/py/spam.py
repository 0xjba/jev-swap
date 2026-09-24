from openai import OpenAI

client = OpenAI()


def is_spam(email: str) -> bool:
    res = client.responses.create(
        model="gpt-5.6-terra",
        instructions="Is this email spam? Answer only yes or no.",
        input=email,
    )
    return res.output_text.strip().lower() == "yes"
