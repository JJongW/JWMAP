const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const pool = require('./db'); // MySQL 연결 설정

const app = express();
app.use(cors());// CORS 미들웨어 사용
app.use(express.json()); // JSON 요청 본문 파싱

// 'uploads' 폴더를 정적 파일로 제공
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Multer 설정
const storage = multer.memoryStorage(); // 메모리 저장소로 설정 (sharp에서 처리 후 저장)
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB로 제한
});

app.get('/', (req, res) => {
  res.send('Server is running!'); // 간단한 응답 메시지
});

// 이미지 업로드 및 리사이징 API
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '파일이 업로드되지 않았습니다.' });
    }

    // 원본 파일 이름과 경로 생성
    const originalName = req.file.originalname;
    const fileName = `${Date.now()}-${originalName}`;
    const outputPath = path.join(__dirname, 'uploads', fileName);

    // 이미지 리사이징 및 저장
    await sharp(req.file.buffer) // 메모리에서 받은 파일 버퍼
      .resize(800) // 최대 가로 크기 800px로 리사이징 (세로는 비율 유지)
      .jpg({ quality: 80 }) // JPEG 포맷으로 압축 (품질 80%)
      .toFile(outputPath); // 파일 저장

    const fileUrl = `/uploads/${fileName}`;
    res.json({ imageUrl: fileUrl });
  } catch (error) {
    console.error('Image processing error:', error);
    res.status(500).json({ message: '이미지 처리 중 오류가 발생했습니다.' });
  }
});

// GET: 모든 장소 가져오기
app.get('/api/locations', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM locations');
    res.json(rows); // 데이터를 JSON 형식으로 반환
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST: 새로운 장소 추가
app.post('/api/locations', async (req, res) => {
  const { name, region, category, address, lon, lat, rating, imageUrl, memo } = req.body;

  if (!name || !region || !category || !address) {
    return res.status(400).json({ message: 'Required fields are missing' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO locations (name, region, category, address, lon, lat, rating, imageUrl, memo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, region, category, address, lon, lat, rating, imageUrl, memo]
    );

    const [newLocation] = await pool.query('SELECT * FROM locations WHERE id = ?', [result.insertId]);
    res.status(201).json(newLocation[0]); // 새로 추가된 장소 반환
  } catch (error) {
    console.error('Error adding location:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT: 특정 장소 업데이트
app.put('/api/locations/:id', async (req, res) => {
  const { id } = req.params;
  const { rating, imageUrl, category, memo } = req.body;

  if (rating === undefined || !imageUrl || !category) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE locations SET rating = ?, imageUrl = ?, category = ?, memo = ? WHERE id = ?',
      [rating, imageUrl, category, memo, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Location not found' });
    }

    const [updatedLocation] = await pool.query('SELECT * FROM locations WHERE id = ?', [id]);
    res.json(updatedLocation[0]); // 업데이트된 장소 반환
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE: 특정 장소 삭제
app.delete('/api/locations/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query('DELETE FROM locations WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Location not found' });
    }

    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 서버 실행
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Database Config:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
});
