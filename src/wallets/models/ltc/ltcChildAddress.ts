import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-byte-hex-key-here';

export interface ILTCChildAddress extends Document {
  mnemonicId: mongoose.Schema.Types.ObjectId;
  childXpub: string;
  childAddress: string;
  privateKey: string;
  networkType: 'mainnet' | 'testnet';
  index: number;
  decryptPrivateKey: () => string;
}

const LTCChildAddressSchema: Schema<ILTCChildAddress> = new Schema({
  mnemonicId: { type: Schema.Types.ObjectId, ref: 'Mnemonic', required: true },
  childXpub: { type: String, required: true },
  childAddress: { type: String, required: true },
  privateKey: { type: String, required: true },
  networkType: { type: String, enum: ['mainnet', 'testnet'], required: true },
  index: { type: Number, required: true }, // Index field
});

// Pre-save hook for encryption
LTCChildAddressSchema.pre('save', function (next) {
  console.log('Pre-save hook triggered for encryption.');

  if (this.privateKey && !this.privateKey.includes(':')) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY!, 'hex'),
      iv
    );

    let encrypted = cipher.update(this.privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    this.privateKey = `${iv.toString('hex')}:${encrypted}`;
    console.log('Encrypted privateKey:', this.privateKey);
  }

  next();
});

// Decryption method
LTCChildAddressSchema.methods.decryptPrivateKey = function () {
  const [iv, encrypted] = this.privateKey.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY!, 'hex'),
    Buffer.from(iv, 'hex')
  );
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

const LTCChildAddress = mongoose.model<ILTCChildAddress>('LTCChildAddress', LTCChildAddressSchema);

export { LTCChildAddress };
