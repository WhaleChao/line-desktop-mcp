# v3.3.8 targeted validation — 2026-10-14 (Asia/Taipei)

This is a scoped regression and authorized live check of changed paths, not a repetition of the entire guided-feature matrix. Prior valid checks are reused where code, inputs and dependencies are unchanged. Private chat names, references, records and screenshots are excluded from this document and the release.

| Path | Evidence and limit |
| --- | --- |
| Exact-name candidates and paired opening | Existing chats and unopened contacts remain distinct; paired existing-chat opening passed. Multiple existing name families remain refused. |
| Direct/group text and TXT | One text and one synthetic TXT per target were verified locally and then recalled. UI placeholders and matching local UNSENT metadata were checked. Recipient delivery/read is not certified. |
| Multiline/emoji draft | Complete value readback passed; repeating the identical draft reported already-matched with no input. |
| Draft conflict | Deliberately wrong expectedDraft refused before input; the exact original draft remained. Task-owned draft was cleared. |
| Wrong chat/account refs | Both requests returned BLOCKED without GUI input or send dispatch. |
| Closed/unproved chat view | Draft read refused an unproved chat kind; explicitly reopening the exact chat restored the verified empty-composer path. |
| Independent-window reply source | Live failure reproduced the main-window-only confirmation bug. The repaired deployed MCP confirmed the same visually selected source. Regression covers exact-window success plus changed HWND, title and minimization refusals. |
| Quoted draft | Native quote source and approved body were visually checked, body cleared and quote cancelled. The custom-drawn Reply menu required guided selection; no quoted reply was sent. |
| Original-forward preview | Automatic preparation safely returned PREPARE_NOT_READY for unverified full source OCR. Its transaction was cancelled. Guided native source Share, unique recipient search/selection and cancellation passed without final Share. No end-to-end forward dispatch claim. |
| Recall cleanup | The additional synthetic source was recalled; UI and its matching local UNSENT record were checked. All task-owned drafts and selection dialogs were cleared. |
| GUI delivery | Native file-picker UIA Open passed. Several Qt confirmation/selection controls ignored background input and required verified foreground or bundled Computer Use. An uncertain acknowledgment was never treated as success. |

The repaired UI/extension regression run passed 93 tests. The full Node run covered 406 cases: 401 passed, then five obsolete snapshot/catalogue test expectations were corrected and those five passed a targeted rerun. The unchanged 401 results were reused. Python initially ran 143 cases with eight environment skips. Supplying the already-installed configured cipher DLL to the two affected modules gave 21/22 passing; only the account's unavailable file-symlink privilege remained skipped. Combined Python coverage is 142 passing and one environment skip. The final security review is recorded separately against this immutable change set.

The Windows client was LINE 26.5.0.3975 and CUA Driver 0.28.2. A fresh configured MCP connection verified the deployed 3.3.8 local build. Existing long-lived Codex tool connections keep their loaded modules until reloaded.
