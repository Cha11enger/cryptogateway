// src/utils/price.ts
import axios from 'axios';

export async function fetchCoinPrice(coin: string): Promise<number> {
    try {
        const response = await axios.get('https://coinremitter.com/api/v3/get-coin-rate');
        if (response.data && response.data.data && response.data.data[coin]) {
            const price = response.data.data[coin].price;
            return price;
        } else {
            throw new Error(`Price data for ${coin} is not available`);
        }
    } catch (error) {
        console.error(`Error fetching ${coin} price:`, error);
        throw new Error(`Failed to fetch ${coin} price`);
    }
}


export const fetchCoinPriceCG = async (coin: string = 'BTC') => {
    try {
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd`);
        const coinData = response.data[coin.toLowerCase()];
        return coinData ? coinData.usd : null;
    } catch (error) {
        console.error(`Error fetching ${coin} price:`, error);
        throw new Error(`Failed to fetch ${coin} price`);
    }
};

