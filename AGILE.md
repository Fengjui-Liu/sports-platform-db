# 開發方法：Kanban + GitHub Flow

本專案採用 Kanban 管理開發工作，將功能拆成可追蹤的小任務，依序經過 To Do、In Progress、Review、Done。版本控制流程採 GitHub Flow：每個功能或修正由分支開發，完成後透過 Pull Request 檢查與合併，維持主線穩定。

## Sprint 紀錄

以下依 git log 的 commit 歷史，將專案開發整理成五個迭代階段。

### 1. 核心資料庫與基本功能

此階段建立專案雛形、後端 API、使用者管理、身體數據與基礎資料庫結構，完成專案可執行的核心骨架。

### 2. 社群互動功能（按讚、留言、收藏）

此階段加入專欄、發文、留言、按讚、收藏、追蹤等社群互動能力，並逐步補齊前端互動與 API 串接。

### 3. 揪團與地圖功能

此階段加入運動揪團、地理位置欄位、LBS schema、地圖顯示與地址搜尋定位，支援更完整的線下活動流程。

### 4. UI 重構（Bootstrap）

此階段調整前端版面、導入 Bootstrap Icons、優化側欄與動態欄位，提升介面一致性與操作體驗。

### 5. Bug 修復與優化

此階段集中修正前端顯示、資料庫索引、登入狀態、schema 整合、UI 動畫與其他 UX 細節。

## 持續交付證據

### 1. 核心資料庫與基本功能

| Commit | 說明 |
| --- | --- |
| `5ddbfe3` | Initial commit，建立專案起點 |
| `9014b58` | 完成用戶管理 API，包含註冊、登入與修改個人資料 |
| `3aa4b41` | 完成身體數據 API |
| `d84683a` | 建立專案雛形與基本架構 |
| `b20a72d` | 同步資料庫結構 |
| `2bc2957` | 完成功能測試，確認核心功能可運作 |

### 2. 社群互動功能（按讚、留言、收藏）

| Commit | 說明 |
| --- | --- |
| `fec3706` | 新增專欄與發文功能 |
| `4da984a` | 補強專欄及發文功能 |
| `d82cbf7` | 專欄、首頁介面與發文流程調整 |
| `b1376a7` | 實作 Feed 按讚 optimistic UI，強化互動回饋 |
| `089c823` | 社群功能強化、Bug 修復與 UX 改善 |
| `0b28d1a` | 新增追蹤名單顯示 |

### 3. 揪團與地圖功能

| Commit | 說明 |
| --- | --- |
| `f17d17e` | 加入地圖功能 |
| `b1376a7` | 加入 LBS schema updates |
| `1fb9370` | 首頁顯示揪團動態，並加入揪團地址搜尋自動定位 |
| `f3d0c9d` | 修復 initDb 建立索引流程，避免 foreign key 衝突 |

### 4. UI 重構（Bootstrap）

| Commit | 說明 |
| --- | --- |
| `918d731` | 前端功能及介面調整 |
| `32b2fb0` | UI 顯示優化 |
| `d08c5f2` | 移除 Hero Banner、整合 migration，修復上傳與登入顯示 |
| `bdadca7` | 導入 Bootstrap Icons 側欄、訓練計畫動態欄位與新欄位支援 |
| `f2708b7` | 訓練計畫頁面新增分享圖片功能 |

### 5. Bug 修復與優化

| Commit | 說明 |
| --- | --- |
| `423f485` | 修復 board_id 傳遞與隱藏 post_type 欄位 |
| `34163c4` | 修復 app.js 語法錯誤與 requireCurrentUser 邏輯 |
| `c1eae49` | 修復 profile page null property error，加入 DOM load checks |
| `64d698d` | 前端 bug 修正 |
| `de9bd81` | 前端功能新增和顯示修正 |
| `8b02b91` | 新增 UI 動畫：卡片 hover、Feed 淡入、按讚彈跳、側欄指示條 |
| `e872b03` | 移除 hover media query，hover 效果直接套用 |

## 技術實踐

- 禁止直接 push main：功能開發需透過 feature branch，完成後再 merge，降低主線被未完成程式破壞的風險。
- GitHub Flow：以短生命週期分支支援快速開發、Review 與合併，符合持續交付節奏。
- `initDb.js` 自動化 migration：啟動後端時自動補齊資料表、欄位、索引與 trigger，體現 DevOps 中自動化環境建置與資料庫演進概念。
- Optimistic UI：按讚、收藏等互動先更新前端畫面，再呼叫 API，符合快速回饋原則，提升使用者操作體驗。
- Kanban 任務流：將需求拆分成小批次功能，讓開發、修正、測試與交付狀態可視化。
