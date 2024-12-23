const express = require('express');
const bodyParser = require('body-parser');
const readline = require('readline');
const puppeteer = require('puppeteer-core');
const { exec } = require('child_process');


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
}else if (action === 'stopped') {
if (positions[ticker]) {
delete positions[ticker];
console.log(`Stopped out of ${ticker}`);
console.log('Current positions:', positions); // Log the current positions after being stopped out
} else {
console.log(`No position for ${ticker}, ignoring stopped signal.`);
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
}else if (data.action === 'STOPPED') {
action = 'stopped';
}

return { action, quantity, close: closePrice, ticker };
};

// Function to calculate profit or loss
const calculateProfit = (entryPrice, exitPrice, quantity, ticker, type) => {
const pointValue = ticker === 'ES1!' ? 50 : ticker === 'NQ1!' ? 20 : 0;
const pointMove = type === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice;
return pointMove * pointValue * quantity;
};


const killChrome = () => {
return new Promise((resolve, reject) => {
exec('taskkill /F /IM chrome.exe', (err, stdout, stderr) => {
if (err) {
reject('Error killing Chrome process:', err);
return;
}
resolve('Chrome killed successfully');
});
});
};

const openChromeToTopstep = () => {
const command = '"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --new-window https://topstepx.com/trade';
exec(command, (err, stdout, stderr) => {
if (err) {
console.error('Error restarting Chrome:', err);
return;
}
console.log('Topstep restarted');
});
};

// Function to simulate buying shares
const simulateBuy = async (quantity, price, ticker) => {
console.log(`Simulating buy of ${quantity} shares of ${ticker} at price ${price}`);

let browser;
let timeoutOccurred = false;

// Function to handle timeout
const timeoutPromise = new Promise((resolve, reject) => {
setTimeout(() => {
timeoutOccurred = true;
reject(new Error('Timeout occurred'));
}, 10000); // 10 seconds timeout for example
});

try {
browser = await Promise.race([
puppeteer.connect({
browserURL: 'http://127.0.0.1:9222',
defaultViewport: null
}),
timeoutPromise
]);

if (timeoutOccurred) throw new Error('Timeout occurred while connecting to the browser');

console.log('Connected to the browser.');

const pages = await browser.pages();
const pageURL = 'https://topstepx.com/trade';
let page = pages.find(page => page.url().includes(pageURL));

if (!page) {
console.error(`Page with URL ${pageURL} not found.`);
await browser.disconnect();
console.log('broaction failed');
return;
}

console.log('Page found.');

try {
// Switch to the page if it's not the active tab
if (page !== (await browser.pages())[0]) {
await page.bringToFront(); // Bring the tab to front
}
// Ensure the correct contract is selected
// const contractInputSelector = 'input.MuiInputBase-input.MuiOutlinedInput-input';
// await page.waitForSelector(contractInputSelector);

// const contractValue = await page.$eval(contractInputSelector, el => el.value);

// if ((ticker === 'ES1' && !contractValue.includes('ES')) || (ticker === 'NQ1' && !contractValue.includes('NQ'))) {
// await page.click(contractInputSelector, { clickCount: 3 });
// await page.type(contractInputSelector, ticker === 'ES1' ? 'ES' : 'NQ');
// await page.keyboard.press('ArrowDown');
// await page.keyboard.press('Enter');
// console.log(`Selected the correct contract for ${ticker}`);
// } else {
// console.log(`Already ${ticker} contract`);
// }


// await page.waitForSelector('div.MuiInputBase-root input#\\:r10\\:');
// await page.click('div.MuiInputBase-root input#\\:r10\\:', { clickCount: 3 });
// await page.type('div.MuiInputBase-root input#\\:r10\\:', quantity.toString());
// console.log(`Set the order quantity to ${quantity}.`);
// Use the aria-invalid attribute to select the input field, which seems stable
const quantityInputSelector = 'input[aria-invalid="false"][type="number"][min="1"][step="1"]';

// Wait for the input field to appear
await page.waitForSelector(quantityInputSelector);

// Click to select the input field and clear it, then input the new value
const quantityInput = await page.$(quantityInputSelector);
await quantityInput.click({ clickCount: 3 });
await quantityInput.type(quantity.toString());

console.log(`Set the order quantity to ${quantity}.`);


// Change the value of the price input field to the provided close price
// await page.waitForSelector('#\\:rv\\:'); // Escape the colon in the selector
// await page.click('#\\:rv\\:', { clickCount: 3 });
// await page.type('#\\:rv\\:', price.toString());
// console.log(`Set the price to ${price}.`);

// Selector for the Limit Price input field using attributes
// const limitPriceInputSelector = 'input[aria-invalid="false"][type="number"][min="0"][step="0.25"]';

// // Wait for the Limit Price input field to appear
// await page.waitForSelector(limitPriceInputSelector);

// // Click to select the input field and clear it, then input the new value
// const limitPriceInput = await page.$(limitPriceInputSelector);
// await limitPriceInput.click({ clickCount: 3 });
// await limitPriceInput.type(price.toString());

// console.log(`Set the limit price to ${price}.`);



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
console.log('broaction failed');
}

console.log('Buy process completed.');
await browser.disconnect();
} catch (error) {
console.error('Error during Puppeteer operations:', error);
console.log('broaction failed');

// Kill Chrome and restart it without the if err part
killChrome()
.then(() => {
openChromeToTopstep();
return new Promise(resolve => setTimeout(resolve, 9000)); // Wait for 9 seconds
})
.then(() => {
return simulateBuy(quantity, price, ticker); // Retry simulateBuy function
})
.catch((err) => {
console.error(err);
});
}
};


