import anthropic

client = anthropic.Anthropic()

VERDICT_SCHEMA = {
    "type": "object",
    "properties": {
        "action": {"type": "string", "enum": ["allow", "review", "block"], "description": "What should happen to this comment?"},
        "contains_pii": {"type": "boolean", "description": "Does the comment contain personal information?"},
    },
    "required": ["action", "contains_pii"],
}


def moderate(comment: str):
    return client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=200,
        system="You moderate forum comments.",
        tools=[{"name": "verdict", "description": "Record the verdict", "input_schema": VERDICT_SCHEMA}],
        tool_choice={"type": "tool", "name": "verdict"},
        messages=[{"role": "user", "content": f"Comment:\n{comment}"}],
    )
