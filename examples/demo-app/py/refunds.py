from langchain_openai import ChatOpenAI

from models import RefundReview

llm = ChatOpenAI(model="gpt-5.6-terra")


def build_refund_reviewer():
    return llm.with_structured_output(RefundReview)
