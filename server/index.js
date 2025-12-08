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

// Serve images statically so the frontend can display them
app.use('/images', express.static('public/images'));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'cluster_db'
});

// --- IMAGE UPLOAD CONFIGURATION ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images') // Ensure you create this folder!
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Middleware to verify Token
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
    const sql = "SELECT * FROM users WHERE phone_number = ?";
    db.query(sql, [phone_number], async (err, result) => {
        if (err) return res.json({ Error: "Error inside server" });
        if (result.length > 0) {
            const user = result[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                const token = jwt.sign({id: user.id, role: user.role}, "your_jwt_secret", {expiresIn: "1d"});
                return res.json({Status: "Success", token, role: user.role, userId: user.id});
            } else {
                return res.json({Error: "Password incorrect"});
            }
        } else {
            return res.json({Error: "No record existed"});
        }
    });
});

// 2. ADD MEMBER (With Image, Birthdate, Spouse)
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

// 3. GET USER PROFILE (Single Route)
app.get('/profile/:id', verifyToken, (req, res) => {
    const id = req.params.id;
    if(req.user.id != id && req.user.role !== 'leader') return res.json({Error: "Access Denied"});

    const sql = "SELECT full_name, phone_number, role, birthdate, spouse_name, profile_picture FROM users WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if(err) return res.json({Error: "Error fetching profile"});
        return res.json({Result: result[0]});
    });
});

// 4. GET OWN RECORDS (For Dashboard)
app.get('/my-records/:id', verifyToken, (req, res) => {
    const id = req.params.id;
    if(req.user.id != id && req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    const sql = "SELECT * FROM financial_records WHERE user_id = ? ORDER BY date_recorded DESC";
    db.query(sql, [id], (err, result) => {
        if(err) return res.json({Error: "Error fetching records"});
        return res.json({Result: result});
    });
});

// 5. GET MEMBERS LIST (Leader Only) - UPDATED for Loan Progress Bar
app.get('/members', verifyToken, (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    
    // JOIN with loans table to get active loan details for the dashboard graph
    const sql = `
        SELECT u.id, u.full_name, u.phone_number, u.profile_picture, 
               l.total_amount, l.current_balance 
        FROM users u 
        LEFT JOIN loans l ON u.id = l.user_id AND l.status = 'active' 
        WHERE u.role = 'member'
    `;

    db.query(sql, (err, result) => {
        if(err) return res.json({Error: "Get users error"});
        return res.json({Result: result});
    });
});

// 6. DELETE MEMBER (Leader Only)
app.delete('/delete-member/:id', verifyToken, (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    const id = req.params.id;
    db.query("DELETE FROM users WHERE id = ?", [id], (err, result) => {
        if(err) return res.json({Error: "Error deleting member"});
        return res.json({Status: "Success"});
    });
});

// --- NEW FINANCIAL LOGIC ROUTES ---

// 7. ASSIGN NEW PARENT LOAN
app.post('/assign-loan', verifyToken, (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    const { user_id, amount } = req.body;

    // Check if user already has an active loan
    db.query("SELECT * FROM loans WHERE user_id = ? AND status = 'active'", [user_id], (err, result) => {
        if(result.length > 0) return res.json({Error: "Member already has an active loan."});

        const sql = "INSERT INTO loans (user_id, total_amount, current_balance, status) VALUES (?, ?, ?, 'active')";
        db.query(sql, [user_id, amount, amount], (err, result) => {
            if(err) return res.json({Error: "Error creating loan"});
            return res.json({Status: "Success"});
        });
    });
});

// 8. ASSIGN RECORD (Savings, Insurance, or Partial Loan Payment)
app.post('/assign-record', verifyToken, (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});

    const { user_id, type, amount, due_date, loan_id } = req.body;
    
    // If it is a partial loan payment, we link it to the loan_id
    const sql = "INSERT INTO financial_records (user_id, type, amount, due_date, status, loan_id) VALUES (?, ?, ?, ?, 'pending', ?)";
    
    db.query(sql, [user_id, type, amount, due_date, loan_id || null], (err, result) => {
        if(err) return res.json({Error: "Error assigning record"});
        return res.json({Status: "Success"});
    });
});

