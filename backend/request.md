# Sports Platform - 完整開發需求

## 專案結構
sports-platform-db/
├── backend/          # 已存在
│   ├── routes/       # 已存在
│   ├── db.js         # 已存在
│   └── server.js     # 已存在
└── frontend/         # 需要新建
├── index.html
├── css/
└── js/
## Tech Stack
- Backend: Node.js + Express.js + mysql2（原生 SQL，禁止 ORM）
- Frontend: HTML + CSS + Vanilla JS（不用框架）
- Database: MySQL

## 已完成 API
- POST /api/users/register ✅
- POST /api/users/login ✅
- PUT /api/users/:id ✅
- POST /api/users/:id/bodyrecord ✅
- GET /api/users/:id/bodyrecord ✅

## 需要完成的後端 API

### SportBoard 專欄
- GET /api/boards — 取得所有專欄
- GET /api/boards/:id/posts — 取得某專欄的所有貼文

### Post 貼文
- POST /api/posts — 建立貼文 { user_id, board_id, post_type, content, image_url }
- GET /api/posts/:id — 取得貼文詳情
- DELETE /api/posts/:id — 刪除貼文

### Comment 留言
- POST /api/posts/:id/comments — 新增留言 { user_id, content }
- GET /api/posts/:id/comments — 取得所有留言
- DELETE /api/comments/:id — 刪除留言

### Likes 按讚
- POST /api/posts/:id/like — 按讚 { user_id }
- DELETE /api/posts/:id/like — 取消按讚 { user_id }

### WorkoutPlan 訓練計畫
- POST /api/workoutplans — 建立訓練計畫
- GET /api/workoutplans — 取得所有公開訓練計畫
- GET /api/workoutplans/:id — 取得單一訓練計畫
- DELETE /api/workoutplans/:id — 刪除訓練計畫
- POST /api/workoutplans/:id/save — 收藏計畫 { user_id }
- DELETE /api/workoutplans/:id/save — 取消收藏 { user_id }

### WorkoutSession 訓練紀錄
- POST /api/sessions — 建立訓練紀錄 { user_id, plan_id, notes, start_time, end_time }
- GET /api/users/:id/sessions — 取得用戶所有訓練紀錄

### WorkoutInvitation 揪團
- POST /api/invitations — 建立揪團 { user_id, board_id, title, location, event_time, max_participants }
- GET /api/invitations — 取得所有揪團
- POST /api/invitations/:id/join — 加入揪團 { user_id }
- DELETE /api/invitations/:id/join — 退出揪團 { user_id }

### Follow 追蹤
- POST /api/users/:id/follow — 追蹤用戶 { follower_id }
- DELETE /api/users/:id/follow — 取消追蹤 { follower_id }

## 需要完成的前端頁面

### 1. 首頁 index.html
- 顯示所有運動專欄卡片
- 顯示最新貼文列表
- 導覽列：首頁、專欄、登入/註冊

### 2. 專欄頁面 board.html
- 顯示專欄名稱和描述
- 貼文列表（含按讚數、留言數）
- 分頁：貼文、訓練計畫、揪團

### 3. 貼文頁面 post.html
- 貼文內容
- 按讚按鈕
- 留言列表
- 新增留言輸入框

### 4. 訓練計畫頁面 workoutplan.html
- 計畫詳情（動作清單）
- 收藏按鈕
- 開始訓練按鈕

### 5. 個人頁面 profile.html
- 個人資料
- 身體數據圖表（折線圖）
- 我的貼文、訓練紀錄、收藏計畫

### 6. 登入/註冊頁面 auth.html
- 登入表單
- 註冊表單切換

## 前端設計風格
- 淺色系，類似 Dcard 風格
- 主色：深藍 #213b99
- 背景：淡灰 #f7f7f7
- 卡片：白色帶圓角陰影
- 字體：系統預設 sans-serif
- RWD：支援網頁版

## Database Schema
（參考 SPEC.md）

## 注意事項
- 後端禁止使用 ORM
- 前端用原生 JS，不用框架
- API 統一回傳 JSON
- 錯誤處理要完整
- 前端用 fetch() 呼叫 API
