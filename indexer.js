import { ethers } from 'ethers';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const RPC_URL = process.env.RPC_URL;
const MYGUY_CONTRACT_ADDRESS = process.env.MYGUY_CONTRACT_ADDRESS;
const API_PORT = process.env.API_PORT || 4000;
const START_BLOCK = parseInt(process.env.START_BLOCK || "0", 10);
const PING_INTERVAL_MS = 30 * 1000;

const MYGUY_MINIMAL_ABI = [
    "event transfer(address indexed from, address indexed to, uint256 tokens)"
];

if (!RPC_URL || !MYGUY_CONTRACT_ADDRESS) { console.error("❌ Error: RPC_URL and MYGUY_CONTRACT_ADDRESS must be set."); process.exit(1); }
if (!RPC_URL.startsWith('wss://')) { console.warn("⚠️ Warning: RPC_URL does not start with wss://. Real-time updates might be slow due to polling instead of WebSockets."); }
if (!ethers.isAddress(MYGUY_CONTRACT_ADDRESS)) { console.error(`❌ Error: Invalid MYGUY_CONTRACT_ADDRESS: ${MYGUY_CONTRACT_ADDRESS}`); process.exit(1); }

let balances = {};
let holders = new Set();
let isSynced = false;
let lastProcessedBlock = START_BLOCK;

console.log("🔹 Using Ethers v6 syntax.");
let provider;
try {
    provider = new ethers.WebSocketProvider(RPC_URL);
    console.log("✅ Ethers v6 WebSocketProvider created successfully.");
} catch (e) { console.error("❌ Failed to create WebSocketProvider:", e); process.exit(1); }
const myGuyContract = new ethers.Contract(MYGUY_CONTRACT_ADDRESS, MYGUY_MINIMAL_ABI, provider);

console.log(`🔌 Connecting to RPC: ${RPC_URL}`);
console.log(`📄 Tracking MYGUY Contract: ${MYGUY_CONTRACT_ADDRESS}`);
console.log(`🔍 Starting scan from block: ${START_BLOCK}`);

function processTransferEvent(from, to, tokensBN) {
    console.log(`  Processing transfer: ${from} -> ${to} : ${tokensBN.toString()}`);
    if (from !== ethers.ZeroAddress) {
        const fromBalance = ethers.toBigInt(balances[from] || "0");
        balances[from] = (fromBalance - tokensBN).toString();
        console.log(`      -> Sender ${from} new balance: ${balances[from]}`);
    }
    if (to !== ethers.ZeroAddress) {
        const toBalance = ethers.toBigInt(balances[to] || "0");
        balances[to] = (toBalance + tokensBN).toString();
        console.log(`      -> Receiver ${to} new balance: ${balances[to]}`);
        if (!holders.has(to)) {
            console.log(`      -> New holder detected: ${to}`);
            holders.add(to);
        }
    }
    if (from !== ethers.ZeroAddress && !holders.has(from)) {
        console.log(`      -> Tracking sender: ${from}`);
        holders.add(from);
    }
}

async function syncPastEvents() {
    console.log(`⏳ Starting initial sync from block ${START_BLOCK}...`);
    isSynced = false;
    try {
        const latestBlock = await provider.getBlockNumber();
        console.log(`   Latest block found: ${latestBlock}`);
        lastProcessedBlock = START_BLOCK > 0 ? START_BLOCK - 1 : 0;
        const BATCH_SIZE = 500;
        let currentBlock = START_BLOCK;
        console.log(`   Querying past 'transfer' events in batches...`);
        const transferFilter = myGuyContract.filters.transfer();
        while (currentBlock <= latestBlock) {
            const endBlock = Math.min(currentBlock + BATCH_SIZE - 1, latestBlock);
            console.log(`      Fetching transfer events from block ${currentBlock} to ${endBlock}`);
            const pastEvents = await myGuyContract.queryFilter(transferFilter, currentBlock, endBlock);
            console.log(`      Found ${pastEvents.length} transfer events in batch.`);
            if (pastEvents.length > 0) {
                for (const event of pastEvents) {
                    const blockNum = event.log?.blockNumber ?? event.blockNumber;
                    if (!event.args) { console.warn(`Skipping event in block ${blockNum} - missing args.`); continue; }
                    const { from, to, tokens } = event.args;
                    if (tokens === undefined) { console.warn(`Skipping event in block ${blockNum} - missing 'tokens' arg.`); continue; }
                    processTransferEvent(from, to, ethers.toBigInt(tokens));
                }
                lastProcessedBlock = endBlock;
                console.log(`      Processed batch up to block ${lastProcessedBlock}`);
            } else { lastProcessedBlock = endBlock; }
            currentBlock = endBlock + 1;
        }
        console.log(`✅ Initial sync complete up to block ${lastProcessedBlock}. Balances calculated for ${holders.size} holders.`);
        isSynced = true;
    } catch (error) { console.error("❌ Error during initial sync:", error); process.exit(1); }
}

