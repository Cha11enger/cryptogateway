import * as bip39 from 'bip39';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { LTCMasterKey } from './models/ltc/ltcMasterKey';
import { LTCChildXKey } from './models/ltc/ltcChildXKey';
import { LTCChildAddress } from './models/ltc/ltcChildAddress';
import Mnemonic from '../models/mnemonicModel';
import { getNetworkByName } from '../lib/networks';
import * as litecoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import axios, { AxiosError } from 'axios';
import { validateCryptoAddress, validate } from '../utils/addressValidator';
import { fetchCoinPrice, fetchCoinPriceCG } from '../utils/price';

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

const SATS_PER_LTC = 100_000_000;

const satsToLTC = (sats: number) => {
  return sats / SATS_PER_LTC;
};

export const createLTCMasterKeys = async (mnemonicName: string, networkType: 'mainnet' | 'testnet') => {
    const mnemonic = await Mnemonic.findOne({ name: mnemonicName });
    if (!mnemonic) {
        throw new Error('Mnemonic not found.');
    }

    const mnemonicPhrase = Array.isArray(mnemonic.mnemonics) ? mnemonic.mnemonics.join(' ') : mnemonic.mnemonics;

    const seed = bip39.mnemonicToSeedSync(mnemonicPhrase);
    const network = getNetworkByName(networkType, 'litecoin');

    const root = bip32.fromSeed(seed, network);

    const masterXpriv = root.toBase58();
    const masterXpub = root.neutered().toBase58();

    let masterKey = await LTCMasterKey.findOne({ mnemonicId: mnemonic._id, networkType });

    if (masterKey) {
        masterKey.masterXpriv = masterXpriv;
        masterKey.masterXpub = masterXpub;
    } else {
        masterKey = new LTCMasterKey({
            mnemonicId: mnemonic._id,
            masterXpriv,
            masterXpub,
            networkType,
        });
    }

    await masterKey.save();

    console.log(`Master keys for ${networkType}:`, masterKey.masterXpriv, masterKey.masterXpub);

    return masterKey;
};

export const createLTCChildXKeys = async (mnemonicName: string, networkType: 'mainnet' | 'testnet', count: number = 1) => {
    const mnemonic = await Mnemonic.findOne({ name: mnemonicName });
    if (!mnemonic) {
        throw new Error('Mnemonic not found.');
    }

    const masterKey = await LTCMasterKey.findOne({ mnemonicId: mnemonic._id, networkType });

    if (!masterKey) {
        throw new Error(`Master key not found for ${networkType}.`);
    }

    const root = bip32.fromBase58(masterKey.decryptMasterXpriv(), getNetworkByName(networkType, 'litecoin'));

    const childKeys = [];

    for (let i = 0; i < count; i++) {
        const childNode = root.derivePath(`m/0'/0/${i}`);
        const childXpriv = childNode.toBase58();
        const childXpub = childNode.neutered().toBase58();

        // Check if a child key already exists
        let childKey = await LTCChildXKey.findOne({ mnemonicId: masterKey.mnemonicId, childXpub, networkType });

        if (childKey) {
            childKey.childXpriv = childXpriv;
        } else {
            childKey = new LTCChildXKey({
                mnemonicId: masterKey.mnemonicId,
                parentXpub: masterKey.masterXpub,
                childXpriv,
                childXpub,
                networkType,
            });
        }

        await childKey.save();
        childKeys.push(childKey);
    }

    console.log(`Created or updated ${count} child keys for ${networkType}.`);

    return childKeys;
};

