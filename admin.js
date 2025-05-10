
const adminContractAddress = "0x2c7edbccFe6EE536BE75067DA2796583EfCd79fD";
const adminContractABI = [
    { "type": "constructor", "inputs": [], "stateMutability": "nonpayable" }, { "type": "fallback", "stateMutability": "payable" }, { "type": "receive", "stateMutability": "payable" }, { "type": "function", "name": "deployed_add", "inputs": [], "outputs": [{ "name": "", "type": "address", "internalType": "address" }], "stateMutability": "view" }, { "type": "function", "name": "deposit_fund", "inputs": [], "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }], "stateMutability": "payable" }, { "type": "function", "name": "fix_address", "inputs": [], "outputs": [{ "name": "", "type": "address", "internalType": "address" }], "stateMutability": "view" }, { "type": "function", "name": "num", "inputs": [], "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }], "stateMutability": "view" }, { "type": "function", "name": "total_supply", "inputs": [], "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }], "stateMutability": "view" }
];

const myguyContractAddress = "0x848744ad263Cb9008D265Cb60B086A9e6FFe19B9";
const EXPECTED_OWNER_ADDRESS = "0xd697bc803e23F51f7e7dA4475860B813db514D41";

const MYGUY_ABI_FOR_ADMIN = [

    { "type": "function", "name": "getContractMgBalance", "inputs": [], "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }], "stateMutability": "view" }

];


let adminWeb3;
let adminContract;
let adminAccounts;
let myguyContractInstanceForAdmin;
let airdropEventSource = null;


const adminConnectContainer = document.getElementById('adminConnectContainer');
const adminConnectButton = document.getElementById('adminConnectButton');
const adminConnectStatus = document.getElementById('adminConnectStatus');
const adminUIContainer = document.getElementById('adminUIContainer');
const adminHeader = document.getElementById('adminHeader');
const adminWalletAddressEl = document.getElementById('adminWalletAddress');
const adminNetworkNameEl = document.getElementById('adminNetworkName');
const adminInterface = document.getElementById('admin-interface');
const adminMainStatus = document.getElementById('adminMainStatus');
const depositAmountEthInput = document.getElementById('depositAmountEth');
const depositButton = document.getElementById('depositButton');
const myguyAddressDisplay = document.getElementById('myguyAddressDisplay');
const myguyEthBalanceEl = document.getElementById('myguyEthBalance');
const adminContractMgBalanceEl = document.getElementById('adminContractMgBalance');
const airdropButton = document.getElementById('airdropButton');
const airdropProgressModal = document.getElementById('airdropProgressModal');
const airdropModalTitle = document.getElementById('airdropModalTitle');
const airdropModalBody = document.getElementById('airdropModalBody');
const closeAirdropModalButton = document.getElementById('closeAirdropModalButton');
const userCountDisplay = document.getElementById('userCountDisplay');
const balanceListEl = document.getElementById('balanceList');
const balancesDisplayArea = document.getElementById('balancesDisplayArea');
const blockBackgroundContainer = document.getElementById('block-background-container');
const introAnimationContainer = document.getElementById('introAnimationContainer');
const notificationContainer = document.getElementById('notification-container');


function displayAdminStatus(message, type = 'info', target = 'main') { const targetContainer = target === 'connect' ? adminConnectStatus : adminMainStatus; if (!targetContainer) { console.error(`Admin status container not found: ${target}`); return; } if (target === 'connect' && targetContainer.classList.contains('hidden')) { targetContainer.classList.remove('hidden'); } targetContainer.style.opacity = 0; setTimeout(() => { targetContainer.innerHTML = `<p class="status-message ${type}">${message}</p>`; targetContainer.className = `status-box ${type}`; targetContainer.style.opacity = 1; }, 150); console.log(`Admin Status [${type}] (${target}): ${message}`); }
function formatAddress(address) { if (!address) return 'N/A'; if (address === '0x0000000000000000000000000000000000000000') return 'Zero Address'; return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`; }
function formatWei(weiValue, decimals = 18, format = 'ether') { if (weiValue === null || weiValue === undefined) return 'N/A'; try { if (!adminWeb3) { console.warn("adminWeb3 not ready for formatWei"); return "N/A"; } return adminWeb3.utils.fromWei(weiValue.toString(), format); } catch (error) { console.error("Error formatting Wei:", weiValue, error); return 'Error'; } }
async function getNetworkName(chainId) { switch (Number(chainId)) { case 1: return 'Mainnet'; case 5: return 'Goerli'; case 11155111: return 'Sepolia'; case 137: return 'Polygon'; case 80001: return 'Mumbai'; case 1337: return 'Localhost'; default: return `Unknown (${chainId})`; } }
function showSpinner(button, show = true) { const text = button?.querySelector('.btn-text'); const spinner = button?.querySelector('.spinner'); if (!button) return; button.disabled = show; if (text) text.classList.toggle('hidden', show); if (spinner) spinner.classList.toggle('hidden', !show); }
async function handleAdminTransaction(txPromise, buttonElement, successMessage) { if (!adminContract || !adminAccounts) { displayAdminStatus("Wallet not connected.", "error"); return false; } if (buttonElement) showSpinner(buttonElement, true); displayAdminStatus('Waiting for transaction...', 'pending'); try { const receipt = await txPromise; await new Promise(resolve => setTimeout(resolve, 500)); displayAdminStatus(`${successMessage}. Tx: ${formatAddress(receipt.transactionHash)}`, 'success'); console.log("Admin Tx Receipt:", receipt); await updateMyGuyEthBalance(); if (buttonElement) showSpinner(buttonElement, false); return true; } catch (error) { console.error("Admin Transaction failed:", error); let errorMessage = error.message; if (error.code === 4001) { errorMessage = "Transaction rejected."; } else if (error.message?.includes("reverted")) { errorMessage = "Tx Reverted. Check console."; } displayAdminStatus(`Error: ${errorMessage.substring(0, 150)}...`, 'error'); if (buttonElement) showSpinner(buttonElement, false); return false; } }


async function connectAndVerifyOwner() {
    if (adminConnectButton && adminConnectButton.disabled) return;
    if (!window.ethereum) { displayAdminStatus("MetaMask not detected!", "error", "connect"); alert("MetaMask is required."); return; }

    displayAdminStatus("Connecting wallet...", "pending", "connect");
    if (adminConnectButton) showSpinner(adminConnectButton, true);

    try {
        adminWeb3 = new Web3(window.ethereum);
        adminAccounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

        if (!adminAccounts || adminAccounts.length === 0) throw new Error("No accounts found/approved.");

        const currentAccount = adminAccounts[0];
        const networkId = await adminWeb3.eth.getChainId();
        const networkName = await getNetworkName(networkId);
        console.log("Admin connected:", currentAccount, "Network:", networkName);

        if (currentAccount.toLowerCase() !== EXPECTED_OWNER_ADDRESS.toLowerCase()) {
            console.warn("Connected account is NOT the owner.");
            displayAdminStatus("Access Denied: Not the owner.", "error", "connect");
            if (adminConnectButton) showSpinner(adminConnectButton, false);
            return;
        }

        console.log("Owner verification successful.");
        displayAdminStatus("Owner verified! Loading Admin Panel...", "success", "connect");

        if (!Array.isArray(adminContractABI) || adminContractABI.length === 0 || !adminWeb3.utils.isAddress(adminContractAddress) || adminContractAddress === "YOUR_LATEST_OWNERONLY_ADDRESS") { // Updated placeholder check
            throw new Error("Admin contract Address/ABI invalid or placeholder used.");
        }
        adminContract = new adminWeb3.eth.Contract(adminContractABI, adminContractAddress);
        console.log("Admin Contract object created.");

        if (!Array.isArray(MYGUY_ABI_FOR_ADMIN) || !adminWeb3.utils.isAddress(myguyContractAddress) || myguyContractAddress === "YOUR_LATEST_MYGUY_ADDRESS") { // Updated placeholder check
            throw new Error("MYGUY Address/ABI for admin invalid or placeholder used.");
        }
        myguyContractInstanceForAdmin = new adminWeb3.eth.Contract(MYGUY_ABI_FOR_ADMIN, myguyContractAddress);
        console.log("MYGUY Contract instance for admin created.");


        if (adminConnectContainer) adminConnectContainer.classList.add('hidden');
        if (adminUIContainer) adminUIContainer.style.display = 'block';
        if (adminHeader) adminHeader.classList.remove('hidden');
        if (adminInterface) adminInterface.classList.remove('hidden');
        if (blockBackgroundContainer) blockBackgroundContainer.classList.remove('hidden');

        if (adminWalletAddressEl) adminWalletAddressEl.textContent = formatAddress(currentAccount);
        if (adminNetworkNameEl) adminNetworkNameEl.textContent = networkName;
        if (myguyAddressDisplay) myguyAddressDisplay.textContent = formatAddress(myguyContractAddress);

        await updateMyGuyEthBalance();
        await fetchInitialAdminData();
        await fetchAllBalances();
        await fetchAndDisplayContractMgBalance();

    } catch (error) {
        console.error("Admin Connection/Verification Error:", error);
        let msg = "Connection failed.";
        if (error.code === 4001) { msg = "Connection rejected."; }
        else if (error.message?.includes("Admin contract Address/ABI invalid")) { msg = "Admin Config Error! Check Address/ABI."; alert(msg); }
        else if (error.message?.includes("MYGUY Address/ABI for admin invalid")) { msg = "MYGUY Config Error for Admin! Check Address/ABI."; alert(msg); } // Specific error
        displayAdminStatus(msg, "error", "connect");
    } finally {
        if (adminConnectButton) showSpinner(adminConnectButton, false);
    }
}

function showNotification(message, type = 'info', duration = 5000) {
    if (!notificationContainer) return;
    const notificationDiv = document.createElement('div');
    notificationDiv.classList.add('notification', type);
    notificationDiv.innerHTML = message;
    notificationContainer.appendChild(notificationDiv);
    setTimeout(() => {
        notificationDiv.classList.add('fade-out');
        setTimeout(() => { notificationDiv.remove(); }, 500);
    }, duration);
}

async function updateMyGuyEthBalance() {
    if (!adminWeb3 || !myguyContractAddress || !myguyEthBalanceEl) return;
    myguyEthBalanceEl.textContent = "Loading...";
    try {
        const balanceWei = await adminWeb3.eth.getBalance(myguyContractAddress);
        myguyEthBalanceEl.textContent = formatWei(balanceWei);
    } catch (error) { console.error("Failed to get MYGUY ETH balance:", error); myguyEthBalanceEl.textContent = "Error"; }
}

async function fetchInitialAdminData() {
    if (!adminContract || !adminAccounts) return;
    console.log("Fetching initial admin contract data (num)...");
    if (userCountDisplay) userCountDisplay.textContent = 'Loading...';
    try {
        if (userCountDisplay && adminContract.methods.num) {
            const count = await adminContract.methods.num().call({ from: adminAccounts[0] });
            userCountDisplay.textContent = count.toString();
            console.log("Admin contract num:", count);
        } else { if (userCountDisplay) userCountDisplay.textContent = '?'; console.warn("Cannot fetch user count (num). Check ABI/element."); }
    } catch (error) { console.error("Error fetching initial admin data:", error); if (userCountDisplay) userCountDisplay.textContent = 'Error'; displayAdminStatus("Error fetching initial data.", "error"); }
}


async function fetchAndDisplayContractMgBalance() {
    if (!myguyContractInstanceForAdmin || !adminAccounts || !adminContractMgBalanceEl) {
        console.warn("Cannot fetch contract MG balance - prerequisites missing.");
        if (adminContractMgBalanceEl) adminContractMgBalanceEl.textContent = 'Error';
        return;
    }
    adminContractMgBalanceEl.textContent = "Loading...";
    console.log("Fetching MYGUY contract MG balance...");
    try {
        if (myguyContractInstanceForAdmin.methods.getContractMgBalance) {
            const balanceWei = await myguyContractInstanceForAdmin.methods.getContractMgBalance().call({ from: adminAccounts[0] });
            adminContractMgBalanceEl.textContent = formatWei(balanceWei) + ' MG';
            console.log("MYGUY contract MG balance:", balanceWei.toString());
        } else {
            throw new Error("getContractMgBalance function not found in MYGUY ABI for admin.");
        }
    } catch (error) {
        console.error("Error fetching MYGUY contract MG balance:", error);
        adminContractMgBalanceEl.textContent = "Error";
        displayAdminStatus("Error fetching contract MG balance.", "error");
    }
}
-

    async function depositFunds() {
        if (!adminContract || !adminAccounts || !depositAmountEthInput) return displayAdminStatus("Not ready.", "error");
        const amountEth = depositAmountEthInput.value.trim();
        if (!amountEth || parseFloat(amountEth) <= 0) return displayAdminStatus("Invalid ETH amount.", 'error');
        try {
            const amountWeiToSend = adminWeb3.utils.toWei(amountEth, 'ether');
            displayAdminStatus(`Depositing ${amountEth} ETH...`, 'pending');
            if (adminContract.methods.deposit_fund && typeof adminContract.methods.deposit_fund === 'function') {
                await handleAdminTransaction(
                    adminContract.methods.deposit_fund().send({ from: adminAccounts[0], value: amountWeiToSend }),
                    depositButton,
                    "Deposit transaction sent"
                );
                if (depositAmountEthInput) depositAmountEthInput.value = '';
            } else { throw new Error("deposit_fund function not found in ABI."); }
        } catch (error) { console.error("Deposit Error:", error); displayAdminStatus(`Deposit Error: ${error.message.substring(0, 100)}...`, 'error'); if (depositButton) showSpinner(depositButton, false); }
    }

async function runAirdrop() {
    if (!adminAccounts || !airdropButton) return displayAdminStatus("Not ready.", "error");


    showNotification("Airdrop process initiated with server...", 'info', 4000);
    displayAdminStatus("Contacting airdrop server to start process...", 'pending');
    showSpinner(airdropButton, true);

    if (airdropProgressModal) airdropProgressModal.classList.remove('hidden');
    if (airdropModalTitle) airdropModalTitle.textContent = "Airdrop In Progress";
    if (airdropModalBody) airdropModalBody.innerHTML = "<p>Airdrop is being processed by the server.</p><p>This may take several minutes depending on the number of users.</p><p>Please check the airdrop server's terminal for live, detailed progress. This modal will show the final summary.</p>";


    try {
        const airdropApiUrl = `https://owner-airdrop.onrender.com/execute-airdrop`;
        console.log(`ADMIN: Sending POST request to ${airdropApiUrl}`);
        const response = await fetch(airdropApiUrl, { method: 'POST' });
        console.log("ADMIN: Airdrop server response status:", response.status);

        const result = await response.json().catch(() => ({ error: "Failed to parse server response. Airdrop might still be running. Check server logs." }));

        if (!response.ok) {
            throw new Error(result.message || result.error || `Airdrop server request failed: ${response.statusText}`);
        }

        console.log("ADMIN: Airdrop server final response:", result);

        if (airdropModalTitle) airdropModalTitle.textContent = "Airdrop Process Completed";
        if (airdropModalBody) {
            let bodyHTML = `<p><strong>Summary: ${result.message || "Process finished."}</strong></p>`;
            if (result.results && result.results.length > 0) {
                bodyHTML += "<h4>Detailed Results:</h4><ul>";
                result.results.forEach(item => {
                    const statusClass = item.status === 'success' ? 'status-success' : (item.status === 'fail' ? 'status-fail' : 'status-skipped');
                    bodyHTML += `<li><span class="address">${formatAddress(item.address)}</span>: <span class="${statusClass}">${item.message}</span></li>`;
                });
                bodyHTML += "</ul>";
            } else if (result.message && !result.results) {
                bodyHTML += `<p>${result.message}</p>`;
            } else {
                bodyHTML += "<p>No detailed results provided or airdrop failed critically.</p>";
            }
            airdropModalBody.innerHTML = bodyHTML;
        }
        showNotification(result.message || "Airdrop process completed!", result.success === false ? 'error' : 'success');
        displayAdminStatus(result.message || "Airdrop process completed.", result.success === false ? 'error' : 'success');


    } catch (error) {
        console.error("Error triggering/processing airdrop:", error);
        if (airdropModalTitle) airdropModalTitle.textContent = "Airdrop Error";
        if (airdropModalBody) airdropModalBody.innerHTML = `<p style="color: var(--error-color);">Error: ${error.message}</p><p>Ensure the airdrop.js server is running and check its console.</p>`;
        showNotification(`Airdrop Failed: ${error.message}`, 'error', 8000);
        displayAdminStatus(`Airdrop Trigger Error: ${error.message}.`, 'error');
    } finally {
        showSpinner(airdropButton, false);
    }
}

