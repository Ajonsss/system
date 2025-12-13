const db = require('../config/db');

const Financial = {
    // --- LOANS ---
    findActiveLoan: (userId, cb) => {
        db.query("SELECT * FROM loans WHERE user_id = ? AND status = 'active'", [userId], cb);
    },
    findById: (loanId, cb) => { // New Helper
        db.query("SELECT * FROM loans WHERE id = ?", [loanId], cb);
    },
    createLoan: (data, cb) => {
        const sql = "INSERT INTO loans (user_id, total_amount, current_balance, status, loan_name) VALUES (?, ?, ?, 'active', ?)";
        db.query(sql, [data.user_id, data.amount, data.amount, data.loan_name], cb);
    },
    updateLoanBalance: (loanId, amount, operation, cb) => {
        const sql = `UPDATE loans SET current_balance = current_balance ${operation} ? WHERE id = ?`;
        db.query(sql, [amount, loanId], cb);
    },
    closeLoan: (loanId, cb) => {
        db.query("UPDATE loans SET status = 'completed' WHERE id = ? AND current_balance <= 0", [loanId], cb);
    },
    smartReactivateLoan: (loanId, cb) => {
        db.query("UPDATE loans SET status = IF(current_balance > 0, 'active', 'completed') WHERE id = ?", [loanId], cb);
    },
    deleteLoan: (loanId, cb) => {
        // Deletes the loan entirely
        db.query("DELETE FROM loans WHERE id = ?", [loanId], cb);
    },

    // --- RECORDS ---
    createRecord: (data, cb) => {
        // Modified to accept 'cancelled' status directly if needed
        const status = data.status || 'pending';
        const sql = "INSERT INTO financial_records (user_id, type, amount, due_date, status, loan_id, loan_name_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?)";
        // Note: Added loan_name_snapshot column logic conceptually, but for now we reuse existing structure
        // Since we don't have a loan_name column in financial_records, we might strictly rely on the type or just insert with null loan_id
        db.query("INSERT INTO financial_records (user_id, type, amount, due_date, status, loan_id) VALUES (?, ?, ?, ?, ?, ?)", 
            [data.user_id, data.type, data.amount, data.due_date, status, data.loan_id], cb);
    },
    // Special method to insert a history log without a loan_id (since loan is being deleted)
    createHistoryLog: (data, cb) => {
        // We use the 'type' field to store the Loan Name for display purposes if needed, or just standard type
        // For the "Loan Cancelled" feature, we want it to show up in history.
        // We will insert a record with status 'cancelled'
        const sql = "INSERT INTO financial_records (user_id, type, amount, due_date, status) VALUES (?, ?, ?, NOW(), 'cancelled')";
        db.query(sql, [data.user_id, data.type, data.amount], cb);
    },
    deleteLoanPayments: (loanId, cb) => {
        db.query("DELETE FROM financial_records WHERE loan_id = ?", [loanId], cb);
    },
    getRecordsByUser: (userId, cb) => {
        // Simplified query: No JOINS, No created_at sort.
        // This ensures we get data even if the table structure is simple.
        const sql = "SELECT * FROM financial_records WHERE user_id = ? ORDER BY due_date DESC";
        db.query(sql, [userId], cb);
    },
    findRecordById: (id, cb) => db.query("SELECT * FROM financial_records WHERE id = ?", [id], cb),
    updateStatus: (id, status, cb) => db.query("UPDATE financial_records SET status = ?, date_recorded = NOW() WHERE id = ?", [status, id], cb),
    deleteRecord: (id, cb) => db.query("DELETE FROM financial_records WHERE id = ?", [id], cb),
    
    cashOut: (userId, type, cb) => {
        const sql = "UPDATE financial_records SET status = 'cashed_out' WHERE user_id = ? AND type = ? AND (status = 'paid' OR status = 'late')";
        db.query(sql, [userId, type], cb);
    },
    undoCashOut: (userId, type, cb) => {
        // Reverts 'cashed_out' back to 'paid' so it reappears in the total
        const sql = "UPDATE financial_records SET status = 'paid' WHERE user_id = ? AND type = ? AND status = 'cashed_out'";
        db.query(sql, [userId, type], cb);
    },
    
    // --- TOTALS ---
    // --- TOTALS ---
    getTotals: (userId, cb) => {
        // STRICT QUERY: Only count money where status is 'paid' or 'late'.
        // Pending records are ignored until the user clicks the "Pay" button.
        
        const q1 = "SELECT SUM(amount) as total FROM financial_records WHERE user_id = ? AND type = 'savings' AND (status = 'paid' OR status = 'late')";
        const q2 = "SELECT SUM(amount) as total FROM financial_records WHERE user_id = ? AND type = 'insurance' AND (status = 'paid' OR status = 'late')";
        
        db.query(q1, [userId], (err, sRes) => {
            if(err) {
                console.log("Error calculating savings total:", err);
                return cb(null, { savings: 0, insurance: 0 }); 
            }
            db.query(q2, [userId], (err, iRes) => {
                if(err) {
                    console.log("Error calculating insurance total:", err);
                    return cb(null, { savings: sRes[0].total || 0, insurance: 0 });
                }
                cb(null, { savings: sRes[0].total || 0, insurance: iRes[0].total || 0 });
            });
        });
    }
};

module.exports = Financial;