export const createLTCChildAddresses = async (
  mnemonicName: string,
  networkType: 'mainnet' | 'testnet',
  count: number = 1
) => {
  console.log(`Creating ${count} child addresses for mnemonic: ${mnemonicName} on ${networkType}`);

  // Find the mnemonic by name
  const mnemonic = await Mnemonic.findOne({ name: mnemonicName });
  if (!mnemonic) {
    throw new Error('Mnemonic not found.');
  }

  // Find the childXKey associated with the mnemonic ID and network type
  const childKeys = await LTCChildXKey.find({ mnemonicId: mnemonic._id, networkType });

  if (!childKeys.length) {
    throw new Error(`Child keys not found for ${networkType}.`);
  }

  const addresses = []; // to store child addresses

  // Find the latest child address index
  const latestChildAddress = await LTCChildAddress.findOne({ mnemonicId: mnemonic._id, networkType }).sort({ index: -1 });
  const startIndex = latestChildAddress ? latestChildAddress.index + 1 : 0;

  for (let i = 0; i < count; i++) {
    const currentIndex = startIndex + i; // Make sure we derive from the correct index
    
    const childKey = childKeys[i % childKeys.length]; // Round-robin selection of child key

    // Derive the child address using the index in the derivation path
    const childNode = bip32.fromBase58(childKey.decryptChildXpriv(), getNetworkByName(networkType, 'litecoin')).derive(currentIndex);

    // Convert the public key from Uint8Array to Buffer and generate the child address
    const childAddress = litecoin.payments.p2wpkh({
      pubkey: Buffer.from(childNode.publicKey),
      network: getNetworkByName(networkType, 'litecoin')
    }).address;
    
    const childPrivateKey = childNode.toWIF();

    // Check if a child address already exists
    let childAddressDoc = await LTCChildAddress.findOne({ mnemonicId: mnemonic._id, index: currentIndex, networkType });

    if (childAddressDoc) {
      console.log(`Address already exists for index ${currentIndex} for mnemonic ${mnemonic._id}`);
      continue; // Skip creating if address exists
    }

    // Create a new child address
    childAddressDoc = new LTCChildAddress({
      mnemonicId: mnemonic._id,
      childXpub: childKey.childXpub,
      childAddress,
      privateKey: childPrivateKey,
      networkType,
      index: currentIndex,  // Set the index here
    });

    // Save the child address (this will trigger the pre-save hook)
    await childAddressDoc.save();
    addresses.push(childAddressDoc);
  }

  console.log(`Created or updated ${addresses.length} child addresses for ${networkType}.`);

  return addresses;
};

// export const createLTCChildAddresses = async (
//     mnemonicName: string,
//     networkType: 'mainnet' | 'testnet',
//     count: number = 1
// ) => {
//     console.log(`Creating ${count} child addresses for ${networkType}.`);
//     const mnemonic = await Mnemonic.findOne({ name: mnemonicName });
//     if (!mnemonic) {
//         throw new Error('Mnemonic not found.');
//     }

//     const childXKey = await LTCChildXKey.findOne({ mnemonicId: mnemonic._id, networkType });
//     if (!childXKey) {
//         throw new Error(`No child xKey found for network type: ${networkType}`);
//     }

//     const network = getNetworkByName(networkType, 'litecoin');
//     const latestChildAddress = await LTCChildAddress.findOne({ networkType }).sort({ index: -1 });
//     const startIndex = latestChildAddress ? latestChildAddress.get('index') + 1 : 0;
//     const addresses = [];

//     for (let i = startIndex; i < startIndex + count; i++) {
//         try {
//             const hdNode = bip32.fromBase58(childXKey.decryptChildXpriv(), network);
//             const childNode = hdNode.derive(i);
//             const keyPair = ECPair.fromPrivateKey(childNode.privateKey!);

//             const pubkey = Buffer.from(keyPair.publicKey);

//             // Generate a bech32 (P2WPKH) address for Litecoin
//             const { address } = litecoin.payments.p2wpkh({
//                 pubkey,
//                 network,
//             });

//             const privateKey = keyPair.toWIF();

//             let childAddressDoc = await LTCChildAddress.findOne({
//                 mnemonicId: mnemonic._id,
//                 childAddress: address,
//                 networkType,
//             });

//             if (childAddressDoc) {
//                 // Update the existing child address
//                 childAddressDoc.privateKey = privateKey;
//             } else {
//                 // Create a new child address
//                 childAddressDoc = new LTCChildAddress({
//                     mnemonicId: mnemonic._id,
//                     childXpub: childXKey.childXpub,
//                     childAddress: address!,
//                     privateKey,
//                     networkType,
//                     index: i,
//                 });
//             }

//             await childAddressDoc.save();
//             addresses.push(childAddressDoc);
//         } catch (error) {
//             console.error(`Failed to create child address for index ${i}:`, error);
//             throw error;
//         }
//     }

//     console.log(`Created or updated ${count} child addresses for ${networkType}.`);

//     return addresses;
// };

const LITECOINSPACE_MAINNET_URL = 'https://litecoinspace.org/api/address';
const LITECOINSPACE_TESTNET_URL = 'https://litecoinspace.org/testnet/api/address';
const BLOCKCYPHER_MAINNET_URL = 'https://api.blockcypher.com/v1/ltc/main/addrs';
const CRYPTOAPIS_MAINNET_URL = 'https://rest.cryptoapis.io/blockchain-data/litecoin/mainnet/addresses';
const CRYPTOAPIS_TESTNET_URL = 'https://rest.cryptoapis.io/blockchain-data/litecoin/testnet/addresses';
const EXPLORERLTC_MAINNET_URL = 'https://explorer.litecoin.net/api/address';
const EXPLORERLTC_TESTNET_URL = 'https://explorer.litecoin.net/testnet/api/address';

// Define Transaction Base URLs
const EXPLORERLTC_MAINNET_TX_URL = 'https://explorer.litecoin.net/api/tx';
const EXPLORERLTC_TESTNET_TX_URL = 'https://explorer.litecoin.net/testnet/api/tx';
const LITECOINSPACE_MAINNET_TX_URL = 'https://litecoinspace.org/api/tx';
const LITECOINSPACE_TESTNET_TX_URL = 'https://litecoinspace.org/testnet/api/tx';

// Export the fetchUTXOs function
export async function fetchUTXOs(
    address: string,
    networkType: 'mainnet' | 'testnet',
    maxRetries: number = 3,
    retryDelay: number = 1000
): Promise<any[]> {
    const validationMessage = validateCryptoAddress(address, 'ltc');
    if (validationMessage === 'invalid') {
        throw new Error(`Invalid address: ${address}`);
    } else if (validationMessage !== networkType) {
        throw new Error(`Address ${address} does not match the network type ${networkType}`);
    }

    // Determine Address and Transaction Base URLs for Primary API (Explorer)
    const explorerAddressBaseURL = networkType === "mainnet" ? EXPLORERLTC_MAINNET_URL : EXPLORERLTC_TESTNET_URL;
    const explorerTxBaseURL = networkType === "mainnet" ? EXPLORERLTC_MAINNET_TX_URL : EXPLORERLTC_TESTNET_TX_URL;

    // Determine Address and Transaction Base URLs for Fallback API (LitecoinSpace)
    const litecoinSpaceAddressBaseURL = networkType === "mainnet" ? LITECOINSPACE_MAINNET_URL : LITECOINSPACE_TESTNET_URL;
    const litecoinSpaceTxBaseURL = networkType === "mainnet" ? LITECOINSPACE_MAINNET_TX_URL : LITECOINSPACE_TESTNET_TX_URL;

    let fetchedUTXOs = [];

    // Attempt to fetch UTXOs from primary API (Explorer)
    try {
        const fetchURL = `${explorerAddressBaseURL}/${address}/utxo`;
        console.log(`Fetching UTXOs for address: ${address} from Explorer API: ${fetchURL}`);
        const { data: utxos } = await axios.get(fetchURL);
        console.log("UTXOs fetched successfully from Explorer API.");
        fetchedUTXOs = await enhanceUTXOs(utxos, explorerTxBaseURL, address, maxRetries, retryDelay);
        if (fetchedUTXOs.length > 0) {
            return fetchedUTXOs;
        }
    } catch (error) {
        console.error("Error fetching UTXOs from Explorer API:", (error as Error).message);
    }

    // If fetching from primary API fails, try fallback API (LitecoinSpace)
    try {
        const fetchURL = `${litecoinSpaceAddressBaseURL}/${address}/utxo`;
        console.log(`Fetching UTXOs for address: ${address} from LitecoinSpace API: ${fetchURL}`);
        const { data: utxos } = await axios.get(fetchURL);
        console.log("UTXOs fetched successfully from LitecoinSpace API.");
        fetchedUTXOs = await enhanceUTXOs(utxos, litecoinSpaceTxBaseURL, address, maxRetries, retryDelay);
        if (fetchedUTXOs.length > 0) {
            return fetchedUTXOs;
        }
    } catch (error) {
        console.error("Error fetching UTXOs from LitecoinSpace API:", (error as Error).message);
    }

    throw new Error("Failed to fetch and enhance UTXOs from both Explorer and LitecoinSpace APIs.");
}

