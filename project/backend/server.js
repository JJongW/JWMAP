const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const pool = require('./db'); // MySQL 연결 설정

const app = express();
app.use(cors());
app.use(express.json()); // JSON 요청 본문 파싱

// 'uploads' 폴더를 정적 파일로 제공
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // 업로드된 파일을 저장할 폴더
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`); // 고유한 파일 이름 생성
  },
});
const upload = multer({ storage });


app.get('/', (req, res) => {
  res.send('Server is running!'); // 간단한 응답 메시지
});

// 파일 업로드 API
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    const filePath = `/uploads/${req.file.filename}`;
    res.json({ imageUrl: filePath }); // 업로드된 이미지의 URL 반환
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ message: 'File upload failed' });
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
