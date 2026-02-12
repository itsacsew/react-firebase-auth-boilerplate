// components/store/index.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/authContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/firebase';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';

const Store = () => {
    const [consumers, setConsumers] = useState([]);
    const [filteredConsumers, setFilteredConsumers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchType, setSearchType] = useState('consumerName'); // 'consumerName' or 'wsin'
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [selectedConsumerDetails, setSelectedConsumerDetails] = useState(null);
    const [showConsumerDetails, setShowConsumerDetails] = useState(false);
    const [billingRecords, setBillingRecords] = useState([]);
    
    const { currentUser, userLoggedIn } = useAuth();
    const navigate = useNavigate();

    // Function to format month properly
    const formatMonth = (month) => {
        if (!month) return 'Unknown';
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // If month is already a full month name, return as is
        if (monthNames.includes(month)) {
            return month;
        }
        
        // If month is a short name, convert to full name
        const shortIndex = shortMonthNames.findIndex(m => m.toLowerCase() === month.toLowerCase());
        if (shortIndex !== -1) {
            return monthNames[shortIndex];
        }
        
        // If month is a number, convert to month name
        const monthNum = parseInt(month);
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
            return monthNames[monthNum - 1];
        }
        
        return month; // Return as is if cannot convert
    };

    // Function to format billing period
    const formatBillingPeriod = (billingPeriod) => {
        if (!billingPeriod) return 'N/A';
        
        const parts = billingPeriod.split(' ');
        if (parts.length === 2) {
            const month = formatMonth(parts[0]);
            const year = parts[1];
            return `${month} ${year}`;
        }
        
        return billingPeriod;
    };

    useEffect(() => {
        if (!userLoggedIn) {
            navigate('/login');
            return;
        }
        fetchConsumersData();
    }, [userLoggedIn, navigate]);

    const fetchConsumersData = async () => {
        try {
            setLoading(true);
            const querySnapshot = await getDocs(collection(db, 'consumers'));
            const consumersData = [];
            
            for (const docSnapshot of querySnapshot.docs) {
                const consumerData = {
                    id: docSnapshot.id,
                    ...docSnapshot.data()
                };

                // Get latest billing record for this consumer
                try {
                    const billingQuery = await getDocs(
                        collection(db, 'consumers', docSnapshot.id, 'billingRecords')
                    );
                    
                    if (!billingQuery.empty) {
                        // Get all billing records and find the most recent
                        const billingRecords = [];
                        billingQuery.forEach(billingDoc => {
                            billingRecords.push({
                                id: billingDoc.id,
                                ...billingDoc.data()
                            });
                        });
                        
                        // Sort by date, most recent first
                        billingRecords.sort((a, b) => {
                            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                            return dateB - dateA;
                        });

                        const latestBilling = billingRecords[0];
                        if (latestBilling) {
                            consumerData.latestBilling = latestBilling;
                            consumerData.year = latestBilling.year;
                            consumerData.month = latestBilling.month;
                            consumerData.billingPeriod = formatBillingPeriod(latestBilling.billingPeriod);
                            consumerData.status = latestBilling.status;
                            consumerData.presentReading = latestBilling.presentReading;
                            consumerData.previousReading = latestBilling.previousReading;
                            consumerData.consumption = latestBilling.waterConsumption;
                            consumerData.waterCharge = latestBilling.waterCharge;
                            consumerData.surcharge = latestBilling.surcharge;
                            consumerData.overallTotal = latestBilling.overallTotal;
                            consumerData.paymentStatus = latestBilling.paymentStatus || 'unpaid';
                            consumerData.processedBy = latestBilling.processedBy;
                            consumerData.createdAt = latestBilling.createdAt;
                        }
                    }
                } catch (billingError) {
                    console.error('Error fetching billing records:', billingError);
                }

                consumersData.push(consumerData);
            }
            
            // Sort by creation date, newest first
            consumersData.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return dateB - dateA;
            });
            
            setConsumers(consumersData);
            setFilteredConsumers(consumersData);
            console.log('📊 Consumers data fetched:', consumersData.length, 'records');
        } catch (error) {
            console.error('❌ Error fetching consumers data:', error);
            setErrorMessage('Failed to load consumers data');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        if (!searchTerm.trim()) {
            // If search term is empty, show all consumers
            setFilteredConsumers(consumers);
            setSuccessMessage('Showing all consumer records');
            return;
        }

        const filtered = consumers.filter(consumer => {
            const searchLower = searchTerm.toLowerCase().trim();
            
            if (searchType === 'consumerName') {
                return consumer.consumerName?.toLowerCase().includes(searchLower);
            } else if (searchType === 'wsin') {
                return consumer.wsin?.toString().includes(searchTerm);
            }
            return false;
        });

        setFilteredConsumers(filtered);
        
        if (filtered.length === 0) {
            setErrorMessage(`No consumers found with ${searchType === 'consumerName' ? 'name' : 'WSIN'} containing "${searchTerm}"`);
            setSuccessMessage('');
        } else {
            setSuccessMessage(`Found ${filtered.length} consumer(s) matching your search`);
            setErrorMessage('');
        }
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        setFilteredConsumers(consumers);
        setSuccessMessage('Showing all consumer records');
        setErrorMessage('');
    };

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value);
        // Clear messages when user starts typing
        if (successMessage) setSuccessMessage('');
        if (errorMessage) setErrorMessage('');
    };

    const handleSearchTypeChange = (e) => {
        setSearchType(e.target.value);
        setSearchTerm('');
        setFilteredConsumers(consumers);
        setSuccessMessage('Search filter changed. Enter search term to filter results.');
        setErrorMessage('');
    };

    const handleBackToHome = () => {
        navigate('/home');
    };

    const handleViewConsumerDetails = async (consumer) => {
        setSelectedConsumerDetails(consumer);
        setShowConsumerDetails(true);
        
        try {
            const billingQuery = await getDocs(
                collection(db, 'consumers', consumer.id, 'billingRecords')
            );
            const records = [];
            billingQuery.forEach((doc) => {
                records.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Sort by date, most recent first
            records.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return dateB - dateA;
            });
            
            setBillingRecords(records);
        } catch (error) {
            console.error('Error fetching billing records:', error);
            setBillingRecords([]);
        }
    };

    const handleBackToConsumerList = () => {
        setShowConsumerDetails(false);
        setSelectedConsumerDetails(null);
        setBillingRecords([]);
    };

    const getServiceTypeColor = (serviceType) => {
        switch (serviceType?.toLowerCase()) {
            case 'residential':
                return 'bg-green-100 text-green-800';
            case 'commercial':
                return 'bg-blue-100 text-blue-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getConsumerTypeColor = (consumerType) => {
        switch (consumerType?.toLowerCase()) {
            case 'new':
                return 'bg-purple-100 text-purple-800';
            case 'old':
                return 'bg-orange-100 text-orange-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'defect':
                return 'bg-red-100 text-red-800';
            case 'normal':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getPaymentStatusColor = (paymentStatus) => {
        switch (paymentStatus?.toLowerCase()) {
            case 'paid':
                return 'bg-green-100 text-green-800';
            case 'unpaid':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    // Format date for display
    const formatDate = (dateValue) => {
        if (!dateValue) return 'N/A';
        
        try {
            if (dateValue.toDate) {
                return dateValue.toDate().toLocaleDateString();
            } else if (dateValue instanceof Date) {
                return dateValue.toLocaleDateString();
            } else {
                return new Date(dateValue).toLocaleDateString();
            }
        } catch (error) {
            return 'Invalid Date';
        }
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
                                <p className="text-gray-600 mt-1">Consumer Records Database</p>
                                <p className="text-sm text-blue-600 mt-1">
                                    Logged in as: {currentUser?.displayName || currentUser?.email}
                                </p>
                            </div>
                            
                            <div className="flex space-x-4">
                                <button
                                    onClick={fetchConsumersData}
                                    disabled={loading}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition duration-300 flex items-center"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Refresh
                                </button>
                                
                                <button
                                    onClick={handleBackToHome}
                                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition duration-300"
                                >
                                    Back to Home
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-8">
                    {/* Search Form - Left Side */}
                    <div className="w-1/3">
                        <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
                            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Search Consumers</h2>
                            
                            <div className="space-y-4">
                                {/* Search Type Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Search By
                                    </label>
                                    <div className="flex space-x-4">
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="searchType"
                                                value="consumerName"
                                                checked={searchType === 'consumerName'}
                                                onChange={handleSearchTypeChange}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                            />
                                            <span className="ml-2 text-sm text-gray-700">Consumer Name</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="searchType"
                                                value="wsin"
                                                checked={searchType === 'wsin'}
                                                onChange={handleSearchTypeChange}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                            />
                                            <span className="ml-2 text-sm text-gray-700">WSIN</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Search Input */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {searchType === 'consumerName' ? 'Consumer Name' : 'WSIN Number'}
                                    </label>
                                    <input
                                        type={searchType === 'wsin' ? 'number' : 'text'}
                                        value={searchTerm}
                                        onChange={handleInputChange}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                handleSearch();
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder={searchType === 'consumerName' ? 'Enter consumer name...' : 'Enter WSIN number...'}
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="flex space-x-4">
                                    <button
                                        onClick={handleSearch}
                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition duration-300"
                                    >
                                        Search
                                    </button>
                                    
                                    <button
                                        onClick={handleClearSearch}
                                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition duration-300"
                                    >
                                        Clear
                                    </button>
                                </div>

                                {/* Messages */}
                                {errorMessage && (
                                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">
                                        {errorMessage}
                                    </div>
                                )}

                                {successMessage && (
                                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-sm">
                                        {successMessage}
                                    </div>
                                )}

                                {/* Statistics */}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <h3 className="font-semibold text-blue-800 mb-2">Database Statistics</h3>
                                    <div className="text-sm text-blue-700 space-y-1">
                                        <p>Total Records: {consumers.length}</p>
                                        <p>Showing: {filteredConsumers.length}</p>
                                        <p>Last Updated: {new Date().toLocaleTimeString()}</p>
                                    </div>
                                </div>

                                {/* Quick Tips */}
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <h3 className="font-semibold text-yellow-800 mb-2">Search Tips</h3>
                                    <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                                        <li>Search by consumer name or WSIN number</li>
                                        <li>Name search is case-insensitive</li>
                                        <li>WSIN search matches exact numbers</li>
                                        <li>Leave search empty to show all records</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Consumers Database - Right Side */}
                    <div className="flex-1">
                        <div className="bg-white rounded-xl shadow-lg p-6 h-[calc(95vh-200px)] flex flex-col">
                            {showConsumerDetails ? (
                                // Consumer Details View
                                <div className="flex-1 flex flex-col">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h2 className="text-2xl font-semibold text-gray-800">
                                                Billing Records - {selectedConsumerDetails?.consumerName}
                                            </h2>
                                            <p className="text-gray-600">
                                                WSIN: {selectedConsumerDetails?.wsin} | Location: {selectedConsumerDetails?.location}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleBackToConsumerList}
                                            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition duration-300"
                                        >
                                            Back to Consumers
                                        </button>
                                    </div>

                                    {billingRecords.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center">
                                            <div className="text-center">
                                                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <p className="text-gray-500 text-lg">No billing records found</p>
                                                <p className="text-gray-400 text-sm mt-2">
                                                    Billing records will appear here after submission
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="overflow-hidden flex flex-col flex-1">
                                            <div className="overflow-auto flex-1">
                                                <table className="min-w-full bg-white border border-gray-900">
                                                    <thead className="sticky top-0 bg-blue-200">
                                                        <tr className="border-b border-gray-900">
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                Year/Month
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                Status
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                Present Reading
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                Previous Reading
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                Consumption
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                Water Charge
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                Surcharge
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                Overall Total
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                Payment Status
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                Processed By
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                                                                Created At
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-900">
                                                        {billingRecords.map((record) => (
                                                            <tr key={record.id} className="hover:bg-gray-50 border-b border-gray-900">
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-900">
                                                                    {formatBillingPeriod(record.billingPeriod) || `${formatMonth(record.month)} ${record.year}`}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm border-r border-gray-900">
                                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                                        record.status === 'defect' 
                                                                            ? 'bg-red-100 text-red-800'
                                                                            : 'bg-green-100 text-green-800'
                                                                    }`}>
                                                                        {record.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-900">
                                                                    {record.presentReading} m³
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-900">
                                                                    {record.previousReading} m³
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-900">
                                                                    <span className="font-semibold">{record.waterConsumption}</span> m³
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 border-r border-gray-900">
                                                                    ₱{record.waterCharge}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-900">
                                                                    {record.includeSurcharge ? `₱${record.surcharge}` : '-'}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-green-600 border-r border-gray-900">
                                                                    ₱{record.overallTotal}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm border-r border-gray-900">
                                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(record.paymentStatus)}`}>
                                                                        {record.paymentStatus || 'unpaid'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-900">
                                                                    {record.processedBy}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                                                    {record.createdAt?.toDate ? 
                                                                        record.createdAt.toDate().toLocaleDateString() : 
                                                                        new Date(record.createdAt).toLocaleDateString()
                                                                    }
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            
                                            <div className="mt-4 flex justify-between items-center pt-4 border-t border-gray-300">
                                                <p className="text-sm text-gray-600">
                                                    Total Records: <span className="font-semibold">{billingRecords.length}</span>
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Consumer: {selectedConsumerDetails?.consumerName}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                // Consumer List View
                                <>
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-2xl font-semibold text-gray-800">
                                            {searchTerm ? `Search Results (${filteredConsumers.length})` : `Consumer Records (${filteredConsumers.length})`}
                                        </h2>
                                        
                                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                                            <span>Last updated:</span>
                                            <span>{new Date().toLocaleString()}</span>
                                        </div>
                                    </div>
                                    
                                    {loading ? (
                                        <div className="flex justify-center items-center py-8 flex-1">
                                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                                        </div>
                                    ) : filteredConsumers.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center">
                                            <div className="text-center">
                                                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <p className="text-gray-500 text-lg">No consumer records found</p>
                                                <p className="text-gray-400 text-sm mt-2">
                                                    {searchTerm ? 'Try adjusting your search criteria' : 'Consumer records will appear here'}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="overflow-hidden flex flex-col flex-1">
                                            <div className="overflow-auto flex-1">
                                                <table className="min-w-full bg-white border border-gray-900">
                                                    <thead className="sticky top-0 bg-blue-200">
                                                        <tr className="border-b border-gray-900">
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                WSIN
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                Consumer Name
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                Location
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                Type
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                Consumer Type
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                Latest Payment Status
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                                                                Actions
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-900">
                                                        {filteredConsumers.map((consumer) => (
                                                            <tr key={consumer.id} className="hover:bg-gray-50 border-b border-gray-900">
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900 border-r border-gray-900">
                                                                    {consumer.wsin}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-900">
                                                                    {consumer.consumerName}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-900">
                                                                    {consumer.location}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm border-r border-gray-900">
                                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getServiceTypeColor(consumer.serviceType)}`}>
                                                                        {consumer.serviceType || 'N/A'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm border-r border-gray-900">
                                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getConsumerTypeColor(consumer.consumerType)}`}>
                                                                        {consumer.consumerType || 'N/A'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm border-r border-gray-900">
                                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(consumer.paymentStatus)}`}>
                                                                        {consumer.paymentStatus || 'unpaid'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                                    <button
                                                                        onClick={() => handleViewConsumerDetails(consumer)}
                                                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition duration-300"
                                                                    >
                                                                        View Details
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            
                                            <div className="mt-4 flex justify-between items-center pt-4 border-t border-gray-300">
                                                <p className="text-sm text-gray-600">
                                                    Showing <span className="font-semibold">{filteredConsumers.length}</span> of{' '}
                                                    <span className="font-semibold">{consumers.length}</span> records
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Data loaded from Firebase Firestore
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Store;