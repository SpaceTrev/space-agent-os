"""
domain_agent.py — Dynamic domain-specialist agent.

DomainAgent is a configurable BaseAgent that becomes any specialist role
by injecting a RoleSpec at instantiation time.  This is the base class for
MarketingAgent, SalesAgent, and any dynamically-loaded role from config/roles/*.yaml.

Example: spin up a Quant on demand:
    from agents.role_spec import RoleSpec
    spec = RoleSpec.from_yaml(Path("config/roles/quant.yaml"))
    quant = DomainAgent(spec)
    result = await quant.run("Backtest a momentum strategy on BTC/USD hourly data")
"""
from __future__ import annotations

from pathlib import Path

from agents.role_spec import AgentResult, BaseAgent, RoleSpec

_ROLES_DIR = Path(__file__).parent.parent.parent / "config" / "roles"


class DomainAgent(BaseAgent):
    """
    A domain-specialist agent defined entirely by its RoleSpec.

    Pass a RoleSpec directly or load one by role name from config/roles/<name>.yaml.
    """

    def __init__(self, spec: RoleSpec) -> None:
        self.SPEC = spec  # type: ignore[misc]  — intentional instance-level override

    @classmethod
    def from_yaml(cls, path: Path) -> "DomainAgent":
        """Instantiate from a YAML role definition file."""
        return cls(RoleSpec.from_yaml(path))

    @classmethod
    def by_name(cls, name: str) -> "DomainAgent":
        """
        Load a domain agent by its role name.

        Looks for config/roles/<name>.yaml relative to apps/core/.
        """
        yaml_path = _ROLES_DIR / f"{name}.yaml"
        if not yaml_path.exists():
            raise FileNotFoundError(
                f"No role spec found for '{name}' at {yaml_path}. "
                f"Create config/roles/{name}.yaml to define this role."
            )
        return cls.from_yaml(yaml_path)

    @classmethod
    def load_all_domain_agents(cls) -> dict[str, "DomainAgent"]:
        """Load all domain agents from config/roles/*.yaml."""
        agents: dict[str, DomainAgent] = {}
        if _ROLES_DIR.exists():
            for yaml_file in sorted(_ROLES_DIR.glob("*.yaml")):
                try:
                    agent = cls.from_yaml(yaml_file)
                    agents[agent.SPEC.name] = agent
                except Exception as exc:
                    import structlog
                    structlog.get_logger().warning(
                        "domain_agent.load_error", file=str(yaml_file), error=str(exc)
                    )
        return agents