async function enhanceUTXOs(
    utxos: any[],
    txBaseURL: string,
    address: string,
    maxRetries: number,
    retryDelay: number
): Promise<any[]> {
    const enhancedUTXOs = [];

    for (const utxo of utxos) {
        let attempt = 0;
        let success = false;

        while (attempt < maxRetries && !success) {
            try {
                const txDetailUrl = `${txBaseURL}/${utxo.txid}/hex`;  // Add /hex to fetch the transaction hex
                console.log(`Fetching transaction hex details from URL: ${txDetailUrl}`);
                const response = await axios.get(txDetailUrl);
                console.log(`Transaction hex details response status: ${response.status}`);
                const rawTx = response.data;

                enhancedUTXOs.push({
                    ...utxo,
                    rawTx,  // Save the raw transaction hex directly
                });

                console.log(`Successfully enhanced UTXO: ${utxo.txid}:${utxo.vout}`);
                success = true;
            } catch (error) {
                attempt++;
                console.error(`Attempt ${attempt} - Error enhancing UTXO ${utxo.txid}:${utxo.vout}: ${(error as AxiosError).message}`);
                if (attempt < maxRetries) {
                    console.log(`Retrying in ${retryDelay}ms...`);
                    await new Promise((resolve) => setTimeout(resolve, retryDelay));
                } else {
                    console.error(`Failed to enhance UTXO ${utxo.txid}:${utxo.vout} after ${maxRetries} attempts.`);
                }
            }
        }
    }

    return enhancedUTXOs;
}

export function selectUTXOs(utxos: any[], amountNeeded: number) {
    let selectedUTXOs = [];
    let totalSelected = 0;

    // Sort UTXOs by value (ascending)
    utxos.sort((a, b) => a.value - b.value);

    for (const utxo of utxos) {
        selectedUTXOs.push(utxo);
        totalSelected += utxo.value;

        if (totalSelected >= amountNeeded) {
            break;
        }
    }

    if (totalSelected < amountNeeded) {
        throw new Error("Insufficient funds available.");
    }

    return { selectedUTXOs, totalSelected };
}

// Define the network name type
type NetworkName = 'mainnet' | 'testnet';

// Fetch current network fee estimates
export async function fetchFeeEstimates(networkType: NetworkName) {
  console.log(`Fetching fee estimates for Litecoin network: ${networkType}`);
  
  // Set the base URLs for the fee estimate API
  const baseUrl = networkType === 'mainnet'
    ? "https://explorer.litecoin.net/api/v1"
    : "https://explorer.litecoin.net/testnet/api/v1";

  const altBaseUrl = networkType === 'mainnet'
    ? "https://litecoinspace.org/api/v1"
    : "https://litecoinspace.org/testnet/api/v1";

  try {
    // Try to fetch fee estimates from the primary source
    const response = await axios.get(`${baseUrl}/fees/recommended`);
    console.log('Base URL:', baseUrl, 'Response:', response.data);
    
    return {
      networkType,
      fastestFee: Math.round(response.data.fastestFee),
      halfHourFee: Math.round(response.data.halfHourFee),
      hourFee: Math.round(response.data.hourFee),
      economyFee: Math.round(response.data.economyFee),
      minimumFee: Math.round(response.data.minimumFee)
    };
  } catch (error) {
    // Log the error from the primary source
    const errorMessage = (error as Error).message;
    console.error('Failed to fetch fee estimates from primary source:', errorMessage);
    console.log('Attempting fetch from alternative source...');

    // Try to fetch fee estimates from the alternative source
    try {
      const altResponse = await axios.get(`${altBaseUrl}/fees/recommended`);
      console.log('Alternative URL:', altBaseUrl, 'Response:', altResponse.data);

      return {
        networkType,
        fastestFee: Math.round(altResponse.data.fastestFee),
        halfHourFee: Math.round(altResponse.data.halfHourFee),
        hourFee: Math.round(altResponse.data.hourFee),
        economyFee: Math.round(altResponse.data.economyFee),
        minimumFee: Math.round(altResponse.data.minimumFee)
      };
    } catch (altError) {
      const altErrorMessage = (altError as Error).message;
      console.error('Failed to fetch fee estimates from both primary and alternative sources:', altErrorMessage);
      throw new Error('Failed to fetch fee estimates from all sources.');
    }
  }
}

