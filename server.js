require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const app = express();
const port = process.env.PORT || 5500;

// Middleware setup
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Database connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Pedroalaim12',
  database: process.env.DB_NAME || 'sandra',
  authPlugins: {
    mysql_native_password: () => require('mysql2/lib/auth/mysql_native_password')
  },
  connectTimeout: 10000
});

// Connect to database
db.connect(err => {
  if (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL database');
  
  // Create table if not exists
  db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      id_number VARCHAR(20) NOT NULL UNIQUE,
      gender ENUM('Male','Female','Other') NOT NULL,
      age INT NOT NULL,
      reg_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `, (err) => {
    if (err) {
      console.error('Table creation error:', err);
    } else {
      console.log('Users table ready');
    }
  });
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Registration endpoint
app.post('/register', (req, res) => {
  const { name, id_number, gender, age } = req.body;
  
  // Validation
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Name must be at least 2 characters' });
  }
  if (!id_number || id_number.trim().length < 3) {
    return res.status(400).json({ error: 'ID number is required' });
  }
  if (!['Male', 'Female', 'Other'].includes(gender)) {
    return res.status(400).json({ error: 'Invalid gender selection' });
  }
  const ageNum = parseInt(age);
  if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
    return res.status(400).json({ error: 'Age must be between 1 and 120' });
  }
  
  const sql = 'INSERT INTO users (name, id_number, gender, age) VALUES (?, ?, ?, ?)';
  
  db.query(sql, [name.trim(), id_number.trim(), gender, ageNum], (err, result) => {
    if (err) {
      console.error('Registration error:', err);
      
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'ID number already exists' });
      }
      
      return res.status(500).json({ 
        error: 'Registration failed',
        details: err.message
      });
    }
    res.json({ success: true, id: result.insertId });
  });
});

// Get users endpoint with search
app.get('/users', (req, res) => {
  const search = req.query.search || '';
  const searchTerm = `%${search}%`;
  
  let sql = 'SELECT * FROM users';
  let params = [];
  
  if (search) {
    sql += ' WHERE name LIKE ? OR id_number LIKE ?';
    params = [searchTerm, searchTerm];
  }
  
  sql += ' ORDER BY reg_date DESC';
  
  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Fetch users error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// Update user endpoint
app.put('/user/:id', (req, res) => {
  const id = req.params.id;
  const { name, gender, age } = req.body;
  
  // Validation
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Name must be at least 2 characters' });
  }
  if (!['Male', 'Female', 'Other'].includes(gender)) {
    return res.status(400).json({ error: 'Invalid gender selection' });
  }
  const ageNum = parseInt(age);
  if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
    return res.status(400).json({ error: 'Age must be between 1 and 120' });
  }
  
  const sql = 'UPDATE users SET name = ?, gender = ?, age = ? WHERE id = ?';
  
  db.query(sql, [name.trim(), gender, ageNum, id], (err, result) => {
    if (err) {
      console.error('Update error:', err);
      return res.status(500).json({ 
        error: 'Update failed',
        details: err.message
      });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true });
  });
});

// Delete user endpoint
app.delete('/user/:id', (req, res) => {
  const id = req.params.id;
  
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  db.query('DELETE FROM users WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Delete error:', err);
      return res.status(500).json({ error: 'Delete failed' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true });
  });
});

// Export to CSV endpoint
app.get('/export', (req, res) => {
  const sql = 'SELECT * FROM users ORDER BY reg_date DESC';
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Export error:', err);
      return res.status(500).json({ error: 'Export failed' });
    }
    
    // Create CSV content
    let csv = 'ID,Name,ID Number,Gender,Age,Registration Date\n';
    
    results.forEach(user => {
      const regDate = new Date(user.reg_date).toISOString();
      csv += `"${user.id}","${user.name}","${user.id_number}","${user.gender}","${user.age}","${regDate}"\n`;
    });
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users_export.csv');
    res.send(csv);
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});