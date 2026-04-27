# 🏃 Sports Platform DB

政治大學 DBMS 課程期末專案 — 運動社群平台資料庫系統

---

## 專案簡介

本系統為一個運動社群平台，結合訓練計畫管理與社群互動功能。
使用者可以在各運動專欄（如籃球、羽球）上發文交流、分享訓練菜單、記錄個人訓練紀錄，並揪團參與運動活動。

---

## 🛠 Tech Stack

| 層級 | 技術 |
|------|------|
| 資料庫 | MySQL |
| 後端 | Node.js + Express.js |
| 前端 | HTML + CSS + Vanilla JS |
| 版本控制 | GitHub |

---

## 🚀 快速開始

### 1. Clone 專案

```bash
git clone https://github.com/Fengjui-Liu/sports-platform-db.git
cd sports-platform-db
```

### 2. 安裝後端套件

```bash
cd backend
npm install
```

### 3. 建立 .env

在 `backend/` 底下建立 `.env`：
DB_HOST=localhost
DB_USER=你的資料庫帳號
DB_PASSWORD=你的資料庫密碼
DB_NAME=sports_platform
PORT=3000
> ⚠️ 每個人的 DB_USER、DB_PASSWORD 可以不同，.env 不要推上 GitHub

### 4. 建立資料庫與資料表

先在 MySQL 建立資料庫：

```sql
CREATE DATABASE sports_platform;
```

然後匯入 schema：

```bash
mysql -u root -p sports_platform < backend/schema.sql
```

### 5. 啟動專案

```bash
cd backend
node server.js
```

打開瀏覽器：
- http://localhost:3000/
- http://localhost:3000/api/boards

---

## 👥 協作流程

### 第一次加入專案
1. 確認已收到 GitHub Collaborator 邀請並接受
2. Clone 專案（用上面的指令）
3. 建立自己的 `.env`

### 每次開發新功能

```bash
# 1. 先拉最新版本
git checkout main
git pull origin main

# 2. 建立自己的功能分支
git checkout -b feature/你的名字-功能名稱

# 3. 改完後提交
git add .
git commit -m "feat: 完成某功能"
git push origin feature/你的名字-功能名稱
```

然後到 GitHub 開 Pull Request，合回 main。

### 同步最新版本

```bash
git checkout main
git pull origin main
```

---

## 📁 專案結構sports-platform-db/
├── backend/
│   ├── routes/          # API 路由
│   │   ├── user.js
│   │   ├── bodyrecord.js
│   │   └── ...
│   ├── db.js            # MySQL 連線
│   ├── server.js        # 入口
│   ├── schema.sql       # 資料庫建表 SQL
│   ├── .env.example     # 環境變數範例
│   └── package.json
├── frontend/            # 前端頁面
│   ├── index.html
│   └── ...
├── docs/                # 文件
│   └── ERD.drawio
├── SPEC.md
└── README.md
---

## 📡 API 列表

### 用戶管理
| Method | Path | 說明 |
|--------|------|------|
| POST | /api/users/register | 註冊 |
| POST | /api/users/login | 登入 |
| PUT | /api/users/:id | 修改個人資料 |
| POST | /api/users/:id/bodyrecord | 新增身體數據 |
| GET | /api/users/:id/bodyrecord | 查詢身體數據歷史 |

### 專欄
| Method | Path | 說明 |
|--------|------|------|
| GET | /api/boards | 取得所有專欄 |
| GET | /api/boards/:id/posts | 取得專欄貼文 |

### 貼文
| Method | Path | 說明 |
|--------|------|------|
| POST | /api/posts | 建立貼文 |
| GET | /api/posts/:id | 取得貼文詳情 |
| DELETE | /api/posts/:id | 刪除貼文 |
| POST | /api/posts/:id/like | 按讚 |
| DELETE | /api/posts/:id/like | 取消按讚 |

### 留言
| Method | Path | 說明 |
|--------|------|------|
| POST | /api/posts/:id/comments | 新增留言 |
| GET | /api/posts/:id/comments | 取得所有留言 |
| DELETE | /api/comments/:id | 刪除留言 |

### 訓練計畫
| Method | Path | 說明 |
|--------|------|------|
| POST | /api/workoutplans | 建立訓練計畫 |
| GET | /api/workoutplans | 取得所有公開計畫 |
| GET | /api/workoutplans/:id | 取得單一計畫 |
| DELETE | /api/workoutplans/:id | 刪除計畫 |
| POST | /api/workoutplans/:id/save | 收藏計畫 |
| DELETE | /api/workoutplans/:id/save | 取消收藏 |

### 訓練紀錄
| Method | Path | 說明 |
|--------|------|------|
| POST | /api/sessions | 建立訓練紀錄 |
| GET | /api/users/:id/sessions | 取得用戶訓練紀錄 |

### 揪團
| Method | Path | 說明 |
|--------|------|------|
| POST | /api/invitations | 建立揪團 |
| GET | /api/invitations | 取得所有揪團 |
| POST | /api/invitations/:id/join | 加入揪團 |
| DELETE | /api/invitations/:id/join | 退出揪團 |

### 追蹤
| Method | Path | 說明 |
|--------|------|------|
| POST | /api/users/:id/follow | 追蹤用戶 |
| DELETE | /api/users/:id/follow | 取消追蹤 |

---

## 👨‍💻 開發團隊
