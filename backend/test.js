require('dotenv').config();
const mysql = require('mysql2');

console.log("🔍 正在讀取 .env 檔案...");
console.log("▶️ DB_HOST:", process.env.DB_HOST);
console.log("▶️ DB_USER:", process.env.DB_USER);
console.log("▶️ DB_NAME:", process.env.DB_NAME);
// 故意不印出密碼，保護隱私

const connection = mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'sports_platform',
  port: 3306 
});

console.log("⏳ 嘗試連線到資料庫中...");

connection.connect((err) => {
  if (err) {
    console.error('\n❌ 抓到兇手了！連線失敗詳細原因：\n', err);
    process.exit(1);
  }
  console.log('\n🎉 太棒了！其實資料庫連線是成功的！');
  connection.end();
});