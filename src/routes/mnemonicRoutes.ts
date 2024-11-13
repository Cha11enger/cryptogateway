// src/routes/mnemonicRoutes.ts

import { Router, Request, Response } from 'express';
import { generateMnemonic, getMnemonic } from '../services/mnemonicService';

const router = Router();

// Route to generate a new mnemonic
router.post('/generate', async (req: Request, res: Response) => {
  const { name, numWords } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  if (numWords && (numWords !== 12 && numWords !== 15 && numWords !== 18 && numWords !== 21 && numWords !== 24)) {
    return res.status(400).json({ error: 'Invalid number of words. Allowed values: 12, 15, 18, 21, 24.' });
  }

  try {
    const mnemonic = await generateMnemonic(name, numWords);
    return res.status(201).json(mnemonic);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Route to get a mnemonic by name
router.get('/:name', async (req: Request, res: Response) => {
  const { name } = req.params;

  try {
    const mnemonic = await getMnemonic(name);
    if (!mnemonic) {
      return res.status(404).json({ error: 'Mnemonic not found.' });
    }
    return res.status(200).json(mnemonic);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
