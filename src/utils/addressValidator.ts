import { validate as multicoinValidate } from 'multicoin-address-validator';

/**
 * Validates a cryptocurrency address against both mainnet and testnet configurations.
 * @param {string} address - The address to validate.
 * @param {string} currency - The currency abbreviation (e.g., 'BTC', 'LTC').
 * @returns {string} - A message indicating on which network(s) the address is valid.
 */
export function validateCryptoAddress(address: string, currency: string): string {
    console.log(`Validating address: ${address} for currency: ${currency}`);
    
    // Validate the address for mainnet
    const isValidMainnet = multicoinValidate(address, currency, { networkType: 'prod' });
    console.log(`Mainnet validation result: ${isValidMainnet}`);

    // Validate the address for testnet
    const isValidTestnet = multicoinValidate(address, currency, { networkType: 'testnet' });
    console.log(`Testnet validation result: ${isValidTestnet}`);

    if (isValidMainnet && !isValidTestnet) {
        console.log("Address is valid on mainnet.");
        return `mainnet`;
    } else if (!isValidMainnet && isValidTestnet) {
        console.log("Address is valid on testnet.");
        return `testnet`;
    } else if (!isValidMainnet && !isValidTestnet) {
        console.log("Address is invalid on both networks.");
        return `invalid`;
    } else {
        // This case should theoretically never happen as an address cannot be valid on both networks
        console.log("Inconclusive address validation.");
        return `inconclusive`;
    }
}

export { multicoinValidate as validate };
