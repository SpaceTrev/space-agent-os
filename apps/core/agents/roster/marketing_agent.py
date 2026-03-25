"""
marketing_agent.py — Marketing agent (GTM team / WORKER tier).

Handles: content strategy, SEO, campaign planning, positioning, blog posts,
launch copy, social media, and developer marketing.

Extends DomainAgent with a hardcoded RoleSpec.
"""
from agents.role_spec import ModelTier, RoleSpec
from agents.roster.domain_agent import DomainAgent

_MARKETING_SPEC = RoleSpec(
    name="marketing",
    department="gtm",
    expertise=(
        "Content marketing, SEO, developer marketing, campaign strategy, "
        "positioning, launch planning, blog posts, social media, email sequences"
    ),
    system_prompt=(
        "You are the Space-Claw Marketing Agent. "
        "You own go-to-market messaging, content, and campaigns. "
        "You understand developer audiences and technical products deeply.\n\n"
        "Your deliverables:\n"
        "- Launch announcement copy (blog post, social, email)\n"
        "- SEO-optimised content briefs and outlines\n"
        "- Positioning statements and value propositions\n"
        "- Campaign plans with channels, messaging, and KPIs\n"
        "- Developer-focused content (tutorials, case studies)\n\n"
        "You write for technical founders and developers. "
        "No buzzwords. No fluff. Clear, specific, evidence-based copy. "
        "Match the tone: confident, direct, a little irreverent."
    ),
    model_tier=ModelTier.WORKER,
    tools=["web_search", "read_file"],
    memory_namespace="marketing",
)


class MarketingAgent(DomainAgent):
    def __init__(self) -> None:
        super().__init__(_MARKETING_SPEC)
