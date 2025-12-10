import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

function Dashboard() {
    const [role, setRole] = useState('');
    const [members, setMembers] = useState([]);
    const [records, setRecords] = useState([]); 
    const [notifications, setNotifications] = useState([]); 
    const [showNotif, setShowNotif] = useState(false);

    const [myData, setMyData] = useState({
        user: {},
        activeLoan: null,
        records: [],
        savingsTotal: 0,
        insuranceTotal: 0
    });

    const [newPassword, setNewPassword] = useState(''); 
    const [newPhone, setNewPhone] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const storedRole = localStorage.getItem('role');
        const storedId = localStorage.getItem('userId');
        const token = localStorage.getItem('token');
        
        if(!token) navigate('/');
        setRole(storedRole);

        // 1. FETCH FULL DETAILS (Includes Notifications)
        axios.get(`http://localhost:8081/member-details/${storedId}`, { headers: { Authorization: token } })
            .then(res => {
                if(res.data.user) {
                    setMyData(res.data);
                    setRecords(res.data.records); 
                    setNotifications(res.data.notifications || []);
                }
            })
            .catch(err => console.log(err));

        if(storedRole === 'leader') {
            axios.get('http://localhost:8081/members', { headers: { Authorization: token } })
                .then(res => setMembers(res.data.Result || []));
        }
    }, []);

    const handleLogout = () => { localStorage.clear(); navigate('/'); }

    const handleMarkRead = (id) => {
        const token = localStorage.getItem('token');
        axios.put(`http://localhost:8081/mark-notification-read/${id}`, {}, { headers: { Authorization: token } })
            .then(() => {
                setNotifications(notifications.map(n => n.id === id ? {...n, is_read: 1} : n));
            });
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    // --- HANDLERS ---
    const handleResetAdminPassword = () => {
        const token = localStorage.getItem('token');
        if(!newPassword) return alert("Enter password");
        axios.put('http://localhost:8081/reset-admin-password', { new_password: newPassword }, { headers: { Authorization: token } }).then(res => { if(res.data.Status === "Success") alert("Success"); });
    };
    const handleUpdateAdminPhone = () => {
        const token = localStorage.getItem('token');
        if(!newPhone) return alert("Enter phone");
        axios.put('http://localhost:8081/update-admin-phone', { new_phone: newPhone }, { headers: { Authorization: token } }).then(res => { if(res.data.Status === "Success") alert("Success"); });
    };
    const handleDeleteMember = (e, memberId) => {
        e.stopPropagation(); 
        if(!window.confirm("Delete member?")) return;
        const token = localStorage.getItem('token');
        axios.delete(`http://localhost:8081/delete-member/${memberId}`, { headers: { Authorization: token } }).then(res => { if(res.data.Status === "Success") setMembers(members.filter(m => m.id !== memberId)); });
    };

    const loanProgress = myData.activeLoan 
        ? ((myData.activeLoan.total_amount - myData.activeLoan.current_balance) / myData.activeLoan.total_amount) * 100 
        : 0;

    return (
        <div className='dashscreen min-h-screen'>
            
            {/* --- FOCUS OVERLAY --- */}
            {showNotif && (
                <div 
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
                    onClick={() => setShowNotif(false)}
                ></div>
            )}

            {/* Navbar with Notifications - VISIBLE TO BOTH ROLES */}
            <nav className='dashnav relative z-50'>
                <div className='dashnava'>
                    <h1>Cluster Management System</h1>
                    <div className='flex items-center gap-4'>
                        
                        {/* --- NOTIFICATION BELL --- */}
                        <div className='relative'>
                            <div className='cursor-pointer p-2 hover:bg-white/10 rounded-full transition' onClick={() => setShowNotif(!showNotif)}>
                                <span className='text-2xl text-white'>🔔</span>
                                {unreadCount > 0 && (
                                    <span className='absolute top-0 right-0 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full border border-white/20 shadow-md'>
                                        {unreadCount}
                                    </span>
                                )}
                            </div>
                            
                            {/* --- NOTIFICATION DROPDOWN --- */}
                            {showNotif && (
                                <div className='absolute right-0 top-full mt-4 w-96 max-h-[80vh] overflow-y-auto 
                                                bg-white/30 backdrop-blur-[100px] border border-white/30 
                                                rounded-[20px] shadow-2xl z-50 transform origin-top-right transition-all'>
                                    
                                    <div className='p-4 border-b border-white/20 sticky top-0 bg-white/20 backdrop-blur-xl z-10'>
                                        <h3 className='text-white text-sm uppercase tracking-wide'>Notifications</h3>
                                    </div>

                                    <div className='flex flex-col'>
                                        {notifications.length > 0 ? notifications.map(n => (
                                            <div 
                                                key={n.id} 
                                                onClick={() => handleMarkRead(n.id)} 
                                                className={`p-4 border-b border-white/10 cursor-pointer transition-colors duration-200
                                                            ${n.is_read ? 'bg-transparent text-white/60 hover:bg-white/10' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                            >
                                                <p className='text-sm leading-relaxed'>{n.message}</p>
                                                <p className={`text-xs mt-2 ${n.is_read ? 'text-white/40' : 'text-blue-200'}`}>
                                                    {new Date(n.created_at).toLocaleDateString()} • {new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </p>
                                            </div>
                                        )) : (
                                            <div className='p-8 text-center text-white/60 text-sm'>
                                                No notifications yet.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={handleLogout} className="border border-white/50 bg-white/10 hover:bg-red-600/80 text-white px-4 py-1.5 rounded-[10px] text-sm transition">
                            Logout
                        </button>
                    </div>
                </div>
            </nav>

            <div className='max-w-6xl mx-auto p-6 space-y-8 relative z-0'>
                
                {/* --- HEADER SECTION --- */}
                <div className='dashhead'>
                    {role === 'leader' ? (
                        // ADMIN VIEW
                        <div className='flex flex-col md:flex-row justify-between items-center gap-4'>
                            <div>
                                <h2 className='dashtitle'>Admin Dashboard</h2>
                                <p className='dashp'>Manage your cluster members below.</p>
                            </div>
                            <div className='flex flex-col gap-3 w-full md:w-auto'>
                                <div className='flex gap-2'>
                                    <input type="password" placeholder="New Admin Password" className='dashadpw' value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                                    <button onClick={handleResetAdminPassword} className='bg-white/0 border border-white hover:bg-red-600 text-white px-4 py-2 rounded-[10px] shadow transition text-sm whitespace-nowrap'>Reset PW</button>
                                </div>
                                <div className='flex gap-2'>
                                    <input type="text" placeholder="New Phone Number" className='dashadpw' value={newPhone} onChange={e => setNewPhone(e.target.value)} />
                                    <button onClick={handleUpdateAdminPhone} className='bg-white/0 border border-white hover:bg-green-600 text-white px-4 py-2 rounded-[10px] shadow transition text-sm whitespace-nowrap'>Update Phone</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // MEMBER VIEW
                        <div className='flex flex-col gap-6'>
                            <div className='flex flex-col md:flex-row gap-6 items-center md:items-start'>
                                <div className='w-32 h-32 rounded-full overflow-hidden border-4 border-gray-100 shadow-sm flex-shrink-0 bg-gray-200'>
                                    {myData.user.profile_picture ? <img src={`http://localhost:8081/images/${myData.user.profile_picture}`} alt="Profile" className='w-full h-full object-cover'/> : <div className='w-full h-full flex items-center justify-center text-gray-400'>No Img</div>}
                                </div>
                                <div className='flex-1 space-y-2 text-center md:text-left'>
                                    <h2 className='text-2xl text-white'>{myData.user.full_name}</h2>
                                    <div className='text-white grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1'>
                                        <p><span className='text-white'>Phone:</span> {myData.user.phone_number}</p>
                                        <p><span className='text-white'>Role:</span> <span className='capitalize'>{myData.user.role}</span></p>
                                        <p><span className='text-white'>Birthdate:</span> {myData.user.birthdate ? new Date(myData.user.birthdate).toLocaleDateString() : 'N/A'}</p>
                                        <p><span className='text-white'>Spouse:</span> {myData.user.spouse_name || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className='grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/20 pt-6'>
                                <div className='bg-white/10 backdrop-blur-[10px] p-4 rounded-[20px] border border-white/30'>
                                    <h3 className='text-white text-sm uppercase mb-2'>Loan Progress</h3>
                                    {myData.activeLoan ? <div><div className='flex justify-between items-end mb-2'><span className='text-3xl text-white'>{Math.round(loanProgress)}%</span><span className='text-sm text-white/80'>₱{myData.activeLoan.current_balance} left</span></div><div className='w-full bg-white/20 rounded-full h-2.5 overflow-hidden'><div className='bg-blue-500 h-2.5 rounded-full transition-all duration-500' style={{ width: `${loanProgress}%` }}></div></div></div> : <p className='text-white/50 italic'>No active loan</p>}
                                </div>
                                <div className='bg-white/10 backdrop-blur-[10px] p-4 rounded-[20px] border border-white/30'><h3 className='text-white text-sm uppercase mb-1'>Total Savings</h3><p className='text-3xl text-white'>₱{myData.savingsTotal}</p></div>
                                <div className='bg-white/10 backdrop-blur-[10px] p-4 rounded-[20px] border border-white/30'><h3 className='text-white text-sm uppercase mb-1'>Total Insurance</h3><p className='text-3xl text-white'>₱{myData.insuranceTotal}</p></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- LEADER ONLY: MEMBER LIST --- */}
                {role === 'leader' && (
                    <div className='dashmember'>
                        <div className='flex justify-between items-center mb-6'>
                            <h2 className='membertitle'>Cluster Members List</h2>
                            <Link to="/add-member" className='addmember'><span className="text-lg">+</span> Add Member</Link>
                        </div>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            {members.map((member, index) => {
                                const progress = member.total_amount ? ((member.total_amount - member.current_balance) / member.total_amount) * 100 : 0;
                                return (
                                    <div key={index} onClick={() => navigate(`/member/${member.id}`)} className='membercard'>
                                        <div className='flex items-center gap-4'>
                                            <div className='w-12 h-12 rounded-[7px] bg-gray-200 overflow-hidden flex-shrink-0'>
                                                {member.profile_picture ? <img src={`http://localhost:8081/images/${member.profile_picture}`} className='w-full h-full object-cover'/> : <div className='w-full h-full flex items-center justify-center text-xs text-gray-500'>No Img</div>}
                                            </div>
                                            <div className='flex-1'>
                                                <p className='text-white'>{member.full_name}</p>
                                                <p className='text-xs text-white'>{member.phone_number}</p>
                                                <p className={`text-xs mt-1 ${member.late_count > 0 ? 'text-red-400' : 'text-white'}`}>Late Payments: {member.late_count}</p>
                                            </div>
                                            <button onClick={(e) => handleDeleteMember(e, member.id)} className='bg-white/0 border border-1 text-white px-2 py-[2px] rounded-[7px] hover:bg-red-500 hover:text-white transition z-10'>Delete</button>
                                        </div>
                                        {member.total_amount ? (
                                            <div className='mt-1'><div className='flex justify-between text-xs text-white mb-1'><span>Loan Progress</span><span>{Math.round(progress)}% Paid</span></div><div className='w-full bg-gray-200 rounded-full h-2.5'><div className='bg-blue-600 h-2.5 rounded-full transition-all duration-500 mt-[20px]' style={{ width: `${progress}%` }}></div></div></div>
                                        ) : <div className='text-xs text-white italic mt-2'>No active loans</div>}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* --- MEMBER ONLY: TABLE --- */}
                {role !== 'leader' && (
                    <div className='bg-white/20 backdrop-blur-[50px] rounded-[30px] shadow-sm border border-gray-200 overflow-hidden'>
                        <div className='p-6 border-b'><h2 className='text-xl text-white'>My Financial Records</h2></div>
                        <div className='overflow-x-auto'>
                            <table className='w-full text-left border-collapse'>
                                <thead className='bg-white/0 text-white text-xs uppercase'><tr><th className='px-6 py-3 text-white'>Type</th><th className='px-6 py-3 text-white'>Amount</th><th className='px-6 py-3 text-white'>Status</th><th className='px-6 py-3 text-white'>Date Recorded</th></tr></thead>
                                <tbody className='divide-y divide-gray-100'>
                                    {records.length > 0 ? records.map((rec, i) => (
                                        <tr key={i} className='hover:bg-white/20 transition'>
                                            <td className=' text-white px-6 py-4 capitalize'>{rec.type.replace('_', ' ')}</td>
                                            <td className=' text-white px-6 py-4'>₱{rec.amount}</td>
                                            <td className=' text-white px-6 py-4'><span className={`px-2 py-1 rounded-full text-xs ${rec.status === 'paid' ? 'bg-green-100 text-green-700' : rec.status === 'late' ? 'bg-orange-100 text-orange-700' : rec.status === 'cashed_out' ? 'bg-gray-200 text-gray-500 line-through' : 'bg-yellow-100 text-yellow-700'}`}>{rec.status.replace('_', ' ')}</span></td>
                                            <td className='px-6 py-4 text-white text-sm'>{new Date(rec.date_recorded).toLocaleDateString()}</td>
                                        </tr>
                                    )) : <tr><td colSpan="4" className="p-8 text-center text-gray-400 italic">No financial records found</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Dashboard;