// src/routes/routes.ts
import { Router } from 'express';
import mnemonicRoutes from './mnemonicRoutes';
import btcRoutes from '../wallets/routes/btcRoutes';
import ltcRoutes from '../wallets/routes/ltcRoutes';
import usdtTrc20Routes from '../wallets/routes/usdtTrc20Routes'

const router = Router();

// Use the mnemonic routes
router.use('/mnemonic', mnemonicRoutes);
router.use('/btc', btcRoutes);
router.use('/ltc', ltcRoutes);
router.use('/usdt-trc20', usdtTrc20Routes);

export default router;