async function fetchAllBalances() {
    if (!balanceListEl) { console.error("Cannot display balances: balanceListEl not found."); return; }
    displayAdminStatus("Fetching balances from indexer...", 'pending');
    balanceListEl.innerHTML = '<li>Fetching from indexer API...</li>';

    try {
        const apiUrl = `https://myguy-contract-indexer.onrender.com/balances`;
        console.log(`ADMIN: Fetching balances from: ${apiUrl}`);
        const response = await fetch(apiUrl);
        console.log("ADMIN: Indexer API Response Status:", response.status);

        if (!response.ok) {
            let errorBody = await response.text().catch(() => "Could not read error body");
            console.error("ADMIN: Indexer API Error Response Body:", errorBody);
            throw new Error(`Indexer API request failed: ${response.statusText} (Status ${response.status})`);
        }

        const balanceData = await response.json();
        console.log("ADMIN: Received balance data from indexer:", balanceData);
        balanceListEl.innerHTML = '';

        if (!Array.isArray(balanceData)) { throw new Error("Received invalid data format from indexer."); }

        if (balanceData.length === 0) {
            balanceListEl.innerHTML = '<li>No token holders found by indexer yet.</li>';
            displayAdminStatus("Fetched 0 balances from indexer.", 'info');
        } else {
            balanceData
                .sort((a, b) => parseFloat(formatWei(b.balance)) - parseFloat(formatWei(a.balance)))
                .forEach(item => {
                    const li = document.createElement('li');
                    const addressSpan = `<span class="address">${formatAddress(item.address)}</span>`;
                    const balanceSpan = `<span class="balance">${formatWei(item.balance)} MG</span>`;
                    li.innerHTML = `${addressSpan}${balanceSpan}`;
                    balanceListEl.appendChild(li);
                });
            displayAdminStatus(`Successfully fetched ${balanceData.length} balances from indexer.`, 'success');
        }

    } catch (error) {
        console.error("ADMIN: Error fetching balances from indexer API:", error);
        balanceListEl.innerHTML = `<li style="color: var(--error-color);">Error fetching from indexer: ${error.message}. Is indexer.js running?</li>`;
        displayAdminStatus(`Indexer Fetch Error: ${error.message}`, 'error');
    }
}


