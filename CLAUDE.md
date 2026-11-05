# Claude 接手入口

@AGENTS.md

開始工作前，請完整讀取並遵循 [AGENTS.md](AGENTS.md)。這是使用者要求 Claude 與 Codex 共用的常駐工作流程。

接著讀取：

1. [目前架構與產品交接](docs/ai-handoff.md)
2. [任務索引與最新遠端交接的查找方法](docs/handoffs/README.md)
3. 與本次需求相符的任務文件，以及 `handoff/*` 的較新 checkpoint。

**提出修改方向後、改動應用程式之前，必須先保存一份 GitHub handoff checkpoint。** 具體命令和既有授權範圍見 AGENTS.md。不要只依賴 Claude 對話或先前 Session 的剩餘額度；未執行或未確認成功的推送，不算交接完成。

如果工具不會自動讀取這個檔案，請使用者提供 AGENTS.md 或 docs/ai-handoff.md 的 GitHub 連結作為入口。
