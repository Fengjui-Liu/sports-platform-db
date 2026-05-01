# Sports Platform Database Project

## Tech Stack
- Backend: Node.js + Express.js 
- Database: MySQL
- Package: mysql2 (原生 SQL，禁止使用 ORM)

## Database Schema

### USER
- user_id (PK, INT, AUTO_INCREMENT)
- username (VARCHAR(16), UNIQUE)
- password (VARCHAR(255))
- email (VARCHAR(255), UNIQUE)
- bio (TEXT)
- profile_image (VARCHAR(255))

### BODYRECORD
- record_id (PK, INT, AUTO_INCREMENT)
- user_id (FK → USER)
- weight (DECIMAL(5,2))
- height (DECIMAL(5,2))
- body_fat (DECIMAL(5,2))
- recorded_at (TIMESTAMP)

### SPORTBOARD
- board_id (PK, INT, AUTO_INCREMENT)
- sport_type (VARCHAR(50))
- description (TEXT)
- created_at (TIMESTAMP)

### WORKOUTPLAN
- plan_id (PK, INT, AUTO_INCREMENT)
- user_id (FK → USER)
- title (VARCHAR(255))
- is_public (BOOLEAN)
- sport_type (VARCHAR(50))
- difficulty_level (ENUM: easy, medium, hard)
- exercise_name (VARCHAR(50))
- muscle_group (VARCHAR(50))
- reps (INT)
- sets (INT)
- created_at (TIMESTAMP)

### WORKOUTSESSION
- session_id (PK, INT, AUTO_INCREMENT)
- user_id (FK → USER)
- plan_id (FK → WORKOUTPLAN)
- notes (TEXT)
- start_time (TIMESTAMP)
- end_time (TIMESTAMP)

### POST
- post_id (PK, INT, AUTO_INCREMENT)
- user_id (FK → USER)
- board_id (FK → SPORTBOARD)
- post_type (VARCHAR(50))
- content (TEXT)
- image_url (VARCHAR(255))
- created_at (TIMESTAMP)

### COMMENT
- comment_id (PK, INT, AUTO_INCREMENT)
- user_id (FK → USER)
- post_id (FK → POST)
- content (TEXT)
- created_at (TIMESTAMP)

### WORKOUTINVITATION
- invitation_id (PK, INT, AUTO_INCREMENT)
- user_id (FK → USER)
- board_id (FK → SPORTBOARD)
- title (VARCHAR(255))
- location (VARCHAR(255))
- event_time (TIMESTAMP)
- max_participants (INT)
- created_at (TIMESTAMP)

## API Routes已完成
- POST /api/users/register ✅
- POST /api/users/login ✅
- PUT /api/users/:id ✅

## API Routes待完成
- POST /api/users/:id/bodyrecord
- GET /api/users/:id/bodyrecord
- GET /api/boards
- POST /api/posts/create
- GET /api/posts/:id
- POST /api/posts/:id/comment
- POST /api/posts/:id/like
- GET /api/workoutplans
- POST /api/workoutplans/create
- POST /api/sessions/create
- POST /api/invitations/create
- POST /api/invitations/:id/join
