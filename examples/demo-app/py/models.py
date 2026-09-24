from enum import Enum
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field

Team = Literal["billing", "technical", "sales"]


class RefundDecision(str, Enum):
    APPROVE = "approve"
    DENY = "deny"
    ESCALATE = "escalate"


class TicketTriage(BaseModel):
    team: Team = Field(description="Which team should handle this ticket?")
    urgent: bool = Field(description="Does the customer convey urgency?")
    priority: int = Field(ge=1, le=5, description="How high is the priority, 1 (low) to 5 (critical)?")
    summary: str


class RefundReview(BaseModel):
    decision: RefundDecision
    fraud_risk: Annotated[int, Field(ge=0, le=3, description="Fraud risk from 0 (none) to 3 (high)")]
    notes: Optional[str] = None
