// components/admin/CreateAccount.jsx
import React, { useState, useEffect } from 'react';
import { doCreateUserWithRole } from '../../firebase/auth';
import { useAuth } from '../../contexts/authContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/firebase';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { isAdminUser } from '../../utils/roleHelpers';
import { updateProfile } from 'firebase/auth';

const CreateAccount = () => {
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState(''); // ADDED: Full Name field
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState('user');
    const [isCreating, setIsCreating] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSuccessIcon, setShowSuccessIcon] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    const { currentUser, userLoggedIn } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const checkAdminAndRedirect = async () => {
            if (!userLoggedIn) {
                console.log('🚫 No user logged in, redirecting to login');
                navigate('/login');
                return;
            }

            try {
                const adminStatus = await isAdminUser(currentUser);
                setIsAdmin(adminStatus);

                if (!adminStatus) {
                    console.log('🚫 Non-admin user trying to access admin panel, redirecting');
                    navigate('/home');
                    return;
                }

                console.log('👨‍💼 CreateAccount Component - Admin User:', {
                    email: currentUser?.email,
                    uid: currentUser?.uid,
                    isAdmin: adminStatus
                });

                // Auto-fetch users when component mounts
                console.log('📥 Fetching users database...');
                fetchUsers();
            } catch (error) {
                console.error('Error checking admin status:', error);
                navigate('/home');
            }
        };

        checkAdminAndRedirect();
    }, [userLoggedIn, currentUser, navigate]);

    const validateForm = () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!email) {
            setErrorMessage('Email is required');
            return false;
        }
        if (!emailRegex.test(email)) {
            setErrorMessage('Please enter a valid email address');
            return false;
        }
        if (!fullName) { // ADDED: Full Name validation
            setErrorMessage('Full Name is required');
            return false;
        }
        if (!password) {
            setErrorMessage('Password is required');
            return false;
        }
        if (password.length < 6) {
            setErrorMessage('Password must be at least 6 characters long');
            return false;
        }
        if (password !== confirmPassword) {
            setErrorMessage('Passwords do not match');
            return false;
        }
        if (!role) {
            setErrorMessage('Please select a role');
            return false;
        }

        setErrorMessage('');
        return true;
    };
    

    const onSubmit = async (e) => {
        e.preventDefault();
        
        console.log('📝 Account creation form submitted:', {
            email: email,
            fullName: fullName, // ADDED
            role: role,
            admin: currentUser?.fullName
        });

        if (!validateForm()) {
            console.log('❌ Form validation failed');
            return;
        }

        if (!isCreating) {
            setIsCreating(true);
            setErrorMessage('');
            setSuccessMessage('');
            setShowSuccessIcon(false);

            try {
                console.log('🔄 Creating new account...');
                const userCredential = await doCreateUserWithRole(email, password, role, fullName);

                await updateProfile(userCredential.user, {
                    displayName: fullName
                });
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    email: email,
                    fullName: fullName, // Store full name in Firestore
                    role: role,
                    createdAt: new Date(),
                    createdBy: currentUser?.email
                }, { merge: true });
                
                console.log('✅ Account created successfully:', {
                    email: email,
                    role: role,
                    createdBy: currentUser?.email,
                    timestamp: new Date().toISOString()
                });
                
                setSuccessMessage(`Successfully created ${role} account for ${email}`);
                setShowSuccessIcon(true);
                
                // Refresh users after successful creation
                console.log('🔄 Refreshing users list after account creation');
                fetchUsers();
                
                // Reset form after successful creation
                setTimeout(() => {
                    setEmail('');
                    setFullName('');
                    setPassword('');
                    setConfirmPassword('');
                    setRole('user');
                    setShowSuccessIcon(false);
                    console.log('🔄 Form reset after successful creation');
                }, 3000);
                
            } catch (error) {
                console.error('❌ Error creating account:', {
                    errorCode: error.code,
                    errorMessage: error.message,
                    email: email,
                    admin: currentUser?.email
                });
                
                if (error.code === 'auth/email-already-in-use') {
                    setErrorMessage('Email is already in use');
                } else if (error.code === 'auth/invalid-email') {
                    setErrorMessage('Invalid email address');
                } else if (error.code === 'auth/weak-password') {
                    setErrorMessage('Password is too weak');
                } else {
                    setErrorMessage('Failed to create account. Please try again.');
                }
            } finally {
                setIsCreating(false);
            }
        }
    };

    const fetchUsers = async () => {
        try {
            console.log('📊 Fetching users from database...');
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
            console.log('✅ Users fetched successfully:', {
                totalUsers: usersData.length,
                users: usersData.map(user => ({ email: user.email, fullName: user.fullName, role: user.role }))
            });
        } catch (error) {
            console.error("❌ Error fetching users:", {
                error: error,
                admin: currentUser?.email
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshUsers = () => {
        console.log('🔄 Manual refresh triggered by admin:', currentUser?.email);
        fetchUsers();
    };

    const handleBackToHome = () => {
        console.log('🏠 Navigating back to home from admin panel');
        navigate('/home');
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
                                <p className="text-gray-600 mt-1">Manage User Accounts</p>
                                <p className="text-sm text-blue-600 mt-1">
                                    Logged in as: {currentUser?.displayName}
                                </p>
                            </div>
                            
                            {/* Back Button */}
                            <button
                                onClick={handleBackToHome}
                                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition duration-300"
                            >
                                Back to Home
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-8">
                    {/* Create Account Form - Left Side (Narrow) */}
                    <div className="w-1/3">
                        <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
                            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Create New Account</h2>
                            
                            
                            <form onSubmit={onSubmit} className="space-y-2">
                            <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Enter full name"
                                        disabled={isCreating}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Enter email address"
                                        disabled={isCreating}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Role
                                    </label>
                                    <select
                                        value={role}
                                        onChange={(e) => setRole(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        disabled={isCreating}
                                    >
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                        <option value="reader">Reader</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Enter password"
                                        disabled={isCreating}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Confirm password"
                                        disabled={isCreating}
                                    />
                                </div>

                                {/* Error Message */}
                                {errorMessage && (
                                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">
                                        {errorMessage}
                                    </div>
                                )}

                                {/* Success Message with Icon */}
                                {successMessage && (
                                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-sm flex items-center">
                                        {showSuccessIcon && (
                                            <svg className="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                        {successMessage}
                                    </div>
                                )}

                                <div className="flex justify-end space-x-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={handleBackToHome}
                                        disabled={isCreating}
                                        className={`px-6 py-2 border rounded-lg transition duration-300 ${
                                            isCreating 
                                                ? 'border-gray-300 text-gray-400 cursor-not-allowed' 
                                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isCreating}
                                        className={`px-6 py-2 text-white font-medium rounded-lg transition duration-300 flex items-center justify-center min-w-[140px] ${
                                            isCreating 
                                                ? 'bg-blue-400 cursor-not-allowed' 
                                                : 'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                    >
                                        {isCreating ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Creating...
                                            </>
                                        ) : showSuccessIcon ? (
                                            <>
                                            
                                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                                Success!
                                            </>
                                        ) : (
                                            'Create Account'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Database Section - Right Side (Wide) */}
                    <div className="flex-1">
                        <div className="bg-white rounded-xl shadow-lg p-6 h-[calc(95vh-200px)] flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-semibold text-gray-800">User Database</h2>
                                <button
                                    onClick={handleRefreshUsers}
                                    disabled={isCreating}
                                    className={`px-4 py-2 rounded-lg text-sm transition duration-300 flex items-center ${
                                        isCreating 
                                            ? 'bg-gray-400 cursor-not-allowed text-white' 
                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Refresh
                                </button>
                            </div>
                            
                            {loading ? (
                                <div className="flex justify-center items-center py-8 flex-1">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                                </div>
                            ) : users.length === 0 ? (
                                <div className="text-center py-8 flex-1 flex items-center justify-center">
                                    <p className="text-gray-500 text-lg">No users found in the database.</p>
                                </div>
                            ) : (
                                <div className="overflow-hidden flex flex-col flex-1">
                                    <div className="overflow-y-auto flex-1">
                                        <table className="min-w-full bg-white">
                                            <thead className="sticky top-0 bg-gray-50">
                                                <tr className="border-b">
                                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        No.
                                                    </th>
                                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Full Name
                                                    </th>
                                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Email
                                                    </th>
                                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Role
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
                                                            {user.fullName || 'N/A'} {/* ADDED: Show full name */}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                            {user.email}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                                                                user.role === 'admin' 
                                                                    ? 'bg-red-100 text-red-800'
                                                                    : user.role === 'reader'
                                                                    ? 'bg-blue-100 text-blue-800'
                                                                    : 'bg-green-100 text-green-800'
                                                            }`}>
                                                                {user.role}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            
                            <div className="mt-4 flex justify-between items-center pt-4 border-t border-gray-200">
                                <p className="text-sm text-gray-600">
                                    Total Users: <span className="font-semibold">{users.length}</span>
                                </p>
                                <p className="text-xs text-gray-500">
                                    Auto-refreshed on account creation
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateAccount;