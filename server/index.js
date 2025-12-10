const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Serve images statically
app.use('/images', express.static('public/images'));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'cluster_db'
});

// --- CONFIG ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/images'),
    filename: (req, file, cb) => cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({Error: "A token is required"});
    try {
        const decoded = jwt.verify(token, 'your_jwt_secret');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({Error: "Invalid Token"});
    }
};

// --- ROUTES ---

// 1. LOGIN
app.post('/login', (req, res) => {
    const { phone_number, password } = req.body;
    db.query("SELECT * FROM users WHERE phone_number = ?", [phone_number], async (err, result) => {
        if (err) return res.json({ Error: "Error inside server" });
        if (result.length > 0) {
            const match = await bcrypt.compare(password, result[0].password);
            if (match) {
                const token = jwt.sign({id: result[0].id, role: result[0].role}, "your_jwt_secret", {expiresIn: "1d"});
                return res.json({Status: "Success", token, role: result[0].role, userId: result[0].id});
            } else return res.json({Error: "Password incorrect"});
        } else return res.json({Error: "No record existed"});
    });
});

// 2. ADD MEMBER
app.post('/add-member', verifyToken, upload.single('image'), async (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    const { full_name, phone_number, password, birthdate, spouse_name } = req.body;
    const image = req.file ? req.file.filename : null; 
    const hash = await bcrypt.hash(password.toString(), 10);
    const sql = "INSERT INTO users (full_name, phone_number, password, role, birthdate, spouse_name, profile_picture) VALUES (?, ?, ?, 'member', ?, ?, ?)";
    db.query(sql, [full_name, phone_number, hash, birthdate, spouse_name, image], (err, result) => {
        if(err) return res.json({Error: "Error inserting data"});
        return res.json({Status: "Success"});
    });
});

