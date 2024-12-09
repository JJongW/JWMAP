const mysql = require('mysql2/promise');
require('dotenv').config(); // .env 파일에서 환경 변수 로드

// MySQL 연결 풀 생성
const pool = mysql.createPool({
  host: process.env.DB_HOST || '3.141.4.145',       // MySQL 호스트
  user: process.env.DB_USER || 'jw',           // MySQL 사용자 이름
  password: process.env.DB_PASSWORD || '', // MySQL 비밀번호
  database: process.env.DB_NAME || 'location_db', // 데이터베이스 이름
  waitForConnections: true,
  connectionLimit: 10, // 연결 제한
  queueLimit: 0,
});

module.exports = pool;
