import * as bitcoin from 'bitcoinjs-lib';

export type NetworkType = 'prod' | 'testnet' | 'both';
export type NetworkName = 'mainnet' | 'testnet';

export interface BitcoinNetworkConfig {
    mainnet: bitcoin.Network;
    testnet: bitcoin.Network;
}

export interface LitecoinNetworkConfig {
    mainnet: bitcoin.Network;
    testnet: bitcoin.Network;
}

export interface NetworksConfig {
    bitcoin: BitcoinNetworkConfig;
    litecoin: LitecoinNetworkConfig;
}

export const networkType: NetworkType = (process.env.NETWORK_TYPE as NetworkType) || 'testnet';

const networks: NetworksConfig = {
    bitcoin: {
        mainnet: bitcoin.networks.bitcoin,
        testnet: bitcoin.networks.testnet,
    },
    litecoin: {
        mainnet: {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'ltc',
            bip32: {
                public: 0x019da462, // Ltub
                private: 0x019d9cfe, // Ltpv
            },
            pubKeyHash: 0x30,
            scriptHash: 0x32,
            wif: 0xb0,
        },
        testnet: {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'tltc',
            bip32: {
                public: 0x0436ef7d, // tltc
                private: 0x0436f6e1, // tltc
            },
            pubKeyHash: 0x6f,
            scriptHash: 0x3a,
            wif: 0xef,
        },
    },
};

// Function to get the network configuration by name
export const getNetworkByName = (name: NetworkName, currency: 'bitcoin' | 'litecoin' = 'bitcoin'): bitcoin.Network => {
    return name === 'mainnet' ? networks[currency].mainnet : networks[currency].testnet;
};

// Create an object to store the selected network configurations based on the network type
export const selectedNetworks = {
    bitcoin: networkType === 'prod' ? networks.bitcoin.mainnet : networks.bitcoin.testnet,
    litecoin: networkType === 'prod' ? networks.litecoin.mainnet : networks.litecoin.testnet,
};

// Function to get available networks
export const getAvailableNetworks = () => {
    const availableNetworks = [];
    if (networkType === 'prod' || networkType === 'both') {
        availableNetworks.push('Bitcoin Mainnet', 'Litecoin Mainnet');
    }
    if (networkType === 'testnet' || networkType === 'both') {
        availableNetworks.push('Bitcoin Testnet', 'Litecoin Testnet');
    }
    return availableNetworks;
};
