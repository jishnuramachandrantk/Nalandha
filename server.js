try { require('dotenv').config(); } catch (e) {}
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '/')));

// =========================================================================
// DATABASE CONNECTION CONFIGURATION (Aiven Cloud MySQL + Fallback)
// =========================================================================
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3307,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'defaultdb'
};

// Enable SSL when running on Cloud (Aiven)
if (process.env.DB_HOST) {
  dbConfig.ssl = {
    rejectUnauthorized: false
  };
}

const db = mysql.createPool(dbConfig);

// Test Database Connection
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database Connection Error:', err.message);
  } else {
    console.log('✅ Successfully connected to MySQL Cloud Database!');
    connection.release();
  }
});

// =========================================================================
// 1. BOOKS ENDPOINTS
// =========================================================================

// Get All Books
app.get('/api/books', (req, res) => {
  const query = 'SELECT * FROM books';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Add New Book
app.post('/api/books', (req, res) => {
  const { bookNumber, title, author, category } = req.body;
  const query = 'INSERT INTO books (bookNumber, title, author, category, assignedTo) VALUES (?, ?, ?, ?, NULL)';
  db.query(query, [bookNumber, title, author, category], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Book added successfully', id: result.insertId });
  });
});

// Delete Book
app.delete('/api/books/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM books WHERE id = ?';
  db.query(query, [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Book deleted successfully' });
  });
});

// =========================================================================
// 2. MEMBERS ENDPOINTS
// =========================================================================

// Get All Members
app.get('/api/members', (req, res) => {
  const query = 'SELECT * FROM members';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Register New Member
app.post('/api/members', (req, res) => {
  const { name, firstName, lastName, mobile, password, district, address } = req.body;
  const query = 'INSERT INTO members (name, firstName, lastName, mobile, password, district, address, status) VALUES (?, ?, ?, ?, ?, ?, ?, "Active")';
  db.query(query, [name, firstName, lastName, mobile, password, district, address], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Member registered successfully', id: result.insertId });
  });
});

// Member Login
app.post('/api/members/login', (req, res) => {
  const { firstName, password } = req.body;
  const query = 'SELECT * FROM members WHERE firstName = ? AND password = ?';
  db.query(query, [firstName, password], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) {
      res.json({ status: 'success', member: results[0] });
    } else {
      res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }
  });
});

// =========================================================================
// 3. BOOK ASSIGN / LOANS ENDPOINTS
// =========================================================================

// Assign Book to Member
app.post('/api/assign-book', (req, res) => {
  const { bookNumber, bookName, memberName, receivedDate, submittedDate } = req.body;
  
  const assignQuery = 'INSERT INTO book_assign (bookNumber, bookName, memberName, receivedDate, submittedDate, status) VALUES (?, ?, ?, ?, ?, "Pending")';
  const updateBookQuery = 'UPDATE books SET assignedTo = ? WHERE bookNumber = ?';

  db.query(assignQuery, [bookNumber, bookName, memberName, receivedDate, submittedDate], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.query(updateBookQuery, [memberName, bookNumber], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: updateErr.message });
      res.json({ message: 'Book assigned successfully' });
    });
  });
});

// Get Assigned Books History
app.get('/api/assigned-books', (req, res) => {
  const query = 'SELECT * FROM book_assign';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Return / Submit Assigned Book
app.post('/api/return-book', (req, res) => {
  const { bookNumber, id } = req.body;
  
  const updateAssignQuery = 'UPDATE book_assign SET status = "Returned" WHERE id = ?';
  const updateBookQuery = 'UPDATE books SET assignedTo = NULL WHERE bookNumber = ?';

  db.query(updateAssignQuery, [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.query(updateBookQuery, [bookNumber], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: updateErr.message });
      res.json({ message: 'Book returned successfully' });
    });
  });
});

// =========================================================================
// 4. PROGRAMS ENDPOINTS
// =========================================================================

// Get All Programs
app.get('/api/programs', (req, res) => {
  const query = 'SELECT * FROM programs';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Add Program
app.post('/api/programs', (req, res) => {
  const { title, event_date, description } = req.body;
  const query = 'INSERT INTO programs (title, event_date, description) VALUES (?, ?, ?)';
  db.query(query, [title, event_date, description], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Program added successfully', id: result.insertId });
  });
});

// =========================================================================
// 5. FINANCE ENDPOINTS
// =========================================================================

// Get Finance Entries
app.get('/api/finances', (req, res) => {
  const query = 'SELECT * FROM finance_entries';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Add Finance Entry
app.post('/api/finances', (req, res) => {
  const { financial_year, type, category, april, may, june, july, aug, sep, oct, nov, dec_val, jan, feb, march } = req.body;
  const query = `INSERT INTO finance_entries 
    (financial_year, type, category, april, may, june, july, aug, sep, oct, nov, dec_val, jan, feb, march) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.query(query, [financial_year, type, category, april || 0, may || 0, june || 0, july || 0, aug || 0, sep || 0, oct || 0, nov || 0, dec_val || 0, jan || 0, feb || 0, march || 0], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Finance entry recorded successfully', id: result.insertId });
  });
});

// =========================================================================
// START SERVER
// =========================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
