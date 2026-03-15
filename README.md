# BuildOS

The operating system for AI-powered software development. Combines always-active governance (standards, specialist agents, quality hooks, project memory) with sprint-based execution (plan, execute, verify, learn) and intelligent context engineering — all through a single `/build:*` command interface for Claude Code.

## Quick Start

```bash
# Clone into your project
git clone https://github.com/kohrohit/buildos.git
cd buildos

# Verify CLI works
node build/bin/build-tools.cjs

# Set up as Claude Code plugin
cp -r build/commands/*.md .claude/commands/
# Configure hooks in .claude/settings.json (see build/hooks.json)

# Start building
# /build-init → /build-plan → /build-sprint → /build-execute → /build-verify → /build-review → /build-learn
```

See [build/README.md](build/README.md) for full documentation.
