#!/usr/bin/env python3
"""
Patches src-tauri/gen/android/app/build.gradle.kts to wire up a
release signingConfig that reads from key.properties.

Used by .github/workflows/release.yml after `tauri android init`.

Why a separate file: embedding this Python in the YAML workflow as a
heredoc is fragile because YAML's indentation rules mangle the Python
source. A standalone script is also easier to test locally.
"""

import re
import sys
from pathlib import Path

GRADLE_PATH = Path("src-tauri/gen/android/app/build.gradle.kts")


def main():
    if not GRADLE_PATH.exists():
        print(f"ERROR: {GRADLE_PATH} not found", file=sys.stderr)
        sys.exit(1)

    content = GRADLE_PATH.read_text()

    # Already patched? Skip.
    if "signingConfigs.create" in content or "signingConfigs[" in content:
        print(f"{GRADLE_PATH} already has signing config — skipping")
        return

    # Add import for java.util.Properties if missing
    if "import java.util.Properties" not in content:
        # Insert after any existing imports, otherwise at the top
        if "import " in content:
            imports = list(re.finditer(r"^import .*$", content, re.MULTILINE))
            if imports:
                last_import = imports[-1]
                insert_pos = last_import.end()
                content = (
                    content[:insert_pos]
                    + "\nimport java.util.Properties"
                    + content[insert_pos:]
                )
        else:
            content = "import java.util.Properties\n" + content

    # Build the signing block that goes BEFORE `android {`
    # and the signingConfigs entry that goes INSIDE `android {`.
    signing_setup = """val keystoreProperties = Properties().apply {
    val propsFile = rootProject.file("key.properties")
    if (propsFile.exists()) {
        load(propsFile.inputStream())
    }
}

"""

    signing_config_inside = """    signingConfigs {
        create("release") {
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
        }
    }
"""

    pattern = re.compile(r"^android \{", re.MULTILINE)
    match = pattern.search(content)
    if not match:
        print("ERROR: could not find `android {` block", file=sys.stderr)
        sys.exit(1)

    new_content = (
        content[: match.start()]
        + signing_setup
        + "android {\n"
        + signing_config_inside
        + content[match.end():]
    )

    # Wire signingConfig into the release build type
    release_block = re.search(r'getByName\("release"\)\s*\{', new_content)
    if release_block:
        insert_at = release_block.end()
        new_content = (
            new_content[:insert_at]
            + '\n            signingConfig = signingConfigs.getByName("release")'
            + new_content[insert_at:]
        )
    else:
        print("WARNING: could not find release buildType block", file=sys.stderr)

    GRADLE_PATH.write_text(new_content)
    print(f"Patched {GRADLE_PATH} with release signingConfig")


if __name__ == "__main__":
    main()
