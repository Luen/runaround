let strava = require('strava-v3');
const polyline = require('@mapbox/polyline');
const puppeteer = require('puppeteer');
const fs = require('fs');
const e = require('express');

const races = [30354222, 30505431, 30361147, 30561161, 30500288, 28927372, 26897948, 26897961, 27927100];

const databasePath = "./database.json";

// Pupperteer can navigate to each athlete and find out if they are male or female by the "QOMs / CRs" or "KOMs / CRs" tabs.
// or can api get it???

/* 3m+3f for the month & 3m+3f for year (until deadline)
const races = {
  30354222: { // January
    results: [
      { 
        start: 1/1/22
        end: 21/1/22
      }, 
      {
        start: 1/1/22
        end: 1/12/22
      }
    ]
  },
  30505431 march
  30361147 june
  30561161 august
  30500288 october
}*/

const STRAVA_EMAIL = process.env.STRAVA_EMAIL;
const STRAVA_PASSWORD = process.env.STRAVA_PASSWORD;

console.log(process.env.STRAVA_ACCESS_TOKEN);

strava = new strava.client('326cb4fa326653edf27751dd0c0dfe9062da5612 '); // eslint-disable-line

const atheletes = {};

(async () => { // eslint-disable-line
  let browser; let database;
  if (process.argv[2] == "all") {
    console.log("Buidling fresh database");
    database = [];
  } else {
    console.log("Only updating active race data");
    database = JSON.parse(fs.readFileSync(databasePath).toString());
  }

  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

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
        await page.goto(`https://www.strava.com/segments/${id}`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('.table-leaderboard tr');
        const leaderboard = await page.$$eval('.table-leaderboard tr:not(:first-child)', tr => {
          const results = [];
          tr.forEach(async (row, index) => {
            if (row.querySelector(':first-child').textContent == "Rank") return;
            // Jul 15, 2021
            const date = row.querySelector(':nth-child(3)').textContent;
            const rank = index + 1;
            const name = row.querySelector(':nth-child(2)').textContent;
            const profileURL = row.querySelector(':nth-child(2) a[href]').href;
            const profileID = profileURL.match(/\d+/)[0];
            const effortURL = row.querySelector(':nth-child(3) a[href]').href; // redirects to activity url
            // const effortID = effortURL.match(/\d+/)[0];
            const pace = row.querySelector(':nth-child(4)').textContent;
            const hr = row.querySelector(':nth-child(5)').textContent;
            const time = row.querySelector(':nth-child(6)').textContent;
            //if (date) { // if date within the segment timeframe
              results.push({rank: rank, name: name, date, pace, hr, time, profileURL, profileID, effortURL});
            //}
          });
          return results;
        });
        /*
        let gender;
        if (atheletes[profileID]) {
          gender = atheletes[profileID];
        } else {
          await page.goto(profileURL, { waitUntil: 'networkidle2' });
          await page.waitForSelector('#athlete-profile li:nth-child(4) > a.tab');
          gender = await page.$$eval('.table-leaderboard tr:not(:first-child)', tab => {
            if (tab.textContent == "KOMs / CRs") {
              return 'm';
            } else if (tab.textContent == "QOMs / CRs") {
              return 'f';
            }
            return 
          });
          atheletes[profileID] = gender; // save in case needed again
        }
          */

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
      fs.writeFileSync(databasePath, JSON.stringify(database));
      console.log('Data saved to file');
    } catch (err) {
      console.error(err);
    }
    console.log('Closing browser');
    if (browser) await browser.close();
  }
})();
