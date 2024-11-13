import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-byte-hex-key-here';

interface ILTCMasterKey extends Document {
  mnemonicId: mongoose.Schema.Types.ObjectId;
  masterXpriv: string;
  masterXpub: string;
  networkType: 'mainnet' | 'testnet';
  decryptMasterXpriv: () => string;
}

const LTCMasterKeySchema: Schema<ILTCMasterKey> = new Schema({
  mnemonicId: { type: Schema.Types.ObjectId, ref: 'Mnemonic', required: true },
  masterXpriv: { type: String, required: true },
  masterXpub: { type: String, required: true },
  networkType: { type: String, enum: ['mainnet', 'testnet'], required: true },
});

// Pre-save hook for encryption
LTCMasterKeySchema.pre('save', function (next) {
  console.log('Pre-save hook triggered for encryption.');

  if (this.masterXpriv && !this.masterXpriv.includes(':')) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY!, 'hex'),
      iv
    );

    let encrypted = cipher.update(this.masterXpriv, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    this.masterXpriv = `${iv.toString('hex')}:${encrypted}`;
    console.log('Encrypted masterXpriv:', this.masterXpriv);
  }

  next();
});

// Decryption method
LTCMasterKeySchema.methods.decryptMasterXpriv = function () {
  const [iv, encrypted] = this.masterXpriv.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY!, 'hex'),
    Buffer.from(iv, 'hex')
  );
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

const LTCMasterKey = mongoose.model<ILTCMasterKey>('LTCMasterKey', LTCMasterKeySchema);

export { LTCMasterKey };
