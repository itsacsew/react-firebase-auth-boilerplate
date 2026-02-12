// components/home/index.jsx
import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/authContext'
import { doSignOut } from '../../firebase/auth'
import { Link, useNavigate } from 'react-router-dom'
import { isAdminUser } from '../../utils/roleHelpers'

const Home = () => {
    const navigate = useNavigate()
    const { currentUser, userLoggedIn } = useAuth();
    const [isAdmin, setIsAdmin] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const checkAdminRole = async () => {
            if (userLoggedIn && currentUser) {
                try {
                    const adminStatus = await isAdminUser(currentUser);
                    setIsAdmin(adminStatus);
                    
                    console.log('🏠 Home Component - User Role Check:', {
                        email: currentUser.email,
                        isAdmin: adminStatus,
                        isLoggedIn: userLoggedIn
                    });

                    // Redirect non-admin users to user dashboard
                    if (!adminStatus) {
                        console.log('🚫 Non-admin user detected, redirecting to /users');
                        navigate('/users', { replace: true });
                    }
                } catch (error) {
                    console.error('Error checking admin role:', error);
                    setIsAdmin(false);
                    navigate('/users', { replace: true });
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };

        checkAdminRole();
    }, [userLoggedIn, currentUser, navigate]);

    const handleManageAccounts = () => {
        console.log('📋 Navigating to admin panel');
        navigate('/admin');
    }

    const handleLogout = async () => {
        console.log('🚪 Logging out user:', currentUser?.email);
        try {
            await doSignOut(); // Use doSignOut directly instead of manualSignOut
            console.log('✅ User logged out successfully');
            navigate('/login');
        } catch (error) {
            console.error('❌ Logout error:', error);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Show nothing if not admin (redirect will happen)
    if (!isAdmin) {
        return null;
    }
   
    return (
        <div className="min-h-screen bg-green-50">
            {/* Header */}
            <div className="bg-blue-200 shadow">
                <div className="max-w-10xl mx-auto px-4 py-6">
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
                        <div className="flex items-center space-x-4 bg-green-50 rounded-lg px-4 py-3">
                            <div className="text-right">
                                <p className="font-medium text-gray-800">
                                    {currentUser.displayName || currentUser.email}
                                </p>
                                <span className="text-sm text-blue-600 font-medium">Admin User</span>
                            </div>
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                <span className="text-white font-semibold text-sm">
                                    {currentUser.displayName 
                                        ? currentUser.displayName.charAt(0).toUpperCase() 
                                        : currentUser.email.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            
                            {userLoggedIn && (
                                <button 
                                    onClick={handleLogout}
                                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                                >
                                    Logout
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                
                    {/* Waterworks System Header */}
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-bold text-gray-900 mb-4">
                            Liloan Waterworks System
                        </h1>
                        <p className="text-xl text-gray-600">ENGAGE WITH US</p>
                    </div>

                    {/* Action Buttons Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
                    
<div 
    onClick={() => navigate('/import')}
    className="bg-blue-200 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-6 text-center border border-gray-200 cursor-pointer hover:bg-blue-300 hover:-translate-y-1 hover:border-blue-400 transform group"
>
    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 group-hover:scale-110 transition-all duration-300">
        <svg className="w-8 h-8 text-blue-600  group-hover:text-blue-700 group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
        </svg>
    </div>
    <h3 className="text-lg font-semibold text-gray-800 mb-2">Import Data</h3>
    <p className="text-gray-600 text-sm">Upload and import water system data</p>
</div>


<div 
    onClick={() => navigate('/store')}
    className="bg-blue-200 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-6 text-center border border-gray-200 cursor-pointer hover:bg-blue-300 hover:-translate-y-1 hover:border-blue-400 transform group"
>
    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-green-200 group-hover:scale-110 transition-all duration-300">
        <svg className="w-8 h-8 text-green-600 group-hover:text-green-700 group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    </div>
    <h3 className="text-lg font-semibold text-gray-800 mb-2 group-hover:text-gray-900">View Database</h3>
    <p className="text-gray-600 text-sm group-hover:text-gray-700">Access and review system records</p>
</div>

                        {/* Add Payment */}
                        
<div 
  onClick={() => navigate('/payment')}
  className="bg-blue-200 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-6 text-center border border-gray-200 cursor-pointer hover:bg-blue-300 hover:-translate-y-1 hover:border-blue-400 transform group"
>
  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-yellow-200 group-hover:scale-110 transition-all duration-300">
    <svg className="w-8 h-8 text-yellow-600 group-hover:text-yellow-700 group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
    </svg>
  </div>
  <h3 className="text-lg font-semibold text-gray-800 mb-2">Add Payment</h3>
  <p className="text-gray-600 text-sm">Process consumer payments</p>
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

                        {/* Manage Accounts */}
                        <div 
                            onClick={handleManageAccounts}
                            className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-6 text-center border border-gray-200 cursor-pointer"
                        >
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Manage Accounts</h3>
                            <p className="text-gray-600 text-sm">Handle user accounts and permissions</p>
                        </div>

                        {/* Read Meter */}
                        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-6 text-center border border-gray-200 cursor-pointer">
                            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Read Meter</h3>
                            <p className="text-gray-600 text-sm">Record and manage meter readings</p>
                        </div>
                    </div>
                
            </div>

            {/* Footer */}
            <div className="max-w-7xl mx-auto px-2 py-2">
                <p className="text-center text-gray-600">
                    © 2025 Municipality of Liloan. All rights reserved.
                </p>
            </div>
        </div>
    )
}

export default Home