# Scripts are dependency-free Node ESM, invoked explicitly, LF everywhere

Every script the kit ships is a Node 18+ ESM `.mjs` file with no dependencies. It lives inside the folder of the skill that uses it, so it travels with `npx skills`, and it is always invoked as `node <path>`, never through a shebang or the executable bit. The kit's author works on Windows, where neither Bash nor Python can be assumed for every harness, and Windows does not preserve executable bits.

The repo enforces LF with `.gitattributes` (`* text=auto eol=lf`). Scripts still accept CRLF on input, because a spec edited on Windows may arrive with CRLF line endings. Paths in docs use `/`.

## Consequences

Copies keep their own scripts unchanged. For example, `diagnosing-bugs` ships a Bash `hitl-loop.template.sh`, and the copy keeps it.
