# Exact chat selection

`list_line_chat_candidates({chatName})` reads at most 20 exact-name identity records. It returns opaque `chatRef` / `ownSenderRef`, `chatType`, and `existingChat`; it does not read messages or media. Unopened contacts are visible as candidates, not silently treated as additional existing conversations. `hasMore:true` means the result is incomplete.

`open_line_chat` retains the original name-only path. That path still refuses globally ambiguous names. A selected existing direct chat can instead provide `chatType:"direct"`, `expectedChatRef`, and `expectedOwnSenderRef` together. The current local account and unique existing name family are checked before GUI access. Wrong refs or changed account fail before opening.

This does not add a LINE MID navigation API. The GUI path still requires a unique safe visible search result or exact titled window. Multiple existing conversations whose names render alike remain refused. A title proves the opened window's title, not its database ID.

For a selected direct chat with unopened-name collisions, the result reports `uiIdentityVerified:false` and `requiresSendContext:true`. Use the existing `prepare_line_send_target` / context verification before input or send. Opening is not send approval. Sender verification, single dispatch, idempotency and local-record verification are unchanged.
