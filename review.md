# SportBoard — 專案檢核文件 REVIEW.md

## 專案概述
運動社群平台，結合訓練計畫管理與社群互動功能。
使用者可在各運動專欄（籃球、羽球等）發文交流、
分享訓練菜單、記錄訓練紀錄、揪團參與運動活動。

---

## 資料庫 Schema 檢核

### 必要資料表（共 11 張）

#### USER
- user_id INT PK AUTO_INCREMENT
- username VARCHAR(16) NOT NULL UNIQUE
- password VARCHAR(255) NOT NULL
- email VARCHAR(255) NOT NULL UNIQUE
- bio TEXT
- profile_image VARCHAR(255)

#### BODYRECORD
- record_id INT PK AUTO_INCREMENT
- user_id INT FK → USER
- weight DECIMAL(5,2)
- height DECIMAL(5,2)
- body_fat DECIMAL(5,2)
- recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

#### SPORTBOARD
- board_id INT PK AUTO_INCREMENT
- sport_type VARCHAR(50) NOT NULL
- description TEXT
- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

#### WORKOUTPLAN
- plan_id INT PK AUTO_INCREMENT
- user_id INT FK → USER
- title VARCHAR(255) NOT NULL
- is_public BOOLEAN DEFAULT TRUE
- sport_type VARCHAR(50)
- difficulty_level ENUM('easy','medium','hard')
- exercise_name VARCHAR(50)
- muscle_group VARCHAR(50)
- sets INT
- reps INT
- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

#### WORKOUTSESSION
- session_id INT PK AUTO_INCREMENT
- user_id INT FK → USER
- plan_id INT FK → WORKOUTPLAN (nullable)
- notes TEXT
- start_time TIMESTAMP
- end_time TIMESTAMP

#### POST
- post_id INT PK AUTO_INCREMENT
- user_id INT FK → USER
- board_id INT FK → SPORTBOARD
- post_type VARCHAR(50)
- content TEXT
- image_url VARCHAR(255)
- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

#### COMMENT
- comment_id INT PK AUTO_INCREMENT
- user_id INT FK → USER
- post_id INT FK → POST
- content TEXT
- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

#### WORKOUTINVITATION
- invitation_id INT PK AUTO_INCREMENT
- user_id INT FK → USER
- board_id INT FK → SPORTBOARD
- title VARCHAR(255)
- location VARCHAR(255)
- event_time TIMESTAMP
- max_participants INT
- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

#### LIKES（關聯表）
- user_id INT FK → USER
- post_id INT FK → POST
- liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- PRIMARY KEY (user_id, post_id)

#### SAVES（關聯表）
- user_id INT FK → USER
- plan_id INT FK → WORKOUTPLAN
- saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- PRIMARY KEY (user_id, plan_id)

#### FOLLOWS（關聯表）
- follower_id INT FK → USER
- followee_id INT FK → USER
- followed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- PRIMARY KEY (follower_id, followee_id)

#### JOINS（關聯表）
- user_id INT FK → USER
- invitation_id INT FK → WORKOUTINVITATION
- status VARCHAR(20) DEFAULT 'pending'
- joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- PRIMARY KEY (user_id, invitation_id)

---

## ERD 關聯檢核

| Relation | 連接 | Cardinality |
|----------|------|-------------|
| Creates | USER → WORKOUTPLAN | 1:N |
| Performs | USER → WORKOUTSESSION | 1:N |
| Writes | USER → POST | 1:N |
| Writes | USER → COMMENT | 1:N |
| BelongsTo | POST → SPORTBOARD | N:1 |
| Has | POST → COMMENT | 1:N |
| Has | SPORTBOARD → WORKOUTPLAN | 1:N |
| BasedOn | WORKOUTSESSION → WORKOUTPLAN | N:1 |
| Likes | USER ↔ POST | M:N |
| Saves | USER ↔ WORKOUTPLAN | M:N |
| Follows | USER ↔ USER | M:N |
| Organizes | USER → WORKOUTINVITATION | 1:N |
| Joins | USER ↔ WORKOUTINVITATION | M:N |
| Records | USER → BODYRECORD | 1:N |

---

## API 檢核清單

### 用戶管理
- [ ] POST /api/users/register — 註冊（username, password, email）
- [ ] POST /api/users/login — 登入，回傳 user_id 和 username
- [ ] PUT /api/users/:id — 修改個人資料（bio, profile_image）
- [ ] POST /api/users/:id/bodyrecord — 新增身體數據
- [ ] GET /api/users/:id/bodyrecord — 查詢身體數據歷史（ORDER BY recorded_at DESC）
- [ ] POST /api/users/:id/follow — 追蹤用戶
- [ ] DELETE /api/users/:id/follow — 取消追蹤
- [ ] GET /api/users/:id/sessions — 取得用戶訓練紀錄

