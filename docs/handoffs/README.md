# 任務交接索引

這裡保存每個需求的計畫與接續狀態。架構與不應改壞的行為放在 [長期交接](../ai-handoff.md)，常駐操作流程在 [AGENTS.md](../../AGENTS.md)。

## 已併入／本次任務

| 任務 | 文件 | 狀態 |
| --- | --- | --- |
| AI 匯入重複行程忽略／覆蓋 | [2026-11-08-import-ignore-overwrite.md](2026-11-08-import-ignore-overwrite.md) | awaiting_review；本機驗證通過，未推程式／未部署 |
| 聯網自動收集天氣／車站／景點 | [2026-11-07-online-travel-info.md](2026-11-07-online-travel-info.md) | completed；已部署並驗證正式站真實 API／離線重載 |
| 重新設計八類型複製提示詞架構 | [2026-11-07-import-prompt-framework.md](2026-11-07-import-prompt-framework.md) | completed；已部署並實測正式站複製與八類匯入 |
| 設備時間地標四時段背景＋欄位參考 | [2026-11-06-destination-day-period.md](2026-11-06-destination-day-period.md) | completed；已部署並實測設備時間更新 |
| 精簡匯入筆記與外部 AI PDF 補件 | [2026-11-06-concise-import-notes.md](2026-11-06-concise-import-notes.md) | completed；已部署並驗證正式站複製按鈕 |
| 發布全部已確認介面 | [2026-11-06-release-approved-ui.md](2026-11-06-release-approved-ui.md) | completed；Vercel 與正式站已驗證 |
| 訂單狀態位於卡片右上角 | [2026-11-06-card-booking-corner.md](2026-11-06-card-booking-corner.md) | completed；已併入 main／部署 |
| D 方案文字底線檢視切換 | [2026-11-06-compact-view-switch.md](2026-11-06-compact-view-switch.md) | completed；已併入 main／部署 |
| 行程小插圖與六款目的地地標頁首 | [2026-11-06-itinerary-art-destinations.md](2026-11-06-itinerary-art-destinations.md) | completed；已併入 main／部署 |
| 底部工具列黃底包含文字 | [2026-11-06-bottom-nav-highlight.md](2026-11-06-bottom-nav-highlight.md) | completed；已併入 main／部署 |
| 航廈 T 標示與 PDF 訂位資訊提示詞 | [2026-11-06-flight-terminal-pdf.md](2026-11-06-flight-terminal-pdf.md) | completed；已併入 main／部署 |
| 建立跨 AI 交接與修改前 checkpoint | [2026-11-06-ai-continuity.md](2026-11-06-ai-continuity.md) | 依文件內最新狀態判斷 |
| 匯出 Claude Design 畫布原始檔到 docs/design | [2026-11-06-design-source-export.md](2026-11-06-design-source-export.md) | completed |

新任務複製 [TEMPLATE.md](TEMPLATE.md)，使用 `YYYY-MM-DD-english-task-slug.md` 檔名。每份文件只追蹤一個需求，改方向或恢復工作時更新原文件，保留重要決策。

## 修改前保存

```bash
python3 scripts/publish-handoff.py docs/handoffs/2026-11-06-example-task.md --dry-run
python3 scripts/publish-handoff.py docs/handoffs/2026-11-06-example-task.md
```

第一個命令可先檢查產生的基準、路徑及分支；第二個才會推送。實際執行時換成已填好的文件路徑，不要推範本。

工具需要 Python 3.10+ 與 Git（無額外 Python 套件）。

工具會：

- fetch 遠端 main 作為基準，用臨時 Git index 建立只有指定 Markdown 的 commit。
- 建立新的 `handoff/<文件名稱>-<UTC時間戳>` 分支並推送，讀回遠端 SHA 確認。
- 保留目前分支、工作檔與原本 staged index；不把其他未審核修改一起提交。
- 不自動合併、不 force-push。草稿分支可能被 Vercel 建成預覽；正式 main 的發布規則不因此改變。

分支時間戳使用 UTC 供唯一識別；文件內的人類日期使用 Asia/Taipei。`already_on_main` 表示相同文件內容已在剛 fetch 的 main 中；確認文件仍符合本次需求後可繼續。`dry_run` 只在本機建立 Git objects，不代表已推送。

## 換 AI 時找最新 checkpoint

main 內的文件可能落後於進行中的草稿，不能只讀這個索引。

```bash
git ls-remote --heads origin 'refs/heads/handoff/*'
git fetch origin 'refs/heads/handoff/*:refs/remotes/origin/handoff/*'
git for-each-ref --sort=-committerdate --format='%(refname:short) %(objectname) %(subject)' refs/remotes/origin/handoff/
```

從清單找與使用者需求相符的任務，使用實際 ref 與路徑讀文件，例如：

```bash
git show origin/handoff/ACTUAL-BRANCH:docs/handoffs/ACTUAL-TASK.md
```

不要原樣執行含 `ACTUAL-...` 的範例。比較該任務各 checkpoint 的狀態、基準和內容，不能把其他任務「時間較新」當成這次任務。也不能因為 checkpoint 的 parent 是 main，就認為目前工作區已同步或進行中程式已在遠端。

## 交棒時必填

1. 最新計畫，以及使用者已確認／尚未確認的項目。
2. 已改檔案、儲存狀態、實際分支與 commit SHA。
3. 測試通過、失敗、未跑；截圖位置是否已進 GitHub。
4. 未完成工作、具體阻礙、接手後第一步。
5. 程式是否只存在舊工作區；若尚未推送，不能宣稱文件能恢復程式。

已達額度上限的 AI 不一定還能執行交接；前置計畫與階段更新用來降低這個風險，不能保證服務的額度或背景自動保存。
