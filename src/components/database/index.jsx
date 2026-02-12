// components/database/index.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/authContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/firebase';
import { collection, getDocs } from 'firebase/firestore';

const Database = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const { currentUser, userLoggedIn } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!userLoggedIn) {
            navigate('/login');
            return;
        }
        
        const isAdmin = currentUser.email === 'mto_bill@gmail.com';
        if (!isAdmin) {
            navigate('/home');
        }
    }, [userLoggedIn, currentUser, navigate]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const querySnapshot = await getDocs(collection(db, "users"));
            const usersData = [];
            querySnapshot.forEach((doc) => {
                usersData.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            setUsers(usersData);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = () => {
        if (!isExpanded) {
            fetchUsers();
        }
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4">
                {/* Header */}
                <div className="bg-white shadow rounded-lg mb-8">
                    <div className="px-6 py-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    MUNICIPALITY OF LILOAN, SOUTHERN LEYTE
                                </h1>
                                <p className="text-gray-600 mt-1">User Database Management</p>
                            </div>
                            
                            <div className="flex space-x-4">
                                {/* Database Button */}
                                <button
                                    onClick={toggleExpand}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition duration-300"
                                >
                                    {isExpanded ? 'Hide Database' : 'Show Database'}
                                </button>
                                
                                {/* Back Button */}
                                <button
                                    onClick={() => navigate('/home')}
                                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition duration-300"
                                >
                                    Back to Home
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Success Message from Create Account */}
                <div className="mb-6">
                    {/* This space is for success messages from Create Account */}
                </div>

                {/* Database Section */}
                {isExpanded && (
                    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-6">User Database</h2>
                        
                        {loading ? (
                            <div className="flex justify-center items-center py-8">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : users.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-gray-500 text-lg">No users found in the database.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white border border-gray-200">
                                    <thead>
                                        <tr className="bg-gray-50 border-b">
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                No.
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Email
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Role
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Created At
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {users.map((user, index) => (
                                            <tr key={user.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {index + 1}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {user.email}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                        user.role === 'admin' 
                                                            ? 'bg-red-100 text-red-800'
                                                            : user.role === 'reader'
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : 'bg-green-100 text-green-800'
                                                    }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {user.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        
                        <div className="mt-6 flex justify-between items-center">
                            <p className="text-sm text-gray-600">
                                Total Users: {users.length}
                            </p>
                            <button
                                onClick={fetchUsers}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition duration-300"
                            >
                                Refresh Data
                            </button>
                        </div>
                    </div>
                )}

                {/* Create Account Form */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-2xl font-semibold text-gray-800 mb-6">Create New Account</h2>
                    
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        // Handle form submission here
                        const formData = new FormData(e.target);
                        const email = formData.get('email');
                        const password = formData.get('password');
                        const confirmPassword = formData.get('confirmPassword');
                        const role = formData.get('role');
                        
                        // Add your form validation and submission logic here
                        console.log({ email, password, confirmPassword, role });
                    }} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter email address"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Role
                                </label>
                                <select
                                    name="role"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                    <option value="reader">Reader</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter password"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Confirm Password
                                </label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Confirm password"
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex justify-end space-x-4">
                            <button
                                type="button"
                                onClick={() => navigate('/home')}
                                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition duration-300"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition duration-300"
                            >
                                Create Account
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Database;