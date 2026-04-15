"""Allow `python -m skills <skill_name> <args>` invocation."""
import sys

if __name__ == "__main__" and len(sys.argv) > 1:
    skill = sys.argv[1]
    sys.argv = sys.argv[1:]  # shift so the skill sees its own args
    if skill == "youtube_ingest":
        from skills.youtube_ingest import main
        main()
    else:
        print(f"Unknown skill: {skill!r}", file=sys.stderr)
        sys.exit(1)
