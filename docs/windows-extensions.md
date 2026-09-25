# Windows tool contract — v3.3.1

[Overview](README.en.md) · [Installation](quickstart-windows.md) · [Upgrade to v3.3.1](MIGRATING.md#upgrading-to-v331) · [Release notes](releases/README.md)

LINE Agent MCP is the display name of the Windows community edition in `bensonmaxai/line-desktop-mcp`. v3.3.0 adds selected recipient/account binding, recent-chat metadata and original-message forwarding to the scoped reader and local send receipts. The MCP server/package identity remains `line-desktop-mcp`. It is an unofficial local bridge to a signed-in LINE Desktop.

v3.3.1 fixes group search navigation when the list label or truncated title prevents OCR equality. A sole structural row is a navigation candidate, never identity proof. Full detached-title verification and a fresh bound local chat/account/type/unique-name check precede group composer input; the pre-Return check remains. Identity-only calls with an expected account now return its checked opaque reference. Direct-chat behavior and all tool schemas remain unchanged. [Validation and limits](releases/v3.3.1.en.md).

## Connection and compatibility

Node.js 24 LTS or newer is required. The server exposes local **stdio only**; no HTTP/REST entry point, server listener, MCPB bundle or startup installer is included. Former HTTP CLI flags fail before startup. Configuration is inherited explicitly from the MCP client; a cwd `.env` is not automatically loaded. Distribution uses a GitHub source tag and attached `.tgz`; the npm registry is not updated by this release.

Windows with `LINE_MCP_EXTENSIONS=1` lists 33 active tools. Five legacy aliases remain callable but hidden from the list, for 38 implemented descriptors. Without extensions, five default descriptors remain. Every Windows named-chat GUI path, including the defaults, requires configured CUA and the Python/SQLite3MC local reader. macOS lists the five defaults but refuses legacy reads/sends before automation with `LINE_CHAT_VERIFICATION_UNAVAILABLE`. The Windows reader is not a macOS feature; see [migration notes](MIGRATING.md#upgrading-to-v331).

## Context with images

`get_line_local_messages` accepts one exact `chatName`, `chatType` (`auto`, `group`, `direct`), explicit `dateFrom`/`dateTo`, `messageLimit` (1–1000, default 200), optional literal `query`, cursor, `mediaMode` and selected `mediaSourceRefs`. The inclusive date window is at most 31 days. Date filtering uses **Asia/Taipei, UTC+08:00** regardless of documentation language.

Default `mediaMode: "metadata"` reads text and attachment metadata without GUI interaction or image decoding. To include pictures, request `mediaMode: "preview"`; optionally pass up to 20 source references from the authorized page. The bridge supplies MCP image blocks to an image-capable AI client/model. It does not perform its own semantic image understanding.

```json
{
  "chatName": "Sample customer",
  "chatType": "direct",
  "dateFrom": "2026-09-01",
  "dateTo": "2026-09-11",
  "messageLimit": 100,
  "mediaMode": "preview"
}
```

Use actual user-authorized names/dates, never the example as authority to read a chat. Keep requests narrow. Missing originals may have thumbnails; missing, rejected, unsupported and response-budget-deferred states are distinct. A returned preview may not be the original full-resolution file.

Static PNG/JPEG previews, bounded APNG/GIF/WebP first frames and small validated PCM WAV blocks are supported by v3.0.0. There is no general video/audio playback, transcription, arbitrary attachment downloader or server media archive. Media bytes are authenticated before decryption. The reader has byte/pixel limits; do not bypass refusal by fetching unrelated files.

## Scope, freshness and speed

The reader uses bounded read-only copies of selected DB/WAL sources, verifies the LINE build/process, validates its working key and takes a fresh snapshot on each query. Source references identify returned records, not clickable UI bubbles or user permission. Pagination is bound to the original chat/date/query and takes a new snapshot for each page; it is not one immutable full-chat transaction.

`compareWithUi: true` requests one optional, separate GUI comparison with CUA chat verification. It may focus LINE and mark the chat read. It reports unmatched directions and comparability limits, not server completeness or current action identity. Missing CUA or failed chat verification preserves local records and reports an unavailable comparison without retry. The local reader never silently falls back to GUI extraction.

Bounded key discovery uses a short-lived process-specific locator hint. The hint contains coarse discovery metadata, not a key or chat text. Every reuse rechecks the process and validates current encrypted data. Missing/expired hints fall back to one bounded scan; process changes and unknown builds refuse or rediscover as appropriate. This explains why warm and cold reads differ.

## Tools

| Purpose | Tool names |
| --- | --- |
| Local text/image context | `get_line_local_messages` |
| Recent recipients and readiness | `list_line_recent_chats`, `check_line_send_target`, `prepare_line_send_target` |
| Scoped or loaded history | `get_line_chat_messages`, `search_line_chat_messages`, `verify_line_message`, `export_line_chat_history` |
| Capabilities and plans | `get_line_capabilities`, `get_line_workflow`, `prepare_line_workflow`, `get_line_status` |
| Chat/UI identity | `open_line_chat`, `get_line_ui_state`, `confirm_line_chat_view`, `open_line_chat_feature` |
| Draft protection | `get_line_draft`, `set_line_draft`, `clear_line_draft` |
| Text/file staging and sending | `send_message_manual`, `send_message_auto`, `send_file_manual` |
| Quoted source | `get_line_reply_source_target`, `confirm_line_reply_source_target`, `stage_line_reply` |
| Other message actions | `copy_line_message`, `translate_line_message`, `stage_line_forward` |
| Reviewed original-message forwarding | `prepare_line_forward`, `confirm_line_forward`, `verify_line_forward`, `cancel_line_forward` |
| Already-open poll | `get_line_poll_state` |

Legacy aliases `prepare_line_direct_chat`, `prepare_line_group_chat`,
`get_line_chatroom_history_short`, `get_line_chatroom_history_default`, and
`get_line_chatroom_history_long` remain callable but do not appear in
`tools/list`. Clients should use the active tools for new integrations.

`open_line_chat` resolves one exact local identity, opens or reuses its titled
main/detached window when needed, and verifies the final HWND, PID, title and
fresh chat header. It never treats the first search result as sufficient
identity proof. Opening can focus LINE or mark a chat read. The bridge guards
the active identity before an input and after it completes. If identity
becomes uncertain, it refuses rather than continuing or automatically retrying.

For `get_line_chat_messages`, `search_line_chat_messages`,
`export_line_chat_history`, and `verify_line_message`, one explicit `date`
or a complete `dateFrom`/`dateTo` range of at most 31 days uses the shared
scoped local DB/WAL reader. Undated requests retain the legacy loaded UI
history path. Local records are not a complete server archive.
`verify_line_message` checks text presence, not delivery. Exports create a
new local file exclusively and do not overwrite or create restorable LINE
backups. The read-only `line-cli` retains its v3.1.0 commands and has no
send or GUI operations.

v3.0.0 verifies the exact main LINE chat before and after every legacy scroll/copy child. Detached windows and identity drift refuse; copied text is discarded before a tool result, export, or optional history log is produced. Copied text must be owned by the bound LINE process. The clipboard helper snapshots the prior available formats and restores them before returning only when its owned sequence is unchanged. A foreign update is preserved and the history read refuses. Clipboard History and listeners can retain the transient copy, `ClipboardAll` can omit unavailable formats, and a small race remains between the final sequence comparison and restoration.

## Selected recipients and direct readiness

`list_line_recent_chats` takes `days:14` or `days:30`, optional literal name
`query`, and `limit` up to 50. It reads activity metadata, not message text or
media. Each result retains its opaque chat identity; same-name rows are not
merged. The list is not send approval or GUI proof.

`check_line_send_target` takes the exact name and direct/group kind. Name-only
checks retain global uniqueness, including unopened contacts. Direct checks
with both `expectedChatRef` and `expectedOwnSenderRef` can resolve one unique
existing chat even when unopened same-name contacts exist. The result is
`IDENTITY_UNIQUE`, `IDENTITY_BOUND_REQUIRES_UI`, or an expected identity
`BLOCKED` result. Operational failures remain MCP errors.

`prepare_line_send_target` takes that exact direct name and both refs. It only
inspects an already-open exact titled window and at most 30 metadata-only
messages from the current and previous two Taipei dates. It requires two
distinct newest text records on one date, matched independently against visible
full text, date, minute and direction, plus a fresh empty composer. Adjacent
same-direction messages may share one visible minute only when their local
dates/minutes agree. Changed pixels, account, chat, draft or local context
refuse. `READY` does not type, send, authorize input or create reusable proof.

Paired `send_message_auto` repeats that proof for the collision case. Globally
unique targets keep automatic opening; ordinary name-only callers keep their
existing uniqueness requirements. Callers must obtain user approval for the
specific send. Optional refs on `get_line_local_messages` also reject a changed
chat/account before selecting message rows.

## Reply and action boundaries

For an ordinary reply, the assistant reads the authorized recent context,
presents the full recipient/draft, obtains user confirmation, sends once and
verifies important results. `send_message_auto` binds the exact named chat
and own sender identity, then checks for a new own local DB/WAL record under
one 30-second deadline: 25 seconds for input, five reserved for the receipt.
`RECORDED_LOCAL` confirms only a local record. It does not confirm recipient
delivery or read state. A persistent idempotency journal prevents automatic
repeat dispatch. Reuse the same `idempotencyKey` to inspect an uncertain
operation; that replay is read-only. Without a key, identical chat and text
reuse the recorded result. A deliberate second send requires a new key.
User approval is the caller's responsibility, not a server-issued permission.
`send_message_manual` stages a draft inside LINE when requested. Existing
drafts require an exact expected-value match before replacement/clearing.

Quoted replies require fresh local source text/sender/time checks, a fresh visual target observation, caller visual confirmation and a short-lived one-use `sourceToken`. The token binds the fresh observed pixels and source identity plus the fresh local chat reference and direct/group kind; it is not send approval or independent proof that the caller looked at the screenshot. Truncated or indistinguishable sources stop the automatic path.

In v3.0.0, source observations contain only the verified message-area crop, whose coordinate origin is `(0, 0)`. Selection rectangles/points are relative to that returned image. The bridge privately translates them to window coordinates once. A post-Reply fallback is reverified and cropped to the same chat's body/composer; it does not return the unrelated sidebar.

`prepare_line_workflow` creates only a reviewable plan; its fingerprint does not authorize an action. Real mentions require blue LINE mention tokens selected and checked in the actual UI. Plain `@Name` text is insufficient. `get_line_poll_state` reads an already-open panel only after local group identity and poll-URL binding; it does not open, create, vote or publish. Missing fields stay unknown.

`send_file_manual` binds the verified main or detached chat HWND, PID, and
title, opens the picker with Ctrl+O, and stages a path there. Clicking Open
is the actual upload/send step and needs the user's approval. Shared
notes/albums, reactions, recall, calls and membership changes have
separate guided UI workflows and action boundaries. Uncertain sends are not
automatically replayed.

Original-message forwarding has separate prepare/confirm/verify/cancel tools.
Preparation binds one exact source, current account and one recipient; final
confirmation must refer to the same reviewed operation. A durable intent is
written before the final native Share input. Uncertain dispatch is verified
without another send, and restart invalidates old preparation tokens.
Cancellation only applies before dispatch; it does not recall a sent message.
Attachment filename/size matches are limited local evidence, not byte identity
or recipient delivery. Custom-drawn or ambiguous source/recipient UI may refuse.

The shared `~/.line-desktop-mcp/operation.lock` serializes supported bridge UI operations across old/new installs. It does not prevent a human or unrelated program from changing LINE. After interference, reobserve and verify; do not reuse old screenshot indices or confirmation tokens.

## Runtime and privacy

Local reads require Python x64 plus cryptography and Pillow, `LINE_MCP_PYTHON`, and the pinned `LINE_MCP_SQLITE3MC_DLL`. Python/DLL configuration is explicit; no PATH or startup installation fallback is used. `get_line_status.localReader` reports build/process metadata only, not full Python/DLL readiness or login/network/delivery proof.

Every named-chat GUI operation requires `LINE_MCP_CUA_DRIVER` plus the
configured `LINE_MCP_PYTHON` and pinned `LINE_MCP_SQLITE3MC_DLL`, including
the five default Windows tools. Before GUI access, a fresh local lookup must
bind one complete unique identity. Ordinary paths use metadata only; the
paired direct exception additionally reads bounded recent context. The
ordinary lookup covers an exact raw group name
or exact effective contact name with an existing direct-chat row, reads no
messages or media, and accepts no NFC, whitespace, or member-count alias.
Name-only contact collisions fail closed even if one candidate has no chat row.
The paired direct exception described above additionally reads bounded recent
context and requires independent visible proof; it never picks an arbitrary
same-name chat or weakens existing-chat/name-family collision checks.
Plain-text send refreshes the identity immediately before Return. Missing,
incomplete, cross-type, or ambiguous identity refuses without fallback.

Tool/capability metadata remains callable without chat-identity proof, and `get_line_status` preserves independent local-reader status when GUI status is unavailable. Pure local DB history needs its reader prerequisites but no CUA. The poll reader retains its documented local-group identity and CUA prerequisites. Local and GUI observations are not an atomic database-ID-to-UI mapping; concurrent rename/create activity remains a race, so retry only after LINE state settles. AutoHotkey uses `LINE_MCP_AUTOHOTKEY` or the standard Program Files v2 executable, with literal argv and no shell/PATH lookup. The driver is called through its public stdio MCP interface. No always-on service is installed by this package.

Reader scratch state lives under `%LOCALAPPDATA%/line-desktop-mcp/line-reader`; encrypted snapshots are cleaned up after use. Locator hints contain no key or chat text. AHK operations use unique temporary script files and remove them on normal completion/failure; an interrupted process can leave temporary files. Optional `CHAT_LOG_ON=true` explicitly writes plaintext legacy-history logs, so leave it off unless a user has requested that export behavior.

Decoding/OCR are local. Tool results, including images, may be sent to the AI provider used by the client. A local bridge therefore does not imply that all processing is offline. Read only authorized named chats; do not post chat contents, account identifiers, keys, raw database files or unredacted traces in issues. [Licenses and platform terms](THIRD_PARTY.md)

## Verification

v3.3.0 reuses the live-tested local.4 runtime: bound preparation, changed
chat/account refusals and one approved plain-text send with a new own exact-text
local record. Synthetic-attachment forwarding and subsequent guided recall
were also exercised. The recorded run used Windows LINE 26.4.2.3957 and CUA
Driver 0.28.2. Node: 349 passed. Python: 135 run, 127 passed, eight skipped.
The preparation observation took about 5.6 seconds on the test machine.
See [v3.3.0 limitations](releases/v3.3.0.en.md); no recipient delivery/read
claim or general latency guarantee follows from these checks.

Historical v3.0.0 pre-release security verification recorded 221/221 Node checks, 101 passing
Python checks plus one symlink-related
skip (102 total), nine passing native SQLite checks, and an AutoHotkey parser
pass. These checks do not read live chats or send messages.

v3.2.0 live MCP checks covered dated read, search and verify, each around
0.6 seconds in the observed run, and one-record TXT/JSON/CSV exports whose
counts were verified. Plain direct/group text sends had matching local
receipts. These observations are not universal latency guarantees or proof
of recipient delivery/read state.

Guided visual checks covered a blue mention token, true quoted reply,
forwarding and recall, synthetic TXT/PNG attachment staging with media
readback, poll, note and album operations, reactions, notification and
window toggles, opening the sticker panel, and cancelling an opened capture
panel. These rich-feature actions were guided UI checks, not autonomous
direct MCP executions. Guided exact copy and English translation actions
passed; direct MCP targeting of custom-drawn text can still refuse. Guided
Files, Media, and Links UI navigation passed. The MCP Files feature entry
opens the More menu but cannot locate Files and returns
`LINE_FEATURE_UNAVAILABLE`; it does not open the Files panel. Chat-list
pinning was tested off/on/off and restored. A downloaded TXT file matched
the original SHA-256 exactly. Live `get_line_draft` read empty direct and
group composers after Search/open in about 2.3 seconds in the observed
checks. Final synthetic checks: 280/280 Node tests; 127 Python tests passed
and one Windows symlink privilege test skipped (128 run).

The following is historical v2.0.0 live evidence, not v3.2.0 validation: it
covered Windows LINE **26.4.2.3957, Traditional Chinese UI**, and CUA Driver
0.23.2. Two actual LINE restarts were followed by successful scoped reads. Five
actual cached images passed MCP transport and independent decoding checks.
GIF/WebP/WAV edge cases additionally used synthetic fixtures. Other
documentation languages do not certify localized LINE interfaces.

| Timing sample | Observed result | Boundary |
| --- | --- | --- |
| Earlier cold text-history reader | 17.866 s | Historical v2 Python core; bounded memory scan plus query |
| Optimized cold text-history reader | 4.661 s | Historical v2 same-machine observation; before the later build gate integration |
| Later warm persistent MCP reads | 0.732–0.803 s | Historical v2 observation; build gate included; model/client routing additional |

The later build gate added about 24 ms in a separate image check. These are
historical same-machine observations from v2.0.0, not a latency claim or live
E2E evidence for v3.0.0. Image decoding and model/GUI work add time. Smaller
LINE process heaps after restart can be faster; machine load and scope can also
be slower. No real message content or private runtime dumps are distributed as
benchmark fixtures.
