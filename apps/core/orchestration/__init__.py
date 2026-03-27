"""Space-Claw orchestration layer."""
from .agent_runner import BaseAgent
from .events import EventBus, TaskEvent
from .pipeline import PIPELINE, PipelineManager

# Legacy coordinators use cross-package relative imports that only resolve
# when the full monorepo package tree is on sys.path.  Guard so the pipeline
# layer remains importable in standalone / test contexts.
try:
    from .central_brain import CentralBrain
    from .swarm_coordinator import SwarmCoordinator
    from .team_orchestrator import TeamOrchestrator
    _legacy_available = True
except ImportError:
    _legacy_available = False

__all__ = [
    "BaseAgent",
    "EventBus",
    "PIPELINE",
    "PipelineManager",
    "TaskEvent",
    # legacy — only present when full package tree is importable
    *(["CentralBrain", "SwarmCoordinator", "TeamOrchestrator"] if _legacy_available else []),
]
