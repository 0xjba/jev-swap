# Negative example: free-text output, should NOT be flagged.
from openai import OpenAI
from pydantic import BaseModel

client = OpenAI()


class Summary(BaseModel):
    title: str
    body: str


def summarize(doc: str) -> Summary:
    return client.chat.completions.parse(
        model="gpt-5.6-terra",
        messages=[{"role": "user", "content": f"Summarize:\n{doc}"}],
        response_format=Summary,
    ).choices[0].message.parsed
