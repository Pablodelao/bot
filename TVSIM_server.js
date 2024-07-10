const express = require('express');
const bodyParser = require('body-parser');
const readline = require('readline');
const puppeteer = require('puppeteer-core');

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
            simulateBuy(quantity, close, ticker).catch(console.error);
            positions[ticker] = { quantity, price: close }; // Save the number of shares and the buy price
            console.log('Current positions:', positions);
        } else {
            console.log(`Already holding a position for ${ticker}, ignoring buy signal.`);
        }
    } else if (action === 'sell') {
        if (positions[ticker]) {
            const position = positions[ticker];
            const profit = (close - position.price) * position.quantity;
            simulateSell(position.quantity, close, ticker).catch(console.error);
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
        quantity = getQuantityForTicker(ticker, closePrice);
    }

    return { action, quantity, close: closePrice, ticker };
};

// Function to get quantity based on the ticker
const getQuantityForTicker = (ticker, price) => {
    const profitTarget = 1000;
    let priceIncrease = 1; // Default value

    switch (ticker) {
        case 'AMD':
            priceIncrease = 1;
            break;
        case 'RIOT':
            priceIncrease = 0.5;
            break;
        // Add more tickers here with their custom values
        default:
            priceIncrease = 1; // Default value if ticker is not specified
            break;
    }

    return calculateQuantity(price, profitTarget, priceIncrease);
};

// Function to calculate the number of shares to buy
const calculateQuantity = (price, profitTarget, priceIncrease) => {
    return Math.ceil(profitTarget / priceIncrease);
};

// Function to simulate buying shares
const simulateBuy = async (quantity, price, ticker) => {
    console.log(`Simulating buy of ${quantity} shares of ${ticker} at price ${price}`);

    const browser = await puppeteer.connect({
        browserURL: 'http://127.0.0.1:9222',
        defaultViewport: null
    });

    const pages = await browser.pages();
    const pageURL = `https://www.tradingview.com/chart/xmVxMYrg/?symbol=NASDAQ%3A${ticker}`;
    let page = pages.find(page => page.url().includes(pageURL));

    if (!page) {
        console.error(`Page with URL ${pageURL} not found.`);
        await browser.disconnect();
        return;
    }

    console.log('Page found.');

    try {
        // Switch to the page if it's not the active tab
        if (page !== (await browser.pages())[0]) {
            await page.bringToFront(); // Bring the tab to front
        }

        // Click the buy button (example selector, adjust as per your page)
        await page.waitForSelector('.section-B5GOsH7j.buy-B5GOsH7j');
        await page.click('.section-B5GOsH7j.buy-B5GOsH7j');
        console.log('Clicked the Buy button.');

        // Change the value of the order quantity input to the provided quantity
        await page.waitForSelector('#order-ticket-quantity-input');
        await page.click('#order-ticket-quantity-input', { clickCount: 3 });
        await page.type('#order-ticket-quantity-input', quantity.toString());
        console.log(`Set the order quantity to ${quantity}.`);

        // Change the value of the price input field to the provided close price
        await page.waitForSelector('.input-RUSovanF.size-small-RUSovanF.with-end-slot-RUSovanF');
        await page.click('.input-RUSovanF.size-small-RUSovanF.with-end-slot-RUSovanF', { clickCount: 3 });
        await page.type('.input-RUSovanF.size-small-RUSovanF.with-end-slot-RUSovanF', price.toString());
        console.log(`Set the price to ${price}.`);

        // Click the place order button (example selector, adjust as per your page)
        await page.waitForSelector('[data-name="place-and-modify-button"]');
        await page.click('[data-name="place-and-modify-button"]');
        console.log('Clicked the place order button.');
    } catch (error) {
        console.error('Error during buy process:', error);
    }

    console.log('Buy process completed.');
    await browser.disconnect();
};

// Function to simulate selling shares
const simulateSell = async (quantity, price, ticker) => {
    console.log(`Simulating sell of ${quantity} shares of ${ticker} at price ${price}`);

    const browser = await puppeteer.connect({
        browserURL: 'http://127.0.0.1:9222',
        defaultViewport: null
    });

    const pages = await browser.pages();
    const pageURL = `https://www.tradingview.com/chart/xmVxMYrg/?symbol=NASDAQ%3A${ticker}`;
    let page = pages.find(page => page.url().includes(pageURL));

    if (!page) {
        console.error(`Page with URL ${pageURL} not found.`);
        await browser.disconnect();
        return;
    }

    console.log('Page found.');

    try {
        // Switch to the page if it's not the active tab
        if (page !== (await browser.pages())[0]) {
            await page.bringToFront(); // Bring the tab to front
        }

        // Click the sell button (example selector, adjust as per your page)
        await page.waitForSelector('.section-B5GOsH7j.sell-B5GOsH7j');
        await page.click('.section-B5GOsH7j.sell-B5GOsH7j');
        console.log('Clicked the Sell button.');

        // Change the value of the order quantity input to the provided quantity
        await page.waitForSelector('#order-ticket-quantity-input');
        await page.click('#order-ticket-quantity-input', { clickCount: 3 });
        await page.type('#order-ticket-quantity-input', quantity.toString());
        console.log(`Set the order quantity to ${quantity}.`);

        // Change the value of the price input field to the provided close price
        await page.waitForSelector('.input-RUSovanF.size-small-RUSovanF.with-end-slot-RUSovanF');
        await page.click('.input-RUSovanF.size-small-RUSovanF.with-end-slot-RUSovanF', { clickCount: 3 });
        await page.type('.input-RUSovanF.size-small-RUSovanF.with-end-slot-RUSovanF', price.toString());
        console.log(`Set the price to ${price}.`);

        // Click the place order button (example selector, adjust as per your page)
        await page.waitForSelector('[data-name="place-and-modify-button"]');
        await page.click('[data-name="place-and-modify-button"]');
        console.log('Clicked the place order button.');
    } catch (error) {
        console.error('Error during sell process:', error);
    }

    console.log('Sell process completed.');
    await browser.disconnect();
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