async function calculateTransactionFees(address: string, recipientAddress: string | null = null, amountToSend: number, network: 'mainnet' | 'testnet') {
  console.log(`Preparing to validate address in calculateTransactionFees: ${address}`);

  const senderValidation = validateCryptoAddress(address, 'ltc');
  if (senderValidation !== network) {
    throw new Error(`Invalid sender address: ${senderValidation}`);
  }

  if (recipientAddress) {
    const recipientValidation = validateCryptoAddress(recipientAddress, 'ltc');
    if (recipientValidation !== network) {
      throw new Error(`Invalid recipient address: ${recipientValidation}`);
    }
  }

  console.log(`Calculating transaction fees for network: ${network}`);
  const utxos = await fetchUTXOs(address, network);
  console.log(`Fetched ${utxos.length} UTXOs for address ${address}`);

  const litecoinPriceUSD = await fetchCoinPrice('LTC');
  console.log(`Current Litecoin price in USD: ${litecoinPriceUSD}`);

  const feeEstimates = await fetchFeeEstimates(network);
  console.log(`Fetched fee estimates: ${JSON.stringify(feeEstimates)}`);

  const outputsCount = recipientAddress ? 2 : 1;  // 1 for change if recipient address is provided
  const { selectedUTXOs, totalSelected } = selectUTXOs(utxos, amountToSend);
  const transactionVbytes = calculateVbytes(selectedUTXOs.length, outputsCount);
  console.log(`Calculated transaction size in vbytes: ${transactionVbytes}`);

  const fees = {
    transactionVbytes,
    feesDetails: {
      'fastest': {
        time: '10 minutes',
        sats: Math.round(feeEstimates.fastestFee * transactionVbytes),
        usd: ((feeEstimates.fastestFee * transactionVbytes / 1e8) * litecoinPriceUSD).toFixed(2)
      },
      'halfHour': {
        time: '30 minutes',
        sats: Math.round(feeEstimates.halfHourFee * transactionVbytes),
        usd: ((feeEstimates.halfHourFee * transactionVbytes / 1e8) * litecoinPriceUSD).toFixed(2)
      },
      'hour': {
        time: '60 minutes',
        sats: Math.round(feeEstimates.hourFee * transactionVbytes),
        usd: ((feeEstimates.hourFee * transactionVbytes / 1e8) * litecoinPriceUSD).toFixed(2)
      },
      'economy': {
        time: '6 hours',
        sats: Math.round(feeEstimates.economyFee * transactionVbytes),
        usd: ((feeEstimates.economyFee * transactionVbytes / 1e8) * litecoinPriceUSD).toFixed(2)
      },
      'minimum': {
        time: '12 hours',
        sats: Math.round(feeEstimates.minimumFee * transactionVbytes),
        usd: ((feeEstimates.minimumFee * transactionVbytes / 1e8) * litecoinPriceUSD).toFixed(2)
      }
    }
  };

  console.log(`Fee details prepared: ${JSON.stringify(fees)}`);
  return { fees, selectedUTXOs };
}

function calculateVbytes(inputsCount: number, outputsCount: number) {
  const nonWitnessBytes = inputsCount * 68 + outputsCount * 31;
  const witnessBytes = inputsCount * (107 / 4); // Approximate average witness size in vbytes
  return Math.ceil(nonWitnessBytes + witnessBytes);
}

interface Balance {
  confirmed: number;
  unconfirmed: number;
  confirmations: number; // Number of block confirmations for the latest transaction
}