### 專欄
- [ ] GET /api/boards — 取得所有專欄
- [ ] GET /api/boards/:id/posts — 取得某專欄的貼文列表

### 貼文
- [ ] POST /api/posts — 建立貼文（user_id, board_id, post_type, content, image_url）
- [ ] GET /api/posts/:id — 取得貼文詳情
- [ ] DELETE /api/posts/:id — 刪除貼文（只能刪自己的）
- [ ] POST /api/posts/:id/like — 按讚
- [ ] DELETE /api/posts/:id/like — 取消按讚

### 留言
- [ ] POST /api/posts/:id/comments — 新增留言
- [ ] GET /api/posts/:id/comments — 取得所有留言
- [ ] DELETE /api/comments/:id — 刪除留言（只能刪自己的）

### 訓練計畫
- [ ] POST /api/workoutplans — 建立訓練計畫
- [ ] GET /api/workoutplans — 取得所有公開計畫
- [ ] GET /api/workoutplans/:id — 取得單一計畫詳情
- [ ] DELETE /api/workoutplans/:id — 刪除計畫（只能刪自己的）
- [ ] POST /api/workoutplans/:id/save — 收藏計畫
- [ ] DELETE /api/workoutplans/:id/save — 取消收藏

### 訓練紀錄
- [ ] POST /api/sessions — 建立訓練紀錄（user_id, plan_id, notes, start_time, end_time）

### 揪團
- [ ] POST /api/invitations — 建立揪團
- [ ] GET /api/invitations — 取得所有揪團
- [ ] POST /api/invitations/:id/join — 加入揪團
- [ ] DELETE /api/invitations/:id/join — 退出揪團

---

## 前端頁面檢核

### auth.html 登入/註冊
- [ ] 首頁有登入和註冊按鈕
- [ ] 登入成功後儲存 user_id 和 username 到 localStorage
- [ ] 登入成功後跳轉到首頁
- [ ] 註冊成功後跳轉到登入頁

### index.html 首頁
- [ ] 顯示所有運動專欄卡片
- [ ] 顯示最新貼文列表
- [ ] 右上角顯示登入用戶名稱
- [ ] 點擊專欄卡片跳轉到 board.html?id=X
- [ ] 未登入時顯示「登入/註冊」按鈕

### board.html 專欄頁面
- [ ] 從 URL 參數讀取 board_id
- [ ] 顯示專欄名稱和描述
- [ ] 三個分頁：貼文、計畫、揪團
- [ ] 貼文列表正常顯示
- [ ] 發文功能：user_id 從 localStorage 自動帶入（不顯示）
- [ ] 揪團功能：user_id 從 localStorage 自動帶入（不顯示）
- [ ] 未登入時禁止發文/揪團

### post.html 貼文詳情
- [ ] 顯示貼文內容
- [ ] 顯示按讚數
- [ ] 按讚/取消按讚功能
- [ ] 顯示留言列表
- [ ] 新增留言功能
- [ ] 刪除自己的留言

### workoutplan.html 訓練計畫
- [ ] 顯示計畫詳情（動作、組數、次數）
- [ ] 收藏/取消收藏按鈕
- [ ] 開始訓練紀錄按鈕

### profile.html 個人頁面
- [ ] 顯示個人資料（用戶名稱、自介、頭像）
- [ ] 身體數據列表（歷史紀錄）
- [ ] 新增身體數據表單
- [ ] 我的貼文列表
- [ ] 修改個人資料功能
- [ ] 登出功能（清除 localStorage）

---

## 技術規範檢核

- [ ] 後端使用原生 SQL（禁止 ORM / Sequelize / Mongoose）
- [ ] 所有 SQL 使用 `?` 參數化查詢（防 SQL Injection）
- [ ] API 統一回傳 JSON 格式
- [ ] 錯誤處理完整（try/catch + 回傳 error message）
- [ ] .env 不推上 GitHub
- [ ] node_modules 不推上 GitHub
- [ ] 前端用 fetch() 呼叫 API
- [ ] localStorage 儲存登入狀態（user_id, username）

---

## 已知問題（待修復）

- [ ] board.html 右上角登入狀態顯示
- [ ] board_id URL 參數傳遞
- [ ] 貼文/揪團表單 user_id 隱藏
- [ ] profile.html Cannot set properties of null 錯誤

---

## 使用方式

把這份文件放在專案根目錄，在 Claude Code 輸入：

```
請根據 REVIEW.md 檢核整個專案，列出哪些項目已完成、
哪些有 bug、哪些還沒實作，然後依序修復所有問題
```
