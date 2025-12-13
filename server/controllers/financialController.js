const Financial = require('../models/financialModel');
const Notification = require('../models/notificationModel');
const User = require('../models/userModel');

// --- LOANS ---
exports.assignLoan = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    const { user_id, amount, loan_name } = req.body;

    Financial.findActiveLoan(user_id, (err, result) => {
        if (result.length > 0) return res.json({ Error: "Member already has an active loan." });

        const loanData = { user_id, amount, loan_name: loan_name || 'Personal Loan' };
        Financial.createLoan(loanData, (err) => {
            if (err) return res.json({ Error: "Database Error" });

            User.findById(user_id, (err, userRes) => {
                const memberName = userRes[0]?.full_name || "Member";
                const memberMsg = `New Loan Assigned: ${loanData.loan_name} - ₱${amount}`;
                const adminMsg = `You assigned Loan (${loanData.loan_name}) to ${memberName}`;
                
                Notification.create(user_id, memberMsg, () => {});
                Notification.create(req.user.id, adminMsg, () => {});
                
                return res.json({ Status: "Success" });
            });
        });
    });
};

// NEW: Cancel Loan (Deletes loan, payments, and adds history log)
exports.cancelLoan = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    const loanId = req.params.loan_id;

    Financial.findById(loanId, (err, result) => {
        if (err || result.length === 0) return res.json({ Error: "Loan not found" });
        const loan = result[0];

        // 1. Create Notifications
        User.findById(loan.user_id, (err, userRes) => {
            const memberName = userRes[0]?.full_name || "Member";
            const memberMsg = `Loan Cancelled: ${loan.loan_name} has been cancelled by Admin.`;
            const adminMsg = `You cancelled the loan (${loan.loan_name}) for ${memberName}.`;

            Notification.create(loan.user_id, memberMsg, () => {});
            Notification.create(req.user.id, adminMsg, () => {});

            // 2. Add "Cancelled" record to history (Display purposes)
            // We use 'loan_payment' type but 'cancelled' status, and put Loan Name in type or separate handling
            // For simplicity, we create a record that says "Loan Cancelled: [Name]"
            const historyData = {
                user_id: loan.user_id,
                type: `Cancelled: ${loan.loan_name}`, // Hack to show name in history
                amount: loan.total_amount
            };
            Financial.createHistoryLog(historyData, () => {
                // 3. Delete partial payments linked to this loan
                Financial.deleteLoanPayments(loanId, () => {
                    // 4. Delete the Loan itself
                    Financial.deleteLoan(loanId, (err) => {
                        if (err) return res.json({ Error: "Error deleting loan" });
                        return res.json({ Status: "Success" });
                    });
                });
            });
        });
    });
};

// --- RECORDS ---
exports.assignRecord = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    const { user_id, type, amount, due_date, loan_id } = req.body;

    const data = { user_id, type, amount, due_date, loan_id: loan_id || null };
    Financial.createRecord(data, (err) => {
        if (err) return res.json({ Error: "Database Error" });

        User.findById(user_id, (err, userRes) => {
            const memberName = userRes[0]?.full_name || "Member";
            let typeText = type === 'loan_payment' ? 'Loan Payment' : (type === 'savings' ? 'Savings' : 'Insurance');
            const memberMsg = `Reminder: ${typeText} of ₱${amount} is due on ${due_date}`;
            const adminMsg = `You assigned a ${typeText} (₱${amount}) to ${memberName}`;

            Notification.create(user_id, memberMsg, () => {});
            Notification.create(req.user.id, adminMsg, () => {});

            res.json({ Status: "Success" });
        });
    });
};

exports.markPaid = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    
    Financial.findRecordById(req.params.id, (err, result) => {
        if (err || result.length === 0) return res.json({ Error: "Record not found" });
        const record = result[0];

        if (['paid', 'late', 'cashed_out'].includes(record.status)) return res.json({ Error: "Already paid" });

        const today = new Date();
        const due = new Date(record.due_date);
        today.setHours(0,0,0,0); due.setHours(0,0,0,0);
        const newStatus = today > due ? 'late' : 'paid';

        Financial.updateStatus(req.params.id, newStatus, (err) => {
            if (err) return res.json({ Error: "Error updating record" });

            if (record.type === 'loan_payment' && record.loan_id) {
                Financial.updateLoanBalance(record.loan_id, record.amount, '-', (err) => {
                    Financial.closeLoan(record.loan_id, () => {});
                    return res.json({ Status: "Success" });
                });
            } else {
                return res.json({ Status: "Success" });
            }
        });
    });
};

