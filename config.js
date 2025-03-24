export const config = {
    // Binance API Configuration
    apiKey: '',  // Add your Binance API key here
    apiSecret: '', // Add your Binance API secret here
    
    // Trading Parameters
    defaultTradingPair: 'BTCUSDT',
    availablePairs: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOGEUSDT'],
    defaultLeverage: 1,
    
    // Risk Management
    maxTradesPerDay: 10,
    defaultRiskPercentage: 20,
    defaultStopLoss: 5,
    defaultTakeProfit: 10,
    
    // Profit Withdrawal
    autoWithdrawalPercentage: 50,
    minimumWithdrawalAmount: 100,
    
    // Binance WebSocket Configuration
    wsEndpoint: 'wss://stream.binance.com:9443/ws',
    restEndpoint: 'https://api.binance.com',
    testnetEndpoint: 'https://testnet.binance.vision', // For testing
    
    // Trading Limits (Minimum trade amounts for each pair)
    minTradeAmount: {
        'BTCUSDT': 0.001,
        'ETHUSDT': 0.01,
        'BNBUSDT': 0.1,
        'ADAUSDT': 1,
        'DOGEUSDT': 100
    },
    
    // Price precision for each pair
    pricePrecision: {
        'BTCUSDT': 2,
        'ETHUSDT': 2,
        'BNBUSDT': 2,
        'ADAUSDT': 4,
        'DOGEUSDT': 5
    }
};