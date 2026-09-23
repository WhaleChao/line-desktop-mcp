# Local read-only CLI

`line-cli` is the command-line entry point for bounded local LINE reads. It
does not replace the MCP server, initialize `LineUi` or CUA, open a chat,
stage a draft, send a message, upload a file, or recall content.
v3.2.0 retains the v3.1.0 command and scope contract. MCP's new plain-text
send receipt and guided UI workflows do not add CLI send commands.

## Commands

```text
line-cli --help
line-cli --version
line-cli status --json
line-cli capabilities --json
line-cli messages read --chat "Exact chat name" --from 2026-09-01 --to 2026-09-07 --limit 100 --json
line-cli messages export --chat "Exact chat name" --from 2026-09-01 --to 2026-09-07 --format json --out "C:\Exports\line-history.json" --json
```

`messages read` and `messages export` require one exact chat name and an
inclusive date range of at most 31 days. `--limit` defaults to 200 and may be
at most 1000. The only optional read filters are `--chat-type auto|group|direct`,
literal `--query`, and an exact `--cursor` from the prior page. Each scope
option may appear once. The CLI supports metadata-only local reads; it rejects
media previews, UI comparison, all-chat scans, and unknown options.

Each invocation returns one page. Preserve its `scope`, `freshness`,
`pagination.hasMore`, `pagination.nextCursor`, and warnings when deciding
whether to request another page. Pages use separate snapshots and are not one
atomic historical export.

`status` checks only the exported local client-status function. A verified
client with `process.state: "not_running"` is a valid status result. An
unverified build or unavailable Python status runtime is an error; status
success never proves that LINE is signed in, connected, or ready for GUI work.

`messages export` delegates to the shared local export helper. It validates
the metadata-only scope and new output path before starting the reader. Output
must be an absolute local path with a matching `.json`, `.txt`, or `.csv`
extension; existing files are never overwritten. JSON uses
`line-local-history-v1` and preserves the complete page. TXT and CSV project
only `date`, `time`, `sender`, `kind`, and `text`; the command result identifies
every omitted field present in that page and retains scope, freshness, warnings,
and pagination. Missing column values are blank. The local reader does not
provide `kind`, so that column stays blank; `contentType` is not guessed into
it. Use JSON to preserve the original message types and complete metadata.

## Output and errors

With `--json`, stdout contains exactly one JSON envelope:

```json
{
  "schemaVersion": 1,
  "requestId": "request UUID",
  "command": "messages.read",
  "ok": true,
  "data": {},
  "meta": {
    "packageVersion": "3.2.0",
    "source": "local-line-reader",
    "durationMs": 0
  }
}
```

Errors use the same envelope with `ok: false` and `error.code`, safe error
details, and `operationMayHaveCompleted`. Standard output is reserved for the
envelope; concise non-JSON diagnostics go to stderr and do not include chat
content or child-process diagnostics.

Human-readable output shows terminal and directional control characters as
visible Unicode escape sequences. Newlines, tabs, and ordinary Unicode remain
readable. JSON output and JSON exports preserve the original strings.

| Exit code | Meaning |
| --- | --- |
| 0 | Command completed. A page may still have `pagination.hasMore`. |
| 1 | Unclassified internal failure. |
| 2 | Invalid command, option, input, or export target. |
| 3 | Chat, cursor, or source scope was rejected or ambiguous. |
| 4 | Required local runtime or verified LINE build is unavailable. |
| 5 | Reader or filesystem execution did not complete. |
| 6 | The operation may have produced an export; inspect it before retrying. |

Exit code 6 takes precedence whenever `operationMayHaveCompleted` is true.
The CLI preserves safe raw error codes such as `LINE_EXPORT_VERIFY_FAILED` so
callers can distinguish failure cases without parsing text.

## Run from the release source

After installing dependencies as described in the [Windows guide](quickstart-windows.md),
run `node src/cli.js --help` from the release directory. A local package
installation also provides the `line-cli` executable. No global npm install
is required. Local reads retain the explicit `LINE_MCP_PYTHON` and
`LINE_MCP_SQLITE3MC_DLL` requirements; CUA is not needed for CLI local reads.

Exported chat data remains sensitive. Choose a private local directory and
share the output only within the scope authorized by the chat owner.
