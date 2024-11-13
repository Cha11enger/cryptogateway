import express from 'express';
import { 
  createMasterKeys,
  createChildXKeys,
  createChildAddresses,
  fetchUtxo,
  fetchFeeEstimates,
  calculateTransactionFees,
  broadcastTransaction,
  fetchBalanceForAddress,
  fetchBalanceXpub,
  convertUsdToBtcAndSats  

 } from '../btc';

const router = express.Router();

// Route to create master keys for mainnet
router.post('/mainnet/createMasterKeys', async (req, res) => {
  const { mnemonicName } = req.body;

  try {
    if (!mnemonicName) {
      return res.status(400).json({ error: 'Mnemonic name is required.' });
    }

    const masterKey = await createMasterKeys(mnemonicName, 'mainnet');
    res.status(201).json(masterKey);
  } catch (error) {
    console.error('Error creating master keys:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to create master keys for testnet
router.post('/testnet/createMasterKeys', async (req, res) => {
  const { mnemonicName } = req.body;

  try {
    if (!mnemonicName) {
      return res.status(400).json({ error: 'Mnemonic name is required.' });
    }

    const masterKey = await createMasterKeys(mnemonicName, 'testnet');
    res.status(201).json(masterKey);
  } catch (error) {
    console.error('Error creating master keys:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to create child keys for mainnet
router.post('/mainnet/createChildXKeys', async (req, res) => {
  const { mnemonicName, count } = req.body;

  try {
    if (!mnemonicName) {
      return res.status(400).json({ error: 'Mnemonic name is required.' });
    }

    const childKeys = await createChildXKeys(mnemonicName, 'mainnet', count);
    res.status(201).json(childKeys);
  } catch (error) {
    console.error('Error creating child keys for mainnet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to create child keys for testnet
router.post('/testnet/createChildXKeys', async (req, res) => {
  const { mnemonicName, count } = req.body;

  try {
    if (!mnemonicName) {
      return res.status(400).json({ error: 'Mnemonic name is required.' });
    }

    const childKeys = await createChildXKeys(mnemonicName, 'testnet', count);
    res.status(201).json(childKeys);
  } catch (error) {
    console.error('Error creating child keys for testnet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});


// Route to create child addresses for mainnet
router.post('/mainnet/createAddress/:mnemonicName', async (req, res) => {
  const { mnemonicName } = req.params;
  const { count } = req.body;

  try {
    const addresses = await createChildAddresses(mnemonicName, 'mainnet', count || 1);
    res.status(201).json(addresses);
  } catch (error) {
    console.error('Error creating child addresses for mainnet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to create child addresses for testnet
router.post('/testnet/createAddress/:mnemonicName', async (req, res) => {
  const { mnemonicName } = req.params;
  const { count } = req.body;

  try {
    const addresses = await createChildAddresses(mnemonicName, 'testnet', count || 1);
    res.status(201).json(addresses);
  } catch (error) {
    console.error('Error creating child addresses for testnet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to fetch UTXOs for a specific address on the mainnet
router.get('/mainnet/fetchUtxo/:address', async (req, res) => {
  const { address } = req.params;

  try {
    const utxos = await fetchUtxo(address, 'mainnet');
    res.status(200).json(utxos);
  } catch (error) {
    console.error('Error fetching UTXOs for mainnet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to fetch UTXOs for a specific address on the testnet
router.get('/testnet/fetchUtxo/:address', async (req, res) => {
  const { address } = req.params;

  try {
    const utxos = await fetchUtxo(address, 'testnet');
    res.status(200).json(utxos);
  } catch (error) {
    console.error('Error fetching UTXOs for testnet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to fetch fee estimates for mainnet
router.get('/mainnet/feeEstimates', async (req, res) => {
  try {
    const feeEstimates = await fetchFeeEstimates('mainnet');
    res.status(200).json(feeEstimates);
  } catch (error) {
    console.error('Error fetching fee estimates for mainnet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to fetch fee estimates for testnet
router.get('/testnet/feeEstimates', async (req, res) => {
  try {
    const feeEstimates = await fetchFeeEstimates('testnet');
    res.status(200).json(feeEstimates);
  } catch (error) {
    console.error('Error fetching fee estimates for testnet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to calculate transaction fees for mainnet
router.post('/mainnet/calculateTransactionFees', async (req, res) => {
  const { address, totalAmountNeeded } = req.body;

  try {
    if (!address || !totalAmountNeeded) {
      return res.status(400).json({ error: 'Address and totalAmountNeeded are required.' });
    }

    const result = await calculateTransactionFees(address, totalAmountNeeded, 'mainnet');
    res.status(200).json(result);
  } catch (error) {
    console.error('Error calculating transaction fees for mainnet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to calculate transaction fees for testnet
router.post('/testnet/calculateTransactionFees', async (req, res) => {
  const { address, totalAmountNeeded } = req.body;

  try {
    if (!address || !totalAmountNeeded) {
      return res.status(400).json({ error: 'Address and totalAmountNeeded are required.' });
    }

    const result = await calculateTransactionFees(address, totalAmountNeeded, 'testnet');
    res.status(200).json(result);
  } catch (error) {
    console.error('Error calculating transaction fees for testnet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to broadcast transaction for mainnet
router.post('/mainnet/broadcastTransaction', async (req, res) => {
  const { serializedTx } = req.body;

  try {
    if (!serializedTx) {
      return res.status(400).json({ error: 'Serialized transaction is required.' });
    }

    const txId = await broadcastTransaction(serializedTx, 'mainnet');
    res.status(200).json({ txId });
  } catch (error) {
    console.error('Error broadcasting transaction for mainnet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to broadcast transaction for testnet
router.post('/testnet/broadcastTransaction', async (req, res) => {
  const { serializedTx } = req.body;

  try {
    if (!serializedTx) {
      return res.status(400).json({ error: 'Serialized transaction is required.' });
    }

    const txId = await broadcastTransaction(serializedTx, 'testnet');
    res.status(200).json({ txId });
  } catch (error) {
    console.error('Error broadcasting transaction for testnet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to fetch balance for mainnet
router.get('/mainnet/fetchBalance/:address', async (req, res) => {
  const { address } = req.params;

  try {
    const balance = await fetchBalanceForAddress(address, 'mainnet');
    res.status(200).json(balance);
  } catch (error) {
    console.error('Error fetching balance for mainnet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to fetch balance for testnet
router.get('/testnet/fetchBalance/:address', async (req, res) => {
  const { address } = req.params;

  try {
    const balance = await fetchBalanceForAddress(address, 'testnet');
    res.status(200).json(balance);
  } catch (error) {
    console.error('Error fetching balance for testnet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to fetch balance by xPub for mainnet
router.post('/mainnet/fetchBalanceXpub', async (req, res) => {
  const { childXpub } = req.body;

  try {
    if (!childXpub) {
      return res.status(400).json({ error: 'childXpub is required.' });
    }

    const balance = await fetchBalanceXpub(childXpub, 'mainnet');
    res.status(200).json(balance);
  } catch (error) {
    console.error('Error fetching balance for mainnet by xPub:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to fetch balance by xPub for testnet
router.post('/testnet/fetchBalanceXpub', async (req, res) => {
  const { childXpub } = req.body;

  try {
    if (!childXpub) {
      return res.status(400).json({ error: 'childXpub is required.' });
    }

    const balance = await fetchBalanceXpub(childXpub, 'testnet');
    res.status(200).json(balance);
  } catch (error) {
    console.error('Error fetching balance for testnet by xPub:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to convert USD to BTC and Sats for mainnet
router.post('/mainnet/convertUsdToBtcAndSats', async (req, res) => {
  const { usdValue } = req.body;

  try {
    if (typeof usdValue !== 'number' || usdValue <= 0) {
      return res.status(400).json({ error: 'A positive USD value is required.' });
    }

    const conversion = await convertUsdToBtcAndSats(usdValue);
    res.status(200).json(conversion);
  } catch (error) {
    console.error('Error converting USD to BTC and Sats for mainnet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Route to convert USD to BTC and Sats for testnet
router.post('/testnet/convertUsdToBtcAndSats', async (req, res) => {
  const { usdValue } = req.body;

  try {
    if (typeof usdValue !== 'number' || usdValue <= 0) {
      return res.status(400).json({ error: 'A positive USD value is required.' });
    }

    const conversion = await convertUsdToBtcAndSats(usdValue);
    res.status(200).json(conversion);
  } catch (error) {
    console.error('Error converting USD to BTC and Sats for testnet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});


export default router;