function startRealtimeListener() {
    if (!provider || typeof provider.on !== 'function') { console.error("❌ Cannot start listener: Provider issue."); return; }
    if (!myGuyContract || typeof myGuyContract.on !== 'function') { console.error("❌ Cannot start listener: Contract issue."); return; }

    console.log(`👂 Starting real-time listener from block ${lastProcessedBlock + 1}...`);

    myGuyContract.on("transfer", (from, to, tokens, event) => {
        console.log("===================================");
        console.log(`⚡ Real-time 'transfer' Event Received!`);
        try {
            const blockNumber = event.log?.blockNumber ?? event.blockNumber;
            console.log(`  Block #: ${blockNumber}, Last Processed: ${lastProcessedBlock}`);
            if (blockNumber === undefined || blockNumber <= lastProcessedBlock) { console.log("  -> Skipping event (old/processed)."); return; }
            if (!isSynced) { console.log("  -> Skipping event (syncing)."); return; }
            if (!from || !to || tokens === undefined) { console.warn("  -> Skipping event (missing args)."); return; }
            console.log("  -> Checks passed, processing.");

            processTransferEvent(from, to, ethers.toBigInt(tokens));
            lastProcessedBlock = blockNumber;
            console.log(`  -> Event Processed. New lastProcessedBlock: ${lastProcessedBlock}`);
        } catch (processingError) { console.error("  -> ❌ Error processing real-time event:", processingError); }
        finally { console.log("==================================="); }
    });

    provider.on('error', (error) => {
        console.error("❌ Provider Error (WebSocket issue?):", error);
    });

    setInterval(async () => { if (!provider) return; try { const blockNum = await provider.getBlockNumber(); console.log(` KEEPALIVE PING: OK - Current block: ${blockNum}`); } catch (pingError) { console.error(" KEEPALIVE PING: FAILED - Provider connection might be lost.", pingError); } }, PING_INTERVAL_MS);

    console.log("✅ Real-time listener attached for 'transfer' event.");
}

const app = express();
app.use(cors());
app.get('/balances', (req, res) => {
    console.log(`API Request Received: /balances`);
    if (!isSynced) { console.log("  -> Indexer not synced, returning 503."); return res.status(503).json({ error: "Indexer is not yet synced." }); }
    try {
        const balanceArray = [];
        console.log(`  -> Preparing balances for ${holders.size} potential holders.`);
        holders.forEach((address) => {
            const balanceStr = balances[address] || "0";
            const balanceBN = ethers.toBigInt(balanceStr);

            balanceArray.push({ address: address, balance: balanceStr });

        });
        console.log(`  -> Sending ${balanceArray.length} balances.`);
        res.json(balanceArray);
    } catch (error) { console.error("❌ Error preparing /balances response:", error); res.status(500).json({ error: "Internal server error generating balances." }); }
});

async function main() {
    try {
        await syncPastEvents();
        startRealtimeListener();
        app.listen(API_PORT, () => { console.log(`✅ Indexer API server running on http://localhost:${API_PORT}`); console.log(`   Endpoint available at http://localhost:${API_PORT}/balances`); });
    } catch (error) { console.error("❌ Unhandled error during main execution:", error); process.exit(1); }
}

process.on('SIGINT', async () => { console.log("\n🔌 Shutting down indexer..."); if (provider?.destroy) { provider.destroy(); console.log("   WebSocket provider destroyed."); } process.exit(0); }); // Added provider destroy

main(); 