// Function to fetch balance for Litecoin
export const fetchLTCBalance = async (address: string, networkType: NetworkName): Promise<Balance> => {
  console.log(`Fetching balance for address: ${address}`);

  // Validate the address for the specific network type
  const isValidAddress = validate(address, 'ltc', { networkType: networkType === 'mainnet' ? 'prod' : 'testnet' });
  if (!isValidAddress) {
    throw new Error(`Invalid address for ${networkType}.`);
  }

  const fetchFromLitecoinExplorer = async () => {
    const explorerBaseURL = networkType === 'mainnet'
      ? `https://explorer.litecoin.net/api`
      : `https://explorer.litecoin.net/testnet/api`;

    try {
      console.log('Fetching balance using Litecoin Explorer API...');
      const response = await axios.get(`${explorerBaseURL}/address/${address}`);
      console.log('Litecoin Explorer API fetch successful:', response.data);

      const chainStats = response.data.chain_stats;
      const mempoolStats = response.data.mempool_stats;

      // Calculate confirmed and unconfirmed balances
      const confirmedBalanceLTC = (chainStats.funded_txo_sum - chainStats.spent_txo_sum) / 1e8;
      const unconfirmedBalanceLTC = (mempoolStats.funded_txo_sum - mempoolStats.spent_txo_sum) / 1e8;

      // Default to 0 confirmations if no transactions are present
      let confirmations = 0;

      // Check if there are any transactions and get confirmation count for the latest one
      if (chainStats.tx_count > 0) {
        const txUrl = `${explorerBaseURL}/address/${address}/txs`;

        // Fetch the list of transactions for the address
        const txResponse = await axios.get(txUrl);
        const transactions = txResponse.data;

        // Check if we have transactions and get the confirmations of the latest transaction
        if (transactions && transactions.length > 0) {
          const latestTransaction = transactions[0]; // The first transaction in the list is the most recent
          confirmations = latestTransaction.status.confirmations || 0;
        } else {
          console.log('No transaction data found to get confirmations.');
        }
      }

      return {
        confirmed: confirmedBalanceLTC,
        unconfirmed: unconfirmedBalanceLTC,
        confirmations, // Return the number of block confirmations for the latest transaction
      };
    } catch (error: unknown) {
      console.error('Litecoin Explorer API fetch failed:', (error as Error).message);
      throw error;
    }
  };

  try {
    return await fetchFromLitecoinExplorer();
  } catch (error: unknown) {
    console.error('Failed to fetch balance data from Litecoin Explorer:', (error as Error).message);
    throw new Error(`Unable to fetch balance for address ${address}`);
  }
};

// Function to fetch balance for Litecoin address
export const fetchBalanceForAddress = async (address: string, networkType: NetworkName) => {
  const balance = await fetchLTCBalance(address, networkType);
  const litecoinPriceUSD = await fetchCoinPrice('LTC');
  const confirmedBalanceUSD = balance.confirmed * litecoinPriceUSD;
  const unconfirmedBalanceUSD = balance.unconfirmed * litecoinPriceUSD;

  return {
    network: networkType,
    litecoinAddress: address,
    confirmedBalance: {
      sats: balance.confirmed * SATS_PER_LTC,
      ltc: balance.confirmed,
      usd: confirmedBalanceUSD,
    },
    unconfirmedBalance: {
      sats: balance.unconfirmed * SATS_PER_LTC,
      ltc: balance.unconfirmed,
      usd: unconfirmedBalanceUSD,
    },
    confirmations: balance.confirmations // Returning the number of block confirmations
  };
};


// interface Balance {
//     confirmed: number;
//     unconfirmed: number;
//   }
  
//   // Function to fetch balance for Litecoin
//   export const fetchLTCBalance = async (address: string, networkType: NetworkName): Promise<Balance> => {
//     console.log(`Fetching balance for address: ${address}`);
  
//     // Validate the address for the specific network type
//     const isValidAddress = validate(address, 'ltc', { networkType: networkType === 'mainnet' ? 'prod' : 'testnet' });
//     if (!isValidAddress) {
//       throw new Error(`Invalid address for ${networkType}.`);
//     }
  
//     const fetchFromLitecoinSpace = async () => {
//       const url = networkType === 'mainnet' ? LITECOINSPACE_MAINNET_URL : LITECOINSPACE_TESTNET_URL;
//       try {
//         console.log('Fetching balance using LitecoinSpace API...');
//         const response = await axios.get(`${url}/${address}/utxo`);
//         console.log('LitecoinSpace API fetch successful:', response.data);
  
