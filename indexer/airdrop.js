import { ethers } from 'ethers';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();


const RPC_URL = process.env.RPC_URL;
const MYGUY_CONTRACT_ADDRESS = process.env.MYGUY_CONTRACT_ADDRESS;
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
const INDEXER_API_URL = process.env.INDEXER_API_URL || "http://localhost:4000";
const AIRDROP_SERVER_PORT = process.env.AIRDROP_SERVER_PORT || 4001;
const AIRDROP_AMOUNT_MG = "15";
const MIN_BALANCE_MG = "1";
const GAS_LIMIT = "150000";
const DELAY_BETWEEN_TX_MS = 500;


const MYGUY_ABI = [
    "function executeAirdrop(address recipient, uint256 amountBaseUnits) external",
];

if (!RPC_URL || !MYGUY_CONTRACT_ADDRESS || !OWNER_PRIVATE_KEY || !INDEXER_API_URL) {
    console.error("❌ Error: RPC_URL, MYGUY_CONTRACT_ADDRESS, OWNER_PRIVATE_KEY, and INDEXER_API_URL must be set in .env");
    process.exit(1);
}
if (!ethers.isAddress(MYGUY_CONTRACT_ADDRESS)) { console.error(`❌ Error: Invalid MYGUY_CONTRACT_ADDRESS`); process.exit(1); }

const provider = RPC_URL.startsWith('wss') ? new ethers.WebSocketProvider(RPC_URL) : new ethers.JsonRpcProvider(RPC_URL);
let ownerWallet;
try { ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider); console.log(`✅ Airdrop Wallet: ${ownerWallet.address}`); }
catch (e) { console.error("❌ Error creating owner wallet:", e); process.exit(1); }
const myGuyContract = new ethers.Contract(MYGUY_CONTRACT_ADDRESS, MYGUY_ABI, ownerWallet);
console.log(`✅ Connected to MYGUY Contract: ${MYGUY_CONTRACT_ADDRESS}`);

const app = express();
app.use(cors());
app.use(express.json());

let isAirdropping = false;

async function executeAirdropLogic() {
    if (isAirdropping) { return { success: false, message: "Airdrop already in progress.", results: [] }; }
    isAirdropping = true;
    console.log("\n🚀 Airdrop process starting...");

    let holders = [];
    let airdropResults = [];

    try {
        console.log(`⏳ Fetching holder list from indexer: ${INDEXER_API_URL}/balances`);
        const response = await fetch(`${INDEXER_API_URL}/balances`);
        if (!response.ok) throw new Error(`Indexer API failed: ${response.statusText}`);
        const balanceData = await response.json();
        if (!Array.isArray(balanceData)) throw new Error("Invalid data from indexer.");
        console.log(`👥 Found ${balanceData.length} total holders.`);

        const minBalanceWei = ethers.parseUnits(MIN_BALANCE_MG, 18);
        holders = balanceData
            .filter(item => ethers.toBigInt(item.balance || "0") >= minBalanceWei)
            .map(item => item.address);
        const eligibleCount = holders.length;
        console.log(`✅ Found ${eligibleCount} eligible recipients (>= ${MIN_BALANCE_MG} MG).`);

        if (eligibleCount === 0) {
            isAirdropping = false;
            return { success: true, message: "No eligible holders for airdrop.", results: [] };
        }

        const airdropAmountWei = ethers.parseUnits(AIRDROP_AMOUNT_MG, 18);
        console.log(`💧 Airdrop Amount per user: ${AIRDROP_AMOUNT_MG} MG (${airdropAmountWei.toString()} Wei)`);
        console.log("⏳ Starting airdrop transactions...");

        for (let i = 0; i < holders.length; i++) {
            const recipient = holders[i];
            if (recipient.toLowerCase() === ownerWallet.address.toLowerCase()) {
                console.log(`   [${i + 1}/${holders.length}] Skipping owner: ${recipient}`);
                airdropResults.push({ address: recipient, status: 'skipped', message: 'Owner address' });
                continue;
            }
            console.log(`   [${i + 1}/${holders.length}] Sending to: ${recipient}`);
            try {
                const tx = await myGuyContract.executeAirdrop(recipient, airdropAmountWei, { gasLimit: GAS_LIMIT });
                console.log(`     Tx Sent: ${tx.hash}`);
                const receipt = await tx.wait();
                console.log(`     ✅ Success! Block: ${receipt.blockNumber}`);
                airdropResults.push({ address: recipient, status: 'success', message: `${AIRDROP_AMOUNT_MG} MG Airdropped!` });
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_TX_MS));
            } catch (error) {
                const reason = error.reason || error.message?.substring(0, 100) || "Unknown error";
                console.error(`     ❌ FAILED for ${recipient}:`, reason);
                airdropResults.push({ address: recipient, status: 'fail', message: `Failed: ${reason}` });
            }
        }
        const successCount = airdropResults.filter(r => r.status === 'success').length;
        const failCount = airdropResults.filter(r => r.status === 'fail').length;
        const summary = `Airdrop process finished. Success: ${successCount}, Failed: ${failCount}.`;
        console.log(`\n🏁 ${summary}`);
        isAirdropping = false;
        return { success: true, message: summary, results: airdropResults };

    } catch (error) {
        console.error("❌ CRITICAL AIRDROP ERROR:", error);
        isAirdropping = false;
        return { success: false, message: `Airdrop failed: ${error.message}`, results: airdropResults };
    }
}

app.post('/execute-airdrop', async (req, res) => {
    const requesterIp = req.ip || req.connection.remoteAddress;
    if (requesterIp !== '::1' && requesterIp !== '127.0.0.1' && !requesterIp.startsWith('::ffff:127.0.0.1')) {
        return res.status(403).json({ error: "Access denied." });
    }
    if (isAirdropping) { return res.status(429).json({ message: "Airdrop already in progress." }); }

    const result = await executeAirdropLogic();

    if (result.success !== false) {
        res.status(200).json({ message: result.message, results: result.results });
    } else {
        res.status(500).json({ error: result.message, results: result.results });
    }
});

app.listen(AIRDROP_SERVER_PORT, () => {
    console.log(`\n🚀 Airdrop Server started on http://localhost:${AIRDROP_SERVER_PORT}`);
    console.log(`   Trigger: POST to http://localhost:${AIRDROP_SERVER_PORT}/execute-airdrop`);
});

process.on('SIGINT', async () => {
    console.log("\n🔌 Shutting down airdrop server...");
    sseClients.forEach(clientRes => clientRes.end());
    if (provider?.destroy) {
        try { provider.destroy(); console.log("   WebSocket provider destroyed."); }
        catch (e) { console.error("   Error destroying provider:", e); }
    }
    process.exit(0);
});

function formatAddress(address) { if (!address) return 'N/A'; return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`; }