function initAdmin() {
    console.log("Admin INIT: Starting...");
    const introContainer = document.getElementById('introAnimationContainer');
    const connectPage = document.getElementById('adminConnectContainer');
    const mainUI = document.getElementById('adminUIContainer');
    if (mainUI) mainUI.style.display = 'none';
    if (blockBackgroundContainer) blockBackgroundContainer.classList.add('hidden');

    if (introContainer && connectPage) { connectPage.classList.add('hidden'); connectPage.style.display = 'none'; console.log("Admin INIT: Setting up intro timeout..."); setTimeout(() => { console.log("Admin TIMEOUT: Intro finished."); if (introContainer) introContainer.classList.add('hidden'); if (connectPage) { console.log("Admin TIMEOUT: Making connect page display:flex"); connectPage.style.display = 'flex'; setTimeout(() => { try { connectPage.classList.remove('hidden'); connectPage.style.animationDelay = '0s'; console.log("Admin TIMEOUT (nested): Connect page shown."); displayAdminStatus("Please connect wallet.", 'info', 'connect'); } catch (nestedError) { console.error("Admin nested timeout Error:", nestedError); } }, 50); } else { console.error("Admin TIMEOUT ERROR: Connect page missing!"); } }, 3000); } else if (connectPage) { console.warn("Admin INIT WARN: Intro container not found..."); connectPage.style.display = 'flex'; connectPage.classList.remove('hidden'); displayAdminStatus("Please connect wallet.", 'info', 'connect'); } else { console.error("Admin INIT FATAL: Cannot display intro or connect page."); alert("Critical error: Admin UI elements missing."); }

    if (adminConnectButton) adminConnectButton.addEventListener('click', connectAndVerifyOwner);
    if (depositButton) depositButton.addEventListener('click', depositFunds);
    if (airdropButton) airdropButton.addEventListener('click', runAirdrop);
    if (closeAirdropModalButton && airdropProgressModal) {
        closeAirdropModalButton.addEventListener('click', () => {
            airdropProgressModal.classList.add('hidden');
        });
    } else { console.error("Airdrop modal close button or modal itself not found."); }

    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (newAccounts) => {
            if (airdropEventSource) airdropEventSource.close();
        });
        window.ethereum.on('chainChanged', () => {
            if (airdropEventSource) airdropEventSource.close();
            window.location.reload();
        });
    }
    console.log("Admin INIT: Complete.");
}

document.addEventListener('DOMContentLoaded', initAdmin);
