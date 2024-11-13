// src/wallets/btc.ts

import * as bip39 from 'bip39';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { BTCMasterKey } from './models/btc/btcMasterKey';
import { BTCChildXKey } from './models/btc/btcChildXKey';
import { BTCChildAddress } from './models/btc/btcChildAddress';
import * as bitcoin from 'bitcoinjs-lib';
import Mnemonic from '../models/mnemonicModel';
import { getNetworkByName } from '../lib/networks';
import { ECPairFactory } from 'ecpair';
const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);
import axios from 'axios';
import { validateCryptoAddress } from '../utils/addressValidator';
import { fetchCoinPrice, fetchCoinPriceCG } from '../utils/price';

export const createMasterKeys = async (mnemonicName: string, networkType: 'mainnet' | 'testnet') => {
  // Find the mnemonic by name
  const mnemonic = await Mnemonic.findOne({ name: mnemonicName });
  if (!mnemonic) {
    throw new Error('Mnemonic not found.');
  }

  // Ensure the mnemonics field is a string
  const mnemonicPhrase = Array.isArray(mnemonic.mnemonics) ? mnemonic.mnemonics.join(' ') : mnemonic.mnemonics;

  // Generate the seed from the mnemonic
  const seed = bip39.mnemonicToSeedSync(mnemonicPhrase);
  const network = getNetworkByName(networkType, 'bitcoin');

  // Generate the root node from the seed
  const root = bip32.fromSeed(seed, network);

  // Get the master private and public keys
  const masterXpriv = root.toBase58();
  const masterXpub = root.neutered().toBase58();

  // Find the existing master key or create a new one
  let masterKey = await BTCMasterKey.findOne({ mnemonicId: mnemonic._id, networkType });
  
  if (masterKey) {
    // Update existing master key
    masterKey.masterXpriv = masterXpriv;
    masterKey.masterXpub = masterXpub;
  } else {
    // Create a new master key
    masterKey = new BTCMasterKey({
      mnemonicId: mnemonic._id,
      masterXpriv,
      masterXpub,
      networkType,
    });
  }

  // Save the master key (this will trigger the pre-save hook)
  await masterKey.save();

  console.log(`Master keys for ${networkType}:`, masterKey.masterXpriv, masterKey.masterXpub);
  
  return masterKey;
};

export const createChildXKeys = async (mnemonicName: string, networkType: 'mainnet' | 'testnet', count: number = 1) => {
  // Find the mnemonic by name
  const mnemonic = await Mnemonic.findOne({ name: mnemonicName });
  if (!mnemonic) {
    throw new Error('Mnemonic not found.');
  }

  // Find the master key associated with the mnemonic ID and network type
  const masterKey = await BTCMasterKey.findOne({ mnemonicId: mnemonic._id, networkType });

  if (!masterKey) {
    throw new Error(`Master key not found for ${networkType}.`);
  }

  const root = bip32.fromBase58(masterKey.decryptMasterXpriv(), getNetworkByName(networkType, 'bitcoin'));

  const childKeys = [];

  for (let i = 0; i < count; i++) {
    const childNode = root.derivePath(`m/0'/0/${i}`);
    const childXpriv = childNode.toBase58();
    const childXpub = childNode.neutered().toBase58();

    // Check if a child key already exists
    let childKey = await BTCChildXKey.findOne({ mnemonicId: masterKey.mnemonicId, childXpub, networkType });

    if (childKey) {
      // Update the existing child key
      childKey.childXpriv = childXpriv;
    } else {
      // Create a new child key
      childKey = new BTCChildXKey({
        mnemonicId: masterKey.mnemonicId,
        parentXpub: masterKey.masterXpub,
        childXpriv,
        childXpub,
        networkType,
      });
    }

    // Save the child key (this will trigger the pre-save hook)
    await childKey.save();
    childKeys.push(childKey);
  }

  console.log(`Created or updated ${count} child keys for ${networkType}.`);

  return childKeys;
};

