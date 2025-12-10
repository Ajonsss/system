import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login() {
    const [values, setValues] = useState({ phone_number: '', password: '' });
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const handleSubmit = (event) => {
        event.preventDefault();
        axios.post('http://localhost:8081/login', values)
            .then(res => {
                if(res.data.Status === "Success") {
                    localStorage.setItem("token", res.data.token);
                    localStorage.setItem("role", res.data.role);
                    localStorage.setItem("userId", res.data.userId);
                    navigate('/dashboard');
                } else {
                    setError(res.data.Error);
                }
            })
            .catch(err => console.log(err));
    }

    return (
        <div className='flex justify-center items-center h-screen p-4'>
            {/* GLASS CONTAINER */}
            <div className='bg-white/0 backdrop-blur-[50px] p-8 rounded-[30px] shadow-lg w-full max-w-sm border border-white/50'>
                <h2 className='text-2xl font-bold mb-6 text-center text-white'>Cluster System Login</h2>
                
                {error && (
                    <div className='text-red-300 text-sm mb-4 text-center bg-red-500/20 p-2 rounded-[10px] border border-red-500/30'>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className='space-y-5'>
                    <div>
                        <label className='block text-xs font-bold text-white uppercase mb-1'>Phone Number</label>
                        <input type="text" 
                            className='w-full p-3 border border-white/30 rounded-[15px] bg-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition'
                            placeholder='Phone Number'
                            onChange={e => setValues({...values, phone_number: e.target.value})}/>
                    </div>
                    <div>
                        <label className='block text-xs font-bold text-white uppercase mb-1'>Password</label>
                        <input type="password" 
                            className='w-full p-3 border border-white/30 rounded-[15px] bg-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition'
                            placeholder='Password'
                            onChange={e => setValues({...values, password: e.target.value})}/>
                    </div>
                    <button className='w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-[15px] shadow-lg transition duration-200 mt-2'>
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    )
}

export default Login;