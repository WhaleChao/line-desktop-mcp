# 功能介紹

[回專案首頁](../README.md) · [Windows 安裝指南](quickstart-windows.md) · [升級與回退](MIGRATING.md)

**LINE Agent MCP** 是
[bensonmaxai/line-desktop-mcp](https://github.com/bensonmaxai/line-desktop-mcp)
持續維護的 Windows 社群版。它的套件名稱與 MCP server 名稱仍是
`line-desktop-mcp`，透過本機 stdio 連到已登入的 LINE Desktop；它不是
LINE 官方 API。

v3.0.0 延續指定對話的文字與附件線索讀取與圖片預覽，並把所有 Windows 指定
聊天室 GUI 路徑改為先通過本機身分核對的 fail-closed 流程。
v3.2.0 把指定日期的讀取、搜尋、匯出與核對導向共用的受限本機讀取器，
並對普通文字傳送增加本人本機紀錄回執與防重送紀錄。`RECORDED_LOCAL`
不代表對方收到或已讀。

## 先看兩個主要能力

### 圖片也納入對話上下文

使用 `get_line_local_messages` 時，先指定聊天室、日期範圍與數量。預設
`mediaMode: "metadata"` 只讀取本機 DB/WAL 的文字與附件資訊，不開 LINE
視窗、不讀圖片快取，也不解碼媒體。

如果同一頁回傳了值得看的圖片 `sourceRef`，才在第二次讀取要求
`mediaMode: "preview"`，並把那一頁的 `mediaSourceRefs` 明確列出。這能讓
模型把對話文字、附件狀態與選到的圖片放在同一段工作脈絡中，也避免一次載入
整個聊天室的媒體。

| 媒體 | 行為 |
| --- | --- |
| PNG、JPEG | 回傳經驗證的圖片內容，供支援影像的 AI 客戶端／模型判讀。 |
| APNG、GIF、WebP | 只處理第一個影格。 |
| 小型 PCM WAV | 可回傳受限音訊區塊。 |
| 影片、一般音訊、其他檔案 | 回傳可用性或格式資訊；沒有通用播放、轉錄或任意檔案擷取。 |
| 快取缺失、不支援或超過回應預算 | 明確回報缺失、拒絕或延後，不會假裝已有預覽。 |

MCP 負責在本機取得與驗證可用的預覽資料；它本身不做影像語意判讀。若把預覽
交給雲端 AI 客戶端，端到端流程就不是完全離線，即使解碼本身在本機完成。

### 更快的本機讀取

v2.0.0 曾在同一台測試電腦上，把文字歷史的冷讀核心從 **17.866 秒**降為
**4.661 秒**；LINE 重啟後、持續 MCP 連線的暖讀樣本是 **0.732–0.803 秒**。

這些是 v2.0.0 的歷史實測範圍，不是 v3.0.0 新 GUI 身分流程的效能或 live E2E
證據，也不是每台電腦的承諾。圖片解碼、MCP 客戶端、模型處理與 GUI 操作都不含
在內，實際時間會隨 LINE 版本、快取、硬體與請求範圍而變化。

## 本機上下文讀取的範圍

`get_line_local_messages` 是主要的指定範圍本機讀取工具：

- 一次只讀一個指定的群組或個人聊天室，日期範圍最多 31 個日曆日。
- 支援字面文字搜尋、筆數限制與 `pagination.nextCursor`；換頁時須維持同一個
  聊天室、日期、聊天類型與查詢範圍。
- 每一頁都會建立新的本機快照，回傳快照時間與新鮮度；它不是 LINE 伺服器的
  完整歷史，也不等於帳號備份。
- 同名群組與個人對話無法唯一判斷時會拒絕，必須明確指定正確類型。
- `compareWithUi: true` 是選用的一次 GUI 對照；它可能把 LINE 帶到前景或標記
  已讀，且需通過 CUA 與指定聊天室的身分核對。預設不做 GUI 對照，
  本機讀取失敗時不會偷偷改用 GUI；對照不可用時保留本機結果並回報不可用。

開始時應以「指定聊天室＋明確日期＋metadata」提出請求。例如：

~~~text
讀取「範例客戶」2026-09-10 到 2026-09-11 的對話，先用預設 metadata 模式
整理進度與待回覆事項；不要送出訊息，也不要開啟 LINE 介面。
~~~

如果回傳內容指出需看圖，再只選那一頁的 `sourceRef` 要求預覽。這樣做能保留
文字脈絡，也避免對不相關圖片進行處理。

v3.2.0 的 `get_line_chat_messages`、`search_line_chat_messages`、
`export_line_chat_history`、`verify_line_message` 若指定單一 `date`，
或完整 `dateFrom`／`dateTo`（最多 31 天），會共用受限本機讀取器；
未指定日期的舊用法仍讀 LINE 介面已載入的歷史。本機結果不會自動改用 GUI，
`compareWithUi: true` 是另行要求的介面對照，可能把聊天室標為已讀。

## 工具模式與能力範圍

在 Windows 把 `LINE_MCP_EXTENSIONS=1` 設為精確值 `1` 時，MCP 提供
**26 個列出的工具**；另有 5 個舊別名仍可呼叫但不列出，總共實作
31 個 descriptor。沒有這個值時仍列出 5 個預設 descriptor；
macOS 也列出這五個預設 descriptor。

v3.0.0 要求 Windows 所有指定聊天室的 GUI 路徑（含預設五工具）同時設定 CUA
與本機 Python／SQLite3MC 讀取器。私有的 metadata-only 核對會從新快照確認唯一
的原始群組名稱，或具既有 direct-chat row 的有效聯絡人名稱，不讀訊息或媒體；
名稱缺失、重複、不完整、群組與個人對話衝突，或只靠 NFC、空白、群組人數後綴
對得上時，都會在讀取／操作 LINE UI 或執行 AHK／剪貼簿 helper 前拒絕。CUA 的
連線與工具協商可能先完成，但不會成為跳過核對的替代路徑。

`open_line_chat` 會解析精確聊天室，必要時開啟或重用有標題的視窗，
並核對 HWND、PID、標題與新鮮標頭；搜尋第一筆本身不算身分證明。任何輸入前後都會重新確認
目前聊天身分；不能維持確定性就拒絕，不會自動繼續或重試。工具／能力 metadata
不需要聊天室身分證明；`get_line_status` 在 GUI 狀態不可用時仍保留獨立的本機讀取器
狀態。純本機資料庫歷史保留原有讀取器前置條件、不需要 CUA；投票讀取也保留原有
的本機群組身分與 CUA 前置條件。本機唯一性快照與新鮮 UI 標頭不是原子的
DB-ID-to-UI 映射，同時改名或建立聊天室仍是競態限制。macOS 保留五個 descriptor，
但舊版讀取／發送會在自動化前回報 `LINE_CHAT_VERIFICATION_UNAVAILABLE`。完整
相容性與回退步驟見[升級至 v3.2.0](MIGRATING.md#upgrading-to-v320)。

| 類別 | 主要內容 |
| --- | --- |
| 本機資料與核對 | `get_line_local_messages`、受限歷史、字面搜尋、精確文字存在核對、TXT/JSON/CSV 匯出。 |
| 狀態與規劃 | `get_line_capabilities`、`get_line_status`、`prepare_line_workflow`、`get_line_workflow`。 |
| 聊天室與草稿 | 開啟指定聊天室、檢查畫面、讀取／設定／清除草稿、普通文字傳送、檔案挑選器暫存。 |
| 引用與訊息操作 | 引用來源核對、視覺確認、引用草稿、複製、翻譯、轉傳選擇。 |
| LINE 功能入口 | 搜尋、記事本、相簿、投票、媒體、檔案、連結、貼圖與附件入口；需要共享狀態變更的流程仍會要求額外確認。 |

`get_line_capabilities({})` 是安裝後最安全的第一個測試：它只列出 bridge 的
能力，不讀聊天室、不讀媒體、不操作 LINE，也不傳送訊息。已啟用 Windows
擴充時，預期結果含 `toolCount: 26`。

`get_line_status({})` 同樣不讀聊天室，但它只回傳 LINE build 與程序狀態。
其中的 `localReader` 不是 Python 套件、SQLite3MC DLL 雜湊或實際資料庫讀取
是否完備的總檢查；請依[安裝指南](quickstart-windows.md)完成完整環境驗證。

## 引用、草稿、傳送與使用者確認

普通文字回覆應先在 AI 客戶端顯示完整草稿，確認收件聊天室與內容後才送出。
`send_message_manual` 只把內容暫存在 LINE；`send_message_auto` 只能用在已明確
核准的聊天室與文字。送出回應不等於對方收到或已讀，結果不明時不得自動重送。

v3.0.0 的真正引用回覆需要完整 `source`（來源文字、發話者、日期、時間與
`sourceRef`）及短效、一次性的 `sourceToken`。token 綁定新鮮觀察到的像素、來源、
本機聊天室 reference 與 direct/group 類型；來源圖以回傳裁切圖的 `(0, 0)` 為
座標原點，內部只會轉換一次座標。Reply 後的 fallback 會重新驗證，且只回傳同一
聊天室的內容區與 composer，不含側欄。這個 token 代表呼叫端已目視核對目前畫面的
來源泡泡；它不是一般使用者授權 token，也不是送出許可。引用草稿建立後仍要在送出前
取得對目的地與內容的明確同意。

舊 GUI 歷史複製在回傳前會還原先前可取得的剪貼簿格式，但只在 helper 擁有的
sequence 沒變時執行；偵測到外部更新會保留新值並拒絕歷史結果。剪貼簿歷程或
observer 仍可能留下短暫複製內容，比對與還原之間也還有很小的競態窗口。

讀取時，使用者應命名聊天室及欲讀的範圍。MCP 會驗證工具參數與資料邊界，但
不會產生可攜的「讀取同意 token」。建立投票、反應、轉傳、上傳、收回、共享
內容或其他對外可見變更，都要在實際動作前針對精確目標與內容確認。

群組中的 `@名字` 純文字不等於 LINE 的藍色提及。若需要通知效果，必須在
LINE UI 中選取真正的成員 token，並在送出前後以新鮮畫面確認；本機紀錄或
純文字無法證明通知已送達。

## 大型本機資料庫（v3.0.0 後的修正）

包含 Issue #1 修正的版本改用分塊加密快照；資料庫預設上限為 2 GiB，WAL
為 256 MiB，合計 2304 MiB。初始化只讀驗證金鑰所需的 4 KiB 檔頭，取得
金鑰後才擷取一次完整的新快照，並重新驗證金鑰。快照仍檢查 DB／WAL 的
身分、時間、大小、雜湊及最後有效提交，不會寫入 LINE 原始資料庫。

`SOURCE_TOO_LARGE` 會回傳超限來源、實際／允許位元組及對應設定名稱。
縮小日期或訊息筆數不會縮小來源檔；不需要刪除聊天紀錄來使用修正版。
上限及五分鐘的預設讀取逾時都可在 MCP client 的環境設定中明確調整，
但保留硬上限。原始 v3.0.0 下載包尚未包含此修正與設定。

快照記憶體不再隨整份來源大小成長，但仍須掃過檔案做一致性檢查，且需要
容納加密副本的本機磁碟空間。子程序正常退出或逾時被強制結束後，父程序
會確認退出並清理該次固定名稱的暫存檔；整個 server 被強制關閉或斷電
仍可能留下加密暫存，沒有廣泛刪除的背景清理。
完整設定與錯誤說明見[大型資料庫設定](quickstart-windows.md#large-local-databases)。

## 依賴與平台邊界

本機讀取限定 Windows x64、已登入的 LINE Desktop 與隨附允許清單中的 build。
本版實測 LINE Desktop 26.4.2.3957；不在允許清單中的版本會回傳
`LINE_BUILD_UNVERIFIED`，不會勉強讀取。

讀取器需要明確設定：

| 設定 | 用途 |
| --- | --- |
| `LINE_MCP_PYTHON` | 指向 x64 venv 的絕對 `python.exe` 路徑。 |
| `LINE_MCP_SQLITE3MC_DLL` | 指向已雜湊驗證的 `sqlite3mc_x64.dll` 絕對路徑。 |
| `LINE_MCP_CUA_DRIVER` | GUI 工具使用的 CUA Driver 絕對 `.exe` 路徑。 |
| `LINE_MCP_AUTOHOTKEY` | 非標準 AutoHotkey v2 安裝時的絕對 `.exe` 覆寫路徑。 |

Python 讀取器需要 `cryptography>=43.0.0` 與 `Pillow>=10.0.0`，即使只讀
metadata 模式也一樣。SQLite3MC DLL 會在使用前重新核對固定 SHA-256。
指定聊天室的 Windows GUI 操作同時需要這些讀取器前置條件與 CUA Driver；保留的
五個 descriptor 不表示可在缺少它們時靜默相容執行。

AutoHotkey v2 的標準位置是
`C:\Program Files\AutoHotkey\v2\AutoHotkey64.exe`。GUI helper 不會從 PATH
或目前工作目錄尋找執行檔，而是以絕對路徑和 `shell: false` 啟動；它也以
`%SystemRoot%\System32\tasklist.exe` 做程序查詢。這些條件只會在實際 GUI
操作時檢查，安裝、能力列舉與 metadata 讀取不會自動安裝任何元件。

CUA Driver 使用公開 `.exe mcp` 的 stdio 介面，每次 GUI 操作後關閉控制
session；本專案不啟動常駐 daemon。OCR 走本機 Windows 元件，是否可用取決於
系統語言/OCR 安裝狀態。

## 傳輸、設定與升級

v3.2.0 只支援本機 stdio，沒有 HTTP 或 REST 伺服器。舊 HTTP 參數會在啟動前
被拒絕，不能把它當成仍有相同網路模式的升級。此版也不會從目前工作目錄自動
讀取 `.env`；請在 MCP client 的環境設定中明確傳入所有 `LINE_MCP_*` 值。v3.2.0
由同一個 GitHub repository 的 tag 發行，沒有 npm registry 或 MCPB 發行。

從 v1.2.0 或 v2.0.0 升級時，保留舊 checkout 與 MCP 設定備份，在同一台電腦以
sibling checkout 安裝 v3，然後把原本的 `line-desktop-mcp` MCP entry 改指向新版本。
各版共用 `~/.line-desktop-mcp/operation.lock`，正常工作時只能有一個 active bridge。
完整步驟、相容性差異與回退方法見[升級至 v3.2.0](MIGRATING.md#upgrading-to-v320)。
