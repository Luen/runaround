let strava = require('strava-v3');
const polyline = require('@mapbox/polyline');
const puppeteer = require('puppeteer');
const fs = require('fs');

const races = [30354222, 30505431, 30361147, 30561161, 30500288];

const STRAVA_EMAIL = process.env.STRAVA_EMAIL;
const STRAVA_PASSWORD = process.env.STRAVA_PASSWORD;

(async () => { // eslint-disable-line
  let browser; const database = [];

  try {
    browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

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
    await page.type('input#email', STRAVA_EMAIL);
    await page.type('input#password', STRAVA_PASSWORD);

    await page.waitForSelector('button#login-button');
    await page.evaluate(() => document.querySelector('button#login-button').click());
    await page.waitForNavigation();

    // await page.screenshot({ path: '02_logged_in.png' });

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
      let segment;
      const id = races[i];
      console.log('Getting segment via API', id);
      try {
        // get segment data
        segment = await strava.segments.get({ id });
        segment.map.geoJSON = polyline.toGeoJSON(segment.map.polyline); // https://stackoverflow.com/questions/48017792/strava-api-how-to-get-route-image
      } catch (error) {
        console.log(`Error: ${error}`);
      }
      console.log('Getting segment via Puppeteer', id);
      try {
        const pageSegment = page;
        await pageSegment.goto(`https://www.strava.com/segments/${id}`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('.table-leaderboard tr');
        const leaderboard = await page.$$eval('.table-leaderboard tr:not(:first-child)', tr => {
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

        segment.leaderboard = leaderboard;

        // console.log(segment);
        // await page.screenshot({ path: '03_segment.png' });

        database.push(segment);
      } catch (error) {
        console.log(`Error: ${error}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    try {
      // write segment data to file
      fs.writeFileSync('./public/database.json', JSON.stringify(database));
      console.log('Data saved to file');
    } catch (err) {
      console.error(err);
    }
    console.log('Closing browser');
    if (browser) await browser.close();
  }
})();
