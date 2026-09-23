# Upgrade to v3.2.0

[Project home](../README.md) · [Windows installation](quickstart-windows.md) · [Features](features.md)

LINE Agent MCP v3.2.0 continues the same
[bensonmaxai/line-desktop-mcp](https://github.com/bensonmaxai/line-desktop-mcp)
repository, package name, and MCP server name: **line-desktop-mcp**. The
release uses the existing GitHub repository; it is not published to
the npm registry or as an MCPB bundle. LINE account and chat data do not migrate.
The reader still uses bounded, read-only local copies; it is not an account
backup or a migration tool.

## Upgrading to v3.2.0

Install the `v3.2.0` source or release archive in a sibling directory,
run `npm ci --ignore-scripts`, then reconnect the MCP client to
refresh its descriptors. Keep the previous directory, launcher, and
configuration for rollback. Do not copy LINE account files, keys, or cache.
The optional read-only `line-cli` remains available; check
`node src/cli.js --version` and `node src/cli.js capabilities --json`.

With `LINE_MCP_EXTENSIONS=1` on Windows, expect 26 listed active tools. Five
legacy aliases remain callable for existing clients but are hidden from the
list; 31 descriptors are implemented. The default five tool names remain.
Update clients that depend on an exact extension list or cached schemas.

Plain-text `send_message_auto` now checks for a new own local record in the
exact chat within one 30-second deadline. `RECORDED_LOCAL` establishes only
local record presence, not delivery or read state. Retain the same
`idempotencyKey` when checking an uncertain attempt; it will not dispatch
again. Without a key, identical chat and text reuse the recorded result.
Use a new key only when a second send is intentional. Never automatically
retry an uncertain send. Contact-name collisions now refuse even if one
candidate lacks a chat row, and identity is refreshed immediately before
Return.

For `get_line_chat_messages`, search, export, and verify, an explicit
`date` or complete `dateFrom`/`dateTo` range (at most 31 days) now uses
the scoped local DB/WAL reader. Undated requests continue to use loaded UI
history. `compareWithUi: true` is a separate GUI comparison; it may mark
the chat read and does not turn local records into delivery evidence.
Detached chat windows and file pickers require exact HWND/PID/title binding.
`send_file_manual` stages a path in the Ctrl+O picker only; clicking Open
after approval sends the file.

The v3.0.0 CUA, Python, pinned SQLite3MC, exact-chat and macOS refusal
requirements still apply to GUI operations. If rolling back, stop the active
bridge, wait for its operation lock to release, retarget the previous launcher,
and reconnect. Keep any uncertain send journal until its outcome is resolved;
rolling back does not justify replaying it.

## Upgrading to v3.1.0

v3.1.0 adds an optional read-only CLI without changing MCP tool names or
schemas. Install the `v3.1.0` source or release archive in a sibling directory,
run `npm ci --ignore-scripts`, then check `node src/cli.js --version` and
`node src/cli.js capabilities --json`. Keep the previous directory and launcher
for rollback. Existing Python and SQLite3MC configuration still applies.
No account or chat-data migration is required. CLI local reads do not need CUA;
MCP GUI operations retain all v3.0.0 requirements. See [CLI usage](CLI.md).

## Upgrading to v3.0.1

v3.0.1 fixes the 256 MiB whole-database blocker reported in [issue #1](https://github.com/bensonmaxai/line-desktop-mcp/issues/1). It streams encrypted DB/WAL snapshots with a default 2 GiB DB limit. No account or chat-data migration or deletion is needed. Install the new package in a sibling directory, preserve the previous launcher for rollback, then reconnect the MCP client. [Limits and timeout settings](quickstart-windows.md#large-local-databases) · [Release notes](releases/README.md).

## Upgrading to v3.0.0

The following v3 security migration requirements also apply to v3.0.1. Commands install the current patch release.

Use this guide from v1.2.0, v2.0.0 or v3.0.0. Install v3.0.1 in a sibling local
checkout, retarget the existing MCP registration, and keep the prior checkout
available for rollback. Do not overwrite a working v1/v2 checkout, delete it,
or force it to the v3 tag with git reset.

v3.0.1 retains the breaking security changes introduced in v3.0.0 for named-chat GUI workflows. Every
Windows named-chat GUI path, including the five default descriptors, now needs
CUA plus the existing local-reader Python/DLL prerequisites. The five descriptor
names, order, and input schemas remain, but their platform availability
descriptions change. A retained descriptor does not mean v3 will silently use
the older GUI behavior.

## Before changing anything

1. Save a copy or export of the current MCP client configuration containing the
   line-desktop-mcp server entry. Keep the copy outside the installation
   directory and record the current v1/v2 command, arguments, and environment.
2. Keep the existing v1.2.0 or v2.0.0 checkout unchanged. Do not copy LINE
   data, keys, cache, or account files into the v3 directory.
3. Finish active LINE work before switching. All versions use the same per-user
   operation lock at ~/.line-desktop-mcp/operation.lock
   (%USERPROFILE%\.line-desktop-mcp\operation.lock on Windows). It serializes
   bridge operations across versions; use one active bridge for normal work.
4. Check the Node runtime selected by the MCP client. Node 24 LTS or newer is
   required by v3.0.1.

For a file-based configuration, make a normal copy rather than rewriting the
existing entry:

~~~powershell
Copy-Item -LiteralPath 'C:\path\to\your-mcp-config.json' -Destination 'C:\path\to\your-mcp-config.before-v3.json'
~~~

Use your client's documented export method if it does not store MCP
configuration in a JSON file.

## Obtain the exact v3.0.1 source

Choose one of the following paths outside OneDrive. Use the published GitHub
tag or attached release package; do not substitute npm install line-desktop-mcp@latest.

### Git checkout (recommended)

~~~powershell
git clone --branch v3.0.1 --depth 1 https://github.com/bensonmaxai/line-desktop-mcp.git C:\Tools\line-desktop-mcp-v3.0.1
Set-Location C:\Tools\line-desktop-mcp-v3.0.1
git describe --exact-match --tags
npm ci --ignore-scripts
~~~

git describe must print v3.0.1. npm ci --ignore-scripts uses the included
lockfile and prevents package lifecycle scripts from running during install.

### GitHub source archive

Use the tag's source archive only when a Git checkout is unavailable:

~~~powershell
$archive = 'C:\Tools\line-desktop-mcp-v3.0.1-source.zip'
$archiveRoot = 'C:\Tools\line-desktop-mcp-v3.0.1-source'
Invoke-WebRequest -Uri 'https://github.com/bensonmaxai/line-desktop-mcp/archive/refs/tags/v3.0.1.zip' -OutFile $archive
Expand-Archive -LiteralPath $archive -DestinationPath $archiveRoot
Set-Location (Join-Path $archiveRoot 'line-desktop-mcp-3.0.1')
npm ci --ignore-scripts
~~~

The source archive is the v3.0.1 GitHub tag snapshot, but has no .git metadata,
so git describe is only available with the checkout path.

### Attached release package

Alternatively, download `line-desktop-mcp-3.0.1.tgz` and `SHA256SUMS.txt` from the
[v3.0.1 release](https://github.com/bensonmaxai/line-desktop-mcp/releases/tag/v3.0.1).
Compare the archive's `Get-FileHash -Algorithm SHA256` result with the checksum
file before extracting. Extract into a new local directory, run
`npm ci --ignore-scripts` inside its `package` subdirectory, and point the MCP
client at `package/src/server.js`. This is the same packaged code tested for
the release; it is not a publication to the npm registry or an MCPB bundle.

## Prepare the required runtime

Complete the v3.0.1 setup in the [Windows installation guide](quickstart-windows.md):

- Node.js 24 LTS or newer.
- Windows x64, a signed-in supported LINE Desktop build, and a 64-bit Python.
- cryptography>=43.0.0 and Pillow>=10.0.0, even for metadata-only local reads.
- The hash-verified SQLite3MC v2.5.1 sqlite3mc_x64.dll, configured as an
  absolute LINE_MCP_SQLITE3MC_DLL path.
- An absolute LINE_MCP_PYTHON path to the x64 venv.
- For every Windows named-chat GUI operation, an absolute
  LINE_MCP_CUA_DRIVER path as well as the Python/DLL values above. Install
  AutoHotkey v2 only for legacy GUI helper paths; set LINE_MCP_AUTOHOTKEY only
  when its executable is outside the standard location.

Pure local DB history retains its reader prerequisites and needs no CUA. The
poll reader retains its established local-group identity and CUA prerequisites.
get_line_capabilities and get_line_status remain chat-free; status preserves
independent local-reader build/process metadata when GUI status is unavailable.
That metadata is not proof that Python imports, the DLL hash, login, or a GUI
operation is ready.

## Retarget the existing MCP registration

Keep the server name line-desktop-mcp. Change its command, src/server.js
argument, and environment to point at C:\Tools\line-desktop-mcp-v3.0.1; do not
create a second normal-workflow server identity.

At minimum, a complete Windows extension configuration is:

~~~json
{
  "command": "C:/Tools/node/node.exe",
  "args": [
    "C:/Tools/line-desktop-mcp-v3.0.1/src/server.js"
  ],
  "env": {
    "LINE_MCP_EXTENSIONS": "1",
    "LINE_MCP_PYTHON": "C:/Tools/line-desktop-mcp-v3.0.1/.venv/Scripts/python.exe",
    "LINE_MCP_SQLITE3MC_DLL": "C:/Tools/line-desktop-mcp-runtime/sqlite3mc-2.5.1/dll/sqlite3mc_x64.dll",
    "LINE_MCP_CUA_DRIVER": "C:/Tools/line-desktop-mcp-runtime/cua-driver-rs-0.23.2/cua-driver.exe",
    "LINE_MCP_AUTOHOTKEY": "C:/Program Files/AutoHotkey/v2/AutoHotkey64.exe"
  }
}
~~~

Replace every sample with a real absolute path. The CUA filename is only an
example; use the extracted driver executable. The AutoHotkey line is optional
when the standard installation path is available. Do not rely on a checkout
.env: v3.0.1 receives every LINE_MCP_* value explicitly from the MCP client.

Restart or reconnect the client after retargeting so it refreshes its tool
schema. Omitting LINE_MCP_EXTENSIONS still exposes the five default descriptors,
but does not bypass v3's named-chat GUI prerequisites.

## What changes from v1/v2

| Area | v3.0.1 behavior |
| --- | --- |
| Package, repository, MCP name | Still line-desktop-mcp; use the same GitHub repository and MCP registration name. |
| Tool catalogue | LINE_MCP_EXTENSIONS=1 exposes 29 Windows tools. Without it, five default descriptors remain with compatible names, order, and input schemas; descriptions and platform availability are updated. |
| Windows named-chat GUI | CUA, Python, cryptography, Pillow, and the pinned SQLite3MC DLL are mandatory before every named-chat GUI path, including the five defaults. There is no unverified fallback. |
| Identity gate | A fresh metadata-only snapshot must resolve one exact raw group name or exact effective contact name with an existing direct-chat row. NFC-only, whitespace, member-count, cross-type, incomplete, missing, or ambiguous matches fail closed before LINE UI, AHK, or clipboard work. |
| Navigation and input | open_line_chat verifies an already-open chat after user-controlled or guided LINE navigation. It does not select a first search result. Identity guards run before input and after it completes; uncertainty refuses without automatic continuation or retry. |
| Local context | get_line_local_messages remains a scoped DB/WAL reader with date bounds, literal search, pagination, and visible freshness. It does not become a server-history archive. |
| Images and metadata | Start in metadata mode. Request preview only for sourceRef values returned on the same page. APNG, GIF, and WebP use a bounded first frame; static PNG/JPEG preserve original bytes. Over-nested JSON metadata is ignored after RecursionError so other scoped records remain usable. |
| Quoted replies | stage_line_reply still needs complete source and a fresh one-use sourceToken. v3 binds it to fresh observed pixels, source identity, fresh local chat reference, and direct/group kind. Returned source crops have (0, 0) origin; post-Reply fallback is reverified and limited to the same chat body/composer. |
| Legacy GUI history | The exact main chat is checked before and after every scroll/copy child. Drift discards copied text before result/export/log. Clipboard restoration happens only if the helper still owns the sequence; a foreign update is preserved and the read refuses. Clipboard History/listeners and a small compare/restore race remain. |
| macOS legacy operations | Five descriptors remain listed, but legacy history, text, and file operations return LINE_CHAT_VERIFICATION_UNAVAILABLE before automation or clipboard activity. |
| Runtime and transport | Node 24 LTS or newer and stdio-only transport remain required. HTTP/REST options refuse before startup, and a current-directory .env is not auto-loaded. |

### Update quoted-reply callers

1. Read authorized, bounded local context and retain the source's full text,
   sender, date, time, and sourceRef.
2. Call get_line_reply_source_target with that complete source.
3. Inspect the returned cropped source image, then call
   confirm_line_reply_source_target with the observed source data and
   zero-origin location.
4. Pass the unchanged full source and short-lived, one-use sourceToken to
   stage_line_reply.

The token attests to the visual source check. It is not user permission, does
not approve sending, and cannot be reused. Continue to review the exact
recipient and reply body with the user before any send.

### Use the named-chat GUI gate deliberately

Open the authorized chat in LINE through user-controlled or guided navigation,
then call open_line_chat to verify its fresh header. Do not try to turn an
alias, normalized spelling, member count, or search-result position into an
identity. If the bridge reports a prerequisite or identity refusal, correct the
configuration or wait for the chat state to settle; do not substitute a legacy
path or automatically replay an uncertain action.

## Validate the upgrade

After reconnecting, start with get_line_capabilities({}), which does not read a
chat, inspect media, operate LINE, or send anything. With Windows extensions
enabled, v3.2.0 reports `toolCount: 26`; v3.0.1 reported 29. `get_line_status({})`
is also chat-free, but does not prove full reader or GUI readiness.

For synthetic local verification from the v3 checkout:

~~~powershell
Set-Location C:\Tools\line-desktop-mcp-v3.0.1
$env:LINE_MCP_PYTHON = 'C:\Tools\line-desktop-mcp-v3.0.1\.venv\Scripts\python.exe'
$env:LINE_MCP_SQLITE3MC_DLL = 'C:\Tools\line-desktop-mcp-runtime\sqlite3mc-2.5.1\dll\sqlite3mc_x64.dll'
npm test
npm run test:python
~~~

Pre-release security verification recorded 221/221 Node checks, 101 passing
Python checks and one symlink-related skip
(102 total), nine passing native SQLite checks, and an AutoHotkey parser pass.
These checks use sanitized synthetic fixtures and do not read real chats or send
messages. The new v3 GUI identity flow was not live end-to-end tested against
LINE. Earlier v2.0.0 live reads, image checks, and timing samples are historical
evidence only; they do not validate the v3 GUI gate.

For a first real local read, ask for one named chat, an explicit bounded date
range, and default metadata mode. If relevant image references are returned,
request mediaMode: "preview" only for selected references from the same page.
An image-capable AI model interprets preview bytes; a cloud client makes that
end-to-end interaction non-local.

## Roll back without losing the prior install

1. Stop the active v3 MCP client/bridge session and wait until it no longer owns
   the shared operation lock. Do not run both bridges to work around LINE_BUSY.
2. Retarget the same line-desktop-mcp entry to the preserved v2.0.0 or v1.2.0
   command, arguments, and environment from the configuration backup.
3. Reconnect the MCP client so it reloads the prior schema.
4. Keep the v3 checkout, venv, and verified runtime files intact until rollback
   is confirmed. They do not require copying or deleting LINE account data.

If an abandoned process leaves the lock behind, first confirm that its recorded
owner is not active and that no LINE action may still be completing. Only then
may you remove that exact lock file manually. Never clear a live lock or replay
an uncertain send.

## Common upgrade issues

| Symptom | What to check |
| --- | --- |
| Node startup fails | Point the MCP client to Node 24 LTS or newer. |
| Only five descriptors appear | Confirm LINE_MCP_EXTENSIONS is exactly 1, then reconnect. Five descriptors are expected when it is omitted. |
| A listed Windows GUI tool refuses | Configure LINE_MCP_CUA_DRIVER, LINE_MCP_PYTHON, and the pinned LINE_MCP_SQLITE3MC_DLL; install the reader packages. Listing a descriptor does not bypass v3 prerequisites. |
| Identity verification refuses | Use the exact raw chat name and correct direct/group type. Do not rely on NFC equivalence, whitespace changes, member-count suffixes, or a first search result. Wait for concurrent rename/create activity to settle. |
| LINE_CHAT_VERIFICATION_UNAVAILABLE on macOS | This is the v3 fail-closed result for legacy history/text/file operations; there is no unsafe compatibility switch. |
| LINE_BUILD_UNVERIFIED | The signed-in LINE build is not in the shipped allowlist. Do not bypass it; install a compatible release or wait for an updated allowlist. |
| ENGINE_DLL_UNCONFIGURED or ENGINE_INTEGRITY_FAILED | Recheck the absolute DLL path and SHA-256 from the installation guide. Do not substitute a DLL. |
| A status call succeeds but local reads fail | get_line_status is not full dependency readiness. Recheck the x64 venv, both imports, configured LINE_MCP_PYTHON, and configured DLL. |
| LINE_BUSY | Another v1, v2, or v3 bridge operation owns the shared lock. Let it finish and use one active bridge. |
| Old HTTP settings no longer work | Remove them and configure a local stdio MCP server. v3.0.1 has no HTTP/REST replacement. |

See [Windows installation](quickstart-windows.md) for fixed download hashes and
complete environment setup, and [Features](features.md) for scope, media, and
approval boundaries.