// 3. GET PROFILE (Basic)
app.get('/profile/:id', verifyToken, (req, res) => {
    const id = req.params.id;
    if(req.user.id != id && req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    db.query("SELECT full_name, phone_number, role, birthdate, spouse_name, profile_picture FROM users WHERE id = ?", [id], (err, result) => {
        const user = result[0];
        if(user && user.role === 'leader') {
            delete user.profile_picture; delete user.birthdate; delete user.spouse_name;
        }
        return res.json({Result: user});
    });
});

// 4. GET MY RECORDS (Table Data)
app.get('/my-records/:id', verifyToken, (req, res) => {
    const id = req.params.id;
    if(req.user.id != id && req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    db.query("SELECT * FROM financial_records WHERE user_id = ? ORDER BY date_recorded DESC", [id], (err, result) => {
        return res.json({Result: result});
    });
});

// 5. GET MEMBERS LIST (Leader Only - Includes Active Loan Data)
app.get('/members', verifyToken, (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    const sql = `SELECT u.id, u.full_name, u.phone_number, u.profile_picture, l.total_amount, l.current_balance 
                 FROM users u LEFT JOIN loans l ON u.id = l.user_id AND l.status = 'active' WHERE u.role = 'member'`;
    db.query(sql, (err, result) => res.json({Result: result}));
});

// 6. DELETE MEMBER
app.delete('/delete-member/:id', verifyToken, (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    db.query("DELETE FROM users WHERE id = ?", [req.params.id], (err, result) => res.json({Status: "Success"}));
});

// --- FINANCIAL LOGIC ---

// 7. ASSIGN LOAN
app.post('/assign-loan', verifyToken, (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    const { user_id, amount } = req.body;
    db.query("SELECT * FROM loans WHERE user_id = ? AND status = 'active'", [user_id], (err, result) => {
        if(result.length > 0) return res.json({Error: "Member already has an active loan."});
        const sql = "INSERT INTO loans (user_id, total_amount, current_balance, status) VALUES (?, ?, ?, 'active')";
        db.query(sql, [user_id, amount, amount], (err, result) => res.json({Status: "Success"}));
    });
});

// 8. ASSIGN RECORD
app.post('/assign-record', verifyToken, (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    const { user_id, type, amount, due_date, loan_id } = req.body;
    const sql = "INSERT INTO financial_records (user_id, type, amount, due_date, status, loan_id) VALUES (?, ?, ?, ?, 'pending', ?)";
    db.query(sql, [user_id, type, amount, due_date, loan_id || null], (err, result) => res.json({Status: "Success"}));
});

// 9. MARK PAID (Updates Loan Balance)
app.put('/mark-paid/:id', verifyToken, (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    const id = req.params.id;

    db.query("SELECT * FROM financial_records WHERE id = ?", [id], (err, result) => {
        if(err || result.length === 0) return res.json({Error: "Record not found"});
        const record = result[0];

        if(record.status === 'paid' || record.status === 'late' || record.status === 'cashed_out') {
            return res.json({Error: "Record already paid"});
        }

        const today = new Date();
        const due = new Date(record.due_date);
        today.setHours(0,0,0,0); due.setHours(0,0,0,0);
        const newStatus = today > due ? 'late' : 'paid';

        db.query("UPDATE financial_records SET status = ?, date_recorded = NOW() WHERE id = ?", [newStatus, id], (err, updateRes) => {
            if(err) return res.json({Error: "Error updating record"});

            if(record.type === 'loan_payment' && record.loan_id) {
                const payAmount = parseFloat(record.amount);
                db.query("UPDATE loans SET current_balance = current_balance - ? WHERE id = ?", [payAmount, record.loan_id], (err, loanRes) => {
                    db.query("UPDATE loans SET status = 'completed' WHERE id = ? AND current_balance <= 0", [record.loan_id]);
                    return res.json({Status: "Success"});
                });
            } else {
                return res.json({Status: "Success"});
            }
        });
    });
});

// 10. RESET STATUS
app.put('/reset-status/:id', verifyToken, (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    db.query("UPDATE financial_records SET status = 'pending' WHERE id = ?", [req.params.id], (err, result) => res.json({Status: "Success"}));
});

// 11. DELETE / CANCEL TRANSACTION (Restores Balance)
app.delete('/delete-record/:id', verifyToken, (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    const id = req.params.id;

    db.query("SELECT * FROM financial_records WHERE id = ?", [id], (err, result) => {
        if(err || result.length === 0) return res.json({Error: "Record not found"});
        const record = result[0];

        if(record.type === 'loan_payment' && record.loan_id && (record.status === 'paid' || record.status === 'late')) {
            const payAmount = parseFloat(record.amount);
            db.query("UPDATE loans SET current_balance = current_balance + ?, status = 'active' WHERE id = ?", [payAmount, record.loan_id], () => {
                db.query("DELETE FROM financial_records WHERE id = ?", [id], () => res.json({Status: "Success"}));
            });
        } else {
            db.query("DELETE FROM financial_records WHERE id = ?", [id], () => res.json({Status: "Success"}));
        }
    });
});

// 12. CASH OUT
app.put('/cash-out', verifyToken, (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    const { user_id, type } = req.body; 
    db.query("UPDATE financial_records SET status = 'cashed_out' WHERE user_id = ? AND type = ? AND (status = 'paid' OR status = 'late')", 
    [user_id, type], (err, result) => res.json({Status: "Success"}));
});

// 13. MEMBER DETAILS (Full Profile + Totals + Loan Stats)
app.get('/member-details/:id', verifyToken, (req, res) => {
    const id = req.params.id;
    
    // Allow Leader OR Self to view
    if(req.user.role !== 'leader' && req.user.id != id) {
        return res.json({Error: "Access Denied"});
    }

    const queries = {
        profile: "SELECT * FROM users WHERE id = ?",
        activeLoan: "SELECT * FROM loans WHERE user_id = ? AND status = 'active' LIMIT 1",
        records: "SELECT * FROM financial_records WHERE user_id = ? ORDER BY due_date DESC",
        savingsTotal: "SELECT SUM(amount) as total FROM financial_records WHERE user_id = ? AND type = 'savings' AND (status = 'paid' OR status = 'late')",
        insuranceTotal: "SELECT SUM(amount) as total FROM financial_records WHERE user_id = ? AND type = 'insurance' AND (status = 'paid' OR status = 'late')"
    };

    db.query(queries.profile, [id], (err, profileRes) => {
        if(err || profileRes.length === 0) return res.json({Error: "User not found"});
        const user = profileRes[0];
        if(user.role === 'leader') { delete user.profile_picture; delete user.birthdate; delete user.spouse_name; }

        db.query(queries.activeLoan, [id], (err, loanRes) => {
            db.query(queries.records, [id], (err, recordRes) => {
                db.query(queries.savingsTotal, [id], (err, saveRes) => {
                    db.query(queries.insuranceTotal, [id], (err, insRes) => {
                        return res.json({
                            user,
                            activeLoan: loanRes[0] || null,
                            records: recordRes,
                            savingsTotal: saveRes[0].total || 0,
                            insuranceTotal: insRes[0].total || 0
                        });
                    });
                });
            });
        });
    });
});

// 14. ADMIN PASSWORD RESET
app.put('/reset-admin-password', verifyToken, async (req, res) => {
    const hash = await bcrypt.hash(req.body.new_password.toString(), 10);
    db.query("UPDATE users SET password = ? WHERE id = ?", [hash, req.user.id], () => res.json({Status: "Success"}));
});

app.listen(8081, () => console.log("Server running on port 8081"));