// 9. MARK RECORD AS PAID (Handle Late Logic & Update Loan Balance)
app.put('/mark-paid/:id', verifyToken, (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    const id = req.params.id;
    const { type, amount, loan_id, due_date } = req.body;

    // Calculate if Late
    const today = new Date();
    const due = new Date(due_date);
    // Reset hours to compare dates accurately
    today.setHours(0,0,0,0);
    due.setHours(0,0,0,0);
    
    const status = today > due ? 'late' : 'paid';

    const sql = "UPDATE financial_records SET status = ?, date_recorded = NOW() WHERE id = ?";
    db.query(sql, [status, id], (err, result) => {
        if(err) return res.json({Error: "Error updating status"});

        // If it was a loan payment, update the parent loan balance
        if(type === 'loan_payment' && loan_id) {
            const updateLoan = "UPDATE loans SET current_balance = current_balance - ? WHERE id = ?";
            db.query(updateLoan, [amount, loan_id], (err, resLoan) => {
                // Check if loan is now fully paid (balance <= 0)
                db.query("UPDATE loans SET status = 'completed' WHERE id = ? AND current_balance <= 0", [loan_id]);
            });
        }
        return res.json({Status: "Success"});
    });
});

// 10. RESET STATUS (Correction / Undo)
app.put('/reset-status/:id', verifyToken, (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    const id = req.params.id;
    // Simply sets it back to pending. Note: For a real app, you might want to re-add the loan balance here.
    const sql = "UPDATE financial_records SET status = 'pending' WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if(err) return res.json({Error: "Error resetting status"});
        return res.json({Status: "Success"});
    });
});

// 11. CASH OUT (Resets total to 0 by marking records as 'cashed_out')
app.put('/cash-out', verifyToken, (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    const { user_id, type } = req.body; // type = 'savings' or 'insurance'

    // Only cash out records that are 'paid' or 'late' (money actually received)
    const sql = "UPDATE financial_records SET status = 'cashed_out' WHERE user_id = ? AND type = ? AND (status = 'paid' OR status = 'late')";
    db.query(sql, [user_id, type], (err, result) => {
        if(err) return res.json({Error: "Error cashing out"});
        return res.json({Status: "Success"});
    });
});

// 12. GET FULL MEMBER DETAILS (Profile + Loan + Totals)
app.get('/member-details/:id', verifyToken, (req, res) => {
    const id = req.params.id;
    
    const queries = {
        profile: "SELECT * FROM users WHERE id = ?",
        activeLoan: "SELECT * FROM loans WHERE user_id = ? AND status = 'active' LIMIT 1",
        records: "SELECT * FROM financial_records WHERE user_id = ? ORDER BY due_date DESC",
        // Calculate Totals for Savings/Insurance (Only count paid/late money, ignore pending or cashed_out)
        savingsTotal: "SELECT SUM(amount) as total FROM financial_records WHERE user_id = ? AND type = 'savings' AND (status = 'paid' OR status = 'late')",
        insuranceTotal: "SELECT SUM(amount) as total FROM financial_records WHERE user_id = ? AND type = 'insurance' AND (status = 'paid' OR status = 'late')"
    };

    db.query(queries.profile, [id], (err, profileRes) => {
        if(err || profileRes.length === 0) return res.json({Error: "User not found"});
        const user = profileRes[0];

        // Privacy: If the user being viewed is a LEADER, hide sensitive info
        if(user.role === 'leader') {
            delete user.profile_picture;
            delete user.birthdate;
            delete user.spouse_name;
        }

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

// 13. ADMIN PASSWORD RESET
app.put('/reset-admin-password', verifyToken, async (req, res) => {
    if(req.user.role !== 'leader') return res.json({Error: "Access Denied"});
    const { new_password } = req.body;
    const hash = await bcrypt.hash(new_password.toString(), 10);
    
    db.query("UPDATE users SET password = ? WHERE id = ?", [hash, req.user.id], (err, result) => {
        if(err) return res.json({Error: "Error resetting password"});
        return res.json({Status: "Success"});
    });
});

app.listen(8081, () => {
    console.log("Server running on port 8081");
});