//         if (response.data.length === 0) {
//           return { confirmed: 0, unconfirmed: 0 };
//         }
  
//         const balanceInLTC = response.data.reduce((acc: number, utxo: any) => acc + (utxo.value / 1e8), 0);
//         return {
//           confirmed: balanceInLTC,
//           unconfirmed: 0 // Assuming unconfirmed balance is not provided in the response
//         };
//       } catch (error: unknown) {
//         console.error('LitecoinSpace API fetch failed:', (error as Error).message);
//         throw error;
//       }
//     };
  
//     const fetchFromBlockcypher = async () => {
//       try {
//         console.log('Fetching balance using Blockcypher API...');
//         const response = await axios.get(`${BLOCKCYPHER_MAINNET_URL}/${address}/balance`, {
//           headers: {
//             'Content-Type': 'application/json',
//             'Authorization': `Bearer ${process.env.BLOCKCYPHER_TOKEN}`
//           }
//         });
//         console.log('Blockcypher API fetch successful:', response.data);
//         return {
//           confirmed: response.data.balance / 1e8,
//           unconfirmed: response.data.unconfirmed_balance / 1e8
//         };
//       } catch (error: unknown) {
//         console.error('Blockcypher API fetch failed:', (error as Error).message);
//         throw error;
//       }
//     };
  
//     const fetchFromCryptoAPIs = async () => {
//       const url = networkType === 'mainnet' ? CRYPTOAPIS_MAINNET_URL : CRYPTOAPIS_TESTNET_URL;
//       try {
//         console.log('Fetching balance using CryptoAPIs...');
//         const response = await axios.get(`${url}/${address}/balance`, {
//           headers: {
//             'Content-Type': 'application/json',
//             'x-api-key': process.env.CRYPTOAPIS_KEY
//           }
//         });
//         console.log('CryptoAPIs fetch successful:', response.data);
//         return {
//           confirmed: parseFloat(response.data.data.item.confirmedBalance.amount),
//           unconfirmed: 0 // Assuming unconfirmed balance is not provided in the response
//         };
//       } catch (error: unknown) {
//         console.error('CryptoAPIs fetch failed:', (error as Error).message);
//         throw new Error(`Unable to fetch balance for address ${address}`);
//       }
//     };
  
//     try {
//       return await fetchFromLitecoinSpace();
//     } catch (error: unknown) {
//       console.log('Retrying LitecoinSpace API fetch...');
//       try {
//         return await fetchFromLitecoinSpace();
//       } catch (retryError: unknown) {
//         if (networkType === 'mainnet') {
//           console.log('LitecoinSpace API retry failed, moving to Blockcypher...');
//           try {
//             return await fetchFromBlockcypher();
//           } catch (blockcypherError: unknown) {
//             console.log('Blockcypher API fetch failed, moving to CryptoAPIs...');
//             return await fetchFromCryptoAPIs();
//           }
//         } else {
//           console.log('LitecoinSpace API retry failed, moving to CryptoAPIs...');
//           return await fetchFromCryptoAPIs();
//         }
//       }
//     }
//   };
  
//   // Function to fetch balance for Litecoin address
//   export const fetchBalanceForAddress = async (address: string, networkType: NetworkName) => {
//     const balance = await fetchLTCBalance(address, networkType);
//     const litecoinPriceUSD = await fetchCoinPrice('LTC');
//     const confirmedBalanceUSD = balance.confirmed * litecoinPriceUSD;
//     const unconfirmedBalanceUSD = balance.unconfirmed * litecoinPriceUSD;
  
//     return {
//       network: networkType,
//       litecoinAddress: address,
//       confirmedBalance: {
//         sats: balance.confirmed * SATS_PER_LTC,
//         ltc: balance.confirmed,
//         usd: confirmedBalanceUSD,
//       },
//       unconfirmedBalance: {
//         sats: balance.unconfirmed * SATS_PER_LTC,
//         ltc: balance.unconfirmed,
//         usd: unconfirmedBalanceUSD,
//       }
//     };
//   };

  // Function to get recent transactions for Litecoin addresses
