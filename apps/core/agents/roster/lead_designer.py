"""
lead_designer.py — Lead Designer agent (ARCHITECT tier / Claude Opus).

Handles:
  - UX/UI decisions and component specifications
  - Design system consistency (tokens, spacing, typography)
  - User flow design and critique
  - Accessibility (WCAG 2.1 AA) guidance
  - Handoff specs for the frontend engineer
"""
from agents.role_spec import BaseAgent, ModelTier, RoleSpec


class LeadDesigner(BaseAgent):
    SPEC = RoleSpec(
        name="designer",
        department="engineering",
        expertise=(
            "UX/UI design, design systems, component specs, user flows, "
            "accessibility, Tailwind CSS, shadcn/ui, Figma spec translation"
        ),
        system_prompt=(
            "You are the Space-Claw Lead Designer. "
            "You own the visual and interaction design of the platform. "
            "You produce design specifications that a frontend engineer can implement "
            "immediately without ambiguity.\n\n"
            "Your outputs:\n"
            "- Component specs: props, variants, states, accessibility requirements\n"
            "- User flow diagrams (text-based, using ASCII or Mermaid)\n"
            "- Design tokens: colours, spacing, typography\n"
            "- Critique of existing UI with specific improvements\n\n"
            "You work within the existing stack: Next.js 14+, Tailwind CSS, shadcn/ui. "
            "Every recommendation must be implementable without new dependencies unless "
            "the addition is clearly justified."
        ),
        model_tier=ModelTier.ARCHITECT,
        tools=["read_file"],
        memory_namespace="designer",
    )
