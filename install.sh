#!/bin/bash
# BuildOS Installer — adds BuildOS as a Claude Code plugin to the current project
# Usage: curl -sL https://raw.githubusercontent.com/kohrohit/buildos/main/install.sh | bash

set -e

REPO="https://github.com/kohrohit/buildos.git"
BRANCH="main"
INSTALL_DIR=".buildos-tmp"

echo "BuildOS v0.3.0 Installer"
echo "========================"
echo ""

# Check we're in a git repo
if [ ! -d ".git" ]; then
  echo "Error: Not a git repository. Run this from your project root."
  exit 1
fi

# Check node is available
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is required. Install it first."
  exit 1
fi

# Clone BuildOS
echo "Downloading BuildOS..."
git clone --depth 1 --branch "$BRANCH" "$REPO" "$INSTALL_DIR" 2>/dev/null

# Copy build directory
echo "Installing build/ directory..."
cp -r "$INSTALL_DIR/build" ./build

# Copy .claude commands and settings
echo "Installing .claude/ commands and hooks..."
mkdir -p .claude/commands
cp "$INSTALL_DIR/.claude/commands/"*.md .claude/commands/
cp "$INSTALL_DIR/.claude/settings.json" .claude/settings.json

# Cleanup
rm -rf "$INSTALL_DIR"

# Verify
echo ""
echo "Verifying installation..."
node build/bin/build-tools.cjs > /dev/null 2>&1 && echo "  ✓ build-tools.cjs works" || echo "  ✗ build-tools.cjs failed"
[ -f ".claude/settings.json" ] && echo "  ✓ hooks configured" || echo "  ✗ hooks missing"
ls .claude/commands/build-*.md > /dev/null 2>&1 && echo "  ✓ $(ls .claude/commands/build-*.md | wc -l) slash commands installed" || echo "  ✗ commands missing"

echo ""
echo "BuildOS installed successfully!"
echo ""
echo "Next steps:"
echo "  1. Open Claude Code in this project: claude"
echo "  2. Run: /build-init <project-name> \"<description>\""
echo "  3. Optionally: /build-init <name> \"<desc>\" --docs ./docs/"
echo ""
echo "Commands available:"
echo "  /build-init, /build-plan, /build-sprint, /build-execute,"
echo "  /build-verify, /build-review, /build-learn, /build-status,"
echo "  /build-scan, /build-ingest, /build-audit, /build-remember"
