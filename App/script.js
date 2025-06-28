// Global variables to store processed data for export
let matchedData = [];
let internalOnlyData = [];
let providerOnlyData = [];
let mismatchedData = [];

/**
 * Displays a message to the user in a dedicated message box.
 * @param {string} message - The message to display.
 * @param {string} type - The type of message ('success', 'error', 'warning', 'info').
 */
function showMessage(message, type) {
    const messageBox = document.getElementById('messageBox');
    const messageIcon = document.getElementById('messageIcon');
    const messageText = document.getElementById('messageText');

    messageText.textContent = message;
    messageBox.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800', 'bg-yellow-100', 'text-yellow-800', 'bg-blue-100', 'text-blue-800');
    messageIcon.className = ''; // Clear previous icon classes

    switch (type) {
        case 'success':
            messageBox.classList.add('bg-green-100', 'text-green-800');
            messageIcon.classList.add('fas', 'fa-check-circle', 'text-green-600');
            break;
        case 'error':
            messageBox.classList.add('bg-red-100', 'text-red-800');
            messageIcon.classList.add('fas', 'fa-times-circle', 'text-red-600');
            break;
        case 'warning':
            messageBox.classList.add('bg-yellow-100', 'text-yellow-800');
            messageIcon.classList.add('fas', 'fa-exclamation-triangle', 'text-yellow-600');
            break;
        case 'info':
            messageBox.classList.add('bg-blue-100', 'text-blue-800');
            messageIcon.classList.add('fas', 'fa-info-circle', 'text-blue-600');
            break;
        default:
            messageBox.classList.add('bg-gray-100', 'text-gray-800');
            messageIcon.classList.add('fas', 'fa-info-circle', 'text-gray-600');
    }
    messageBox.classList.remove('hidden');
}

/**
 * Hides the message box.
 */
function hideMessage() {
    document.getElementById('messageBox').classList.add('hidden');
}

/**
 * Shows the loading spinner.
 */
function showLoadingSpinner() {
    document.getElementById('loadingSpinner').style.display = 'block';
}

/**
 * Hides the loading spinner.
 */
function hideLoadingSpinner() {
    document.getElementById('loadingSpinner').style.display = 'none';
}

/**
 * Initiates the reconciliation process by parsing uploaded CSV files.
 */
async function reconcile() {
    hideMessage();
    const resultsSection = document.getElementById('results');
    resultsSection.classList.add('hidden'); // Hide previous results
    resultsSection.classList.remove('results-fade-in'); // Remove animation class for re-triggering
    showLoadingSpinner();

    const internalFile = document.getElementById('internalFile').files[0];
    const providerFile = document.getElementById('providerFile').files[0];

    if (!internalFile || !providerFile) {
        showMessage('Please upload both CSV files.', 'warning');
        hideLoadingSpinner();
        return;
    }

    try {
        // Use Promises to handle PapaParse asynchronously
        const parseInternal = new Promise((resolve, reject) => {
            Papa.parse(internalFile, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.errors.length) {
                        reject(new Error(`Error parsing internal file: ${results.errors[0].message}`));
                    }
                    resolve(results.data);
                },
                error: (err) => reject(err)
            });
        });

        const parseProvider = new Promise((resolve, reject) => {
            Papa.parse(providerFile, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.errors.length) {
                        reject(new Error(`Error parsing provider file: ${results.errors[0].message}`));
                    }
                    resolve(results.data);
                },
                error: (err) => reject(err)
            });
        });

        const [internalSystemData, providerStatementData] = await Promise.all([parseInternal, parseProvider]);

        processReconciliation(internalSystemData, providerStatementData);
        hideLoadingSpinner();
        resultsSection.classList.remove('hidden');
        resultsSection.classList.add('results-fade-in'); // Add animation class
        showMessage('Reconciliation complete!', 'success');

    } catch (error) {
        hideLoadingSpinner();
        showMessage(`Error during reconciliation: ${error.message}`, 'error');
        console.error("Reconciliation error:", error);
    }
}

/**
 * Processes the parsed data to perform reconciliation.
 * @param {Array<Object>} internalSystemData - Data from the internal system CSV.
 * @param {Array<Object>} providerStatementData - Data from the provider statement CSV.
 */
