import express from 'express';
import {
    createLTCMasterKeys,
    createLTCChildXKeys,
    createLTCChildAddresses,
    fetchUTXOs,
    fetchFeeEstimates,
    calculateTransactionFees,
    fetchBalanceForAddress,



} from '../ltc';

const router = express.Router();

// Route to create LTC master keys for mainnet
router.post('/mainnet/createLTCMasterKeys', async (req, res) => {
    const { mnemonicName } = req.body;

    try {
        if (!mnemonicName) {
            return res.status(400).json({ error: 'Mnemonic name is required.' });
        }

        const masterKey = await createLTCMasterKeys(mnemonicName, 'mainnet');
        res.status(201).json(masterKey);
    } catch (error) {
        console.error('Error creating LTC master keys:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Route to create LTC master keys for testnet
router.post('/testnet/createLTCMasterKeys', async (req, res) => {
    const { mnemonicName } = req.body;

    try {
        if (!mnemonicName) {
            return res.status(400).json({ error: 'Mnemonic name is required.' });
        }

        const masterKey = await createLTCMasterKeys(mnemonicName, 'testnet');
        res.status(201).json(masterKey);
    } catch (error) {
        console.error('Error creating LTC master keys:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Route to create LTC child keys for mainnet
router.post('/mainnet/createLTCChildXKeys', async (req, res) => {
    const { mnemonicName, count } = req.body;

    try {
        if (!mnemonicName) {
            return res.status(400).json({ error: 'Mnemonic name is required.' });
        }

        const childKeys = await createLTCChildXKeys(mnemonicName, 'mainnet', count);
        res.status(201).json(childKeys);
    } catch (error) {
        console.error('Error creating LTC child keys for mainnet:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Route to create LTC child keys for testnet
router.post('/testnet/createLTCChildXKeys', async (req, res) => {
    const { mnemonicName, count } = req.body;

    try {
        if (!mnemonicName) {
            return res.status(400).json({ error: 'Mnemonic name is required.' });
        }

        const childKeys = await createLTCChildXKeys(mnemonicName, 'testnet', count);
        res.status(201).json(childKeys);
    } catch (error) {
        console.error('Error creating LTC child keys for testnet:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Route to create LTC child addresses for mainnet
router.post('/mainnet/createAddress/:mnemonicName', async (req, res) => {
    const { mnemonicName } = req.params;
    const { count } = req.body;

    try {
        const addresses = await createLTCChildAddresses(mnemonicName, 'mainnet', count || 1);
        res.status(201).json(addresses);
    } catch (error) {
        console.error('Error creating LTC child addresses for mainnet:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Route to create LTC child addresses for testnet
router.post('/testnet/createAddress/:mnemonicName', async (req, res) => {
    const { mnemonicName } = req.params;
    const { count } = req.body;

    try {
        const addresses = await createLTCChildAddresses(mnemonicName, 'testnet', count || 1);
        res.status(201).json(addresses);
    } catch (error) {
        console.error('Error creating LTC child addresses for testnet:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Route to fetch UTXOs for mainnet
router.get('/mainnet/fetchUtxos/:address', async (req, res) => {
    const { address } = req.params;

    try {
        const utxos = await fetchUTXOs(address, 'mainnet');
        res.status(200).json(utxos);
    } catch (error) {
        console.error('Error fetching UTXOs for mainnet:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Route to fetch UTXOs for testnet
router.get('/testnet/fetchUtxos/:address', async (req, res) => {
    const { address } = req.params;

    try {
        const utxos = await fetchUTXOs(address, 'testnet');
        res.status(200).json(utxos);
    } catch (error) {
        console.error('Error fetching UTXOs for testnet:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Route to fetch fee estimates for Litecoin mainnet
router.get('/mainnet/fees', async (req, res) => {
    try {
      const feeEstimates = await fetchFeeEstimates('mainnet');
      res.status(200).json(feeEstimates);
    } catch (error) {
      console.error('Error fetching Litecoin mainnet fee estimates:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Route to fetch fee estimates for Litecoin testnet
  router.get('/testnet/fees', async (req, res) => {
    try {
      const feeEstimates = await fetchFeeEstimates('testnet');
      res.status(200).json(feeEstimates);
    } catch (error) {
      console.error('Error fetching Litecoin testnet fee estimates:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Route to calculate transaction fees for Litecoin mainnet
router.post('/mainnet/calculateTxFees', async (req, res) => {
    const { address, recipientAddress, amountToSend } = req.body;
  
    try {
      const { fees, selectedUTXOs } = await calculateTransactionFees(address, recipientAddress, amountToSend, 'mainnet');
      res.status(200).json({ fees, selectedUTXOs });
    } catch (error) {
      console.error('Error calculating Litecoin mainnet transaction fees:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Route to calculate transaction fees for Litecoin testnet
  router.post('/testnet/calculateTxFees', async (req, res) => {
    const { address, recipientAddress, amountToSend } = req.body;
  
    try {
      const { fees, selectedUTXOs } = await calculateTransactionFees(address, recipientAddress, amountToSend, 'testnet');
      res.status(200).json({ fees, selectedUTXOs });
    } catch (error) {
      console.error('Error calculating Litecoin testnet transaction fees:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Route to fetch balance for mainnet
router.get('/mainnet/balance/:address', async (req, res) => {
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
  router.get('/testnet/balance/:address', async (req, res) => {
    const { address } = req.params;
    try {
      const balance = await fetchBalanceForAddress(address, 'testnet');
      res.status(200).json(balance);
    } catch (error) {
      console.error('Error fetching balance for testnet:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  

export default router;
