![LINE Agent MCP v3.0.0](assets/line-agent-cover-v3.png)

# LINE Agent MCP

**LINE context, including images. Faster reads, less waiting.**

Choose a chat and date range. Let your AI assistant organize the conversation together with available cached images into progress, attachment context and next steps. MCP supplies previews to an image-capable model; original, thumbnail and missing states stay explicit.

[繁體中文](../README.md) · [English](README.en.md) · [日本語](README.ja.md) · [ภาษาไทย](README.th.md) · [Bahasa Indonesia](README.id.md)

[v3.2.0 release notes](releases/v3.2.0.en.md) · [Install](quickstart-windows.md) · [Technical contract](windows-extensions.md)

**v3.2.0 — Plain-text sends and local receipts:** A send binds the exact chat and own sender, then checks for a new local own message within one 30-second deadline. `RECORDED_LOCAL` is not delivery or read proof. Uncertain operations are checked without automatic resending. Dated MCP reads/search/exports/verification share the scoped local reader; undated calls retain loaded UI history. Windows lists 26 active extension tools and keeps five legacy aliases callable but hidden. [Details](releases/v3.2.0.en.md)

**v3.1.0 — Read-only local CLI：** Add `line-cli` for capabilities, local status, and scoped chat reads and JSON/TXT/CSV exports. Each invocation returns one page over at most 31 days. It does not operate the GUI or send messages. [CLI](CLI.md) · [v3.1.0](releases/v3.1.0.en.md)


**v3.0.1 large-database fix:** Streamed snapshots replace the 256 MiB whole-database blocker. The default DB limit is 2 GiB; WAL and source-stability checks remain. No chat-history deletion is needed. [Release notes](releases/v3.0.1.en.md) · [Upgrade](MIGRATING.md#upgrading-to-v301)

**LINE Agent MCP**, the Windows community edition maintained by [bensonmaxai](https://github.com/bensonmaxai/line-desktop-mcp), based on [Geoffrey Wang's original project](https://github.com/dtwang/line-desktop-mcp). It connects a local MCP client to a signed-in LINE Desktop. Codex is our everyday client; other local MCP clients can connect too. This project is not affiliated with LINE.

Set `LINE_MCP_EXTENSIONS=1` on Windows for **26 listed active tools**, with **five callable but hidden legacy aliases**. Without the flag, **five tools** are listed. macOS lists the same five names, but reads and sends are unavailable in this release.

**v3.0.0 security update:** Every Windows named-chat GUI operation, including the five defaults, needs CUA and the configured local reader. A private metadata-only check resolves one unique group or existing direct chat without reading messages, then verifies an already-open LINE header. Automatic first-result navigation is disabled. macOS reads/sends refuse before automation. Reply images are cropped to the requested chat; APNG previews contain one frame. GUI history copy restores the prior available clipboard formats when no newer writer intervenes. [Release notes](releases/v3.0.0.en.md) · [Migration](MIGRATING.md#upgrading-to-v300)

## One conversation, a complete workflow

![Read, summarize, approve, send, check](assets/workflow-en.svg)

Ask your assistant to review a named chat and report current progress. It reads the authorized scope, consults separately authorized business sources when needed, and shows the exact draft in the assistant conversation. After you confirm the recipient and content, it sends and checks the result. No separate workbench is required.

| Task | Capability and limit |
| --- | --- |
| Follow up on work | Exact group/direct local history, explicit dates, up to 31 days, pagination and snapshot freshness |
| Understand attachments | On-demand cached image previews, small PCM WAV blocks and explicit media availability |
| Reply to the right source | Full text/sender/time checks and a one-use visual source token |
| Inspect a poll | Read an already-open panel only after binding it to the authorized group |
| Handle client changes | Verified LINE build hashes and distinct process states; unknown builds refuse local reads |
| Reduce waiting | Bounded key search, temporary locator reuse and fewer redundant UI enumerations |

Ordinary text drafts are reviewed in Codex. The agent performs visual UI checks; real mentions and shared-content changes still need their specific workflow and approval. Plans are not evidence that an action happened.

## Install and migrate

```powershell
git clone --branch v3.2.0 --depth 1 https://github.com/bensonmaxai/line-desktop-mcp.git
cd line-desktop-mcp
npm ci --ignore-scripts
```

Use Node.js 24 LTS or newer (tested: 24.19.0) and the separately configured runtime components for your intended tools. Local reads require Windows x64, Python x64, `cryptography` and Pillow, a pinned SQLite3MC DLL, and explicit `LINE_MCP_PYTHON` / `LINE_MCP_SQLITE3MC_DLL`. Both Python packages are required, including in metadata mode. Every Windows named-chat GUI path also requires that local-reader environment and `LINE_MCP_CUA_DRIVER`, with AutoHotkey v2 and local Windows OCR where needed. See the [installation guide](quickstart-windows.md).

**Upgrade from v1.2.0 or v2.0.0 in the same project.** MCP identity and the five default tool names remain. Windows GUI operations require the local reader and CUA; `open_line_chat` resolves the exact chat and can open and verify its titled window. macOS reads/sends are unavailable. Install into a new directory, keep the previous launcher/settings for rollback, then reconnect and refresh schemas. LINE account/chat data need no migration. Earlier v1 callers must still migrate `stage_line_reply` to the complete `source` and a one-use `sourceToken`. [Upgrade and rollback](MIGRATING.md)

Use this GitHub tag or release `.tgz`. This project is not published to the npm registry and provides no MCPB bundle. The older `line-desktop-mcp@latest` package does not install it.

## Evidence and limits

![Same-machine cold-reader comparison](assets/performance.svg)

Historical v2.0.0 measurements, not a new v3.2.0 benchmark: text-history cold-reader core: **17.866 → 4.661 seconds**. Warm persistent MCP reads after restart: **0.732–0.803 seconds**, before image decoding and additional client/model/GUI overhead. These are bounded same-machine observations, not universal performance guarantees. v3.2.0 plain-text/local-record checks ran on LINE; rich-feature checks were guided UI actions, not autonomous MCP executions or recipient delivery/read proof. [v3.2.0 verification scope](releases/v3.2.0.en.md)

- Live GUI evidence: Windows LINE **26.4.2.3957, Traditional Chinese UI**, CUA Driver 0.23.2. Documentation translations do not certify other UI languages.
- Query dates and poll planning use **Asia/Taipei, UTC+08:00**.
- Local reading uses bounded read-only access to the signed-in LINE process memory. It stops on refused access or an unverified build.
- Local cached records are not a full server archive. Supported previews are PNG/JPEG, GIF/WebP/APNG first frames and small PCM WAV; other recognized media returns metadata. No general playback/transcription feature is implied.
- Text presence does not prove recipient delivery/read state. Real mention tokens need visual verification; uncertain sends are not automatically repeated.
- Decoding and OCR run locally; returned content follows the chosen AI client's data-handling policies.

Run `npm test` and `npm run test:python` with configured Python for synthetic verification. [Detailed tool contract and verification](windows-extensions.md)

[Language selection and official sources](LANGUAGES.md) · [Report an issue](https://github.com/bensonmaxai/line-desktop-mcp/issues) · [MIT license](../LICENSE.md) · [Third-party notes](THIRD_PARTY.md)

The cover is an AI-generated concept illustration. Workflow/performance graphics are code-generated, not real chat screenshots or official LINE assets.

This release uses local stdio only. It exposes no HTTP/REST server and does not automatically load a cwd `.env`; configure environment variables explicitly in the MCP client.
