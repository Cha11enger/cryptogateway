import mongoose, { Schema, Document } from 'mongoose';

export interface IMnemonic extends Document {
  name: string;
  mnemonics: string | string[];
  type: string;
  numWords?: number;
}

const MnemonicSchema: Schema = new Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true, 
    validate: {
      validator: function(value: string) {
        // Ensure no spaces in the name
        return /^[^\s]+$/.test(value);
      },
      message: 'Name must be a single word without spaces.'
    }
  },
  mnemonics: { type: Schema.Types.Mixed, required: true }, // string or array of strings
  type: { type: String, required: true },
  numWords: { type: Number, required: false }
});

const Mnemonic = mongoose.model<IMnemonic>('Mnemonic', MnemonicSchema);

export default Mnemonic;
