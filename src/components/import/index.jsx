// components/import/index.jsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/authContext';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { db } from '../../firebase/firebase';
import { collection, addDoc, doc, setDoc, getDocs, query, where } from 'firebase/firestore';

const Import = () => {
    const [excelFile, setExcelFile] = useState(null);
    const [excelData, setExcelData] = useState(null);
    const [fileName, setFileName] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isViewing, setIsViewing] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    
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
    const formatBillingPeriod = (month, year) => {
        if (!month || !year) return 'N/A';
        const formattedMonth = formatMonth(month);
        return `${formattedMonth} ${year}`;
    };

    // Function to determine payment status
    const determinePaymentStatus = (paymentStatus, overallTotal, surcharge) => {
        if (!paymentStatus) {
            // Auto-detect based on overall total and surcharge
            const total = parseFloat(overallTotal || 0);
            const surchargeAmount = parseFloat(surcharge || 0);
            
            if (total === 0) {
                return 'unpaid';
            } else if (surchargeAmount > 0) {
                return 'overdue';
            } else {
                return 'paid';
            }
        }
        
        // Use provided payment status
        const status = paymentStatus.toString().toLowerCase().trim();
        if (status === 'paid' || status === 'unpaid' || status === 'overdue') {
            return status;
        }
        
        // Default to unpaid if unknown status
        return 'unpaid';
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFileName(file.name);
            setExcelFile(file);
            setErrorMessage('');
            setSuccessMessage('');
        }
    };

    const handleViewData = () => {
        if (!excelFile) {
            setErrorMessage('Please select an Excel file first');
            return;
        }

        setIsViewing(true);
        setErrorMessage('');
        setSuccessMessage('');

        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get the first worksheet
                const worksheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[worksheetName];
                
                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                setExcelData(jsonData);
                setSuccessMessage(`Successfully loaded ${fileName} for preview`);
                
                console.log('📊 Excel Data Loaded:', {
                    fileName: fileName,
                    rows: jsonData.length,
                    columns: jsonData[0] ? jsonData[0].length : 0
                });
                
            } catch (error) {
                console.error('❌ Error loading Excel file:', error);
                setErrorMessage('Failed to load Excel file. Please make sure it\'s a valid Excel file.');
            } finally {
                setIsViewing(false);
            }
        };

        reader.onerror = () => {
            setErrorMessage('Error reading file');
            setIsViewing(false);
        };

        reader.readAsArrayBuffer(excelFile);
    };

    const handleImportToFirebase = async () => {
        if (!excelData || excelData.length < 2) {
            setErrorMessage('No data to import. Please load an Excel file first.');
            return;
        }

        setIsImporting(true);
        setErrorMessage('');

        try {
            const headers = excelData[0];
            const rows = excelData.slice(1);
            
            let importedCount = 0;
            let errorCount = 0;

            // Map column names to handle different possible header names
            const columnMapping = {
                wsin: ['wsin', 'ws in', 'water service identification number'],
                consumerName: ['consumername', 'consumer name', 'name', 'customer name'],
                location: ['location', 'address', 'area'],
                type: ['type', 'servicetype', 'service type'],
                consumerType: ['consumertype', 'consumer type', 'customertype', 'customer type'],
                year: ['year', 'billingyear', 'billing year'],
                month: ['month', 'billingmonth', 'billing month'],
                status: ['status', 'meterstatus', 'meter status'],
                previousReading: ['previousreading', 'previous reading', 'lastreading', 'last reading'],
                presentReading: ['presentreading', 'present reading', 'currentreading', 'current reading'],
                consumption: ['consumption', 'waterconsumption', 'water consumption', 'usage'],
                waterCharge: ['watercharge', 'water charge', 'charge', 'amount'],
                surcharge: ['surcharge', 'penalty', 'latefee', 'late fee'],
                overallTotal: ['overalltotal', 'overall total', 'total', 'grandtotal', 'grand total'],
                paymentStatus: ['paymentstatus', 'payment status', 'statuspayment', 'paidstatus', 'paid status'],
                processedBy: ['processedby', 'processed by', 'processedby', 'collectedby', 'collected by'],
                createdAt: ['createdat', 'created at', 'date', 'billingdate', 'billing date']
            };

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                try {
                    // Create consumer data object based on column mapping
                    const consumerData = {};
                    headers.forEach((header, index) => {
                        if (header && row[index] !== undefined) {
                            const cleanHeader = header.toString().trim().toLowerCase().replace(/\s+/g, '');
                            
                            // Find the matching field name using column mapping
                            let fieldName = null;
                            for (const [key, aliases] of Object.entries(columnMapping)) {
                                if (aliases.includes(cleanHeader)) {
                                    fieldName = key;
                                    break;
                                }
                            }
                            
                            // If no mapping found, use the cleaned header
                            if (!fieldName) {
                                fieldName = cleanHeader;
                            }
                            
                            consumerData[fieldName] = row[index];
                        }
                    });

                    // Validate required fields
                    if (!consumerData.wsin || !consumerData.consumerName || !consumerData.location) {
                        console.warn(`Skipping row ${i + 1}: Missing required fields (WSIN, Consumer Name, Location)`);
                        errorCount++;
                        continue;
                    }

                    // Get Year and Month (separate columns)
                    const year = consumerData.year ? consumerData.year.toString() : new Date().getFullYear().toString();
                    const month = formatMonth(consumerData.month?.toString() || 'Unknown');

                    // Determine payment status
                    const paymentStatus = determinePaymentStatus(
                        consumerData.paymentStatus,
                        consumerData.overallTotal,
                        consumerData.surcharge
                    );

                    // Find or create consumer document
                    const consumersRef = collection(db, 'consumers');
                    const consumerQuery = query(
                        consumersRef, 
                        where('wsin', '==', consumerData.wsin.toString()),
                        where('location', '==', consumerData.location)
                    );
                    
                    const querySnapshot = await getDocs(consumerQuery);
                    let consumerDocRef;

                    if (querySnapshot.empty) {
                        // Create new consumer
                        consumerDocRef = doc(collection(db, 'consumers'));
                        await setDoc(consumerDocRef, {
                            consumerName: consumerData.consumerName,
                            location: consumerData.location,
                            wsin: consumerData.wsin.toString(),
                            serviceType: consumerData.type || 'residential',
                            consumerType: consumerData.consumerType || 'new',
                            createdAt: new Date(),
                            createdBy: currentUser?.email,
                            createdByName: currentUser?.displayName || 'Unknown User'
                        });
                    } else {
                        // Use existing consumer
                        consumerDocRef = doc(db, 'consumers', querySnapshot.docs[0].id);
                    }

                    // Add billing record
                    const billingData = {
                        year: year,
                        month: month,
                        status: consumerData.status || 'normal',
                        previousReading: consumerData.previousReading?.toString() || '0',
                        presentReading: consumerData.presentReading?.toString() || '0',
                        waterConsumption: consumerData.consumption?.toString() || '0',
                        waterCharge: consumerData.waterCharge?.toString() || '0',
                        surcharge: consumerData.surcharge?.toString() || '0',
                        overallTotal: consumerData.overallTotal?.toString() || '0',
                        includeSurcharge: parseFloat(consumerData.surcharge || '0') > 0,
                        processedBy: consumerData.processedBy || currentUser?.displayName || currentUser?.email,
                        billingPeriod: formatBillingPeriod(month, year),
                        isDefect: (consumerData.status || '').toLowerCase() === 'defect',
                        commercialFeeType: 'latest',
                        paymentStatus: paymentStatus, // ADDED: Payment status field
                        createdAt: consumerData.createdAt ? new Date(consumerData.createdAt) : new Date()
                    };

                    await addDoc(collection(consumerDocRef, 'billingRecords'), billingData);
                    importedCount++;

                } catch (rowError) {
                    console.error(`Error importing row ${i + 1}:`, rowError);
                    errorCount++;
                }
            }

            setSuccessMessage(`Successfully imported ${importedCount} records to Firebase. ${errorCount} errors.`);
            console.log('✅ Import completed:', { imported: importedCount, errors: errorCount });

        } catch (error) {
            console.error('❌ Error importing to Firebase:', error);
            setErrorMessage('Failed to import data to Firebase. Please try again.');
        } finally {
            setIsImporting(false);
        }
    };

    const handleClear = () => {
        setExcelFile(null);
        setExcelData(null);
        setFileName('');
        setSuccessMessage('');
        setErrorMessage('');
    };

    const toggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    const handleBackToHome = () => {
        navigate('/home');
    };

    // Format cell value for display
    const formatCellValue = (value) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    };

    // Get service type color
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

    // Get status color
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

    // Get consumer type color
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

    // Get payment status color
    const getPaymentStatusColor = (paymentStatus) => {
        switch (paymentStatus?.toLowerCase()) {
            case 'paid':
                return 'bg-green-100 text-green-800';
            case 'unpaid':
                return 'bg-red-100 text-red-800';
            case 'overdue':
                return 'bg-orange-100 text-orange-800';
            default:
                return 'bg-gray-100 text-gray-800';
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
                                <p className="text-gray-600 mt-1">Excel File Import</p>
                                <p className="text-sm text-blue-600 mt-1">
                                    Logged in as: {currentUser?.displayName || currentUser?.email}
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
                    {/* Import Form - Left Side */}
                    <div className="w-1/3">
                        <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
                            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Import Excel File</h2>
                            
                            <div className="space-y-6">
                                {/* File Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Select Excel File
                                    </label>
                                    <div className="flex items-center space-x-4">
                                        <label className="flex-1">
                                            <input
                                                type="file"
                                                accept=".xlsx, .xls, .csv"
                                                onChange={handleFileChange}
                                                className="hidden"
                                                id="file-input"
                                            />
                                            <div className="w-full px-3 py-2 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition duration-300 text-center">
                                                {fileName || 'Choose file...'}
                                            </div>
                                        </label>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Supported formats: .xlsx, .xls, .csv
                                    </p>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex space-x-4">
                                    <button
                                        onClick={handleViewData}
                                        disabled={!excelFile || isViewing}
                                        className={`flex-1 px-4 py-2 font-medium rounded-lg transition duration-300 flex items-center justify-center ${
                                            !excelFile || isViewing
                                                ? 'bg-blue-400 cursor-not-allowed text-white'
                                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                        }`}
                                    >
                                        {isViewing ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Loading...
                                            </>
                                        ) : (
                                            'View Data'
                                        )}
                                    </button>
                                </div>

                                <div className="flex space-x-4">
                                    <button
                                        onClick={handleImportToFirebase}
                                        disabled={!excelData || isImporting}
                                        className={`flex-1 px-4 py-2 font-medium rounded-lg transition duration-300 flex items-center justify-center ${
                                            !excelData || isImporting
                                                ? 'bg-green-400 cursor-not-allowed text-white'
                                                : 'bg-green-600 hover:bg-green-700 text-white'
                                        }`}
                                    >
                                        {isImporting ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Importing...
                                            </>
                                        ) : (
                                            'Import File'
                                        )}
                                    </button>
                                    
                                    <button
                                        onClick={handleClear}
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
                                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-sm flex items-center">
                                        <svg className="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        {successMessage}
                                    </div>
                                )}

                                {/* File Info */}
                                {excelData && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <h3 className="font-semibold text-blue-800 mb-2">File Information</h3>
                                        <div className="text-sm text-blue-700 space-y-1">
                                            <p>File: {fileName}</p>
                                            <p>Rows: {excelData.length}</p>
                                            <p>Columns: {excelData[0] ? excelData[0].length : 0}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Import Instructions */}
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <h3 className="font-semibold text-yellow-800 mb-2">Import Instructions</h3>
                                    <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                                        <li>First, click "View Data" to preview the Excel file</li>
                                        <li>Then, click "Import File" to save to Firebase</li>
                                        <li>Data will be saved to consumers collection with billing records</li>
                                        <li>Required columns: WSIN, Consumer Name, Location</li>
                                        <li>Separate Year and Month columns will be properly formatted</li>
                                        <li>Supported column names for Year: year, billingyear, billing year</li>
                                        <li>Supported column names for Month: month, billingmonth, billing month</li>
                                        <li>Payment Status: paid, unpaid, overdue (auto-detected if not provided)</li>
                                    </ul>
                                </div>

                                {/* Expected Format */}
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <h3 className="font-semibold text-green-800 mb-2">Expected Excel Format</h3>
                                    <div className="text-sm text-green-700">
                                        <p className="font-medium">Columns should include:</p>
                                        <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                                            <span>• WSIN</span>
                                            <span>• Consumer Name</span>
                                            <span>• Location</span>
                                            <span>• Type</span>
                                            <span>• Consumer Type</span>
                                            <span>• Year</span>
                                            <span>• Month</span>
                                            <span>• Status</span>
                                            <span>• Present Reading</span>
                                            <span>• Previous Reading</span>
                                            <span>• Consumption</span>
                                            <span>• Water Charge</span>
                                            <span>• Surcharge</span>
                                            <span>• Overall Total</span>
                                            <span>• Payment Status</span>
                                            <span>• Processed By</span>
                                            <span>• Created At</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Data Preview - Right Side */}
                    <div className="flex-1">
                        <div className="bg-white rounded-xl shadow-lg p-6 h-[calc(95vh-200px)] flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-semibold text-gray-800">
                                    Data Preview
                                </h2>
                                
                                {excelData && (
                                    <button
                                        onClick={toggleExpand}
                                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition duration-300 flex items-center"
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            {isExpanded ? (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            ) : (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                                            )}
                                        </svg>
                                        {isExpanded ? 'Collapse' : 'Expand'}
                                    </button>
                                )}
                            </div>
                            
                            {!excelData ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="text-center">
                                        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <p className="text-gray-500 text-lg">No data loaded yet</p>
                                        <p className="text-gray-400 text-sm mt-2">
                                            Select an Excel file and click "View Data" to preview
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className={`overflow-hidden flex flex-col flex-1 ${isExpanded ? '' : 'max-h-96'}`}>
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
                                                        Year
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider border-r border-gray-900">
                                                        Month
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
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                                                        Processed By
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-900">
                                                {excelData.slice(1).map((row, rowIndex) => {
                                                    // Map Excel columns based on your structure
                                                    const headers = excelData[0];
                                                    const rowData = {};
                                                    
                                                    headers.forEach((header, index) => {
                                                        if (header && row[index] !== undefined) {
                                                            rowData[header] = row[index];
                                                        }
                                                    });

                                                    // Determine payment status for display
                                                    const paymentStatus = determinePaymentStatus(
                                                        rowData['Payment Status'] || rowData.paymentStatus,
                                                        rowData['Overall Total'] || rowData.overallTotal,
                                                        rowData['Surcharge'] || rowData.surcharge
                                                    );

                                                    return (
                                                        <tr key={rowIndex} className="hover:bg-gray-50 border-b border-gray-900">
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-900">
                                                                {formatCellValue(rowData.WSIN || rowData.WSIN)}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-900">
                                                                {formatCellValue(rowData['Consumer Name'] || rowData.ConsumerName || rowData.consumerName)}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-900">
                                                                {formatCellValue(rowData.Location || rowData.location)}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm border-r border-gray-900">
                                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getServiceTypeColor(rowData.Type || rowData.type)}`}>
                                                                    {formatCellValue(rowData.Type || rowData.type) || 'N/A'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm border-r border-gray-900">
                                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getConsumerTypeColor(rowData['Consumer Type'] || rowData.ConsumerType || rowData.consumerType)}`}>
                                                                    {formatCellValue(rowData['Consumer Type'] || rowData.ConsumerType || rowData.consumerType) || 'N/A'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-900">
                                                                {formatCellValue(rowData.Year || rowData.year)}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-900">
                                                                {formatMonth(formatCellValue(rowData.Month || rowData.month))}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm border-r border-gray-900">
                                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(rowData.Status || rowData.status)}`}>
                                                                    {formatCellValue(rowData.Status || rowData.status) || 'N/A'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-900">
                                                                {formatCellValue(rowData['Present Reading'] || rowData.PresentReading || rowData.presentReading)} m³
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-900">
                                                                {formatCellValue(rowData['Previous Reading'] || rowData.PreviousReading || rowData.previousReading)} m³
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-900">
                                                                <span className="font-semibold">{formatCellValue(rowData.Consumption || rowData.consumption)}</span> m³
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 border-r border-gray-900">
                                                                ₱{parseFloat(rowData['Water Charge'] || rowData.WaterCharge || rowData.waterCharge || 0).toFixed(2)}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-900">
                                                                {parseFloat(rowData.Surcharge || rowData.surcharge || 0) > 0 ? `₱${parseFloat(rowData.Surcharge || rowData.surcharge).toFixed(2)}` : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-green-600 border-r border-gray-900">
                                                                ₱{parseFloat(rowData['Overall Total'] || rowData.OverallTotal || rowData.overallTotal || 0).toFixed(2)}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm border-r border-gray-900">
                                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(paymentStatus)}`}>
                                                                    {paymentStatus.toUpperCase()}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                                                {formatCellValue(rowData['Processed By'] || rowData.ProcessedBy || rowData.processedBy)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    <div className="mt-4 flex justify-between items-center pt-4 border-t border-gray-300">
                                        <p className="text-sm text-gray-600">
                                            Total Rows: <span className="font-semibold">{excelData.length - 1}</span>
                                            {excelData[0] && (
                                                <> • Columns: <span className="font-semibold">{excelData[0].length}</span></>
                                            )}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            File: {fileName}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Import;