import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-byte-hex-key-here';

export interface ILTCChildXKey extends Document {
  mnemonicId: mongoose.Schema.Types.ObjectId;
  parentXpub: string;
  childXpriv: string;
  childXpub: string;
  networkType: 'mainnet' | 'testnet';
  decryptChildXpriv: () => string;
}

const LTCChildXKeySchema: Schema<ILTCChildXKey> = new Schema({
  mnemonicId: { type: Schema.Types.ObjectId, ref: 'Mnemonic', required: true },
  parentXpub: { type: String, required: true },
  childXpriv: { type: String, required: true },
  childXpub: { type: String, required: true },
  networkType: { type: String, enum: ['mainnet', 'testnet'], required: true },
});

// Pre-save hook for encryption
LTCChildXKeySchema.pre('save', function (next) {
  console.log('Pre-save hook triggered for encryption.');

  if (this.childXpriv && !this.childXpriv.includes(':')) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY!, 'hex'),
      iv
    );

    let encrypted = cipher.update(this.childXpriv, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    this.childXpriv = `${iv.toString('hex')}:${encrypted}`;
    console.log('Encrypted childXpriv:', this.childXpriv);
  }

  next();
});

// Decryption method
LTCChildXKeySchema.methods.decryptChildXpriv = function () {
  const [iv, encrypted] = this.childXpriv.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY!, 'hex'),
    Buffer.from(iv, 'hex')
  );
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

const LTCChildXKey = mongoose.model<ILTCChildXKey>('LTCChildXKey', LTCChildXKeySchema);

export { LTCChildXKey };
