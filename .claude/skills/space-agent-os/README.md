# space-agent-os Skills

Project-specific Claude skills that enforce proper workflow discipline.

| Skill | Purpose |
|-------|---------|
| `task-execute` | Full end-to-end task cycle: read ticket → branch → build → verify → PR → merge → confirm → close ticket |
| `deploy-verify` | HTTP verification after Railway deploys — never report success without curl evidence |
| `pr-flow` | PR creation, conflict check, merge, confirm on main, close Linear ticket |

## Usage

These skills are automatically available to any Claude agent working in this repo.
Invoke them by name or they will trigger contextually when the task matches.
