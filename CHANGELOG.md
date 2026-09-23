# Changelog

## 3.2.0 — 2026-09-23 (Asia/Taipei)

**Bounded Windows workflows and local receipt checks.** This release retains
the read-only `line-cli` and the v3 named-chat safety requirements. Distribution
uses a GitHub source tag and attached `.tgz`, without npm-registry or MCPB
publication.

- Plain-text `send_message_auto` now binds the exact named chat and local
  sender identity, uses a 30-second operation deadline (25 seconds for input,
  five reserved for the local receipt), and checks for a new own message in
  the scoped local DB/WAL. `RECORDED_LOCAL` means a matching local record
  was found. It does not establish recipient delivery or read state.
- Contact-name collisions now refuse even when a competing contact has no
  chat row. Plain-text send refreshes identity immediately before Return.
- A persistent idempotency journal prevents automatic repeat dispatch. Reuse
  the same `idempotencyKey` to inspect an uncertain attempt; without a key,
  identical chat/text reuses its recorded result. A deliberate second send
  requires a new key. An uncertain retry performs a read-only receipt check.
- Dated `get_line_chat_messages`, search, export, and verify requests use
  the shared scoped local reader for one explicit date or complete
  `dateFrom`/`dateTo` range of at most 31 days. Undated legacy requests
  retain loaded-history UI behavior. `compareWithUi: true` performs a
  separate, bounded UI comparison and can mark the chat read.
- Detached chat and file-picker handling binds the exact window handle,
  process ID, and title. `send_file_manual` opens the picker with Ctrl+O
  and stages the chosen path only; clicking Open is the actual send action.
- Windows extensions advertise 26 active tools. Five legacy aliases remain
  callable but are hidden from the list, leaving 31 implemented descriptors.
  Tool results are compact, and Ajv is loaded only when extensions run.

