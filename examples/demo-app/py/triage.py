from openai import OpenAI

from models import TicketTriage

client = OpenAI()
SYSTEM = "You triage support tickets."


def triage_ticket(ticket: str) -> TicketTriage:
    completion = client.chat.completions.parse(
        model="gpt-5.6-terra",
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": ticket},
        ],
        response_format=TicketTriage,
    )
    return completion.choices[0].message.parsed