// Function to simulate selling shares
const simulateSell = async (quantity, price, ticker) => {
console.log(`Simulating sell of ${quantity} shares of ${ticker} at price ${price}`);

let browser;
let timeoutOccurred = false;

// Function to handle timeout
const timeoutPromise = new Promise((resolve, reject) => {
setTimeout(() => {
timeoutOccurred = true;
reject(new Error('Timeout occurred'));
}, 10000); // 10 seconds timeout for example
});

try {
browser = await Promise.race([
puppeteer.connect({
browserURL: 'http://127.0.0.1:9222',
defaultViewport: null
}),
timeoutPromise
]);

if (timeoutOccurred) throw new Error('Timeout occurred while connecting to the browser');

console.log('Connected to the browser.');

const pages = await browser.pages();
const pageURL = 'https://topstepx.com/trade';
let page = pages.find(page => page.url().includes(pageURL));

if (!page) {
console.error(`Page with URL ${pageURL} not found.`);
await browser.disconnect();
console.log('broaction failed');
return;
}

console.log('Page found.');

try {
// Switch to the page if it's not the active tab
if (page !== (await browser.pages())[0]) {
await page.bringToFront(); // Bring the tab to front
}

// Ensure the correct contract is selected
// const contractInputSelector = 'input.MuiInputBase-input.MuiOutlinedInput-input';
// await page.waitForSelector(contractInputSelector);

// const contractValue = await page.$eval(contractInputSelector, el => el.value);

// if ((ticker === 'ES1' && !contractValue.includes('ES')) || (ticker === 'NQ1' && !contractValue.includes('NQ'))) {
// await page.click(contractInputSelector, { clickCount: 3 });
// await page.type(contractInputSelector, ticker === 'ES1' ? 'ES' : 'NQ');
// await page.keyboard.press('ArrowDown');
// await page.keyboard.press('Enter');
// console.log(`Selected the correct contract for ${ticker}`);
// } else {
// console.log(`Already ${ticker} contract`);
// }


const quantityInputSelector = 'input[aria-invalid="false"][type="number"][min="1"][step="1"]';

// Wait for the input field to appear
await page.waitForSelector(quantityInputSelector);

// Click to select the input field and clear it, then input the new value
const quantityInput = await page.$(quantityInputSelector);
await quantityInput.click({ clickCount: 3 });
await quantityInput.type(quantity.toString());

console.log(`Set the order quantity to ${quantity}.`);
// Change the value of the price input field to the provided close price
// await page.waitForSelector('input#\\:r10\\:'); // Updated selector for the price input field
// await page.click('input#\\:r10\\:', { clickCount: 3 });
// await page.type('input#\\:r10\\:', price.toString());
// console.log(`Set the price to ${price}.`);


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
console.log('broaction failed');
}

console.log('Sell process completed.');
await browser.disconnect();
} catch (error) {
console.error('Error during Puppeteer operations:', error);
console.log('broaction failed');

// Kill Chrome and restart it without the if err part
killChrome()
.then(() => {
openChromeToTopstep();
return new Promise(resolve => setTimeout(resolve, 9000)); // Wait for 9 seconds
})
.then(() => {
return simulateSell(quantity, price, ticker); // Retry simulateSell function
})
.catch((err) => {
console.error(err);
});
}
};






// Function to determine if the current time is within trading hours
const isWithinTradingHours = (time) => {
    const tradingStart = 0; // 8:30 AM in minutes
    const tradingEnd = 24 * 60 + 60; // 3:00 PM in minutes

    const noTradeStart = 15 * 60; // 3:00 PM in minutes
    const noTradeEnd = 16 * 60 + 30; // 4:30 PM in minutes

    const [hours, minutes] = time.split(':').map(Number);
    const currentTimeInMinutes = hours * 60 + minutes;

    // Check if the time is within the restricted no-trade period
    if (currentTimeInMinutes >= noTradeStart && currentTimeInMinutes < noTradeEnd) {
        console.log("That alert came too late.");
        return false;
    }

    // Check if the time is within trading hours
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