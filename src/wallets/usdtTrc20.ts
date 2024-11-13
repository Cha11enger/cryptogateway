// src/wallets/usdtTrc20.ts

import { TronWeb } from 'tronweb'; // Updated import for TronWeb
import * as bip39 from 'bip39';
import { hdkey } from 'ethereumjs-wallet';
import Mnemonic from '../models/mnemonicModel';
import { TronAccount } from './models/usdt/usdtTrc'; // Correct path for TronAccount model
import { selectedNetworks } from '../lib/networks';
import { USDT_CONTRACT_ADDRESS } from '../config/contracts'; // USDT contract addresses
import axios from 'axios';

// Function to initialize TronWeb instance based on the network type
const getTronWebInstance = (networkType: 'mainnet' | 'testnet') => {
    const networkConfig = selectedNetworks.tron; 
    return new TronWeb({
        fullHost: networkConfig.fullNode,
        solidityNode: networkConfig.solidityNode,
        eventServer: networkConfig.eventServer,
    });
};

// Generate Tron Address from Mnemonic
export const createTrc20Address = async (mnemonicName: string, networkType: 'mainnet' | 'testnet', count: number = 1) => {
    console.log(`Creating TRC20 address with mnemonic: ${mnemonicName}, networkType: ${networkType}`);

    // Find the mnemonic by name
    const mnemonic = await Mnemonic.findOne({ name: mnemonicName });
    if (!mnemonic) {
        throw new Error('Mnemonic not found.');
    }

    const mnemonicPhrase = Array.isArray(mnemonic.mnemonics) ? mnemonic.mnemonics.join(' ') : mnemonic.mnemonics;
    if (!bip39.validateMnemonic(mnemonicPhrase)) {
        throw new Error('Invalid mnemonic.');
    }

    const seed = bip39.mnemonicToSeedSync(mnemonicPhrase);
    const hdWallet = hdkey.fromMasterSeed(seed);

    // Find the latest index for this mnemonic and networkType
    const latestAccount = await TronAccount.findOne({ mnemonicId: mnemonic._id, networkType }).sort({ index: -1 });
    const startIndex = latestAccount ? latestAccount.index + 1 : 0;

    const addresses = [];

    for (let i = 0; i < count; i++) {
        const currentIndex = startIndex + i;
        const key = hdWallet.derivePath(`m/44'/195'/0'/0/${currentIndex}`);
        const privateKey = key.getWallet().getPrivateKeyString().replace('0x', '');
        const publicKey = key.getWallet().getPublicKeyString();

        const tronWeb = getTronWebInstance(networkType);
        const address = tronWeb.address.fromPrivateKey(privateKey);

        if (!address) {
            throw new Error('Failed to derive address from private key.');
        }

        // Check if an address already exists for this mnemonicId, index, and networkType
        let account = await TronAccount.findOne({ mnemonicId: mnemonic._id, index: currentIndex, networkType });

        if (account) {
            // Update the existing account
            account.privateKey = privateKey;
            account.publicKey = publicKey;
        } else {
            // Create a new account
            account = new TronAccount({
                mnemonicId: mnemonic._id,
                index: currentIndex,
                networkType,
                address,
                privateKey,
                publicKey
            });
        }

        await account.save();
        addresses.push(account);
    }

    console.log(`Created or updated ${count} TRC20 addresses for ${networkType}.`);
    return addresses;
};


export const fetchUsdtTrc20Balance = async (address: string, networkType: 'mainnet' | 'testnet') => {
    console.log(`Fetching USDT TRC-20 balance for address: ${address} on ${networkType}`);
    
    const tronWeb = getTronWebInstance(networkType);

    // Validate the Tron address before interacting with the contract
    if (!tronWeb.isAddress(address)) {
        throw new Error('Invalid Tron address');
    }

    console.log(`Tron address is valid: ${address}`);

    // Set the owner address (important for TRC-20 interactions)
    tronWeb.setAddress(USDT_CONTRACT_ADDRESS[networkType]); // Use contract address for owner

    try {
        console.log(`Attempting to get contract at address: ${USDT_CONTRACT_ADDRESS[networkType]}`);
        const contract = await tronWeb.contract().at(USDT_CONTRACT_ADDRESS[networkType]);

        console.log(`Contract instance created. Fetching balance for address: ${address}`);
        // Fetch the balance of the provided address in base58 format
        const balanceResult = await contract.methods.balanceOf(address).call();  // Use base58 address

        console.log(`Balance result: ${balanceResult}`);

        // Check if the balanceResult is an object or array, and extract the correct value
        const balance = Array.isArray(balanceResult) ? balanceResult[0] : balanceResult;

        // Convert the balance from SUN to the main unit (TRC20 tokens)
        const convertedBalance = tronWeb.fromSun(balance); // Convert from SUN (TRX smallest unit) to USDT
        console.log(`Converted balance (USDT): ${convertedBalance}`);

        // Fetch the latest transaction to get the number of block confirmations
        const latestTransaction = await fetchLatestTransaction(address, networkType); // Pass the networkType string
        const confirmations = latestTransaction ? latestTransaction.confirmations : 0;

        console.log(`Number of block confirmations: ${confirmations}`);

        return {
            balance: convertedBalance,
            confirmations,
        };
    } catch (error) {
        console.error(`Error occurred during contract interaction: ${error}`);
        throw new Error(`Failed to fetch balance: ${(error as Error).message}`);
    }
};

