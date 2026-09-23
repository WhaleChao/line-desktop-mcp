# v3.2.0 validation and security review

Validated on 2026-09-23 with Windows LINE 26.4.2.3957, CUA 0.28.2 and Node 24.19.0. Live actions were explicitly approved for one direct chat and one group. This report contains no chat names, message IDs, screenshots, extracted history or local account paths.

## Automated checks

- Node: 280 tests passed, no failures or skips.
- Python: 128 tests run, 127 passed; one filesystem-symlink test skipped because the test account could not create symlinks. The configured SQLite3MultipleCiphers engine tests passed.
- Fresh MCP process: version 3.2.0, 26 advertised tools; 31 implementation descriptors including five hidden compatibility entries.
- Production dependency audit: zero known vulnerabilities reported by `npm audit --omit=dev` on the review date. This is a point-in-time registry result, not a guarantee.
- Release archive allowlist excludes runtime data, private validation artifacts, dependencies and generated Python bytecode.

## Actual operation results

| Scope | Result and evidence level |
| --- | --- |
| Direct/group plain text | New own records read back from the scoped local DB; multiline Unicode and a URL preserved. Observed sends took about 3.3–13.3 seconds. |
| Retry of the completed direct send | Same operation and receipt reused in about 0.8 seconds; no new dispatch. |
| Dated MCP read/search/verify | Passed through the local reader, about 0.6 seconds per observed call. |
| Dated CLI pagination | Two bounded pages, no duplicate records between pages. |
| MCP and CLI TXT/JSON/CSV exports | Each selected one synthetic test message; written files read back and hashed. |
| Draft read/stage/set/clear | Passed; final direct and group drafts were empty. Final reads also passed with chat search open. |
| Fresh search entry | MCP opened and verified the detached chat search bar. |
| TXT/PNG attachment staging | Exact native picker target and filename verified; one approved Open action per attachment. Local attachment records read back. |
| TXT download | Downloaded bytes matched the synthetic source SHA-256 exactly. |
| Image readback | Authenticated cached thumbnail decoded; album download visually matched the test image. LINE saved the album image as JPEG, so no original-PNG byte identity is claimed. |
| Real All mention | Blue LINE token observed before/after send; stored mention metadata agreed. Recipient notification is not established. |
| Quoted reply | Source and quote visually verified; stored related-source reference matched the approved source message. |
| Forward / recall | Exactly one approved forward read back; the designated recall visually verified. |
| Poll | Create, vote, result display, end and delete completed. |
| Note | Create, edit and delete completed. |
| Album | Create, add test image, rename, save image and delete completed. |
| Reaction | Added, observed on the intended message, then removed. |
| Chat-list pin, notifications and window pin | Toggled and restored to original values. |
| Copy / translation | Exact clipboard text and displayed English translation verified through guided UI. |
| Media / files / links | Panels verified through guided UI. |
| Sticker / capture | Sticker picker opened without sending; capture opened and cancelled without capturing or sharing. |

Rich actions in this table were guided visual operations, not proof that a single MCP call can perform their complete lifecycle. Polls, notes and albums created for this run were removed. Existing user content was not deleted. Calls, camera/microphone, screen sharing and sticker sending were excluded from the authorized test batch.

## Remaining interface limits

- `open_line_chat_feature(files)` can open More but still returns `LINE_FEATURE_UNAVAILABLE` because the custom menu item cannot be bound reliably. The guided Files panel check passed; automatic Files entry did not.
- Direct MCP copy/translate/forward selection can refuse custom-drawn message text. Guided UI worked; there is no silent guessed-message fallback.
- Local receipts prove local record presence, not server acceptance, recipient delivery or read status. Local history is a bounded cache, not a complete server archive.
- UI identity is checked against current local names and an exact process/window/title. The DB identity and a GUI window cannot be bound atomically; concurrent user changes remain an operating limitation.

## Security review and changes

The review covered the release diff, send journal/retry state, chat and sender identity, SQL scope, exact window routing, AutoHotkey arguments and release contents. It found a defensive gap where GUI name uniqueness omitted contacts without existing chat rows. The GUI/send identity check now includes those contacts and visually equivalent names; sends recheck chat reference, chat kind and own sender before the fresh pre-Return UI guard. Synthetic collision and identity-change regressions pass. An actual misdelivery was not reproduced or claimed.

File staging and activation bind validated HWND, PID and escaped title before focus or input. Attachments remain staged until the approved Open action. Uncertain sends are read-only on retry; the persistent journal records Return intent before dispatch. Export paths refuse overwrites and unsafe reparse paths. No credentials, chat databases, private screenshots, message extracts or machine-specific test records are included in the release.

No confirmed unresolved release-blocking issue was found within this review scope. This is a scoped code and dependency review, not a penetration-test certification.
