// src/services/mnemonicService.ts

import * as bip39 from 'bip39';
import Mnemonic, { IMnemonic } from '../models/mnemonicModel';

export const generateMnemonic = async (name: string, numWords: number = 12): Promise<IMnemonic> => {
  try {
    const strength = (numWords / 3) * 32; // Convert number of words to strength
    const mnemonics = bip39.generateMnemonic(strength);

    const newMnemonic = new Mnemonic({
      name,
      mnemonics,
      type: 'BIP-39',
      numWords,
    });

    await newMnemonic.save();
    return newMnemonic;
  } catch (error) {
    throw new Error('Error generating mnemonic: ' + (error as Error).message);
  }
};

// Get Mnemonic Function
export const getMnemonic = async (name: string): Promise<IMnemonic | null> => {
  try {
    const mnemonic = await Mnemonic.findOne({ name });
    if (!mnemonic) {
      throw new Error('Mnemonic not found');
    }
    return mnemonic;
  } catch (error) {
    throw new Error('Error retrieving mnemonic: ' + (error as Error).message);
  }
};