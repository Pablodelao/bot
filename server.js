const express = require('express');
const bodyParser = require('body-parser');
const readline = require('readline');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// Object to keep track of positions for each ticker
const positions = {};

app.post('/webhook', (req, res) => {
    const data = req.body;
    console.log('Alert received:', data); // Logs the alert data

    handleAlert(data);

    res.status(200).send('Alert received');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Function to process alert data
const handleAlert = (data) => {
    const { action, quantity, close, ticker } = processData(data);

    if (action === 'buy' && isWithinTradingHours(data.time)) {
        if (!positions[ticker]) {
            simulateBuy(quantity, close, ticker);
            positions[ticker] = { quantity, price: close }; // Save the number of shares and the buy price
            console.log('Current positions:', positions);
        } else {
            console.log(`Already holding a position for ${ticker}, ignoring buy signal.`);
        }
    } else if (action === 'sell') {
        if (positions[ticker]) {
            const position = positions[ticker];
            const profit = (close - position.price) * position.quantity;
            simulateSell(position.quantity, close, ticker);
            console.log(`Sold ${position.quantity} shares of ${ticker} at price ${close} for a ${profit >= 0 ? 'profit' : 'loss'} of $${profit.toFixed(2)}`);
            delete positions[ticker]; // Remove the position after selling
            console.log('Current positions:', positions); // Log the current positions after selling
        } else {
            console.log(`No position for ${ticker}, ignoring sell signal.`);
        }
    }
};

// Function to determine buy/sell action and quantity
const processData = (data) => {
    let action = '';
    let quantity = 0;
    const closePrice = data.close;
    const ticker = data.ticker;

    if (data.action === 'SELL') {
        action = 'sell';
        quantity = 10; // Default value, can be customized later
    } else if (data.action === 'BUY') {
        action = 'buy';
        // Assuming a profit target of $1000 for a $1 increase in price
        quantity = calculateQuantity(closePrice, 1000, 1);
    }

    return { action, quantity, close: closePrice, ticker };
};

// Function to calculate the number of shares to buy
const calculateQuantity = (price, profitTarget, priceIncrease) => {
    return Math.ceil(profitTarget / priceIncrease);
};

// Function to simulate buying shares
const simulateBuy = (quantity, price, ticker) => {
    console.log(`Simulating buy of ${quantity} shares of ${ticker} at price ${price}`);
    // Actual Puppeteer code to simulate the buy action will go here
};

// Function to simulate selling shares
const simulateSell = (quantity, price, ticker) => {
    console.log(`Simulating sell of ${quantity} shares of ${ticker} at price ${price}`);
    // Actual Puppeteer code to simulate the sell action will go here
};

// Function to check if the current time is within trading hours
const isWithinTradingHours = (time) => {
    const [hour, minute, second] = time.split(':').map(Number);
    const currentTime = hour * 3600 + minute * 60 + second; // Convert time to seconds

    const startTradingTime = 9 * 3600 + 30 * 60; // 9:30:00 in seconds
    const endTradingTime = 15 * 3600; // 15:00:00 in seconds

    return currentTime >= startTradingTime && currentTime <= endTradingTime;
};

// Function to handle manual position update via command-line input
const handleManualSell = (ticker) => {
    if (positions[ticker]) {
        delete positions[ticker];
        console.log(`Manually removed position for ${ticker}`);
        console.log('Current positions:', positions); // Log the current positions after manual sell
    } else {
        console.log(`No position found for ${ticker}`);
    }
};

// Setup command-line input listener
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    const [command, ticker] = input.trim().split(' ');
    if (command === 'sold' && ticker) {
        handleManualSell(ticker);
    } else {
        console.log(`Unknown command or ticker: ${input}`);
    }
});
