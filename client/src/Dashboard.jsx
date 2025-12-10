import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

function Dashboard() {
    const [role, setRole] = useState('');
    const [members, setMembers] = useState([]);
    const [records, setRecords] = useState([]);
    const [profile, setProfile] = useState({}); 
    const [newPassword, setNewPassword] = useState(''); 
    const navigate = useNavigate();

    useEffect(() => {
        const storedRole = localStorage.getItem('role');
        const storedId = localStorage.getItem('userId');
        const token = localStorage.getItem('token');
        
        if(!token) navigate('/');
        setRole(storedRole);

        // 1. Fetch My Profile (For everyone)
        axios.get(`http://localhost:8081/profile/${storedId}`, { headers: { Authorization: token } })
            .then(res => setProfile(res.data.Result || {}))
            .catch(err => console.log(err));

        // 2. Fetch Members (Leader only) - Now includes Loan Data
        if(storedRole === 'leader') {
            axios.get('http://localhost:8081/members', { headers: { Authorization: token } })
                .then(res => setMembers(res.data.Result || []))
                .catch(err => console.log(err));
        }

        // 3. Fetch Financial Records (Everyone)
        axios.get(`http://localhost:8081/my-records/${storedId}`, { headers: { Authorization: token } })
            .then(res => setRecords(res.data.Result || []))
            .catch(err => console.log(err));

    }, []);

    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    }

    const handleResetAdminPassword = () => {
        const token = localStorage.getItem('token');
        if(!newPassword) return alert("Enter a new password");
        
        axios.put('http://localhost:8081/reset-admin-password', { new_password: newPassword }, { headers: { Authorization: token } })
            .then(res => {
                if(res.data.Status === "Success") {
                    alert("Password updated successfully");
                    setNewPassword('');
                } else alert("Error updating password");
            })
            .catch(err => console.log(err));
    };

    const handleDeleteMember = (e, memberId) => {
        e.stopPropagation(); // Prevent clicking the card when clicking delete
        if(!window.confirm("Are you sure you want to delete this member?")) return;

        const token = localStorage.getItem('token');
        axios.delete(`http://localhost:8081/delete-member/${memberId}`, { headers: { Authorization: token } })
            .then(res => {
                if(res.data.Status === "Success") {
                    // Remove from list visually
                    setMembers(members.filter(m => m.id !== memberId));
                } else {
                    alert("Error deleting member");
                }
            });
    };

    return (
        <div className='dashscreen'>
            {/* Navbar */}
            <nav className='dashnav'>
                <div className='dashnava'>
                    <h1>Cluster Management System</h1>
                    <button onClick={handleLogout}>Logout</button>
                </div>
            </nav>

            <div className='max-w-6xl mx-auto p-6 space-y-8'>
                
                {/* --- HEADER SECTION --- */}
                <div className='dashhead'>
                    {role === 'leader' ? (
                        // ADMIN VIEW
                        <div className='flex flex-col md:flex-row justify-between items-center gap-4'>
                            <div>
                                <h2 className='dashtitle'>Admin Dashboard</h2>
                                <p className='dashp'>Manage your cluster members below.</p>
                            </div>

                            <div className='flex gap-2 w-full md:w-auto'>
                                <input 
                                    type="password" 
                                    placeholder="New Admin Password" 
                                    className='dashadpw' 
                                    value={newPassword} 
                                    onChange={e => setNewPassword(e.target.value)} 
                                />
                                <button onClick={handleResetAdminPassword} className='bg-white/0 border border-white hover:bg-red-600 text-white px-4 py-2 rounded-[10px] shadow transition'>
                                    Reset Password
                                </button>
                            </div>
                        </div>
                    ) : (
                        // MEMBER VIEW: Show Full Profile Card
                        <div className='flex flex-col md:flex-row gap-6 items-center md:items-start'>
                            <div className='w-32 h-32 rounded-full overflow-hidden border-4 border-gray-100 shadow-sm flex-shrink-0 bg-gray-200'>
                                {profile.profile_picture ? (
                                    <img src={`http://localhost:8081/images/${profile.profile_picture}`} alt="Profile" className='w-full h-full object-cover'/>
                                ) : (
                                    <div className='w-full h-full flex items-center justify-center text-gray-400'>No Img</div>
                                )}
                            </div>
                            <div className='flex-1 space-y-2 text-center md:text-left'>
                                <h2 className='text-2xl  text-white'>{profile.full_name}</h2>
                                <div className='text-white grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1'>
                                    <p><span className='text-white'>Phone:</span> {profile.phone_number}</p>
                                    <p><span className='text-white'>Role:</span> <span className='capitalize'>{profile.role}</span></p>
                                    <p><span className='text-white'>Birthdate:</span> {profile.birthdate ? new Date(profile.birthdate).toLocaleDateString() : 'N/A'}</p>
                                    <p><span className='text-white'>Spouse:</span> {profile.spouse_name || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- LEADER ONLY: MEMBER LIST WITH LOAN GRAPHS --- */}
                {role === 'leader' && (
                    <div className='dashmember'>
                        <div className='flex justify-between items-center mb-6'>
                            <h2 className='membertitle'>Cluster Members List</h2>
                            <Link to="/add-member" className='addmember'>
                                <span className="text-lg font-bold">+</span> Add Member
                            </Link>
                        </div>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            {members.map((member, index) => {
                                // Calculate Loan Progress for this specific member
                                const progress = member.total_amount 
                                    ? ((member.total_amount - member.current_balance) / member.total_amount) * 100 
                                    : 0;

                                return (
                                    <div key={index} 
                                         onClick={() => navigate(`/member/${member.id}`)}
                                         className='membercard'>
                                        
                                        {/* Top Section: Info */}
                                        <div className='flex items-center gap-4'>
                                            <div className='w-12 h-12 rounded-[7px] bg-gray-200 overflow-hidden flex-shrink-0'>
                                                {member.profile_picture ? 
                                                    <img src={`http://localhost:8081/images/${member.profile_picture}`} className='w-full h-full object-cover' alt="Member"/> : 
                                                    <div className='w-full h-full flex items-center justify-center text-xs text-gray-500'>No Img</div>
                                                }
                                            </div>
                                            <div className='flex-1'>
                                                <p className='font-semibold text-white'>{member.full_name}</p>
                                                <p className='text-xs text-white'>{member.phone_number}</p>
                                            </div>
                                            
                                            {/* DELETE BUTTON */}
                                            <button 
                                                onClick={(e) => handleDeleteMember(e, member.id)}
                                                className='bg-white/0 border border-1 text-white px-2 py-[2px] rounded-[7px] hover:bg-red-500 hover:text-white transition z-10'
                                                title="Delete Member"
                                            >
                                                Delete
                                            </button>
                                        </div>

                                        {/* Loan Bar Graph */}
                                        {member.total_amount ? (
                                            <div className='mt-1'>
                                                <div className='flex justify-between  text-xs text-white mb-1'>
                                                    <span>Loan Progress</span>
                                                    <span>{Math.round(progress)}% Paid</span>
                                                </div>
                                                <div className='w-full bg-gray-200 rounded-full h-2.5'>
                                                    <div 
                                                        className='bg-blue-600 h-2.5 rounded-full transition-all duration-500 mt-[20px]' 
                                                        style={{ width: `${progress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className='text-xs text-white italic mt-2'>No active loans</div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* --- FINANCIAL RECORDS (HIDDEN FOR ADMIN) --- */}
                {role !== 'leader' && (
                    <div className='bg-white/20 backdrop-blur-[50px] rounded-[30px] shadow-sm border border-gray-200 overflow-hidden'>
                        <div className='p-6 border-b'>
                            <h2 className='text-xl font-bold text-white'>My Financial Records</h2>
                        </div>
                        <div className='overflow-x-auto'>
                            <table className='w-full text-left border-collapse'>
                                <thead className='bg-white/0 text-white text-xs uppercase'>
                                    <tr>
                                        <th className='px-6 py-3 font-semibold text-white'>Type</th>
                                        <th className='px-6 py-3 font-semibold text-white'>Amount</th>
                                        <th className='px-6 py-3 font-semibold text-white'>Status</th>
                                        <th className='px-6 py-3 font-semibold text-white'>Date Recorded</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-gray-100'>
                                    {records.length > 0 ? records.map((rec, i) => (
                                        <tr key={i} className='hover:bg-white/20 transition'>
                                            <td className=' text-white px-6 py-4 capitalize font-medium text-white'>{rec.type.replace('_', ' ')}</td>
                                            <td className=' text-white px-6 py-4 text-white'>₱{rec.amount}</td>
                                            <td className=' text-white px-6 py-4'>
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                    rec.status === 'paid' ? 'bg-green-100 text-green-700' :
                                                    rec.status === 'late' ? 'bg-orange-100 text-orange-700' :
                                                    rec.status === 'cashed_out' ? 'bg-gray-200 text-gray-500 line-through' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {rec.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className='px-6 py-4 text-white text-sm'>{new Date(rec.date_recorded).toLocaleDateString()}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="4" className="p-8 text-center text-gray-400 italic">No financial records found</td>
                                        </tr>
                                    )}
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