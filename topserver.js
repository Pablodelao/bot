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
    console.log(`Server up and ready to cook on port ${PORT}`);
});

// Function to process alert data
const handleAlert = (data) => {
    // Ensure the close price is rounded to two decimal points
    data.close = roundToTwoDecimals(data.close);

    const { action, quantity, close, ticker } = processData(data);

    if (action === 'buy' && isWithinTradingHours(data.time)) {
        if (!positions[ticker]) {
            simulateBuy(quantity, close, ticker).catch(console.error);
            positions[ticker] = { quantity, price: close, type: 'long' }; // Save the number of shares and the buy price
            console.log('Current positions:', positions);
        } else {
            console.log(`Already holding a position for ${ticker}, ignoring buy signal.`);
        }
    } else if (action === 'sell') {
        if (positions[ticker] && positions[ticker].type === 'long') {
            const position = positions[ticker];
            const profit = calculateProfit(position.price, close, position.quantity, ticker, 'long');
            simulateSell(position.quantity, close, ticker).catch(console.error);
            console.log(`Sold ${position.quantity} contracts of ${ticker} at price ${close} for a ${profit >= 0 ? 'profit' : 'loss'} of $${profit.toFixed(2)}`);
            delete positions[ticker]; // Remove the position after selling
            console.log('Current positions:', positions); // Log the current positions after selling
        } else {
            console.log(`No long position for ${ticker}, ignoring sell signal.`);
        }
    } else if (action === 'short_sell' && isWithinTradingHours(data.time)) {
        if (!positions[ticker]) {
            simulateSell(quantity, close, ticker).catch(console.error);
            positions[ticker] = { quantity, price: close, type: 'short' }; // Save the number of shares and the short price
            console.log('Current positions:', positions);
        } else {
            console.log(`Already holding a position for ${ticker}, ignoring short sell signal.`);
        }
    } else if (action === 'short_cover') {
        if (positions[ticker] && positions[ticker].type === 'short') {
            const position = positions[ticker];
            const profit = calculateProfit(position.price, close, position.quantity, ticker, 'short');
            simulateBuy(position.quantity, close, ticker).catch(console.error);
            console.log(`Bought to cover ${position.quantity} contracts of ${ticker} at price ${close} for a ${profit >= 0 ? 'profit' : 'loss'} of $${profit.toFixed(2)}`);
            delete positions[ticker]; // Remove the position after covering
            console.log('Current positions:', positions); // Log the current positions after covering
        } else {
            console.log(`No short position for ${ticker}, ignoring short cover signal.`);
        }
    }
};

// Function to round a number to two decimal places
const roundToTwoDecimals = (num) => {
    return Math.round(num * 100) / 100;
};

// Function to determine buy/sell action and quantity
const processData = (data) => {
    let action = '';
    let quantity = 2; // Hardcode quantity to 2
    const closePrice = data.close;
    const ticker = data.ticker;

    if (data.action === 'SELL') {
        action = 'sell';
    } else if (data.action === 'BUY') {
        action = 'buy';
    } else if (data.action === 'SHORT_SELL') {
        action = 'short_sell';
    } else if (data.action === 'SHORT_COVER') {
        action = 'short_cover';
        quantity = positions[ticker]?.quantity || 0; // Use the quantity of the existing short position
    }

    return { action, quantity, close: closePrice, ticker };
};

// Function to calculate profit or loss
const calculateProfit = (entryPrice, exitPrice, quantity, ticker, type) => {
    const pointValue = ticker === 'ES1' ? 50 : ticker === 'NQ1' ? 20 : 0;
    const pointMove = type === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice;
    return pointMove * pointValue * quantity;
};



