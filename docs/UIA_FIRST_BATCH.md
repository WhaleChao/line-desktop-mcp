# UIA first batch

The existing CUA backend already exposes accessible element values and routes supported element clicks through UIA Invoke. Reuse those interfaces; this patch does not add another GUI server or text-reading bridge.

Draft writing now checks the complete current value and expected draft in the same fresh, guarded snapshot used to select the write target. A changed draft uses one pre-input snapshot and one post-input snapshot instead of two pre-input snapshots and one post-input snapshot. The chat inspection before that sequence remains required. A draft already matching the requested full text causes no input. Draft conflicts, chat switches and uncertain input results retain their refusal and no-retry behavior. This path is shared by plain-text sending, draft updates/clears and optional attachment notes.

To measure an operation during development, set `LINE_MCP_UI_METRICS=1` in that process's environment. Metrics are disabled by default and add no response fields when disabled. When enabled, successful UI results and failure details include `uiMetrics` with elapsed time, fixed phase call counts/durations, screenshot request count and external process start attempts. They retain no chat names, text, targets, file paths, images or backend diagnostic strings, and write no logs. Phase durations overlap (for example, a CUA call inside a snapshot); do not sum them as total elapsed time. Counts describe attempts/requests, not successful captures or sends.

Validation: CUA/LINE UI/metrics/OCR checks pass, including full multiline/emoji values, stale-chat refusal before input, post-input chat drift, no blind retry, optional-file partial-state reporting and isolated concurrent metrics. Use an authorized live chat and exact outgoing content for any future send comparison; a synthetic call-count reduction is not a measured end-to-end speed percentage.

## Guided Unsend confirmation

On LINE 26.5.0.3975 with CUA Driver 0.28.2, native file-picker Open worked through UIA and message context menus accepted background input. The normal Unsend confirmation button remained unchanged after background input and completed through explicit foreground input. This is a control-specific limitation, not evidence that every LINE control needs foreground input.

`get_line_workflow(message_changes)` now describes this observed completion path. It requires a fresh exact dialog and verified NO-OP before switching to foreground; a disappeared dialog or uncertain result is inspected without replay. Recall remains a guided visual workflow, with a recalled-message placeholder as the required result and matching local UNSENT metadata as corroboration.
