// import { Router, Request, Response } from 'express';
// import { createTrc20Address, fetchUsdtTrc20Balance } from '../usdtTrc20';

// const router = Router();

// // Helper function to handle route logic
// const createRoutesForNetwork = (networkType: 'mainnet' | 'testnet') => {
//     const subRouter = Router();

//     // Route to create a new TRC-20 address
//     subRouter.post('/createAddress', async (req: Request, res: Response) => {
//         const { mnemonicName, index } = req.body;

//         if (!mnemonicName) {
//             return res.status(400).json({ error: 'mnemonicName is required.' });
//         }

//         try {
//             const addressData = await createTrc20Address(mnemonicName, networkType, index);
//             res.status(201).json(addressData);
//         } catch (error) {
//             res.status(500).json({ error: (error as Error).message });
//         }
//     });

//     // Route to fetch the USDT TRC-20 balance of a Tron address
//     subRouter.get('/balance/:address', async (req: Request, res: Response) => {
//         const { address } = req.params;

//         if (!address) {
//             return res.status(400).json({ error: 'Address is required.' });
//         }

//         try {
//             const balance = await fetchUsdtTrc20Balance(address, networkType);
//             res.status(200).json({ address, balance });
//         } catch (error) {
//             res.status(500).json({ error: (error as Error).message });
//         }
//     });

//     // Route to broadcast a transaction on TRON
//     // subRouter.post('/broadcast', async (req: Request, res: Response) => {
//     //     const { signedTransaction } = req.body;

//     //     if (!signedTransaction) {
//     //         return res.status(400).json({ error: 'signedTransaction is required.' });
//     //     }

//     //     try {
//     //         const txid = await broadcastTrxTransaction(signedTransaction, networkType);
//     //         res.status(200).json({ txid });
//     //     } catch (error) {
//     //         res.status(500).json({ error: (error as Error).message });
//     //     }
//     // });

//     return subRouter;
// };

// // Register routes for mainnet and testnet
// router.use('/mainnet', createRoutesForNetwork('mainnet'));
// router.use('/testnet', createRoutesForNetwork('testnet'));

// export default router;


import { Router, Request, Response } from 'express';
import { createTrc20Address, fetchUsdtTrc20Balance } from '../usdtTrc20';

const router = Router();

// Helper function to handle route logic
const createRoutesForNetwork = (networkType: 'mainnet' | 'testnet') => {
    const subRouter = Router();

    // Route to create a new TRC-20 address with mnemonic name from URL
    subRouter.post('/createAddress/:mnemonicName', async (req: Request, res: Response) => {
        const { mnemonicName } = req.params; // Get mnemonic name from URL params
        const { index } = req.body;

        try {
            const addressData = await createTrc20Address(mnemonicName, networkType, index);
            res.status(201).json(addressData);
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

    // Route to fetch the USDT TRC-20 balance of a Tron address
    subRouter.get('/balance/:address', async (req: Request, res: Response) => {
        const { address } = req.params;

        if (!address) {
            return res.status(400).json({ error: 'Address is required.' });
        }

        try {
            const balance = await fetchUsdtTrc20Balance(address, networkType);
            res.status(200).json({ address, balance });
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

    return subRouter;
};

// Register routes for mainnet and testnet
router.use('/mainnet', createRoutesForNetwork('mainnet'));
router.use('/testnet', createRoutesForNetwork('testnet'));

export default router;
