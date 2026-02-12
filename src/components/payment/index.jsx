// components/payment/index.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/authContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/firebase';
import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    limit,
    doc,
    setDoc
} from 'firebase/firestore';

const Payment = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [consumerData, setConsumerData] = useState({
        consumerType: 'new',
        serviceType: 'residential',
        consumerName: '',
        location: '',
        year: '',
        month: '', 
        wsin: '',
        status: '',
        previousReading: '',
        presentReading: '',
        waterConsumption: '',
        waterCharge: '',
        surcharge: '',
        includeSurcharge: false,
        overallTotal: '',
        commercialFeeType: 'latest'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [consumers, setConsumers] = useState([]);
    const [filteredConsumers, setFilteredConsumers] = useState([]);
    const [selectedConsumer, setSelectedConsumer] = useState(null);
    const [readingsCalculated, setReadingsCalculated] = useState(false);
    const [nextWSIN, setNextWSIN] = useState('');
    const [isDefectAutoSubmit, setIsDefectAutoSubmit] = useState(false);
    const [selectedConsumerDetails, setSelectedConsumerDetails] = useState(null);
    const [showConsumerDetails, setShowConsumerDetails] = useState(false);
    const [billingRecords, setBillingRecords] = useState([]);
    
    const { currentUser, userLoggedIn } = useAuth();
    const navigate = useNavigate();

    const locations = [
        'LOTAO',
        'CENTRAL',
        'PALAWAN',
        'CADUCAN',
        'MORYO-MORYO',
        'HIGHWAY',
        'BUSAY',
        'DUWANGAN',
        'SAN ROQUE',
        'SAN ISIDRO',
        'CALIAN'
    ];

    const years = Array.from({ length: 19 }, (_, i) => (2012 + i).toString());
    
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Function to parse Year/Month into separate year and month
    const parseYearMonth = (yearMonth) => {
        if (!yearMonth) return { year: new Date().getFullYear().toString(), month: 'Unknown' };
        
        const match = yearMonth.match(/([A-Za-z]{3})-(\d{2})/);
        if (match) {
            const month = match[1];
            const year = `20${match[2]}`;
            return { year, month };
        }
        
        if (yearMonth.includes('-')) {
            const parts = yearMonth.split('-');
            if (parts.length >= 2) {
                return { year: parts[0], month: parts[1] };
            }
        }
        
        return { year: new Date().getFullYear().toString(), month: 'Unknown' };
    };

    // Function to format month properly
    const formatMonth = (month) => {
        if (!month) return 'Unknown';
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        if (monthNames.includes(month)) {
            return month;
        }
        
        const shortIndex = shortMonthNames.findIndex(m => m.toLowerCase() === month.toLowerCase());
        if (shortIndex !== -1) {
            return monthNames[shortIndex];
        }
        
        const monthNum = parseInt(month);
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
            return monthNames[monthNum - 1];
        }
        
        return month;
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
        }
        fetchConsumers();
    }, [userLoggedIn, navigate]);

    // Calculate next WSIN number when location changes for NEW consumer type
    useEffect(() => {
        if (consumerData.consumerType === 'new' && consumerData.location) {
            calculateNextWSIN(consumerData.location);
        } else {
            setNextWSIN('');
        }
    }, [consumerData.location, consumerData.consumerType, consumers]);

    // Filter consumers based on search criteria for OLD consumer type
    useEffect(() => {
        if (consumerData.consumerType === 'old' && (consumerData.consumerName || consumerData.location)) {
            const filtered = consumers.filter(consumer => {
                const nameMatch = consumerData.consumerName ? 
                    consumer.consumerName.toLowerCase().includes(consumerData.consumerName.toLowerCase()) : true;
                const locationMatch = consumerData.location ? 
                    consumer.location === consumerData.location : true;
                return nameMatch && locationMatch;
            });
            setFilteredConsumers(filtered);
        } else {
            setFilteredConsumers([]);
        }
    }, [consumerData.consumerName, consumerData.location, consumerData.consumerType, consumers]);

    // Auto-submit for defect status
    useEffect(() => {
        if (isDefectAutoSubmit && consumerData.status === 'defect') {
            handleDefectAutoSubmit();
        }
    }, [isDefectAutoSubmit, consumerData.status]);

    // Calculate next WSIN number for a given location
    const calculateNextWSIN = async (location) => {
        try {
            const locationQuery = query(
                collection(db, 'consumers'),
                where('location', '==', location),
                orderBy('wsin', 'desc'),
                limit(1)
            );
            
            const querySnapshot = await getDocs(locationQuery);
            let nextNumber = 1;
            
            if (!querySnapshot.empty) {
                const latestConsumer = querySnapshot.docs[0].data();
                const currentWSIN = parseInt(latestConsumer.wsin);
                nextNumber = currentWSIN + 1;
            }
            
            setNextWSIN(nextNumber.toString());
            setConsumerData(prev => ({
                ...prev,
                wsin: nextNumber.toString()
            }));
            
        } catch (error) {
            console.error('Error calculating next WSIN:', error);
            const locationConsumers = consumers.filter(consumer => consumer.location === location);
            if (locationConsumers.length > 0) {
                const highestWSIN = Math.max(...locationConsumers.map(consumer => parseInt(consumer.wsin)));
                const nextNumber = highestWSIN + 1;
                setNextWSIN(nextNumber.toString());
                setConsumerData(prev => ({
                    ...prev,
                    wsin: nextNumber.toString()
                }));
            } else {
                setNextWSIN('1');
                setConsumerData(prev => ({
                    ...prev,
                    wsin: '1'
                }));
            }
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        if (type === 'checkbox') {
            setConsumerData(prev => ({
                ...prev,
                [name]: checked
            }));
        } else {
            setConsumerData(prev => ({
                ...prev,
                [name]: value
            }));
        }

        if ((name === 'consumerName' || name === 'location') && consumerData.consumerType === 'old') {
            setSelectedConsumer(null);
        }

        if ((name === 'previousReading' || name === 'presentReading' || name === 'includeSurcharge' || name === 'commercialFeeType') && readingsCalculated) {
            setReadingsCalculated(false);
            setConsumerData(prev => ({
                ...prev,
                waterConsumption: '',
                waterCharge: '',
                surcharge: '',
                overallTotal: ''
            }));
        }

        if (name === 'status' && value === 'defect' && consumerData.consumerType === 'old') {
            setIsDefectAutoSubmit(true);
        }
    };

    const calculateCommercialFee = (consumption, feeType) => {
        let charge = 0;

        switch (feeType) {
            case 'latest':
                if (consumption <= 10) {
                    charge = 150;
                } else if (consumption >= 11 && consumption <= 20) {
                    charge = 150 + ((consumption - 10) * 20);
                } else if (consumption >= 21) {
                    charge = 350 + ((consumption - 20) * 30);
                }
                break;

            case 'lastYear':
                if (consumption <= 15) {
                    charge = consumption * 15;
                } else if (consumption >= 16) {
                    charge = 150 + ((consumption - 10) * 20);
                }
                break;

            case 'old':
                if (consumption <= 10) {
                    charge = 150;
                } else if (consumption >= 11) {
                    charge = 150 + ((consumption - 10) * 20);
                }
                break;

            default:
                charge = 0;
        }

        return charge;
    };

    const handleConsumerSelect = (consumer) => {
        setSelectedConsumer(consumer);
        setConsumerData(prev => ({
            ...prev,
            consumerName: consumer.consumerName,
            location: consumer.location,
            wsin: consumer.wsin,
            serviceType: consumer.serviceType || 'residential'
        }));
        setSuccessMessage(`Selected consumer: ${consumer.consumerName}`);
    };

    const handleViewConsumerDetails = async (consumer) => {
        setSelectedConsumerDetails(consumer);
        setShowConsumerDetails(true);
        
        try {
            const billingQuery = query(
                collection(db, 'consumers', consumer.id, 'billingRecords'),
                orderBy('createdAt', 'desc')
            );
            const querySnapshot = await getDocs(billingQuery);
            const records = [];
            querySnapshot.forEach((doc) => {
                records.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            setBillingRecords(records);
        } catch (error) {
            console.error('Error fetching billing records:', error);
            setBillingRecords([]);
        }
    };

    const handleNextStep = () => {
        if (currentStep === 1) {
            if (!consumerData.consumerName || !consumerData.location || !consumerData.year || !consumerData.month || !consumerData.wsin) {
                setErrorMessage('Please fill in all required fields');
                return;
            }

            if (consumerData.consumerType === 'old' && !selectedConsumer) {
                setErrorMessage('Please select an existing consumer from the search results');
                return;
            }

            if (consumerData.consumerType === 'old' && consumerData.status === 'defect') {
                console.log('🔧 Defect status detected, auto-submitting with default charge...');
                handleDefectAutoSubmit();
                return;
            }

            if (consumerData.consumerType === 'old' && !consumerData.status) {
                setErrorMessage('Please select status for existing consumer');
                return;
            }

            setErrorMessage('');
            setCurrentStep(2);
        }
    };

    const handleDefectAutoSubmit = async () => {
        if (!consumerData.consumerName || !consumerData.location || !consumerData.year || !consumerData.month || !consumerData.wsin) {
            setErrorMessage('Please fill in all required fields before submitting defect');
            setIsDefectAutoSubmit(false);
            return;
        }

        if (consumerData.consumerType === 'old' && !selectedConsumer) {
            setErrorMessage('Please select an existing consumer from the search results');
            setIsDefectAutoSubmit(false);
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            let consumerDocRef;

            if (consumerData.consumerType === 'new') {
                consumerDocRef = doc(collection(db, 'consumers'));
                await setDoc(consumerDocRef, {
                    consumerName: consumerData.consumerName,
                    location: consumerData.location,
                    wsin: consumerData.wsin,
                    serviceType: consumerData.serviceType,
                    consumerType: consumerData.consumerType,
                    createdAt: new Date(),
                    createdBy: currentUser?.email,
                    createdByName: currentUser?.displayName || 'Unknown User'
                });
            } else {
                consumerDocRef = doc(db, 'consumers', selectedConsumer.id);
            }

            const billingData = {
                year: consumerData.year,
                month: consumerData.month,
                status: 'defect',
                previousReading: '0',
                presentReading: '0',
                waterConsumption: '0',
                waterCharge: '75.00',
                surcharge: '0.00',
                overallTotal: '75.00',
                includeSurcharge: false,
                processedBy: currentUser?.displayName || currentUser?.email,
                processedDate: new Date(),
                billingPeriod: `${consumerData.month} ${consumerData.year}`,
                isDefect: true,
                defectCharge: 75.00,
                commercialFeeType: consumerData.commercialFeeType,
                createdAt: new Date()
            };

            await addDoc(collection(consumerDocRef, 'billingRecords'), billingData);

            setSuccessMessage('Defect consumer record created successfully with default charge of ₱75.00!');
            
            setConsumerData({
                consumerType: 'new',
                serviceType: 'residential',
                consumerName: '',
                location: '',
                year: '',
                month: '',
                wsin: '',
                status: '',
                previousReading: '',
                presentReading: '',
                waterConsumption: '',
                waterCharge: '',
                surcharge: '',
                includeSurcharge: false,
                overallTotal: '',
                commercialFeeType: 'latest'
            });
            
            setCurrentStep(1);
            setReadingsCalculated(false);
            setSelectedConsumer(null);
            setFilteredConsumers([]);
            setNextWSIN('');
            setIsDefectAutoSubmit(false);
            
            fetchConsumers();
            
        } catch (error) {
            console.error('Error adding defect consumer:', error);
            setErrorMessage('Failed to create defect consumer record');
        } finally {
            setIsSubmitting(false);
            setIsDefectAutoSubmit(false);
        }
    };

    const handleCalculateReadings = () => {
        if (!consumerData.previousReading || !consumerData.presentReading) {
            setErrorMessage('Please enter both previous and present readings');
            return;
        }

        const prev = parseFloat(consumerData.previousReading);
        const present = parseFloat(consumerData.presentReading);
        
        if (isNaN(prev) || isNaN(present)) {
            setErrorMessage('Please enter valid numbers for readings');
            return;
        }

        if (present < prev) {
            setErrorMessage('Present reading cannot be less than previous reading');
            return;
        }

        const consumption = present - prev;
        
        let charge = 0;
        
        if (consumerData.serviceType === 'residential') {
            if (consumption <= 5) {
                charge = 62.50;
            } else {
                charge = 62.50 + ((consumption - 5) * 12.50);
            }
        } else { 
            charge = calculateCommercialFee(consumption, consumerData.commercialFeeType);
        }

        let surchargeAmount = 0;
        if (consumerData.includeSurcharge) {
            surchargeAmount = charge * 0.02;
        }
        
        const overallTotalAmount = charge + surchargeAmount;

        setConsumerData(prevData => ({
            ...prevData,
            waterConsumption: consumption.toFixed(2),
            waterCharge: charge.toFixed(2),
            surcharge: surchargeAmount.toFixed(2),
            overallTotal: overallTotalAmount.toFixed(2)
        }));

        setReadingsCalculated(true);
        setErrorMessage('');
    };

    const handlePreviousStep = () => {
        setCurrentStep(1);
        setErrorMessage('');
        setReadingsCalculated(false);
        setIsDefectAutoSubmit(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!readingsCalculated) {
            setErrorMessage('Please calculate the readings first by clicking the Calculate button');
            return;
        }

        if (!consumerData.waterConsumption || !consumerData.waterCharge) {
            setErrorMessage('Please calculate water consumption and charge first');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            let consumerDocRef;

            if (consumerData.consumerType === 'new') {
                consumerDocRef = doc(collection(db, 'consumers'));
                await setDoc(consumerDocRef, {
                    consumerName: consumerData.consumerName,
                    location: consumerData.location,
                    wsin: consumerData.wsin,
                    serviceType: consumerData.serviceType,
                    consumerType: consumerData.consumerType,
                    createdAt: new Date(),
                    createdBy: currentUser?.email,
                    createdByName: currentUser?.displayName || 'Unknown User'
                });
            } else {
                consumerDocRef = doc(db, 'consumers', selectedConsumer.id);
            }

            const billingData = {
                year: consumerData.year,
                month: consumerData.month,
                status: consumerData.status || 'normal',
                previousReading: consumerData.previousReading,
                presentReading: consumerData.presentReading,
                waterConsumption: consumerData.waterConsumption,
                waterCharge: consumerData.waterCharge,
                surcharge: consumerData.surcharge,
                overallTotal: consumerData.overallTotal,
                includeSurcharge: consumerData.includeSurcharge,
                processedBy: currentUser?.displayName || currentUser?.email,
                processedDate: new Date(),
                billingPeriod: `${consumerData.month} ${consumerData.year}`,
                commercialFeeType: consumerData.commercialFeeType,
                createdAt: new Date()
            };

            await addDoc(collection(consumerDocRef, 'billingRecords'), billingData);

            setSuccessMessage('Consumer payment record created successfully!');
            
            setConsumerData({
                consumerType: 'new',
                serviceType: 'residential',
                consumerName: '',
                location: '',
                year: '',
                month: '',
                wsin: '',
                status: '',
                previousReading: '',
                presentReading: '',
                waterConsumption: '',
                waterCharge: '',
                surcharge: '',
                includeSurcharge: false,
                overallTotal: '',
                commercialFeeType: 'latest'
            });
            
            setCurrentStep(1);
            setReadingsCalculated(false);
            setSelectedConsumer(null);
            setFilteredConsumers([]);
            setNextWSIN('');
            
            fetchConsumers();
            
        } catch (error) {
            console.error('Error adding consumer:', error);
            setErrorMessage('Failed to create consumer record');
        } finally {
            setIsSubmitting(false);
        }
    };

    const fetchConsumers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'consumers'));
            const consumersData = [];
            querySnapshot.forEach((doc) => {
                consumersData.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            consumersData.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return dateB - dateA;
            });
            setConsumers(consumersData);
        } catch (error) {
            console.error('Error fetching consumers:', error);
        }
    };

    const handleBackToHome = () => {
        navigate('/home');
    };

    const handleBackToConsumerList = () => {
        setShowConsumerDetails(false);
        setSelectedConsumerDetails(null);
        setBillingRecords([]);
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
                                <p className="text-gray-600 mt-1">Consumer Payment System</p>
                                <p className="text-sm text-blue-600 mt-1">
                                    Logged in as: {currentUser?.displayName || currentUser?.email}
                                </p>
                            </div>
                            
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
                    {/* Consumer Form - Left Side */}
                    <div className="w-1/3">
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
                                {currentStep === 1 ? 'Consumer Information' : 'Payment Calculation'}
                            </h2>
                            
                            <form onSubmit={handleSubmit}>
                                {currentStep === 1 ? (
                                    <div className="space-y-2">
                                        {/* Consumer Type */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Consumer Type *
                                            </label>
                                            <div className="flex space-x-6">
                                                <label className="flex items-center">
                                                    <input
                                                        type="radio"
                                                        name="consumerType"
                                                        value="new"
                                                        checked={consumerData.consumerType === 'new'}
                                                        onChange={handleInputChange}
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                                    />
                                                    <span className="ml-2 text-sm text-gray-700">New</span>
                                                </label>
                                                <label className="flex items-center">
                                                    <input
                                                        type="radio"
                                                        name="consumerType"
                                                        value="old"
                                                        checked={consumerData.consumerType === 'old'}
                                                        onChange={handleInputChange}
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                                    />
                                                    <span className="ml-2 text-sm text-gray-700">Old</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Service Type */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Service Type *
                                            </label>
                                            <div className="flex space-x-6">
                                                <label className="flex items-center">
                                                    <input
                                                        type="radio"
                                                        name="serviceType"
                                                        value="residential"
                                                        checked={consumerData.serviceType === 'residential'}
                                                        onChange={handleInputChange}
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                                    />
                                                    <span className="ml-2 text-sm text-gray-700">Residential</span>
                                                </label>
                                                <label className="flex items-center">
                                                    <input
                                                        type="radio"
                                                        name="serviceType"
                                                        value="commercial"
                                                        checked={consumerData.serviceType === 'commercial'}
                                                        onChange={handleInputChange}
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                                    />
                                                    <span className="ml-2 text-sm text-gray-700">Commercial</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Consumer Name */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Consumer Name *
                                            </label>
                                            <input
                                                type="text"
                                                name="consumerName"
                                                value={consumerData.consumerName}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder={
                                                    consumerData.consumerType === 'old' 
                                                        ? "Search consumer name..." 
                                                        : "Enter consumer name"
                                                }
                                                required
                                            />
                                        </div>

                                        {/* Location Dropdown */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Location *
                                            </label>
                                            <select
                                                name="location"
                                                value={consumerData.location}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                required
                                            >
                                                <option value="">Select Location</option>
                                                {locations.map((location, index) => (
                                                    <option key={index} value={location}>
                                                        {location}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* WSIN Display */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                WSIN (Water Service Identification Number) *
                                            </label>
                                            {consumerData.consumerType === 'new' && consumerData.location ? (
                                                <div className="flex items-center space-x-3">
                                                    <input
                                                        type="text"
                                                        value={consumerData.wsin}
                                                        readOnly
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 font-mono font-bold text-blue-600"
                                                    />
                                                    <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                                                        Auto-generated
                                                    </div>
                                                </div>
                                            ) : (
                                                <input
                                                    type="number"
                                                    name="wsin"
                                                    value={consumerData.wsin}
                                                    onChange={handleInputChange}
                                                    readOnly
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter WSIN"
                                                    required
                                                    disabled={consumerData.consumerType === 'old' && selectedConsumer}
                                                />
                                            )}
                                            
                                        </div>

                                        {/* Search Info for Old Consumers */}
                                        {consumerData.consumerType === 'old' && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                <p className="text-sm text-blue-700">
                                                    <strong>Search Tip:</strong> Enter consumer name and/or select location to filter existing consumers. 
                                                    Then select a consumer from the table on the right by checking the checkbox.
                                                </p>
                                            </div>
                                        )}

                                        {/* Year and Month Dropdowns */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Year *
                                                </label>
                                                <select
                                                    name="year"
                                                    value={consumerData.year}
                                                    onChange={handleInputChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    required
                                                >
                                                    <option value="">Select Year</option>
                                                    {years.map((year, index) => (
                                                        <option key={index} value={year}>
                                                            {year}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Month *
                                                </label>
                                                <select
                                                    name="month"
                                                    value={consumerData.month}
                                                    onChange={handleInputChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    required
                                                >
                                                    <option value="">Select Month</option>
                                                    {months.map((month, index) => (
                                                        <option key={index} value={month}>
                                                            {month}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Status for Old Consumers */}
                                        {consumerData.consumerType === 'old' && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                                    Status *
                                                </label>
                                                <div className="flex space-x-6">
                                                    <label className="flex items-center">
                                                        <input
                                                            type="radio"
                                                            name="status"
                                                            value="defect"
                                                            checked={consumerData.status === 'defect'}
                                                            onChange={handleInputChange}
                                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                                        />
                                                        <span className="ml-2 text-sm text-gray-700">Defect (Auto ₱75 charge)</span>
                                                    </label>
                                                    <label className="flex items-center">
                                                        <input
                                                            type="radio"
                                                            name="status"
                                                            value="normal"
                                                            checked={consumerData.status === 'normal'}
                                                            onChange={handleInputChange}
                                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                                        />
                                                        <span className="ml-2 text-sm text-gray-700">Normal Reading</span>
                                                    </label>
                                                </div>
                                                {consumerData.status === 'defect' && (
                                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                                                        <p className="text-sm text-yellow-700">
                                                            <strong>Note:</strong> Defect status will auto-submit with ₱75.00 charge
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Selected Consumer Info for Old Type */}
                                        {consumerData.consumerType === 'old' && selectedConsumer && (
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                                <p className="text-sm text-green-700 font-medium">
                                                    ✓ Selected: {selectedConsumer.consumerName} 
                                                    (WSIN: {selectedConsumer.wsin}, Location: {selectedConsumer.location})
                                                </p>
                                            </div>
                                        )}

                                        {/* Auto-submit message for defect */}
                                        {isDefectAutoSubmit && consumerData.status === 'defect' && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                <p className="text-sm text-blue-700 font-medium">
                                                    ⚡ Auto-submitting defect record with ₱75.00 charge...
                                                </p>
                                            </div>
                                        )}

                                        {/* Next Button */}
                                        <div className="flex justify-end pt-1">
                                            <button
                                                type="button"
                                                onClick={handleNextStep}
                                                disabled={isDefectAutoSubmit}
                                                className={`px-6 py-2 font-medium rounded-lg transition duration-300 ${
                                                    isDefectAutoSubmit
                                                        ? 'bg-gray-400 cursor-not-allowed text-white'
                                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                }`}
                                            >
                                                {consumerData.consumerType === 'old' && consumerData.status === 'defect' 
                                                    ? 'Processing Defect...' 
                                                    : 'Next'
                                                }
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // Step 2: Payment Calculation
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Payment Calculation</h3>
                                        
                                        {/* Previous Reading */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Previous Reading (m³) *
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                name="previousReading"
                                                value={consumerData.previousReading}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Enter previous reading"
                                                required
                                            />
                                        </div>

                                        {/* Present Reading */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Present Reading (m³) *
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                name="presentReading"
                                                value={consumerData.presentReading}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Enter present reading"
                                                required
                                            />
                                        </div>

                                        {/* Commercial Fee Type Selection */}
                                        {consumerData.serviceType === 'commercial' && (
                                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                                <label className="block text-sm font-medium text-purple-700 mb-3">
                                                    Commercial Fee Type *
                                                </label>
                                                <div className="space-y-3">
                                                    <label className="flex items-center">
                                                        <input
                                                            type="radio"
                                                            name="commercialFeeType"
                                                            value="latest"
                                                            checked={consumerData.commercialFeeType === 'latest'}
                                                            onChange={handleInputChange}
                                                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                                                        />
                                                        <span className="ml-2 text-sm text-purple-700">
                                                            <strong>Latest Fee</strong> - 0-10m³: ₱150 | 11-20m³: ₱150 + (consumption-10)×20 | 21m³+: ₱350 + (consumption-20)×30
                                                        </span>
                                                    </label>
                                                    <label className="flex items-center">
                                                        <input
                                                            type="radio"
                                                            name="commercialFeeType"
                                                            value="lastYear"
                                                            checked={consumerData.commercialFeeType === 'lastYear'}
                                                            onChange={handleInputChange}
                                                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                                                        />
                                                        <span className="ml-2 text-sm text-purple-700">
                                                            <strong>Last Year Fee (2024)</strong> - 0-15m³: consumption×15 | 16m³+: ₱150 + (consumption-10)×20
                                                        </span>
                                                    </label>
                                                    <label className="flex items-center">
                                                        <input
                                                            type="radio"
                                                            name="commercialFeeType"
                                                            value="old"
                                                            checked={consumerData.commercialFeeType === 'old'}
                                                            onChange={handleInputChange}
                                                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                                                        />
                                                        <span className="ml-2 text-sm text-purple-700">
                                                            <strong>Old Fee (2012-2023)</strong> - 0-10m³: ₱150 | 11m³+: ₱150 + (consumption-10)×20
                                                        </span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        {/* Surcharge Checkbox */}
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    name="includeSurcharge"
                                                    checked={consumerData.includeSurcharge}
                                                    onChange={handleInputChange}
                                                    className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                                                />
                                                <span className="ml-2 text-sm font-medium text-yellow-800">
                                                    Include 2% Surcharge
                                                </span>
                                            </label>
                                            <p className="text-xs text-yellow-600 mt-1 ml-6">
                                                Check this box to include 2% surcharge in the calculation
                                            </p>
                                        </div>

                                        {/* Calculate Button */}
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={handleCalculateReadings}
                                                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition duration-300"
                                            >
                                                Calculate
                                            </button>
                                        </div>

                                        {/* Water Consumption */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Water Consumption (m³)
                                            </label>
                                            <input
                                                type="text"
                                                name="waterConsumption"
                                                value={consumerData.waterConsumption}
                                                readOnly
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                                placeholder="Click Calculate to compute"
                                            />
                                        </div>

                                        {/* Water Charge */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Water Charge (₱)
                                            </label>
                                            <input
                                                type="text"
                                                name="waterCharge"
                                                value={consumerData.waterCharge}
                                                readOnly
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                                placeholder="Click Calculate to compute"
                                            />
                                        </div>

                                        {/* Surcharge (2%) */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Surcharge (2%)
                                            </label>
                                            <input
                                                type="text"
                                                name="surcharge"
                                                value={consumerData.surcharge}
                                                readOnly
                                                className={`w-full px-3 py-2 border rounded-lg ${
                                                    consumerData.includeSurcharge 
                                                        ? 'border-yellow-300 bg-yellow-50 text-yellow-700' 
                                                        : 'border-gray-300 bg-gray-50 text-gray-500'
                                                }`}
                                                placeholder={consumerData.includeSurcharge ? "2% of water charge" : "Surcharge not included"}
                                            />
                                        </div>

                                        {/* Overall Total */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Overall Total (₱)
                                            </label>
                                            <input
                                                type="text"
                                                name="overallTotal"
                                                value={consumerData.overallTotal}
                                                readOnly
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-semibold text-lg"
                                                placeholder="Auto-calculated total"
                                            />
                                        </div>

                                        {/* Processed By Info */}
                                        {readingsCalculated && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                                <p className="text-sm text-blue-700">
                                                    <strong>Processed by:</strong> {currentUser?.displayName || currentUser?.email}
                                                </p>
                                                <p className="text-sm text-blue-700 mt-1">
                                                    <strong>Date:</strong> {new Date().toLocaleDateString()}
                                                </p>
                                                <p className="text-sm text-blue-700 mt-1">
                                                    <strong>Billing Period:</strong> {consumerData.month} {consumerData.year}
                                                </p>
                                                <p className="text-sm text-blue-700 mt-1">
                                                    <strong>Service Type:</strong> {consumerData.serviceType}
                                                    {consumerData.serviceType === 'commercial' && (
                                                        <span> - {consumerData.commercialFeeType === 'latest' ? 'Latest Fee' : consumerData.commercialFeeType === 'lastYear' ? 'Last Year Fee (2024)' : 'Old Fee (2012-2023)'}</span>
                                                    )}
                                                </p>
                                                <p className="text-sm text-blue-700 mt-1">
                                                    <strong>Surcharge Included:</strong> {consumerData.includeSurcharge ? 'Yes (2%)' : 'No'}
                                                </p>
                                                {consumerData.consumerType === 'old' && selectedConsumer && (
                                                    <p className="text-sm text-blue-700 mt-1">
                                                        <strong>Original Consumer:</strong> {selectedConsumer.consumerName} (WSIN: {selectedConsumer.wsin})
                                                    </p>
                                                )}
                                            </div>
                                        )}

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

                                        {/* Action Buttons */}
                                        <div className="flex justify-between pt-4">
                                            <button
                                                type="button"
                                                onClick={handlePreviousStep}
                                                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition duration-300"
                                            >
                                                Previous
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSubmitting || !readingsCalculated}
                                                className={`px-6 py-2 text-white font-medium rounded-lg transition duration-300 ${
                                                    isSubmitting || !readingsCalculated
                                                        ? 'bg-blue-400 cursor-not-allowed'
                                                        : 'bg-blue-600 hover:bg-blue-700'
                                                }`}
                                            >
                                                {isSubmitting ? 'Submitting...' : 'Submit Payment'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>

                    {/* Database Section - Right Side */}
                    <div className="w-2/3">
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
                                            {consumerData.consumerType === 'old' && (consumerData.consumerName || consumerData.location) 
                                                ? `Search Results (${filteredConsumers.length})` 
                                                : `Consumer Records (${consumers.length})`
                                            }
                                        </h2>
                                        
                                        <button
                                            onClick={fetchConsumers}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition duration-300 flex items-center"
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Refresh
                                        </button>
                                    </div>
                                    
                                    {consumers.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center">
                                            <div className="text-center">
                                                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <p className="text-gray-500 text-lg">No consumer records found</p>
                                                <p className="text-gray-400 text-sm mt-2">
                                                    Consumer records will appear here after submission
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="overflow-hidden flex flex-col flex-1">
                                            <div className="overflow-auto flex-1">
                                                <table className="min-w-full bg-white border border-gray-900">
                                                    <thead className="sticky top-0 bg-blue-200">
                                                        <tr className="border-b border-gray-900">
                                                            {consumerData.consumerType === 'old' && (
                                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                                    Select
                                                                </th>
                                                            )}
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
                                                                Actions
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-900">
                                                        {(consumerData.consumerType === 'old' && (consumerData.consumerName || consumerData.location) ? filteredConsumers : consumers).map((consumer) => (
                                                            <tr key={consumer.id} className={`hover:bg-gray-50 border-b border-gray-900 ${
                                                                selectedConsumer?.id === consumer.id ? 'bg-green-50' : ''
                                                            }`}>
                                                                {consumerData.consumerType === 'old' && (
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm border-r border-gray-900">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedConsumer?.id === consumer.id}
                                                                            onChange={() => handleConsumerSelect(consumer)}
                                                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                                        />
                                                                    </td>
                                                                )}
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
                                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                                        consumer.serviceType === 'residential' 
                                                                            ? 'bg-green-100 text-green-800'
                                                                            : 'bg-blue-100 text-blue-800'
                                                                    }`}>
                                                                        {consumer.serviceType}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm border-r border-gray-900">
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
                                                    {consumerData.consumerType === 'old' && (consumerData.consumerName || consumerData.location) 
                                                        ? `Showing: ${filteredConsumers.length} of ${consumers.length} records` 
                                                        : `Total Records: ${consumers.length}`
                                                    }
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Auto-refreshed on new submission
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

export default Payment;