// Function to simulate buying shares
const simulateBuy = async (quantity, price, ticker) => {
    console.log(`Simulating buy of ${quantity} shares of ${ticker} at price ${price}`);

    const browser = await puppeteer.connect({
        browserURL: 'http://127.0.0.1:9222',
        defaultViewport: null
    });

    const pages = await browser.pages();
    const pageURL = 'https://topstepx.com/trade';
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

        // Change the value of the price input field to the provided close price
        await page.waitForSelector('#\\:rv\\:');  // Escape the colon in the selector
        await page.click('#\\:rv\\:', { clickCount: 3 });
        await page.type('#\\:rv\\:', price.toString());
        console.log(`Set the price to ${price}.`);


        await page.waitForSelector('div.MuiInputBase-root input#\\:r10\\:');
        await page.click('div.MuiInputBase-root input#\\:r10\\:', { clickCount: 3 });
        await page.type('div.MuiInputBase-root input#\\:r10\\:', quantity.toString());
        console.log(`Set the order quantity to ${quantity}.`);        
        


        // Click the place order button (example selector, adjust as per your page)
        await page.waitForSelector('button.MuiButtonBase-root.MuiButton-root.MuiButton-contained.MuiButton-containedSuccess.MuiButton-sizeLarge.MuiButton-containedSizeLarge');
        await page.click('button.MuiButtonBase-root.MuiButton-root.MuiButton-contained.MuiButton-containedSuccess.MuiButton-sizeLarge.MuiButton-containedSizeLarge');
        console.log('Clicked the Buy button.');     
        

// Use XPath to find the Confirm Buy button
const confirmButtonXPath = "//button[contains(text(), 'Confirm Buy')]";

// Wait for the Confirm Buy button to be present in the DOM
await page.waitForFunction(
    (xpath) => {
        return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    },
    {},
    confirmButtonXPath
);




// Click the Confirm Buy button
await page.evaluate((xpath) => {
    const button = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    button.click();
}, confirmButtonXPath);

console.log('Clicked the Confirm Buy button.');


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
    const pageURL = 'https://topstepx.com/trade';
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

        // Change the value of the price input field to the provided close price
        await page.waitForSelector('#\\:rv\\:');  // Escape the colon in the selector
        await page.click('#\\:rv\\:', { clickCount: 3 });
        await page.type('#\\:rv\\:', price.toString());
        console.log(`Set the price to ${price}.`);

        await page.waitForSelector('div.MuiInputBase-root input#\\:r10\\:');
        await page.click('div.MuiInputBase-root input#\\:r10\\:', { clickCount: 3 });
        await page.type('div.MuiInputBase-root input#\\:r10\\:', quantity.toString());
        console.log(`Set the order quantity to ${quantity}.`);        
        
        // Click the place order button (example selector, adjust as per your page)
        await page.waitForSelector('button.MuiButtonBase-root.MuiButton-root.MuiButton-contained.MuiButton-containedError.MuiButton-sizeLarge.MuiButton-containedSizeLarge');
        await page.click('button.MuiButtonBase-root.MuiButton-root.MuiButton-contained.MuiButton-containedError.MuiButton-sizeLarge.MuiButton-containedSizeLarge');        
        console.log('Clicked the Sell button.');     
        

        // Use XPath to find the Confirm Sell button
        const confirmButtonXPath = "//button[contains(text(), 'Confirm Sell')]";

        // Wait for the Confirm Sell button to be present in the DOM
        await page.waitForFunction(
            (xpath) => {
                return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            },
            {},
            confirmButtonXPath
        );

        // Click the Confirm Sell button
        await page.evaluate((xpath) => {
            const button = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            button.click();
        }, confirmButtonXPath);

        console.log('Clicked the Confirm Sell button.');

    } catch (error) {
        console.error('Error during sell process:', error);
    }

    console.log('Sell process completed.');
    await browser.disconnect();
};



// Function to determine if the current time is within trading hours
const isWithinTradingHours = (time) => {
    const tradingStart = 8 * 60 + 30; // 8:30 AM in minutes
    const tradingEnd = 14 * 60 + 30; // 2:30 PM in minutes

    const [hours, minutes] = time.split(':').map(Number);
    const currentTimeInMinutes = hours * 60 + minutes;

    return currentTimeInMinutes >= tradingStart && currentTimeInMinutes <= tradingEnd;
};

// Read user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    try {
        const [command, ticker] = input.trim().split(' ');
        if (command === 'sold' && ticker) {
            handleManualSell(ticker);
        } else {
            const alertData = JSON.parse(input);
            handleAlert(alertData);
        }
    } catch (error) {
        console.error('Invalid input:', error);
    }
});



const handleManualSell = (ticker) => {
    if (positions[ticker]) {
        delete positions[ticker];
        console.log(`Manually removed position for ${ticker}`);
        console.log('Current positions:', positions); // Log the current positions after manual sell
    } else {
        console.log(`No position found for ${ticker}`);
    }
};
