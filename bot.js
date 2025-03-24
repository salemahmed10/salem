import { config } from './config.js';

class TradingBot {
    constructor() {
        this.isRunning = false;
        this.balance = 0;
        this.profits = 0;
        this.totalTrades = 0;
        this.successfulTrades = 0;
        
        this.currentPrice = 0;
        this.websocket = null;
        this.selectedPair = config.defaultTradingPair;
        this.entryPrice = 0;
        this.exitPrice = 0;
        
        this.activeTrades = [];
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkApiKeys();
    }

    async checkApiKeys() {
        const savedApiKey = localStorage.getItem('binance_api_key');
        const savedApiSecret = localStorage.getItem('binance_api_secret');

        if (!savedApiKey || !savedApiSecret) {
            this.showApiKeyModal();
        } else {
            config.apiKey = savedApiKey;
            config.apiSecret = savedApiSecret;
            await this.initializeBinance();
        }
    }

    showApiKeyModal() {
        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal">
                    <h2>إعداد مفاتيح Binance API</h2>
                    <form class="api-key-form" id="apiKeyForm">
                        <div class="input-wrapper">
                            <label class="api-key-label" for="apiKey">API Key:</label>
                            <input type="text" id="apiKey" placeholder="أدخل API Key" required>
                            <div class="api-key-help">انسخ والصق API Key من حساب Binance الخاص بك</div>
                        </div>
                        <div class="input-wrapper">
                            <label class="api-key-label" for="apiSecret">API Secret:</label>
                            <input type="text" id="apiSecret" placeholder="أدخل API Secret" required>
                            <div class="api-key-help">انسخ والصق API Secret من حساب Binance الخاص بك</div>
                        </div>
                        <div class="modal-buttons">
                            <button type="submit" class="btn primary">حفظ المفاتيح</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Make inputs easily selectable
        const inputs = document.querySelectorAll('.api-key-form input');
        inputs.forEach(input => {
            input.addEventListener('click', function() {
                this.select();
            });
            
            input.addEventListener('focus', function() {
                this.select();
            });
        });

        const form = document.getElementById('apiKeyForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const apiKey = document.getElementById('apiKey').value.trim();
            const apiSecret = document.getElementById('apiSecret').value.trim();

            if (!apiKey || !apiSecret) {
                alert('الرجاء إدخال كلا المفتاحين');
                return;
            }

            localStorage.setItem('binance_api_key', apiKey);
            localStorage.setItem('binance_api_secret', apiSecret);

            config.apiKey = apiKey;
            config.apiSecret = apiSecret;

            document.querySelector('.modal-overlay').remove();
            await this.initializeBinance();
        });
    }

    initializeElements() {
        // Controls
        this.startButton = document.getElementById('startBot');
        this.stopButton = document.getElementById('stopBot');
        this.withdrawButton = document.getElementById('withdrawProfits');
        
        // Display elements
        this.balanceDisplay = document.getElementById('currentBalance');
        this.dailyProfitsDisplay = document.getElementById('dailyProfits');
        this.totalTradesDisplay = document.getElementById('totalTrades');
        this.successRateDisplay = document.getElementById('successRate');
        this.tradesLog = document.getElementById('tradesLog');
        
        // Settings
        this.strategySelect = document.getElementById('tradingStrategy');
        this.riskLevel = document.getElementById('riskLevel');
        this.stopLoss = document.getElementById('stopLoss');
        this.takeProfit = document.getElementById('takeProfit');
        
        // New elements for Binance integration
        this.pairSelect = document.getElementById('tradingPair');
        this.entryPriceInput = document.getElementById('entryPrice');
        this.exitPriceInput = document.getElementById('exitPrice');
        this.currentPriceDisplay = document.getElementById('currentPrice');
        
        // Add new elements for multiple trades
        this.tradeAmountInput = document.getElementById('tradeAmount');
        this.addTradeButton = document.getElementById('addTrade');
        this.activeTradesList = document.querySelector('.trades-container');
        
        // Add settings button to header
        const header = document.querySelector('.header');
        const settingsButtons = document.createElement('div');
        settingsButtons.className = 'settings-buttons';
        settingsButtons.innerHTML = `
            <button class="btn primary" id="updateApiKeys">تحديث مفاتيح API</button>
        `;
        header.appendChild(settingsButtons);

        // Add event listener for API key update button
        document.getElementById('updateApiKeys').addEventListener('click', () => {
            this.showApiKeyModal();
        });

        this.addTradeButton.addEventListener('click', () => this.addNewTrade());
    }

    setupEventListeners() {
        this.startButton.addEventListener('click', () => this.startTrading());
        this.stopButton.addEventListener('click', () => this.stopTrading());
        this.withdrawButton.addEventListener('click', () => this.withdrawProfits());
        
        this.riskLevel.addEventListener('input', (e) => {
            document.getElementById('riskValue').textContent = `${e.target.value}%`;
        });

        this.pairSelect.addEventListener('change', (e) => {
            this.selectedPair = e.target.value;
            this.reconnectWebSocket();
        });

        this.entryPriceInput.addEventListener('change', (e) => {
            this.entryPrice = parseFloat(e.target.value);
        });

        this.exitPriceInput.addEventListener('change', (e) => {
            this.exitPrice = parseFloat(e.target.value);
        });
    }

    async initializeBinance() {
        if (!config.apiKey || !config.apiSecret) {
            this.logTrade('تحذير: الرجاء إضافة مفاتيح API الخاصة بـ Binance', 'error');
            return;
        }

        try {
            // Initialize Binance client
            await this.checkBinanceConnection();
            this.connectWebSocket();
        } catch (error) {
            this.logTrade(`خطأ في الاتصال بـ Binance: ${error.message}`, 'error');
        }
    }

    async checkBinanceConnection() {
        try {
            const response = await fetch(`${config.restEndpoint}/api/v3/ping`);
            if (!response.ok) {
                throw new Error('فشل الاتصال بخوادم Binance');
            }
            this.logTrade('تم الاتصال بـ Binance بنجاح');
        } catch (error) {
            throw new Error(`فشل الاتصال بـ Binance: ${error.message}`);
        }
    }

    connectWebSocket() {
        if (this.websocket) {
            this.websocket.close();
        }

        this.websocket = new WebSocket(`${config.wsEndpoint}/${this.selectedPair.toLowerCase()}@trade`);
        
        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.currentPrice = parseFloat(data.p);
            this.currentPriceDisplay.textContent = `${this.currentPrice} USDT`;
            this.checkTradingConditions();
        };

        this.websocket.onerror = (error) => {
            this.logTrade('خطأ في اتصال WebSocket', 'error');
        };

        this.websocket.onclose = () => {
            this.logTrade('تم قطع اتصال WebSocket');
        };
    }

    reconnectWebSocket() {
        this.connectWebSocket();
    }

    addNewTrade() {
        const tradeAmount = parseFloat(this.tradeAmountInput.value);
        const entryPrice = parseFloat(this.entryPriceInput.value);
        const exitPrice = parseFloat(this.exitPriceInput.value);
        const pair = this.pairSelect.value;

        if (!tradeAmount || !entryPrice || !exitPrice) {
            this.logTrade('الرجاء إدخال جميع البيانات المطلوبة للصفقة', 'error');
            return;
        }

        const trade = {
            id: Date.now(),
            pair,
            amount: tradeAmount,
            entryPrice,
            exitPrice,
            status: 'pending'
        };

        this.activeTrades.push(trade);
        this.renderTrade(trade);
        this.logTrade(`تمت إضافة صفقة جديدة: ${pair} بمبلغ ${tradeAmount} USDT`);

        // Clear inputs
        this.tradeAmountInput.value = '';
        this.entryPriceInput.value = '';
        this.exitPriceInput.value = '';
    }

    renderTrade(trade) {
        const tradeElement = document.createElement('div');
        tradeElement.className = 'trade-item';
        tradeElement.id = `trade-${trade.id}`;
        tradeElement.innerHTML = `
            <div class="trade-item-header">
                <span>${trade.pair}</span>
                <button class="remove-trade" onclick="bot.removeTrade(${trade.id})">إلغاء</button>
            </div>
            <div class="trade-item-details">
                <div>المبلغ: ${trade.amount} USDT</div>
                <div>سعر الدخول: ${trade.entryPrice}</div>
                <div>سعر الخروج: ${trade.exitPrice}</div>
                <div>الحالة: ${trade.status === 'pending' ? 'قيد الانتظار' : 'نشط'}</div>
            </div>
        `;
        this.activeTradesList.appendChild(tradeElement);
    }

    removeTrade(tradeId) {
        this.activeTrades = this.activeTrades.filter(trade => trade.id !== tradeId);
        const tradeElement = document.getElementById(`trade-${tradeId}`);
        if (tradeElement) {
            tradeElement.remove();
            this.logTrade('تم إلغاء الصفقة');
        }
    }

    checkTradingConditions() {
        if (!this.isRunning) return;

        this.activeTrades.forEach(trade => {
            if (trade.status === 'pending') {
                if (this.currentPrice <= trade.entryPrice) {
                    this.executeBuy(trade);
                    trade.status = 'active';
                    this.updateTradeDisplay(trade);
                } else if (this.currentPrice >= trade.exitPrice) {
                    this.executeSell(trade);
                    this.removeTrade(trade.id);
                }
            }
        });
    }

    updateTradeDisplay(trade) {
        const tradeElement = document.getElementById(`trade-${trade.id}`);
        if (tradeElement) {
            const statusDiv = tradeElement.querySelector('.trade-item-details div:last-child');
            statusDiv.textContent = `الحالة: ${trade.status === 'pending' ? 'قيد الانتظار' : 'نشط'}`;
        }
    }

    async startTrading() {
        this.isRunning = true;
        this.startButton.disabled = true;
        this.stopButton.disabled = false;
        
        this.logTrade('بدء التداول الآلي...');
        
        // Start trading loop
        this.tradingLoop();
    }

    stopTrading() {
        this.isRunning = false;
        this.startButton.disabled = false;
        this.stopButton.disabled = true;
        this.logTrade('تم إيقاف التداول الآلي');
        if (this.websocket) {
            this.websocket.close();
        }
    }

    async tradingLoop() {
        while (this.isRunning) {
            try {
                await this.analyzeMarket();
                await this.executeTrades();
                await this.updateStats();
                
                // Delay between iterations
                await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (error) {
                this.logTrade(`خطأ: ${error.message}`, 'error');
            }
        }
    }

    async analyzeMarket() {
        // Simulated market analysis
        const analysis = await this.performTechnicalAnalysis();
        this.logTrade(`تحليل السوق: ${analysis.signal}`);
        return analysis;
    }

    async executeTrades() {
        // Simulated trade execution
        const successful = Math.random() > 0.4;
        const profit = successful ? (Math.random() * 5).toFixed(2) : (-Math.random() * 3).toFixed(2);
        
        this.totalTrades++;
        if (successful) this.successfulTrades++;
        
        this.profits += parseFloat(profit);
        this.updateBalance(profit);
        
        this.logTrade(`تنفيذ صفقة: ${successful ? 'ناجحة' : 'خاسرة'} (${profit} USDT)`);
    }

    async performTechnicalAnalysis() {
        // Simulated technical analysis
        const signals = ['شراء', 'بيع', 'انتظار'];
        const signal = signals[Math.floor(Math.random() * signals.length)];
        return { signal };
    }

    updateBalance(change) {
        this.balance += parseFloat(change);
        this.balanceDisplay.textContent = `${this.balance.toFixed(2)} USDT`;
        this.dailyProfitsDisplay.textContent = `${this.profits.toFixed(2)} USDT`;
        this.totalTradesDisplay.textContent = this.totalTrades;
        
        const successRate = (this.successfulTrades / this.totalTrades * 100) || 0;
        this.successRateDisplay.textContent = `${successRate.toFixed(1)}%`;
        
        // Enable withdraw button if profits are available
        this.withdrawButton.disabled = this.profits <= config.minimumWithdrawalAmount;
    }

    async withdrawProfits() {
        const withdrawalAmount = this.profits * (config.autoWithdrawalPercentage / 100);
        this.profits -= withdrawalAmount;
        
        this.logTrade(`تم سحب الأرباح: ${withdrawalAmount.toFixed(2)} USDT`);
        this.updateBalance(0); // Update displays
    }

  async executeBuy(trade) {
    if (!this.isRunning) return;

    try {
        const timestamp = Date.now();
        const quantity = trade.amount;
        const queryString = symbol=${trade.pair}&side=BUY&type=MARKET&quoteOrderQty=${quantity}&timestamp=${timestamp};
        const signature = this.generateSignature(queryString);

        const response = await fetch(${config.restEndpoint}/api/v3/order?${queryString}&signature=${signature}, {
            method: 'POST',
            headers: {
                'X-MBX-APIKEY': config.apiKey
            }
        });

        const data = await response.json();

        if (response.ok) {
            this.logTrade(أمر شراء تم بنجاح: ${data.executedQty} ${trade.pair});
        } else {
            this.logTrade(فشل أمر الشراء: ${data.msg || 'خطأ غير معروف'}, 'error');
        }
    } catch (error) {
        this.logTrade(خطأ في تنفيذ أمر الشراء: ${error.message}, 'error');
    }
}
            
            // Here you would add actual Binance API call
            const timestamp = Date.now();
            const signature = this.generateSignature({
                symbol: trade.pair,
                side: 'BUY',
                type: 'MARKET',
                quantity: quantity,
                timestamp: timestamp
            });

            this.logTrade(`جاري تنفيذ أمر الشراء: ${quantity} ${trade.pair} @ ${this.currentPrice}`);
            await this.executeTrades();
        } catch (error) {
            this.logTrade(`خطأ في تنفيذ أمر الشراء: ${error.message}`, 'error');
        }
    }

    async executeSell(trade) {
    if (!this.isRunning) return;

    try {
        const timestamp = Date.now();
        const quantity = trade.amount;
        const queryString = symbol=${trade.pair}&side=SELL&type=MARKET&quoteOrderQty=${quantity}&timestamp=${timestamp};
        const signature = this.generateSignature(queryString);

        const response = await fetch(${config.restEndpoint}/api/v3/order?${queryString}&signature=${signature}, {
            method: 'POST',
            headers: {
                'X-MBX-APIKEY': config.apiKey
            }
        });

        const data = await response.json();

        if (response.ok) {
            this.logTrade(أمر بيع تم بنجاح: ${data.executedQty} ${trade.pair});
        } else {
            this.logTrade(فشل أمر البيع: ${data.msg || 'خطأ غير معروف'}, 'error');
        }
    } catch (error) {
        this.logTrade(خطأ في تنفيذ أمر البيع: ${error.message}, 'error');
    }
}


            this.logTrade(`جاري تنفيذ أمر البيع: ${quantity} ${trade.pair} @ ${this.currentPrice}`);
            await this.executeTrades();
        } catch (error) {
            this.logTrade(`خطأ في تنفيذ أمر البيع: ${error.message}`, 'error');
        }
    }

    generateSignature(queryString) {
    return CryptoJS.HmacSHA256(queryString, config.apiSecret).toString(CryptoJS.enc.Hex);
}

    logTrade(message, type = 'info') {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
        this.tradesLog.insertBefore(logEntry, this.tradesLog.firstChild);
    }

    updateStats() {
        // Currently does nothing, but can be used to update stats in the future
    }
}

// Make bot accessible globally for the remove trade button
window.bot = new TradingBot();
