# 精簡筆記與 PDF 補件流程（已確認發布）

對應 [任務交接](../../handoffs/2026-11-06-concise-import-notes.md)。已隨 0afb5fb 併入 main／部署，正式站複製按鈕與精簡匯入筆記已實測；圖片為虛構資料的 Chromium 截圖。

- [short-note.png](short-note.png)：筆記僅含三個行動短項，來源與查核記錄沒有混入。
- [pdf-instructions.png](pdf-instructions.png)：Gmail 附件讀不到時，直接把原始 PDF 上傳到同一外部 AI 對話。
- [prompt-example.txt](prompt-example.txt)：可直接複製給外部 AI 的新版提示詞範例，旅程日期可自行調整。由 importPrompt 產生，沒有私人訂單資訊。

筆記以最多三項為原則，不硬截斷重要限制、不改寫既有手動長筆記。根層 review 是外部 AI 對話的核對區，現有 App 不匯入或顯示它。Gmail 拒絕存取機票、座位仍缺漏時，提示詞要求先補上 PDF 再產生最終 JSON；真正讀完仍無座位才標示未載明。

測試只驗證提示詞文字與虛構 JSON → App 的資料流程，沒有執行外部 AI 或讀取真實 PDF；不能宣稱已驗證任何服務的附件權限。舊的長筆記不會自動變短，需重新產生、確認後再處理。
