const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// =========================================================================
// MYSQL DATABASE CONNECTION CONFIGURATION
// =========================================================================
const db = mysql.createConnection({
  host: '127.0.0.1',
  port: 3307,            // MySQL Workbench Port
  user: 'root',          // MySQL Username
  password: 'Pass@100100', // MySQL Password
  database: 'Nalandha'   // Database Name
});

db.connect(err => {
  if (err) {
    console.error('❌ Database Connection Error:', err.message);
  } else {
    console.log('⚡ Connected to MySQL Database (Nalandha) successfully!');
  }
});

// =========================================================================
// 1. BOOKS & LOANS / ASSIGNMENTS API
// =========================================================================
app.get('/api/books', (req, res) => {
  const action = req.query.action || 'getBooks';

  if (action === 'getBooks') {
    db.query('SELECT * FROM books ORDER BY id DESC', (err, results) => {
      if (err) return res.status(500).json({ status: 'error', message: err.message });
      
      const books = results.map(b => ({
        id: b.id,
        bookNumber: b.book_number,
        title: b.title,
        author: b.author,
        category: b.category,
        isbn: b.isbn,
        assignedTo: b.assigned_to
      }));
      res.json({ status: 'success', data: books });
    });
  } else if (action === 'getLoans') {
    db.query('SELECT * FROM book_assign ORDER BY id DESC', (err, results) => {
      if (err) return res.status(500).json({ status: 'error', message: err.message });
      
      const loans = results.map(l => ({
        bookNumber: l.book_number,
        bookName: l.book_name,
        memberName: l.member_name,
        receivedDate: l.received_date ? l.received_date.toISOString().split('T')[0] : '',
        submittedDate: l.submitted_date ? l.submitted_date.toISOString().split('T')[0] : 'Not Returned',
        status: l.status
      }));
      res.json({ status: 'success', data: loans });
    });
  }
});

app.post('/api/books', (req, res) => {
  const { action, bookNumber, title, author, category, isbn, assignedTo, issueDate, bookName, memberName, receivedDate } = req.body;

  if (action === 'addBook') {
    const num = bookNumber ? bookNumber.trim() : '';
    const bookTitle = title ? title.trim() : '';
    const bookAuthor = author ? author.trim() : '';
    const cat = category || 'General';
    const isbnCode = isbn || '978-0000000';

    if (!num || !bookTitle || !bookAuthor) {
      return res.status(400).json({ status: 'error', message: 'Book Number, Title, and Author are required!' });
    }

    const sql = 'INSERT INTO books (book_number, title, author, category, isbn, assigned_to) VALUES (?, ?, ?, ?, ?, NULL)';
    db.query(sql, [num, bookTitle, bookAuthor, cat, isbnCode], (err) => {
      if (err) {
        console.error('❌ Add Book Error:', err);
        return res.status(500).json({ status: 'error', message: err.message });
      }
      res.json({ status: 'success', message: 'Book successfully added to MySQL database!' });
    });
  } 
  else if (action === 'assignBook') {
    const targetBookNum = bookNumber || 'N/A';
    const targetBookTitle = title || bookName || '';
    const targetMember = assignedTo || memberName || '';
    const rDate = issueDate || receivedDate || new Date().toISOString().split('T')[0];

    db.query('UPDATE books SET assigned_to = ? WHERE book_number = ? OR title = ?', [targetMember, targetBookNum, targetBookTitle], (err1) => {
      db.query(
        'INSERT INTO book_assign (book_number, book_name, member_name, received_date, status) VALUES (?, ?, ?, ?, "Pending")',
        [targetBookNum, targetBookTitle, targetMember, rDate],
        (err2) => {
          if (err2) return res.status(500).json({ status: 'error', message: err2.message });
          res.json({ status: 'success', message: 'Book assigned and logged in MySQL!' });
        }
      );
    });
  }
  else if (action === 'submitReturn') {
    const targetBookNum = bookNumber || '';
    const targetBookTitle = title || bookName || '';
    const today = new Date().toISOString().split('T')[0];

    db.query('UPDATE books SET assigned_to = NULL WHERE book_number = ? OR title = ?', [targetBookNum, targetBookTitle], (err1) => {
      db.query(
        'UPDATE book_assign SET submitted_date = ?, status = "Returned" WHERE (book_number = ? OR book_name = ?) AND status = "Pending"',
        [today, targetBookNum, targetBookTitle],
        (err2) => {
          if (err2) return res.status(500).json({ status: 'error', message: err2.message });
          res.json({ status: 'success', message: 'Return recorded in MySQL!' });
        }
      );
    });
  }
});

