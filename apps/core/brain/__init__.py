"""
brain — Space Scribe context injection module.

Public API:
    BrainDoc       — parsed brain document with frontmatter
    BrainLoader    — loads and indexes all brain/ vault docs
    BrainSelector  — scores and selects relevant docs for a task
    BrainAssembler — builds a context packet within a token budget

Typical usage (in an agent):
    from brain import BrainAssembler

    assembler = BrainAssembler()
    context = assembler.build(
        department="engineering",
        task="refactor the context agent to use the brain loader",
    )
    result = await call_llm(spec, task, context)
"""

from brain.assembler import BrainAssembler
from brain.loader import BrainDoc, BrainLoader
from brain.selector import BrainSelector

__all__ = ["BrainDoc", "BrainLoader", "BrainSelector", "BrainAssembler"]
