const puppeteer = require('puppeteer');
const fs = require('fs');

const login = 'anygis0000+1@gmail.com';
const password = 'AnyG15server';

const races = [30354222, 30505431, 30361147, 30561161, 30500288];

(async () => { // eslint-disable-line
  let browser;
  try {
    browser = await puppeteer.launch({ headless: false });

    // Authorization on www.strava.com/login
    const page = await browser.newPage();
    await page.setViewport({
      width: 1280,
      height: 1024,
    });
    await page.setDefaultNavigationTimeout(0);

    await page.goto('https://www.strava.com/login', {
      waitUntil: 'networkidle2',
    });

    await page.waitForSelector('form');
    await page.type('input#email', login);
    await page.type('input#password', password);

    await page.waitForSelector('button#login-button');
    await page.evaluate(() => document.querySelector('button#login-button').click());
    await page.waitForNavigation();

    const recaptcha = await page.evaluate(() => document.querySelector('input[name=recaptcha_enterprise_token]'));
    if (recaptcha) {
      console.log('ERROR: captcha detected.');
      await browser.close();
      return false;
    }

    const alert = await page.evaluate(() => {
      const alert = document.querySelector('div.alert-message'); // eslint-disable-line
      if (alert) {
        return alert.innerText;
      }
      return null;
    });
    // <div class="alert-message">Access to this account is temporarily suspended. Please try again later.</div>
    if (alert) {
      if (alert.includes('suspended')) {
        console.log('ERROR: The Strava account is temporarily suspended.');
        await browser.close();
        return false;
      }
    }

    for (let i = 0; i < races.length; i++) { // eslint-disable-line
      const id = races[i];
      console.log('Getting segment', id);
      try {
        const pageSegment = page;
        await pageSegment.goto(`https://www.strava.com/segments/${id}`, {
          waitUntil: 'networkidle2',
        });
        await page.waitForSelector('.table-leaderboard tr');
        const leaderboard = await page.$$eval('.table-leaderboard tr', tr => {
          const results = [];
          tr.forEach((row, index) => {
            const rank = index + 1;
            const name = row.querySelector(':nth-child(2)').textContent;
            const date = row.querySelector(':nth-child(3)').textContent;
            const pace = row.querySelector(':nth-child(4)').textContent;
            const hr = row.querySelector(':nth-child(5)').textContent;
            const time = row.querySelector(':nth-child(6)').textContent;
            if (date) { // if date within the segment timeframe
              results.push([rank, name, date, pace, hr, time]);
            }
          });
          return results;
        });
        try {
          fs.writeFileSync(`./database/${id}-leaderboard.json`, JSON.stringify(leaderboard));
          console.log('Leaderboard saved to file', id);
        } catch (err) {
          console.error(err);
        }
      } catch (error) {
        console.log(`Error: ${error}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    console.log('Closing browser');
    if (browser) await browser.close();
  }
})();