export const getRecentLTCTransactions = async (address: string, networkType: 'mainnet' | 'testnet', limit: number = 1) => {
    // Validate Litecoin address
    const isValid = validate(address, 'ltc', { networkType: networkType === 'mainnet' ? 'prod' : 'testnet' });
    if (!isValid) {
      throw new Error('Invalid Litecoin address.');
    }
  
    const litecoinspaceBaseURL = networkType === 'mainnet'
      ? 'https://litecoinspace.org/api/address'
      : 'https://litecoinspace.org/testnet/api/address';
    
    const explorerBaseURL = networkType === 'mainnet'
      ? 'https://explorer.litecoin.net/api/address'
      : 'https://explorer.litecoin.net/testnet/api/address';
    
    try {
      console.log(`Fetching recent transactions for address: ${address} from LitecoinSpace API`);
      const { data: litecoinSpaceData } = await axios.get(`${litecoinspaceBaseURL}/${address}/txs`, {
        params: { limit }
      });
      console.log('LitecoinSpace API fetch successful.');
      return litecoinSpaceData.slice(0, limit);  // Limit the number of transactions
    } catch (error: unknown) {
      console.error('LitecoinSpace API fetch failed:', (error as Error).message);
      console.log('Falling back to explorer.litecoin.net API');
  
      try {
        const { data: explorerData } = await axios.get(`${explorerBaseURL}/${address}/txs`);
        return explorerData.slice(0, limit);  // Manually limit the number of transactions
      } catch (explorerError: unknown) {
        console.error("Failed to fetch recent Litecoin transactions from explorer.litecoin.net:", (explorerError as Error).message);
        throw new Error("Failed to fetch recent Litecoin transactions from both APIs.");
      }
    }
  };
  
  
  const broadcastTransaction = async (serializedTx: string, networkType: 'mainnet' | 'testnet'): Promise<string> => {
    const broadcastURLs = {
      blockcypher: networkType === "mainnet"
        ? "https://api.blockcypher.com/v1/ltc/main/txs/push"
        : "https://api.blockcypher.com/v1/ltc/test3/txs/push",
      litecoinspace: networkType === "mainnet"
        ? "https://explorer.litecoin.net/api/tx"
        : "https://explorer.litecoin.net/testnet/api/tx"
    };
  
    try {
      const blockcypherResponse = await axios.post(
        broadcastURLs.blockcypher,
        JSON.stringify({ tx: serializedTx }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.BLOCKCYPHER_TOKEN}`
          }
        }
      );
  
      if (blockcypherResponse.data && blockcypherResponse.data.tx && blockcypherResponse.data.tx.hash) {
        return blockcypherResponse.data.tx.hash;
      } else {
        throw new Error("Transaction ID not found in Blockcypher response.");
      }
    } catch (error) {
      try {
        const litecoinspaceResponse = await axios.post(
          broadcastURLs.litecoinspace,
          serializedTx,
          {
            headers: {
              'Content-Type': 'text/plain'
            }
          }
        );
  
        return litecoinspaceResponse.data;
      } catch (litecoinspaceError) {
        const errorMessage = litecoinspaceError instanceof Error ? litecoinspaceError.message : 'Unknown error';
        throw new Error(`Failed to broadcast transaction via both Blockcypher and Litecoinspace: ${errorMessage}`);
      }
    }
  };
  
  export const convertUsdToLtcAndSats = async (usdValue: number): Promise<{ usd: number, ltc: number, sats: number }> => {
    try {
      const ltcPriceInUsd = await fetchCoinPrice('LTC');
      if (!ltcPriceInUsd) {
        throw new Error('Failed to fetch LTC price in USD.');
      }
  
      const ltcValue = usdValue / ltcPriceInUsd;
      const satsValue = Math.round(ltcValue * SATS_PER_LTC); // Convert LTC to Satoshis
  
      return {
        usd: usdValue,
        ltc: ltcValue,
        sats: satsValue
      };
    } catch (error) {
      console.error('Error converting USD to LTC and Sats:', error);
      throw new Error('Failed to convert USD to LTC and Sats.');
    }
  };


export { calculateTransactionFees, calculateVbytes };
