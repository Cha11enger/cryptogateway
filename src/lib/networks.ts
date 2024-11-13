import * as bitcoin from 'bitcoinjs-lib';

export type NetworkType = 'prod' | 'testnet' | 'both';
export type NetworkName = 'mainnet' | 'testnet';

// Existing Bitcoin Network Configuration
export interface BitcoinNetworkConfig {
    mainnet: bitcoin.Network;
    testnet: bitcoin.Network;
}

// Existing Litecoin Network Configuration
export interface LitecoinNetworkConfig {
    mainnet: bitcoin.Network;
    testnet: bitcoin.Network;
}

// TRON Network Configuration (for USDT TRC-20)
export interface TronNetworkConfig {
    mainnet: {
        fullNode: string;
        solidityNode: string;
        eventServer: string;
    };
    testnet: {
        fullNode: string;
        solidityNode: string;
        eventServer: string;
    };
}

// Binance Smart Chain (BSC) Configuration (for USDT BEP-20)
export interface BinanceSmartChainConfig {
    mainnet: {
        rpcUrl: string;
        usdtAddress: string; // USDT BEP-20 contract address on BSC
    };
    testnet: {
        rpcUrl: string;
        usdtAddress: string; // USDT BEP-20 contract address on BSC testnet
    };
}

// Extend the NetworksConfig interface to include TRON and BSC
export interface NetworksConfig {
    bitcoin: BitcoinNetworkConfig;
    litecoin: LitecoinNetworkConfig;
    tron: TronNetworkConfig; // Add TRON network config
    binanceSmartChain: BinanceSmartChainConfig; // Add Binance Smart Chain config
}

// Read network type from environment variables
export const networkType: NetworkType = (process.env.NETWORK_TYPE as NetworkType) || 'testnet';

// Extend networks object to include TRON and BSC configurations
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
    tron: {
        mainnet: {
            fullNode: 'https://api.trongrid.io',
            solidityNode: 'https://api.trongrid.io',
            eventServer: 'https://api.trongrid.io',
        },
        testnet: {
            fullNode: 'https://api.shasta.trongrid.io',
            solidityNode: 'https://api.shasta.trongrid.io',
            eventServer: 'https://api.shasta.trongrid.io',
        }
    },
    binanceSmartChain: {
        mainnet: {
            rpcUrl: 'https://bsc-dataseed.binance.org/',
            usdtAddress: '0x55d398326f99059ff775485246999027b3197955', // USDT BEP-20 contract on BSC mainnet
        },
        testnet: {
            rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
            usdtAddress: '0x4BdCF499289Ad1ed1B032d690F22Ca5534fFe805', // USDT BEP-20 contract on BSC testnet
        }
    }
};

// Function to get the network configuration by name
export const getNetworkByName = (name: NetworkName, currency: 'bitcoin' | 'litecoin' = 'bitcoin'): bitcoin.Network => {
    return name === 'mainnet' ? networks[currency].mainnet : networks[currency].testnet;
};

// Create an object to store the selected network configurations based on the network type
export const selectedNetworks = {
    bitcoin: networkType === 'prod' ? networks.bitcoin.mainnet : networks.bitcoin.testnet,
    litecoin: networkType === 'prod' ? networks.litecoin.mainnet : networks.litecoin.testnet,
    tron: networkType === 'prod' ? networks.tron.mainnet : networks.tron.testnet, // TRON selected network
    binanceSmartChain: networkType === 'prod' ? networks.binanceSmartChain.mainnet : networks.binanceSmartChain.testnet, // BSC selected network
};

// Function to get available networks
export const getAvailableNetworks = () => {
    const availableNetworks = [];
    if (networkType === 'prod' || networkType === 'both') {
        availableNetworks.push('Bitcoin Mainnet', 'Litecoin Mainnet', 'TRON Mainnet', 'BSC Mainnet');
    }
    if (networkType === 'testnet' || networkType === 'both') {
        availableNetworks.push('Bitcoin Testnet', 'Litecoin Testnet', 'TRON Testnet', 'BSC Testnet');
    }
    return availableNetworks;
};