function processReconciliation(internalSystemData, providerStatementData) {
    matchedData = [];
    internalOnlyData = [];
    providerOnlyData = [];
    mismatchedData = [];

    // Create maps for quick lookup by transaction_reference
    // Ensure 'transaction_reference', 'amount', 'status' columns exist
    const internalMap = new Map();
    internalSystemData.forEach(row => {
        if (row.transaction_reference) { // Ensure reference exists
            internalMap.set(row.transaction_reference, row);
        }
    });

    const providerMap = new Map();
    providerStatementData.forEach(row => {
        if (row.transaction_reference) { // Ensure reference exists
            providerMap.set(row.transaction_reference, row);
        }
    });

    // Iterate through internal data to find matches, mismatches, or internal-only
    for (let [ref, internalRow] of internalMap) {
        const providerRow = providerMap.get(ref);
        if (providerRow) {
            // Check for mismatches in amount or status
            // Note: CSV parsing reads values as strings. Convert to number for amount comparison.
            const internalAmount = parseFloat(internalRow.amount);
            const providerAmount = parseFloat(providerRow.amount);

            if (isNaN(internalAmount) || isNaN(providerAmount) ||
                internalAmount !== providerAmount ||
                internalRow.status !== providerRow.status) {
                mismatchedData.push({
                    transaction_reference: ref,
                    internal_amount: internalRow.amount,
                    provider_amount: providerRow.amount,
                    internal_status: internalRow.status,
                    provider_status: providerRow.status
                });
            } else {
                matchedData.push(internalRow); // Or providerRow, they are identical for matched
            }
            providerMap.delete(ref); // Remove from providerMap as it's been processed
        } else {
            internalOnlyData.push(internalRow);
        }
    }

    // Any remaining transactions in providerMap are provider-only
    for (let [ref, providerRow] of providerMap) {
        providerOnlyData.push(providerRow);
    }

    // Display results in the tables
    displayResults();
}

/**
 * Clears all result tables.
 */
function clearResultTables() {
    document.getElementById('matchedTable').getElementsByTagName('tbody')[0].innerHTML = '';
    document.getElementById('mismatchTable').getElementsByTagName('tbody')[0].innerHTML = '';
    document.getElementById('internalOnlyTable').getElementsByTagName('tbody')[0].innerHTML = '';
    document.getElementById('providerOnlyTable').getElementsByTagName('tbody')[0].innerHTML = '';
}

/**
 * Populates the HTML tables with the reconciliation results.
 */
function displayResults() {
    clearResultTables(); // Clear previous results

    // Matched Transactions
    const matchedTableBody = document.getElementById('matchedTable').getElementsByTagName('tbody')[0];
    matchedData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'matched-row border-b border-gray-200 hover:bg-gray-100 transition-colors duration-150';
        tr.innerHTML = `<td class="py-2 px-4 text-xs text-gray-800">${row.transaction_reference}</td><td class="py-2 px-4 text-xs text-gray-800">${row.amount}</td><td class="py-2 px-4 text-xs text-gray-800">${row.status}</td>`;
        matchedTableBody.appendChild(tr);
    });

    // Mismatched Transactions
    const mismatchTableBody = document.getElementById('mismatchTable').getElementsByTagName('tbody')[0];
    mismatchedData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'mismatch-row border-b border-gray-200 hover:bg-gray-100 transition-colors duration-150';
        tr.innerHTML = `<td class="py-2 px-4 text-xs text-gray-800">${row.transaction_reference}</td><td class="py-2 px-4 text-xs text-gray-800">${row.internal_amount}</td><td class="py-2 px-4 text-xs text-gray-800">${row.provider_amount}</td><td class="py-2 px-4 text-xs text-gray-800">${row.internal_status}</td><td class="py-2 px-4 text-xs text-gray-800">${row.provider_status}</td>`;
        mismatchTableBody.appendChild(tr);
    });

    // Internal Only
    const internalOnlyTableBody = document.getElementById('internalOnlyTable').getElementsByTagName('tbody')[0];
    internalOnlyData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'internal-only-row border-b border-gray-200 hover:bg-gray-100 transition-colors duration-150';
        tr.innerHTML = `<td class="py-2 px-4 text-xs text-gray-800">${row.transaction_reference}</td><td class="py-2 px-4 text-xs text-gray-800">${row.amount}</td><td class="py-2 px-4 text-xs text-gray-800">${row.status}</td>`;
        internalOnlyTableBody.appendChild(tr);
    });

    // Provider Only
    const providerOnlyTableBody = document.getElementById('providerOnlyTable').getElementsByTagName('tbody')[0];
    providerOnlyData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'provider-only-row border-b border-gray-200 hover:bg-gray-100 transition-colors duration-150';
        tr.innerHTML = `<td class="py-2 px-4 text-xs text-gray-800">${row.transaction_reference}</td><td class="py-2 px-4 text-xs text-gray-800">${row.amount}</td><td class="py-2 px-4 text-xs text-gray-800">${row.status}</td>`;
        providerOnlyTableBody.appendChild(tr);
    });
}

/**
 * Exports the given data array to a CSV file.
 * @param {Array<Object>} data - The array of objects to export.
 * @param {string} filename - The desired filename for the CSV.
 */
function exportCSV(data, filename) {
    if (data.length === 0) {
        showMessage(`No data to export for ${filename.replace('.csv', '')}.`, 'info');
        return;
    }
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link); // Clean up
    showMessage(`Exported ${filename} successfully!`, 'success');
}

/**
 * Clears uploaded files, hides results, and clears messages.
 */
function clearFilesAndResults() {
    // Clear file inputs
    document.getElementById('internalFile').value = '';
    document.getElementById('providerFile').value = '';

    // Clear global data arrays
    matchedData = [];
    internalOnlyData = [];
    providerOnlyData = [];
    mismatchedData = [];

    // Clear tables
    clearResultTables();

    // Hide results section
    document.getElementById('results').classList.add('hidden');
    document.getElementById('results').classList.remove('results-fade-in');

    // Hide message box
    hideMessage();

    showMessage('Files and results cleared.', 'info');
}
