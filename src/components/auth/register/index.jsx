// components/auth/register/index.jsx
import React, { useState } from 'react'
import { Navigate, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/authContext'
import { doCreateUserWithEmailAndPassword } from '../../../firebase/auth'

const Register = () => {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setconfirmPassword] = useState('')
    const [role, setRole] = useState('admin') // Default to admin, only option available
    const [isRegistering, setIsRegistering] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const { userLoggedIn } = useAuth()

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
            setErrorMessage('Role is required');
            return false;
        }
        setErrorMessage('');
        return true;
    }

    const onSubmit = async (e) => {
        e.preventDefault()
        if (!validateForm()) return;

        if(!isRegistering) {
            setIsRegistering(true)
            try {
                await doCreateUserWithEmailAndPassword(email, password, role)
                console.log('✅ Account created successfully with role:', role);
                // After successful registration, redirect to login
                navigate('/login');
            } catch (error) {
                setIsRegistering(false)
                if (error.code === 'auth/email-already-in-use') {
                    setErrorMessage('Email is already in use')
                } else if (error.code === 'auth/invalid-email') {
                    setErrorMessage('Invalid email address')
                } else if (error.code === 'auth/weak-password') {
                    setErrorMessage('Password is too weak')
                } else {
                    setErrorMessage('Failed to create account. Please try again.')
                }
            }
        }
    }

    return (
        <>
            {userLoggedIn && (<Navigate to={'/home'} replace={true} />)}

            <main className="w-full h-screen flex self-center place-content-center place-items-center">
                <div className="w-96 text-gray-600 space-y-5 p-4 shadow-xl border rounded-xl">
                    <div className="text-center mb-6">
                        <div className="mt-2">
                            <h3 className="text-gray-800 text-xl font-semibold sm:text-2xl">Create Admin Account</h3>
                            <p className="text-sm text-gray-500 mt-2">Create a new administrator account</p>
                        </div>
                    </div>
                    <form
                        onSubmit={onSubmit}
                        className="space-y-4"
                    >
                        <div>
                            <label className="text-sm text-gray-600 font-bold">
                                Email
                            </label>
                            <input
                                type="email"
                                autoComplete='email'
                                required
                                value={email} onChange={(e) => { setEmail(e.target.value) }}
                                className="w-full mt-2 px-3 py-2 text-gray-500 bg-transparent outline-none border focus:indigo-600 shadow-sm rounded-lg transition duration-300"
                            />
                        </div>

                        {/* ADDED: Role Selection - Only Admin Available */}
                        <div>
                            <label className="text-sm text-gray-600 font-bold">
                                Role
                            </label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="w-full mt-2 px-3 py-2 text-gray-500 bg-transparent outline-none border focus:border-indigo-600 shadow-sm rounded-lg transition duration-300"
                                disabled={isRegistering}
                            >
                                <option value="admin">Administrator</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                                Only administrator accounts can be created through public registration
                            </p>
                        </div>

                        <div>
                            <label className="text-sm text-gray-600 font-bold">
                                Password
                            </label>
                            <input
                                disabled={isRegistering}
                                type="password"
                                autoComplete='new-password'
                                required
                                value={password} onChange={(e) => { setPassword(e.target.value) }}
                                className="w-full mt-2 px-3 py-2 text-gray-500 bg-transparent outline-none border focus:border-indigo-600 shadow-sm rounded-lg transition duration-300"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-gray-600 font-bold">
                                Confirm Password
                            </label>
                            <input
                                disabled={isRegistering}
                                type="password"
                                autoComplete='off'
                                required
                                value={confirmPassword} onChange={(e) => { setconfirmPassword(e.target.value) }}
                                className="w-full mt-2 px-3 py-2 text-gray-500 bg-transparent outline-none border focus:border-indigo-600 shadow-sm rounded-lg transition duration-300"
                            />
                        </div>

                        {errorMessage && (
                            <span className='text-red-600 font-bold'>{errorMessage}</span>
                        )}

                        <button
                            type="submit"
                            disabled={isRegistering}
                            className={`w-full px-4 py-2 text-white font-medium rounded-lg ${isRegistering ? 'bg-gray-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-xl transition duration-300'}`}
                        >
                            {isRegistering ? 'Creating Admin Account...' : 'Create Admin Account'}
                        </button>
                        
                        <div className="text-sm text-center">
                            Already have an account? {'   '}
                            <Link to={'/login'} className="text-center text-sm hover:underline font-bold">Sign In</Link>
                        </div>
                    </form>
                </div>
            </main>
        </>
    )
}

export default Register