Live MCP checks covered dated read, search, and verify at about 0.6 seconds
each in the observed run, plus TXT/JSON/CSV exports with one verified record
each. These are observations, not general speed guarantees. Guided visual
checks covered direct/group text with local receipts, a real
blue mention, quoted reply, forwarding, recall, synthetic TXT/PNG attachment
staging and media readback, polls, notes, albums, reactions, notification and
window toggles, sticker-panel opening, and capture-panel cancellation. These
rich-feature checks were guided UI actions, **not autonomous MCP executions**.
Guided UI copy and English translation checks passed; direct MCP targeting
of custom-drawn text can still refuse. Guided Files, Media, and Links UI
navigation passed; the MCP Files feature entry opens the More menu but cannot
locate Files and returns `LINE_FEATURE_UNAVAILABLE`. Chat-list pinning was
tested off/on/off and restored. A downloaded TXT file matched the original
SHA-256 exactly. Live `get_line_draft` read empty direct/group composers after
Search/open in about 2.3 seconds in the observed checks. Final synthetic
checks: 280/280 Node tests; 127 Python tests passed and one Windows symlink
privilege test skipped (128 run). No delivery/read receipt is claimed. See
[release notes](docs/releases/README.md), [upgrade instructions](docs/MIGRATING.md#upgrading-to-v320),
and [CLI](docs/CLI.md).

## 3.1.0 — 2026-09-22 (Asia/Taipei)

**Add a bounded, read-only local CLI.** GitHub tag and `.tgz` release;
no npm-registry or MCPB publication. Existing MCP entry points and v3 security
requirements remain in effect.

- Add `line-cli` with help, version, capabilities, local status, scoped
  `messages read`, and `messages export` commands. Reads require one exact
  chat and a date range of at most 31 days; every invocation returns one page.
- Add structured JSON results, request IDs, package version metadata, safe
  error codes, and explicit exit codes including uncertain export completion.
- Escape terminal and directional control characters in human-readable output
  so stored chat text cannot change terminal presentation. JSON retains the
  original strings. This was found and fixed during the pre-release review.
- Share the existing export implementation with MCP. JSON preserves the
  complete page; TXT/CSV report omitted metadata. Exports use a new absolute
  local path, exclusive creation, and hash/readback verification.
- Reject unknown/duplicate scope options, all-chat scans, UI comparison,
  media previews, and send operations. The CLI never initializes the GUI.

Verification: 249 Node tests passed; 124 Python tests passed with one Windows
symlink-privilege skip. Production npm audit reported zero known vulnerabilities.
The low-severity terminal-control issue found in review was reproduced with a
synthetic page, fixed, and covered by a passing regression. Tests use synthetic
reader results and filesystem fixtures.
No live LINE chat read, GUI action, or message send is claimed for this CLI
release. See [CLI usage](docs/CLI.md), [upgrade instructions](docs/MIGRATING.md#upgrading-to-v310),
and the [five-language release notes](docs/releases/README.md).

## 3.0.1 — 2026-09-12 (Asia/Taipei)

**Large local database repair ([#1](https://github.com/bensonmaxai/line-desktop-mcp/issues/1)).**
GitHub tag and `.tgz` release; no npm-registry or MCPB publication. The v3.0.0
security requirements remain in effect.

- Fix #1: local history and identity reads stream encrypted DB/WAL snapshots
  instead of rejecting every database above 256 MiB or retaining whole-file
  buffers. Key discovery uses a bounded 4 KiB prefix, followed by one fresh,
  verified snapshot and key revalidation before the scoped SQLite query.
- Default source DB capacity is 2 GiB, with independent, bounded environment
  settings for DB, WAL, and combined snapshot bytes. Oversize errors identify
  the exceeded limit without exposing paths or chat content. See
  [large local databases](docs/quickstart-windows.md#large-local-databases).
- Reader subprocesses use an owned request directory that the parent cleans
  after exit, including forced timeout termination. The default reader timeout
  is five minutes and can be explicitly configured within a bounded range.
- Freshness metadata adds `capturedAfterInitialization: true` and
  `bootstrapKind: stable_database_prefix`. The legacy
  `recapturedAfterInitialization: true` flag remains a compatibility alias for
  the post-key freshness guarantee, not a claim of two full snapshots.
  Timing reports `bootstrapPrefixMs` instead of `initialSnapshotMs`, adds
  `queryMs`, and retains `snapshotFileAndQueryMs` as the aggregate fresh-copy,
  validation, and query time (which includes `freshSnapshotAndValidationMs`).

Validation: 234 Node tests passed; 124 Python tests passed, with one existing
Windows file-symlink privilege skip (125 total). Synthetic encrypted databases
of 853,438,464 and 1,087,713,280 bytes, each with a committed WAL update,
returned the newest scoped message; source hashes were unchanged and request
files were cleaned. Peak process working set was approximately 39 MiB.
Build/key discovery was simulated; actual snapshot, cipher validation and SQL
ran. No real LINE chat, send or reporter-machine verification is claimed.
See the [five-language release notes](docs/releases/README.md).

## 3.0.0 — 2026-09-12 (Asia/Taipei)

**Fail-closed named-chat GUI verification.** This GitHub release is published
from `bensonmaxai/line-desktop-mcp` under tag `v3.0.0`. The package and MCP
server identity remain `line-desktop-mcp`; no npm-registry or MCPB publication
accompanies this release.

### Breaking security changes

- Every Windows named-chat GUI path, including the five default descriptors,
  now requires configured CUA plus the existing Python/SQLite3MC local reader.
  The five descriptor names, order, and input schemas remain, but their
  platform availability descriptions change. Missing prerequisites refuse; they
  do not silently retain the prior GUI behavior.
- Before a CUA LINE-window listing/state read/input or AHK/clipboard activity,
  a fresh metadata-only local lookup must resolve one complete, unique identity:
  an exact raw group name or an exact effective contact name with an existing
  direct-chat row. It reads no message rows or media. NFC-only, whitespace,
  member-count, cross-type, missing, incomplete, and ambiguous matches fail
  closed.
- `open_line_chat` only verifies an authorized chat that is already open after
  user-controlled or guided LINE navigation; it never selects the first search
  result. Active-chat guards run before input and after it completes. Any
  identity uncertainty refuses rather than continuing or automatically retrying.
- Legacy history verifies the exact main chat before and after every scroll/copy
  child. Drift discards copied text before a result, export, or optional history
  log. The clipboard helper restores prior available formats only while its
  owned sequence is unchanged; a foreign update is preserved and the read
  refuses. Clipboard History/listeners can still retain the transient copy, and
  a small compare/restore race remains.
- `sourceToken` now binds fresh observed pixels, source identity, the fresh
  local chat reference, and direct/group kind. Source observations return only a
  verified message-area crop with `(0, 0)` origin; the bridge rebases internally
  once. The post-Reply fallback is reverified and cropped to the same chat body
  and composer.
- macOS keeps the five descriptors, but legacy history, text, and file
  operations return `LINE_CHAT_VERIFICATION_UNAVAILABLE` before automation or
  clipboard activity. No compatibility opt-out exists while macOS lacks a
  verified active-chat implementation.
- APNG uses the existing bounded first-frame preview path. Static PNG/JPEG keep
  original bytes, and over-nested JSON metadata is ignored after `RecursionError`
  so other messages on a scoped page remain available.

Pure local DB history retains its existing reader prerequisites and does not
need CUA. The poll reader retains its local-group identity and CUA prerequisites.
Tool/capability metadata remains callable without named-chat identity proof, and
`get_line_status` preserves independent local-reader status when GUI status is
unavailable. See [upgrade and rollback](docs/MIGRATING.md#upgrading-to-v300).

### Verification scope

Pre-release security verification recorded 221/221 Node checks, 101 passing
Python checks plus one symlink-related skip
(102 total), nine passing native SQLite checks, and an AutoHotkey parser pass.
The new v3 GUI identity flow was not live end-to-end tested against LINE. The
v2.0.0 live GUI evidence and timing samples below are historical context, not
v3.0.0 validation or a performance claim.

## 2.0.0 — 2026-09-11

**LINE context, including images. Faster local reads.** This major release continues the existing `bensonmaxai/line-desktop-mcp` repository and MCP/package identity. LINE Agent MCP is the display name of the Windows community edition, derived from Geoffrey Wang's MIT-licensed upstream project.

### Main improvements

- Combine scoped text history with on-demand cached image previews for image-capable AI clients. Original/thumbnail, missing, unsupported and budget-deferred states remain explicit.
- Faster bounded local reading: same-machine text-history cold core 17.866 → 4.661 s; later warm persistent-MCP samples 0.732–0.803 s. Image decoding, model and GUI time are additional.
- 29 opt-in Windows tools, fresh DB/WAL snapshots, source references, pagination and up to 31 days per query.
- Full quoted-source binding with one-use visual tokens; group-bound reading of an already-open poll.
- Verified LINE build checks, independent process metadata and temporary process-specific locator reuse without persisted keys.
- Five-language overview/release notes and illustrated workflows.

### Breaking changes and upgrade

- Node.js 24 or newer is required; release verification used Node.js 24.19.0.
- `stage_line_reply` requires complete `source` and a short-lived one-use `sourceToken`. Update older callers, reconnect and refresh schemas.
- Local reading requires explicitly configured Python and a verified SQLite3MC DLL, with cryptography and Pillow installed. `get_line_status.localReader` checks build/process state, not full dependency readiness.
- This release exposes **stdio only**. The inherited HTTP mode and REST entry point were removed; HTTP CLI options fail before server startup.
- The server no longer auto-loads `.env` from the launch directory. Pass configuration explicitly through the MCP client.
- Obsolete MCPB builders/installers were removed. Use this repository's source tag or release `.tgz`; no npm-registry or MCPB publication accompanies this release.

The five original default tool descriptors, macOS interface, MCP identity and `LINE_MCP_*` environment names remain. The shared `.line-desktop-mcp/operation.lock` prevents parallel bridges driving the same UI. LINE account/chat data need no migration. See [upgrade and rollback](docs/MIGRATING.md).

### Verification scope

Live GUI evidence covers Windows LINE 26.4.2.3957 with Traditional Chinese UI; date filtering/planning uses Asia/Taipei (UTC+08:00). Translations do not certify other UI locales. Local caches are not complete server archives and text presence is not a delivery/read receipt.

Localized notes: [繁體中文](docs/releases/v2.0.0.zh-TW.md) · [English](docs/releases/v2.0.0.en.md) · [日本語](docs/releases/v2.0.0.ja.md) · [ภาษาไทย](docs/releases/v2.0.0.th.md) · [Bahasa Indonesia](docs/releases/v2.0.0.id.md).

## 1.2.0 — 2026-09-10

Earlier Windows community release: 24 opt-in tools, bounded loaded-history processing, draft protection and UI navigation. Its source and release assets remain available under tag `v1.2.0`.
