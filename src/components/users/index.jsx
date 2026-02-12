// components/users/index.jsx
import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/authContext'
import { doSignOut } from '../../firebase/auth'
import { Link, useNavigate } from 'react-router-dom'
import { isAdminUser } from '../../utils/roleHelpers'

const User = () => {
    const navigate = useNavigate()
    const { currentUser, userLoggedIn } = useAuth()
    const [loading, setLoading] = useState(true)
    
    console.log('👤 User Component - Current User:', {
        email: currentUser?.email,
        uid: currentUser?.uid,
        displayName: currentUser?.displayName,
        isLoggedIn: userLoggedIn
    });

    useEffect(() => {
        const checkAdminRole = async () => {
            if (userLoggedIn && currentUser) {
                try {
                    const adminStatus = await isAdminUser(currentUser);
                    
                    // Redirect admin users to admin dashboard
                    if (adminStatus) {
                        console.log('👑 Admin user detected in user dashboard, redirecting to /home');
                        navigate('/home', { replace: true });
                    }
                } catch (error) {
                    console.error('Error checking admin role:', error);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };

        checkAdminRole();
    }, [userLoggedIn, currentUser, navigate]);

    const handleLogout = () => {
        console.log('🚪 Logging out user:', currentUser?.email);
        doSignOut().then(() => { 
            console.log('✅ User logged out successfully');
            navigate('/login'); 
        });
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-blue-200 shadow">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                MUNICIPALITY OF LILOAN, SOUTHERN LEYTE
                            </h1>
                            <p className="text-lg text-gray-600 mt-2">
    Welcome, {currentUser.displayName || currentUser.email}!
</p>
                        </div>
                        
                        {/* User Info and Logout */}
                        <div className="flex items-center space-x-4 bg-gray-100 rounded-lg px-4 py-3">
                            <div className="text-right">
                                <p className="font-medium text-gray-800">
                                    {currentUser.displayName || currentUser.email}
                                </p>
                                <span className="text-sm text-blue-600 font-medium">User</span>
                            </div>
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                <span className="text-white font-semibold text-sm">
                                    {currentUser.displayName 
                                        ? currentUser.displayName.charAt(0).toUpperCase() 
                                        : currentUser.email.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            
                            {
                                userLoggedIn
                                    ?
                                    <>
                                        <button 
                                            onClick={handleLogout}
                                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                                        >
                                            Logout
                                        </button>
                                    </>
                                    :
                                    <>
                                        <Link className='text-sm text-blue-600 underline' to={'/login'}></Link>
                                        <Link className='text-sm text-blue-600 underline' to={'/register'}></Link>
                                    </>
                            }
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                
                <div className="border-t pt-8">
                    {/* Waterworks System Header */}
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-bold text-gray-900 mb-4">
                            Liloan Waterworks System
                        </h1>
                        <p className="text-xl text-gray-600">ENGAGE WITH US</p>
                    </div>

                    {/* Action Buttons Grid - Only 3 buttons as shown in image */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                        {/* View Database */}
                        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-6 text-center border border-gray-200 cursor-pointer">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">View Database</h3>
                            <p className="text-gray-600 text-sm">Access and review system records</p>
                        </div>

                        {/* Add Payment */}
                        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-6 text-center border border-gray-200 cursor-pointer">
                            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Add Payment</h3>
                            <p className="text-gray-600 text-sm">Process customer payments</p>
                        </div>

                        {/* Export Data */}
                        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-6 text-center border border-gray-200 cursor-pointer">
                            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Export Data</h3>
                            <p className="text-gray-600 text-sm">Download reports and data</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-white border-t mt-12">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <p className="text-center text-gray-600">
                        © 2025 Municipality of Liloan. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    )
}

export default User