// =========================================================================
// 2. ACTIVE MEMBERS API
// =========================================================================
app.get('/api/members', (req, res) => {
  db.query('SELECT * FROM members ORDER BY id DESC', (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });

    const members = results.map(m => ({
      id: m.id,
      firstName: m.first_name,
      lastName: m.last_name,
      name: m.name,
      address: m.address,
      district: m.district,
      mobile: m.mobile,
      password: m.password,
      status: m.status,
      createdDate: m.created_at ? m.created_at.toISOString().split('T')[0] : ''
    }));

    res.json({ status: 'success', data: members });
  });
});

app.post('/api/members', (req, res) => {
  const { action, id, firstName, lastName, address, district, mobile, password, status } = req.body;

  if (action === 'addMember') {
    if (!firstName || !lastName || !mobile || !password) {
      return res.status(400).json({ status: 'error', message: 'First name, Last name, Phone, and Password are required!' });
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const sql = 'INSERT INTO members (first_name, last_name, name, address, district, mobile, password, status) VALUES (?, ?, ?, ?, ?, ?, ?, "Active")';
    
    db.query(sql, [firstName.trim(), lastName.trim(), fullName, address.trim(), district.trim(), mobile.trim(), password.trim()], (err) => {
      if (err) {
        console.error('❌ Insert Member Error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ status: 'error', message: 'Phone number is already registered!' });
        }
        return res.status(500).json({ status: 'error', message: err.message });
      }
      res.json({ status: 'success', message: 'Member registered successfully in MySQL!' });
    });
  } 
  else if (action === 'updateMember') {
    const sql = 'UPDATE members SET mobile = ?, password = ?, status = ? WHERE id = ?';
    db.query(sql, [mobile, password, status, id], (err) => {
      if (err) return res.status(500).json({ status: 'error', message: err.message });
      res.json({ status: 'success', message: 'Member updated successfully in MySQL!' });
    });
  }
});

// =========================================================================
// 3. PROGRAMS & EVENTS API
// =========================================================================
app.get('/api/programs', (req, res) => {
  db.query('SELECT * FROM programs ORDER BY event_date DESC', (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });

    const programs = results.map(p => ({
      id: p.id,
      title: p.title,
      date: p.event_date ? p.event_date.toISOString().split('T')[0] : '',
      capacity: p.capacity,
      desc: p.description,
      participants: p.participants || ''
    }));

    res.json({ status: 'success', data: programs });
  });
});

app.post('/api/programs', (req, res) => {
  const { action, id, title, date, capacity, desc, participants } = req.body;

  if (action === 'addProgram') {
    const sql = 'INSERT INTO programs (title, event_date, capacity, description, participants) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [title.trim(), date, capacity, desc || '', participants || ''], (err) => {
      if (err) return res.status(500).json({ status: 'error', message: err.message });
      res.json({ status: 'success', message: 'Program created successfully in MySQL!' });
    });
  } 
  else if (action === 'updateProgram') {
    const sql = 'UPDATE programs SET title = ?, event_date = ?, capacity = ?, description = ?, participants = ? WHERE id = ?';
    db.query(sql, [title.trim(), date, capacity, desc || '', participants || '', id], (err) => {
      if (err) return res.status(500).json({ status: 'error', message: err.message });
      res.json({ status: 'success', message: 'Program updated successfully in MySQL!' });
    });
  } 
  else if (action === 'deleteProgram') {
    db.query('DELETE FROM programs WHERE id = ?', [id], (err) => {
      if (err) return res.status(500).json({ status: 'error', message: err.message });
      res.json({ status: 'success', message: 'Program deleted successfully from MySQL!' });
    });
  }
});

// =========================================================================
// 4. INCOME & EXPENSE (FINANCE) API
// =========================================================================
const DEFAULT_INCOME_CATS = [
  'MONTHLY EXPANCE', 'CONTRIBUTION', 'PANCHAYATH GRAND', 'KSLC GRAND',
  'LIBRARIAN ALLOWANCE', 'ULSAVABATHA', 'ANOTHER', '2021 WORKING GRNAD',
  'BANK INTREST', 'MUNNIRUPP'
];

const DEFAULT_EXPENSE_CATS = [
  'NEWSPAPER', 'EMPLOYEE ALLOWANCE', 'ULSAVABATHA', 'ROOM RENT',
  'YEARLY PROGRAMS', 'ANOTHER', 'KSLC GRAND', 'TRAVEL EXPANCE'
];

app.get('/api/finances', (req, res) => {
  const year = req.query.year || '2026-2027';

  db.query('SELECT * FROM finance_entries WHERE financial_year = ? ORDER BY id ASC', [year], (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });

    if (results.length === 0) {
      const inserts = [];
      DEFAULT_INCOME_CATS.forEach(c => inserts.push([year, 'Income', c]));
      DEFAULT_EXPENSE_CATS.forEach(c => inserts.push([year, 'Expense', c]));

      db.query('INSERT INTO finance_entries (financial_year, type, category) VALUES ?', [inserts], (err2) => {
        if (err2) return res.status(500).json({ status: 'error', message: err2.message });

        db.query('SELECT * FROM finance_entries WHERE financial_year = ? ORDER BY id ASC', [year], (err3, seeded) => {
          return res.json({ status: 'success', data: mapFinanceResults(seeded) });
        });
      });
    } else {
      res.json({ status: 'success', data: mapFinanceResults(results) });
    }
  });
});

function mapFinanceResults(results) {
  return results.map(r => ({
    id: r.id,
    financialYear: r.financial_year,
    type: r.type,
    category: r.category,
    april: r.april || '',
    may: r.may || '',
    june: r.june || '',
    july: r.july || '',
    aug: r.aug || '',
    sep: r.sep || '',
    oct: r.oct || '',
    nov: r.nov || '',
    dec_val: r.dec_val || '',
    jan: r.jan || '',
    feb: r.feb || '',
    march: r.march || ''
  }));
}

app.post('/api/finances', (req, res) => {
  const { action, id, financialYear, type, category, entries } = req.body;

  if (action === 'saveBatch') {
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No entries provided' });
    }

    let completed = 0;
    let hasError = false;

    entries.forEach(item => {
      const sql = `UPDATE finance_entries SET 
        april = ?, may = ?, june = ?, july = ?, aug = ?, sep = ?, 
        oct = ?, nov = ?, dec_val = ?, jan = ?, feb = ?, march = ? 
        WHERE id = ?`;

      db.query(sql, [
        item.april || '', item.may || '', item.june || '', item.july || '', item.aug || '', item.sep || '',
        item.oct || '', item.nov || '', item.dec_val || '', item.jan || '', item.feb || '', item.march || '',
        item.id
      ], (err) => {
        if (err && !hasError) {
          hasError = true;
          return res.status(500).json({ status: 'error', message: err.message });
        }
        completed++;
        if (completed === entries.length && !hasError) {
          res.json({ status: 'success', message: 'Financial ledger saved to MySQL!' });
        }
      });
    });
  } 
  else if (action === 'addCategory') {
    if (!category || !category.trim()) {
      return res.status(400).json({ status: 'error', message: 'Category name is required' });
    }

    const sql = 'INSERT INTO finance_entries (financial_year, type, category) VALUES (?, ?, ?)';
    db.query(sql, [financialYear, type, category.trim()], (err, result) => {
      if (err) {
        console.error('❌ Add Category Error:', err);
        return res.status(500).json({ status: 'error', message: err.message });
      }
      res.json({ status: 'success', message: 'New category added!', insertId: result.insertId });
    });
  } 
  else if (action === 'deleteCategory') {
    db.query('DELETE FROM finance_entries WHERE id = ?', [id], (err) => {
      if (err) return res.status(500).json({ status: 'error', message: err.message });
      res.json({ status: 'success', message: 'Category removed!' });
    });
  }
  else {
    res.status(400).json({ status: 'error', message: 'Invalid action parameter' });
  }
});

// =========================================================================
// START SERVER
// =========================================================================
app.listen(5000, () => {
  console.log('🚀 Server running on http://localhost:5000');
});