export const createChildAddresses = async (
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
  const childKeys = await BTCChildXKey.find({ mnemonicId: mnemonic._id, networkType });

  if (!childKeys.length) {
    throw new Error(`Child keys not found for ${networkType}.`);
  }

  const addresses = []; // to store child addresses

  // Find the latest child address index
  const latestChildAddress = await BTCChildAddress.findOne({ mnemonicId: mnemonic._id, networkType }).sort({ index: -1 });
  const startIndex = latestChildAddress ? latestChildAddress.index + 1 : 0;

  for (let i = 0; i < count; i++) {
    const childKey = childKeys[i % childKeys.length]; // Round-robin selection of child key

    // **Use the childXpriv to derive the child node**
    const childNode = bip32.fromBase58(childKey.decryptChildXpriv(), getNetworkByName(networkType, 'bitcoin'));

    // Properly derive the child address using the current index in the derivation path
    const derivedChildNode = childNode.derive(0).derive(startIndex + i); // `derive` with index

    // Convert the public key from Uint8Array to Buffer for p2wpkh
    const childAddress = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(derivedChildNode.publicKey), network: getNetworkByName(networkType, 'bitcoin') }).address;
    const childPrivateKey = derivedChildNode.toWIF();

    // Set the current index for this address
    const currentIndex = startIndex + i;

    // Check if a child address already exists
    let childAddressDoc = await BTCChildAddress.findOne({ mnemonicId: mnemonic._id, index: currentIndex, networkType });

    if (childAddressDoc) {
      console.log(`Address already exists for index ${currentIndex} for mnemonic ${mnemonic._id}`);
      continue; // Skip creating if address exists
    }

    // Create a new child address
    childAddressDoc = new BTCChildAddress({
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



interface UTXO {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey?: string;
  rawTx?: string;
}

function isAxiosError(error: any): error is { response: { status: number } } {
  return error.response && typeof error.response.status === 'number';
}

export const fetchUtxo = async (address: string, networkType: 'mainnet' | 'testnet'): Promise<UTXO[]> => {
  const validationResult = validateCryptoAddress(address, 'btc');
  console.log(`Validation result for address ${address}: ${validationResult}`);

  if (validationResult !== networkType) {
    throw new Error(`Address ${address} is not valid on the ${networkType} network.`);
  }

  const blockstreamBaseURL =
    networkType === "mainnet"
      ? "https://blockstream.info/api"
      : "https://blockstream.info/testnet/api";

  const mempoolBaseURL =
    networkType === "mainnet"
      ? "https://mempool.space/api"
      : "https://mempool.space/testnet/api";

  let attempt = 0;
  while (attempt < 3) {
    try {
      console.log(`Fetching UTXOs for address: ${address} from Blockstream API`);
      const { data: utxos } = await axios.get<UTXO[]>(
        `${blockstreamBaseURL}/address/${address}/utxo`
      );

      const enhancedUtxos = await Promise.all(
        utxos.map(async (utxo: UTXO) => {
          const txDetailUrl = `${blockstreamBaseURL}/tx/${utxo.txid}`;
          const { data: txDetails } = await axios.get(txDetailUrl);
          const scriptPubKey = txDetails.vout[utxo.vout].scriptpubkey;
          const rawTx = await axios.get(`${blockstreamBaseURL}/tx/${utxo.txid}/hex`);

          return { ...utxo, scriptPubKey, rawTx: rawTx.data };
        })
      );

      console.log("UTXOs fetched and enhanced successfully from Blockstream API.");
      return enhancedUtxos;
    } catch (error) {
      if (isAxiosError(error) && error.response.status === 429) {
        console.warn(`Rate limited by Blockstream API. Retrying in 1000ms...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempt++;
      } else {
        console.error("Error fetching UTXOs from Blockstream API:", error);
        break;
      }
    }
  }

  attempt = 0;
  while (attempt < 3) {
    try {
      console.log(`Fetching UTXOs for address: ${address} from Mempool.space API`);
      const { data: utxos } = await axios.get<UTXO[]>(
        `${mempoolBaseURL}/address/${address}/utxo`
      );

      const enhancedUtxos = await Promise.all(
        utxos.map(async (utxo: UTXO) => {
          const txDetailUrl = `${mempoolBaseURL}/tx/${utxo.txid}`;
          const { data: txDetails } = await axios.get(txDetailUrl);
          const scriptPubKey = txDetails.vout[utxo.vout].scriptpubkey;
          const rawTx = await axios.get(`${mempoolBaseURL}/tx/${utxo.txid}/hex`);

          return { ...utxo, scriptPubKey, rawTx: rawTx.data };
        })
      );

      console.log("UTXOs fetched and enhanced successfully from Mempool.space API.");
      return enhancedUtxos;
    } catch (error) {
      if (isAxiosError(error) && error.response.status === 429) {
        console.warn(`Rate limited by Mempool.space API. Retrying in 1000ms...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempt++;
      } else {
        console.error("Error fetching UTXOs from Mempool.space API:", error);
        throw new Error("Failed to fetch UTXOs from both Blockstream and Mempool.space APIs.");
      }
    }
  }

  throw new Error("Max retries exceeded. Failed to fetch UTXOs.");
};

export const fetchFeeEstimates = async (networkType: 'mainnet' | 'testnet') => {
  const baseURL = networkType === 'mainnet'
    ? 'https://mempool.space/api/v1/fees/recommended'
    : 'https://mempool.space/testnet/api/v1/fees/recommended';

  try {
    const response = await axios.get(baseURL);
    console.log('Base URL:', baseURL, 'Response:', response.data);
    return {
      networkType,
      fastestFee: Math.round(response.data.fastestFee),
      halfHourFee: Math.round(response.data.halfHourFee),
      hourFee: Math.round(response.data.hourFee),
      economyFee: Math.round(response.data.economyFee),
      minimumFee: Math.round(response.data.minimumFee)
    };
  } catch (error) {
    console.error('Failed to fetch fee estimates:', error);
    if (isAxiosError(error) && error.response && error.response.status === 503) {
      const blockstreamUrl = networkType === 'mainnet'
        ? 'https://blockstream.info/api/fee-estimates'
        : 'https://blockstream.info/testnet/api/fee-estimates';
      const blockstreamResponse = await axios.get(blockstreamUrl);
      console.log('Blockstream URL:', blockstreamUrl, 'Response:', blockstreamResponse.data);
      return {
        networkType,
        fastestFee: Math.round(blockstreamResponse.data[1]),
        halfHourFee: Math.round(blockstreamResponse.data[3]),
        hourFee: Math.round(blockstreamResponse.data[6]),
        economyFee: Math.round(blockstreamResponse.data[24]),
        minimumFee: Math.round(blockstreamResponse.data[144] || blockstreamResponse.data.economyFee)
      };
    }
    throw new Error('Failed to fetch fee estimates.');
  }
};

export const selectUtxo = (utxos: UTXO[], amountNeeded: number) => {
  if (utxos.length === 0) {
    throw new Error('No UTXOs available to select from.');
  }

  let selectedUtxos: UTXO[] = [];
  let totalSelected = 0;

  // Sort UTXOs by value in ascending order to prioritize smaller UTXOs
  utxos.sort((a, b) => a.value - b.value);

  for (const utxo of utxos) {
    if (!utxo.rawTx) {
      throw new Error(`Missing raw transaction data for UTXO: ${utxo.txid}`);
    }

    selectedUtxos.push(utxo);
    totalSelected += utxo.value;

    if (totalSelected >= amountNeeded) {
      break;
    }
  }

  // Check if the selected UTXOs cover the required amount
  if (totalSelected < amountNeeded) {
    throw new Error('Insufficient funds available.');
  }

  return { selectedUtxos, totalSelected };
};

export const calculateVbytes = (inputsCount: number, outputsCount: number) => {
  const nonWitnessBytes = inputsCount * 68 + outputsCount * 31;
  const witnessBytes = inputsCount * (107 / 4);
  return Math.ceil(nonWitnessBytes + witnessBytes);
};

export const calculateTransactionFees = async (
  address: string,
  totalAmountNeeded: number,
  networkType: 'mainnet' | 'testnet'
) => {
  console.log(`Preparing to validate address in calculateTransactionFees: ${address}`);

  // Validate the sender address
  const senderValidation = validateCryptoAddress(address, 'btc');
  if (senderValidation !== networkType) {
    throw new Error(`Invalid sender address: ${senderValidation}`);
  }

  console.log(`Calculating transaction fees for network: ${networkType}`);
  
  // Fetch UTXOs for the provided address
  const utxos = await fetchUtxo(address, networkType);
  console.log(`Fetched ${utxos.length} UTXOs for address ${address}`);

  // Fetch the current Bitcoin price in USD
  const bitcoinPriceUSD = await fetchCoinPrice('BTC');
  console.log(`Current Bitcoin price in USD: ${bitcoinPriceUSD}`);

  // Fetch fee estimates from the selected API
  const feeEstimates = await fetchFeeEstimates(networkType);
  console.log(`Fetched fee estimates: ${JSON.stringify(feeEstimates)}`);

  // Select UTXOs that cover the total amount needed
  const { selectedUtxos, totalSelected } = selectUtxo(utxos, totalAmountNeeded);

  // Calculate the vbytes needed for the transaction
  const transactionVbytes = calculateVbytes(selectedUtxos.length, 3);

  // Calculate the transaction fees for different fee rates
  const fees = {
    fastest: Math.round(feeEstimates.fastestFee * transactionVbytes),
    halfHour: Math.round(feeEstimates.halfHourFee * transactionVbytes),
    hour: Math.round(feeEstimates.hourFee * transactionVbytes),
    economy: Math.round(feeEstimates.economyFee * transactionVbytes),
    minimum: Math.round(feeEstimates.minimumFee * transactionVbytes),
  };

  console.log('Transaction Vbytes:', transactionVbytes);
  console.log('Fee Estimates:', feeEstimates);
  console.log('Calculated Fees:', fees);

  return { fees, selectedUtxos, totalSelected, bitcoinPriceUSD };
};

export const broadcastTransaction = async (serializedTx: string, networkType: 'mainnet' | 'testnet'): Promise<string> => {
  const broadcastURLs = {
    blockcypher: networkType === "mainnet"
      ? "https://api.blockcypher.com/v1/btc/main/txs/push"
      : "https://api.blockcypher.com/v1/btc/test3/txs/push",
    mempool: networkType === "mainnet"
      ? "https://mempool.space/api/tx"
      : "https://mempool.space/testnet/api/tx"
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
    console.error('Blockcypher broadcast error:', error);

    try {
      const mempoolResponse = await axios.post(
        broadcastURLs.mempool,
        serializedTx,
        {
          headers: {
            'Content-Type': 'text/plain'
          }
        }
      );

      return mempoolResponse.data;
    } catch (mempoolError) {
      const errorMessage = mempoolError instanceof Error ? mempoolError.message : 'Unknown error';
      console.error('Mempool broadcast error:', errorMessage);
      throw new Error(`Failed to broadcast transaction via both Blockcypher and Mempool.space: ${errorMessage}`);
    }
  }
};

export const fetchBalanceForAddress = async (address: string, networkType: 'mainnet' | 'testnet') => {
  const currency = 'BTC';
  const validation = validateCryptoAddress(address, currency);

  if ((networkType === 'mainnet' && validation !== 'mainnet') || (networkType === 'testnet' && validation !== 'testnet')) {
    throw new Error(`Address ${address} is invalid on ${networkType}.`);
  }

  const baseURLs = networkType === 'mainnet'
    ? [
      'https://blockstream.info/api',
      'https://mempool.space/api'
    ]
    : [
      'https://blockstream.info/testnet/api',
      'https://mempool.space/testnet/api'
    ];

  let response;

  for (const baseURL of baseURLs) {
    try {
      console.log(`Attempting to fetch balance from ${baseURL}`);
      response = await axios.get(`${baseURL}/address/${address}`);
      console.log(`Successfully fetched balance from ${baseURL}`);
      break; // Exit the loop if the request is successful
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to fetch balance from ${baseURL}:`, error.message);
      } else {
        console.error(`An unexpected error occurred while fetching from ${baseURL}`);
      }
    }
  }

  if (!response) {
    throw new Error('Failed to fetch balance from all available APIs.');
  }

  console.log(`Processing response data for address: ${address}`);
  const { chain_stats, mempool_stats } = response.data;

  const confirmedBalanceSats = chain_stats.funded_txo_sum - chain_stats.spent_txo_sum;
  const unconfirmedBalanceSats = mempool_stats.funded_txo_sum - mempool_stats.spent_txo_sum;

  const confirmedBalanceBTC = confirmedBalanceSats / 1e8;
  const unconfirmedBalanceBTC = unconfirmedBalanceSats / 1e8;

  const bitcoinPriceUSD = await fetchCoinPrice('BTC');
  const confirmedBalanceUSD = confirmedBalanceBTC * bitcoinPriceUSD;
  const unconfirmedBalanceUSD = unconfirmedBalanceBTC * bitcoinPriceUSD;

  // Fetch the current block height to calculate confirmations
  const blockHeightResponse = await axios.get(`${baseURLs[0]}/blocks/tip/height`);
  const currentBlockHeight = blockHeightResponse.data;

  // Get transaction details for calculating confirmations
  const txDetailsResponse = await axios.get(`${baseURLs[0]}/address/${address}/txs`);
  const transactions = txDetailsResponse.data;

  // Calculate the confirmations for the transactions
  const transactionConfirmations = transactions.map((tx: any) => {
    if (tx.status.block_height) {
      const confirmations = currentBlockHeight - tx.status.block_height + 1;
      return {
        txid: tx.txid,
        confirmations,
        blockHeight: tx.status.block_height
      };
    } else {
      return {
        txid: tx.txid,
        confirmations: 0, // Pending transaction (not confirmed)
        blockHeight: null
      };
    }
  });

  console.log(`Final calculated balances and confirmations for address ${address}:`);
  console.log(`Confirmed: ${confirmedBalanceBTC} BTC (${confirmedBalanceUSD} USD)`);
  console.log(`Unconfirmed: ${unconfirmedBalanceBTC} BTC (${unconfirmedBalanceUSD} USD)`);
  console.log(`Transaction Confirmations:`, transactionConfirmations);

  return {
    network: networkType,
    bitcoinAddress: address,
    confirmedBalance: {
      sats: confirmedBalanceSats,
      btc: confirmedBalanceBTC,
      usd: confirmedBalanceUSD,
    },
    unconfirmedBalance: {
      sats: unconfirmedBalanceSats,
      btc: unconfirmedBalanceBTC,
      usd: unconfirmedBalanceUSD,
    },
    totalConfirmedTransactions: chain_stats.tx_count,
    pendingTransactions: mempool_stats.tx_count,
    transactionConfirmations // Add this new field for the number of confirmations
  };
};


// export const fetchBalanceForAddress = async (address: string, networkType: 'mainnet' | 'testnet') => {
//   const currency = 'BTC';
//   const validation = validateCryptoAddress(address, currency);

//   if ((networkType === 'mainnet' && validation !== 'mainnet') || (networkType === 'testnet' && validation !== 'testnet')) {
//     throw new Error(`Address ${address} is invalid on ${networkType}.`);
//   }

//   const baseURLs = networkType === 'mainnet'
//     ? [
//       'https://blockstream.info/api',
//       'https://mempool.space/api'
//     ]
//     : [
//       'https://blockstream.info/testnet/api',
//       'https://mempool.space/testnet/api'
//     ];

//   let response;

//   for (const baseURL of baseURLs) {
//     try {
//       console.log(`Attempting to fetch balance from ${baseURL}`);
//       response = await axios.get(`${baseURL}/address/${address}`);
//       console.log(`Successfully fetched balance from ${baseURL}`);
//       break; // Exit the loop if the request is successful
//     } catch (error) {
//       if (error instanceof Error) {
//         console.error(`Failed to fetch balance from ${baseURL}:`, error.message);
//       } else {
//         console.error(`An unexpected error occurred while fetching from ${baseURL}`);
//       }
//     }
//   }

//   if (!response) {
//     throw new Error('Failed to fetch balance from all available APIs.');
//   }

//   console.log(`Processing response data for address: ${address}`);
//   const { chain_stats, mempool_stats } = response.data;

//   const confirmedBalanceSats = chain_stats.funded_txo_sum - chain_stats.spent_txo_sum;
//   const unconfirmedBalanceSats = mempool_stats.funded_txo_sum - mempool_stats.spent_txo_sum;

//   const confirmedBalanceBTC = confirmedBalanceSats / 1e8;
//   const unconfirmedBalanceBTC = unconfirmedBalanceSats / 1e8;

//   const bitcoinPriceUSD = await fetchCoinPrice('BTC');
//   const confirmedBalanceUSD = confirmedBalanceBTC * bitcoinPriceUSD;
//   const unconfirmedBalanceUSD = unconfirmedBalanceBTC * bitcoinPriceUSD;

//   console.log(`Final calculated balances for address ${address}:`);
//   console.log(`Confirmed: ${confirmedBalanceBTC} BTC (${confirmedBalanceUSD} USD)`);
//   console.log(`Unconfirmed: ${unconfirmedBalanceBTC} BTC (${unconfirmedBalanceUSD} USD)`);

//   return {
//     network: networkType,
//     bitcoinAddress: address,
//     confirmedBalance: {
//       sats: confirmedBalanceSats,
//       btc: confirmedBalanceBTC,
//       usd: confirmedBalanceUSD,
//     },
//     unconfirmedBalance: {
//       sats: unconfirmedBalanceSats,
//       btc: unconfirmedBalanceBTC,
//       usd: unconfirmedBalanceUSD,
//     },
//     totalConfirmedTransactions: chain_stats.tx_count,
//     pendingTransactions: mempool_stats.tx_count,
//   };
// };

export const fetchBalanceXpub = async (childXpub: string, networkType: 'mainnet' | 'testnet') => {
  // Find the child xKey based on the provided xPub and network type
  const childXKey = await BTCChildXKey.findOne({ childXpub, networkType });
  if (!childXKey) {
    throw new Error(`No child xKey found for the provided xPub and network type: ${networkType}`);
  }

  // Fetch all child addresses associated with the child xPub and network type
  const childAddresses = await BTCChildAddress.find({ childXpub, networkType });
  const balances = await Promise.all(
    childAddresses.map(address => fetchBalanceForAddress(address.childAddress, networkType))
  );

  // Calculate total confirmed and unconfirmed balances in Sats and BTC
  const totalConfirmedBalanceSats = balances.reduce((acc, balance) => acc + balance.confirmedBalance.sats, 0);
  const totalUnconfirmedBalanceSats = balances.reduce((acc, balance) => acc + balance.unconfirmedBalance.sats, 0);

  const totalConfirmedBalanceBTC = totalConfirmedBalanceSats / 1e8;
  const totalUnconfirmedBalanceBTC = totalUnconfirmedBalanceSats / 1e8;

  // Fetch the current Bitcoin price in USD and calculate total balances in USD
  const bitcoinPriceUSD = await fetchCoinPrice('BTC');
  const totalConfirmedBalanceUSD = totalConfirmedBalanceBTC * bitcoinPriceUSD;
  const totalUnconfirmedBalanceUSD = totalUnconfirmedBalanceBTC * bitcoinPriceUSD;

  return {
    network: networkType,
    totalConfirmedBalance: {
      sats: totalConfirmedBalanceSats,
      btc: totalConfirmedBalanceBTC,
      usd: totalConfirmedBalanceUSD,
    },
    totalUnconfirmedBalance: {
      sats: totalUnconfirmedBalanceSats,
      btc: totalUnconfirmedBalanceBTC,
      usd: totalUnconfirmedBalanceUSD,
    },
    addresses: balances,
  };
};

export const convertUsdToBtcAndSats = async (usdValue: number): Promise<{ usd: number, btc: number, sats: number }> => {
  try {
    const btcPriceInUsd = await fetchCoinPriceCG('bitcoin');
    if (!btcPriceInUsd) {
      throw new Error('Failed to fetch BTC price in USD.');
    }

    const btcValue = usdValue / btcPriceInUsd;
    const satsValue = Math.round(btcValue * 1e8); // Convert BTC to Satoshis

    return {
      usd: usdValue,
      btc: btcValue,
      sats: satsValue
    };
  } catch (error) {
    console.error('Error converting USD to BTC and Sats:', error);
    throw new Error('Failed to convert USD to BTC and Sats.');
  }
};