// Helper function to fetch the latest transaction for the address
const fetchLatestTransaction = async (address: string, networkType: 'mainnet' | 'testnet') => {
    const tronWeb = getTronWebInstance(networkType);
    const baseUrl = networkType === 'mainnet' ? 'https://api.trongrid.io' : 'https://api.shasta.trongrid.io';
    
    const hexAddress = tronWeb.address.toHex(address); // Convert to hex address format
    const url = `${baseUrl}/v1/accounts/${hexAddress}/transactions`;

    console.log(`Fetching latest transaction for address: ${address} from ${url}`);

    try {
        const response = await axios.get(url, {
            params: {
                limit: 1, // Fetch only the most recent transaction
                order_by: "block_timestamp,desc"
            }
        });

        if (response.data && response.data.data && response.data.data.length > 0) {
            const latestTransaction = response.data.data[0];
            console.log(`Latest transaction details: ${JSON.stringify(latestTransaction)}`);

            // Extract the confirmations based on block number
            const currentBlock = await tronWeb.trx.getCurrentBlock();
            const confirmations = currentBlock.block_header.raw_data.number - latestTransaction.blockNumber;
            console.log(`Number of block confirmations: ${confirmations}`);

            return { confirmations };
        } else {
            console.log('No transactions found for this address.');
            return { confirmations: 0 };
        }
    } catch (error: any) {
        console.error(`Failed to fetch latest transaction: ${error.message}`);

        if (error.response) {
            console.error(`AxiosError: ${error.response.status} - ${error.response.statusText}`);
            console.error(`Response data: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            console.error(`Request failed with no response: ${error.request}`);
        } else {
            console.error(`Error message: ${error.message}`);
        }

        return { confirmations: 0 };
    }
};



// export const fetchUsdtTrc20Balance = async (address: string, networkType: 'mainnet' | 'testnet') => {
//     console.log(`Fetching USDT TRC-20 balance for address: ${address} on ${networkType}`);
    
//     const tronWeb = getTronWebInstance(networkType);

//     // Validate the Tron address before interacting with the contract
//     if (!tronWeb.isAddress(address)) {
//         throw new Error('Invalid Tron address');
//     }

//     console.log(`Tron address is valid: ${address}`);

//     // Set the owner address (important for TRC-20 interactions)
//     tronWeb.setAddress(USDT_CONTRACT_ADDRESS[networkType]); // Use contract address for owner

//     try {
//         console.log(`Attempting to get contract at address: ${USDT_CONTRACT_ADDRESS[networkType]}`);
//         const contract = await tronWeb.contract().at(USDT_CONTRACT_ADDRESS[networkType]);

//         console.log(`Contract instance created. Fetching balance for address: ${address}`);
//         // Fetch the balance of the provided address in base58 format
//         const balanceResult = await contract.methods.balanceOf(address).call();  // Use base58 address

//         console.log(`Balance result: ${balanceResult}`);

//         // Check if the balanceResult is an object or array, and extract the correct value
//         const balance = Array.isArray(balanceResult) ? balanceResult[0] : balanceResult;

//         // Convert the balance from SUN to the main unit (TRC20 tokens)
//         const convertedBalance = tronWeb.fromSun(balance); // Convert from SUN (TRX smallest unit) to USDT
//         console.log(`Converted balance (USDT): ${convertedBalance}`);

//         // Fetch the latest transaction to get the number of block confirmations
//         const latestTransaction = await fetchLatestTransaction(address, tronWeb);
//         const confirmations = latestTransaction ? latestTransaction.confirmations : 0;

//         console.log(`Number of block confirmations: ${confirmations}`);

//         return {
//             balance: convertedBalance,
//             confirmations,
//         };
//     } catch (error) {
//         console.error(`Error occurred during contract interaction: ${error}`);
//         throw new Error(`Failed to fetch balance: ${(error as Error).message}`);
//     }
// };

// // Helper function to fetch the latest transaction for the address
// const fetchLatestTransaction = async (address: string, networkType: 'mainnet' | 'testnet') => {
//     const tronWeb = getTronWebInstance(networkType);
//     const baseUrl = networkType === 'mainnet' ? 'https://api.trongrid.io' : 'https://api.shasta.trongrid.io';
    
//     const hexAddress = tronWeb.address.toHex(address); // Convert to hex address format
//     const url = `${baseUrl}/v1/accounts/${hexAddress}/transactions`;

//     console.log(`Fetching latest transaction for address: ${address} from ${url}`);

//     try {
//         const response = await axios.get(url, {
//             params: {
//                 limit: 1, // Fetch only the most recent transaction
//                 order_by: "block_timestamp,desc"
//             }
//         });

//         if (response.data && response.data.data && response.data.data.length > 0) {
//             const latestTransaction = response.data.data[0];
//             console.log(`Latest transaction details: ${JSON.stringify(latestTransaction)}`);

//             // Extract the confirmations based on block number
//             const currentBlock = await tronWeb.trx.getCurrentBlock();
//             const confirmations = currentBlock.block_header.raw_data.number - latestTransaction.blockNumber;
//             console.log(`Number of block confirmations: ${confirmations}`);

//             return { confirmations };
//         } else {
//             console.log('No transactions found for this address.');
//             return { confirmations: 0 };
//         }
//     } catch (error: any) {
//         console.error(`Failed to fetch latest transaction: ${error.message}`);

//         if (error.response) {
//             console.error(`AxiosError: ${error.response.status} - ${error.response.statusText}`);
//             console.error(`Response data: ${JSON.stringify(error.response.data)}`);
//         } else if (error.request) {
//             console.error(`Request failed with no response: ${error.request}`);
//         } else {
//             console.error(`Error message: ${error.message}`);
//         }

//         return { confirmations: 0 };
//     }
// };





