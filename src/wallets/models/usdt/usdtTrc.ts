import mongoose, { Schema, Document } from 'mongoose';
import { IMnemonic } from '../../../models/mnemonicModel'; // Import mnemonic interface

export interface ITronAccount extends Document {
    index: number;
    address: string;
    privateKey: string;
    publicKey: string;
    mnemonicId: IMnemonic['_id']; // Reference to the mnemonic used to generate the account
    networkType: 'mainnet' | 'testnet'; // Added networkType for clarity
    createdAt: Date;
}

const TronAccountSchema: Schema = new Schema({
    index: { type: Number, required: true }, // Incremental index for account derivation
    address: { type: String, required: true, unique: true }, // TRC-20 address
    privateKey: { type: String, required: true }, // Private key for the TRC-20 address
    publicKey: { type: String, required: true }, // Public key for the TRC-20 address
    mnemonicId: { type: Schema.Types.ObjectId, ref: 'Mnemonic', required: true }, // Reference to the mnemonic
    networkType: { type: String, enum: ['mainnet', 'testnet'], required: true }, // Network type (mainnet or testnet)
    createdAt: { type: Date, default: Date.now }, // Timestamp for record creation
});

// Create a unique compound index to prevent duplicates across mnemonicId, index, and networkType
TronAccountSchema.index({ mnemonicId: 1, index: 1, networkType: 1 }, { unique: true });

export const TronAccount = mongoose.model<ITronAccount>('TronAccount', TronAccountSchema);
