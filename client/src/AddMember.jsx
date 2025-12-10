import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function AddMember() {
    const [values, setValues] = useState({
        full_name: '',
        phone_number: '',
        password: '',
        birthdate: '',
        spouse_name: ''
    });
    const [file, setFile] = useState(null); 
    const navigate = useNavigate();

    const handleSubmit = (event) => {
        event.preventDefault();
        const token = localStorage.getItem('token');
        
        const formData = new FormData();
        formData.append('full_name', values.full_name);
        formData.append('phone_number', values.phone_number);
        formData.append('password', values.password);
        formData.append('birthdate', values.birthdate);
        formData.append('spouse_name', values.spouse_name);
        if(file) {
            formData.append('image', file);
        }

        axios.post('http://localhost:8081/add-member', formData, {
            headers: { Authorization: token }
        })
        .then(res => {
            if(res.data.Status === "Success") {
                alert("Member Added Successfully");
                navigate('/dashboard');
            } else {
                alert("Error: " + res.data.Error);
            }
        })
        .catch(err => console.log(err));
    }

    return (
        <div className='min-h-screen flex justify-center items-center bg-gray-50/0 p-4'>
            {/* CONTAINER WITH GLASS EFFECT */}
            <div className='bg-white/0 backdrop-blur-[50px] p-8 rounded-[30px] shadow-lg w-full max-w-md border border-white/50 relative'>
                
                {/* Header */}
                <div className='flex justify-between items-center mb-6'>
                    <h2 className='text-2xl font-bold text-white'>Add New Member</h2>
                    <button 
                        onClick={() => navigate('/dashboard')} 
                        className='text-white/70 hover:text-white text-xl font-bold transition'
                    >
                        ✕
                    </button>
                </div>
                
                {/* Form */}
                <form onSubmit={handleSubmit} className='space-y-4'>
                    <div>
                        <label className='block text-xs font-bold text-white uppercase mb-1'>Full Name</label>
                        <input 
                            type="text" 
                            className='w-full p-3 border border-white/30 rounded-[15px] bg-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition'
                            required
                            placeholder="Juan Dela Cruz"
                            onChange={e => setValues({...values, full_name: e.target.value})}
                        />
                    </div>

                    <div>
                        <label className='block text-xs font-bold text-white uppercase mb-1'>Profile Picture</label>
                        <input 
                            type="file" 
                            className='w-full p-2 border border-white/30 rounded-[15px] bg-white/10 text-white file:mr-4 file:py-2 file:px-4 file:rounded-[10px] file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer'
                            onChange={e => setFile(e.target.files[0])}
                        />
                    </div>

                    <div className='flex gap-3'>
                        <div className='w-1/2'>
                            <label className='block text-xs font-bold text-white uppercase mb-1'>Birthdate</label>
                            <input 
                                type="date" 
                                className='w-full p-3 border border-white/30 rounded-[15px] bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                                required
                                onChange={e => setValues({...values, birthdate: e.target.value})}
                            />
                        </div>
                        <div className='w-1/2'>
                            <label className='block text-xs font-bold text-white uppercase mb-1'>Spouse Name</label>
                            <input 
                                type="text" 
                                className='w-full p-3 border border-white/30 rounded-[15px] bg-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                placeholder='Optional'
                                onChange={e => setValues({...values, spouse_name: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className='block text-xs font-bold text-white uppercase mb-1'>Phone (Login ID)</label>
                        <input 
                            type="text" 
                            className='w-full p-3 border border-white/30 rounded-[15px] bg-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500'
                            required
                            placeholder="09123456789"
                            onChange={e => setValues({...values, phone_number: e.target.value})}
                        />
                    </div>

                    <div>
                        <label className='block text-xs font-bold text-white uppercase mb-1'>Password</label>
                        <input 
                            type="password" 
                            className='w-full p-3 border border-white/30 rounded-[15px] bg-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500'
                            required
                            placeholder="••••••••"
                            onChange={e => setValues({...values, password: e.target.value})}
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        className='w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-[15px] shadow-lg transition duration-200 mt-4'
                    >
                        Register Member
                    </button>
                </form>
            </div>
        </div>
    )
}

export default AddMember;