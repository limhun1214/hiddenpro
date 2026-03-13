const puppeteer = require('puppeteer');

async function delay(time) {
    return new Promise(function (resolve) { setTimeout(resolve, time) });
}

(async () => {
    console.log("Starting Puppeteer validation script...");
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    let logs = [];
    page.on('console', msg => logs.push(msg.text()));

    console.log("==========================================");
    console.log("[SCENARIO 1: CUSTOMER LOGIN]");

    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

    const [customerBtn] = await page.$$('::-p-xpath(//h2[contains(., "고객으로 시작하기")]/ancestor::button)');
    if (customerBtn) {
        await customerBtn.click();
        await delay(3000); // Wait for redirect and reload

        await page.goto('http://localhost:3000/chat', { waitUntil: 'domcontentloaded' });
        await delay(2000);

        const h2Elements = await page.$$eval('h2', els => els.map(el => el.textContent));
        const chatH2 = h2Elements.find(text => text.includes('대화방')) || "N/A";

        const navElements = await page.$$eval('nav span', els => els.map(el => el.textContent));
        const hasWallet = navElements.some(text => text.includes('지갑')) ? "Yes" : "No";

        const roleLog = logs.find(l => l.includes('Current Verified Role:')) || "N/A";

        console.log(`- Found Wallet Icon in GNB? : ${hasWallet}`);
        console.log(`- H2 Text Extracted         : ${chatH2}`);
        console.log(`- Console Role Output       : ${roleLog}`);
    } else {
        console.log("Customer button not found.");
    }

    logs = [];

    console.log("==========================================");
    console.log("[SCENARIO 2: PRO LOGIN]");

    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await page.goto('about:blank');

    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

    const [proBtn] = await page.$$('::-p-xpath(//h2[contains(., "고수로 시작하기")]/ancestor::button)');
    if (proBtn) {
        await proBtn.click();
        await delay(3000);

        await page.goto('http://localhost:3000/chat', { waitUntil: 'domcontentloaded' });
        await delay(2000);

        const h2Elements2 = await page.$$eval('h2', els => els.map(el => el.textContent));
        const chatH22 = h2Elements2.find(text => text.includes('대화방')) || "N/A";

        const navElements2 = await page.$$eval('nav span', els => els.map(el => el.textContent));
        const hasWallet2 = navElements2.some(text => text.includes('지갑')) ? "Yes" : "No";

        const roleLog2 = logs.find(l => l.includes('Current Verified Role:')) || "N/A";

        console.log(`- Found Wallet Icon in GNB? : ${hasWallet2}`);
        console.log(`- H2 Text Extracted         : ${chatH22}`);
        console.log(`- Console Role Output       : ${roleLog2}`);
    } else {
        console.log("Pro button not found.");
    }

    await browser.close();
    console.log("Validation complete.");
})();