exports.resetStatus = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    
    Financial.findRecordById(req.params.id, (err, result) => {
        if (err || result.length === 0) return res.json({ Error: "Record not found" });
        const record = result[0];

        if (record.type === 'loan_payment' && record.loan_id && ['paid', 'late'].includes(record.status)) {
            Financial.updateLoanBalance(record.loan_id, record.amount, '+', () => {
                Financial.smartReactivateLoan(record.loan_id, () => {
                    Financial.updateStatus(req.params.id, 'pending', () => res.json({ Status: "Success" }));
                });
            });
        } else {
            Financial.updateStatus(req.params.id, 'pending', () => res.json({ Status: "Success" }));
        }
    });
};

exports.deleteRecord = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    
    Financial.findRecordById(req.params.id, (err, result) => {
        if (err || result.length === 0) return res.json({ Error: "Record not found" });
        const record = result[0];

        if (record.type === 'loan_payment' && record.loan_id && ['paid', 'late'].includes(record.status)) {
            Financial.updateLoanBalance(record.loan_id, record.amount, '+', () => {
                Financial.smartReactivateLoan(record.loan_id, () => {
                    Financial.deleteRecord(req.params.id, () => res.json({ Status: "Success" }));
                });
            });
        } else {
            Financial.deleteRecord(req.params.id, () => res.json({ Status: "Success" }));
        }
    });
};

exports.cashOut = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    Financial.cashOut(req.body.user_id, req.body.type, (err) => {
        if (err) return res.json({ Error: "Error cashing out" });
        return res.json({ Status: "Success" });
    });
};

// NEW: Undo Cashout
exports.undoCashOut = (req, res) => {
    if (req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    Financial.undoCashOut(req.body.user_id, req.body.type, (err) => {
        if (err) return res.json({ Error: "Error undoing cash out" });
        return res.json({ Status: "Success" });
    });
};

exports.getMemberDetails = (req, res) => {
    const userId = req.params.id;
    if (req.user.role !== 'leader' && req.user.id != userId) return res.json({ Error: "Access Denied" });

    User.findById(userId, (err, userRes) => {
        if (err || userRes.length === 0) return res.json({ Error: "User not found" });
        const user = userRes[0];
        
        if (user.role === 'leader') { 
            delete user.profile_picture; delete user.birthdate; delete user.spouse_name; 
        }

        Financial.findActiveLoan(userId, (err, loanRes) => {
            // --- UPDATED SECTION START ---
            Financial.getRecordsByUser(userId, (err, recordRes) => {
                // ADDED: Log the error if one happens!
                if (err) {
                    console.log("DATABASE ERROR (getRecordsByUser):", err);
                    // Send empty array on error so frontend doesn't crash
                    recordRes = []; 
                }
            // --- UPDATED SECTION END ---

                Notification.getByUser(userId, (err, notifRes) => {
                    Financial.getTotals(userId, (err, totals) => {
                        return res.json({
                            user,
                            activeLoan: loanRes[0] || null,
                            records: recordRes, // Now this will be valid data or []
                            notifications: notifRes || [],
                            savingsTotal: totals.savings || 0,
                            insuranceTotal: totals.insurance || 0
                        });
                    });
                });
            });
        });
    });
};

exports.getMyRecords = (req, res) => {
    if (req.user.id != req.params.id && req.user.role !== 'leader') return res.json({ Error: "Access Denied" });
    Financial.getRecordsByUser(req.params.id, (err, result) => {
        return res.json({ Result: result });
    });
};

exports.markNotificationRead = (req, res) => {
    Notification.markRead(req.params.id, () => res.json({ Status: "Success" }));
};