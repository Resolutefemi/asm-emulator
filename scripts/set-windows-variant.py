#!/usr/bin/env python3
"""
Patches src-tauri/tauri.conf.json to set the Windows webviewInstallMode
for the current build variant.

Usage:
  python3 scripts/set-windows-variant.py lite   # downloadBootstrapper (~9 MB)
  python3 scripts/set-windows-variant.py full   # offlineInstaller (~200 MB)

Used by .github/workflows/release.yml on Windows jobs. We can't embed
the Python in a YAML heredoc because GitHub Actions uses PowerShell as
the default shell on Windows runners, and PowerShell doesn't understand
bash heredoc syntax (<<'PY' ... PY).

Why a separate script: same reason as scripts/patch-android-signing.py —
a standalone .py file is testable, doesn't get mangled by YAML
indentation rules, and works on both bash and PowerShell runners.
"""

import json
import sys
from pathlib import Path

CONF_PATH = Path("src-tauri/tauri.conf.json")

VARIANTS = {
    "lite": {
        "type": "downloadBootstrapper",
        "silent": True,
    },
    "full": {
        "type": "offlineInstaller",
        "silent": True,
    },
}


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in VARIANTS:
        print("Usage: set-windows-variant.py [lite|full]", file=sys.stderr)
        sys.exit(1)

    variant = sys.argv[1]
    if not CONF_PATH.exists():
        print(f"ERROR: {CONF_PATH} not found", file=sys.stderr)
        sys.exit(1)

    conf = json.loads(CONF_PATH.read_text())
    conf.setdefault("bundle", {}).setdefault("windows", {})["webviewInstallMode"] = VARIANTS[variant]
    CONF_PATH.write_text(json.dumps(conf, indent=2) + "\n")
    print(f"Configured Windows {variant.upper()} variant")
    print(f"  webviewInstallMode = {VARIANTS[variant]['type']}")


if __name__ == "__main__":
    main()
