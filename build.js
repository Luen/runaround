let strava = require('strava-v3');
// const polyline = require('@mapbox/polyline');
const puppeteer = require('puppeteer');
const fs = require('fs');
const { https } = require('follow-redirects');

const stravaConfigFile = 'strava_config.json';
const client_id = process.env.STRAVA_CLIENT_ID;
const client_secret = process.env.STRAVA_CLIENT_SECRET;
const refresh_token = process.env.STRAVA_REFRESH_TOKEN;

(async () => { // eslint-disable-line

  var stravaConfig = {}
  await fs.readFile(stravaConfigFile, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    stravaConfig = JSON.parse(data);
  });

  let access_token = stravaConfig.access_token;

  var timestamp = new Date().getTime();
  if (!access_token ||!stravaConfig.expires_at || stravaConfig.expires_at > timestamp) {
    console.log('Getting fresh access token');

    stravaConfig = await getAccessToken();
    access_token = stravaConfig.access_token;

  }

  console.log('Using access_token:', access_token);
  strava = new strava.client(access_token); // eslint-disable-line

  const databasePath = "./database.json";

  // Subscribe to Strava and get age groups and gender
  // 3m+3f for the month & 3m+3f for year (until deadline)
  const races = {
    30500288: { 
      title: 'Race 5 - October 22',
      description: 'Two laps of The Cutheringa Track and the Goat Track',
      duration: [
        ['1/10/22','31/10/22'],
        ['1/1/22','1/12/22']
      ]
    },
    30561161: { 
      title: 'Race 4 - August 22',
      description: 'Around Castle Hill and Queens Gardens',
      duration: [
        ['1/8/22','31/8/22'],
        ['1/1/22','1/12/22']
      ]
    },
    30361147: { 
      title: 'Race 3 - June 22',
      description: 'West Ridge & Yarrawonga Hill',
      duration: [
        ['1/6/22','30/6/22'],
        ['1/1/22','1/12/22']
      ]
    },
    30505431: { 
      title: 'Race 2 - March 22',
      description: 'A lap of the Ross River, around Bicentennial Park and Townsville Golf Club',
      duration: [
        ['1/3/22','31/3/22'],
        ['1/1/22','1/12/22']
      ]
    },
    30354222: { 
      title: 'Race 1 - January 22',
      description: 'Lap of Castle Hill and the suburbs',
      duration: [
        ['1/1/22','31/1/22'],
        ['1/1/22','1/12/22']
      ]
    },
    28927372: { 
      title: 'Race 3 - June 21',
      description: 'Cutheringa and Goat tracks',
      duration: [
        ['1/6/22','30/6/22']
      ]
    },
    27927100: { 
      title: 'Race 2 - May 21',
      description: 'The north end of Castle Hill loop. Yarrawonga Hill.',
      duration: [
        ['1/5/22','31/5/22']
      ]
    },
    26897948: { 
      title: 'Race 1 - Jan 21 (Short)',
      description: 'A lap of Ross Creek, through Reid Park, around Cowboys Training Field and Stadium',
      duration: [
        ['1/1/22','31/1/22']
      ]
    },
    26897961: { 
      title: 'Race 1 - Jan 21 - (Long)',
      description: 'Two laps of Ross Creek, through Reid Park, around Cowboys Training Field and Stadium',
      duration: [
        ['1/1/22','31/1/22']
      ]
    }
  }

  const STRAVA_EMAIL = process.env.STRAVA_EMAIL;
  const STRAVA_PASSWORD = process.env.STRAVA_PASSWORD;

  const atheletes = {};


  let browser; let database;
  if (process.argv[2] == "all") {
    console.log("Building fresh database");
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

    //for (let i = 0; i < races.length; i++) { // eslint-disable-line
    for (const [i, [id, v]] of Object.entries(Object.entries(races))) {
      let segment;
// if not in database, then (build fresh)
      //const id = races[i];
      console.log('Getting segment via API', id);
      try {
        // get segment data
        segment = await strava.segments.get({ id });
        //segment.map.geoJSON = polyline.toGeoJSON(segment.map.polyline); // https://stackoverflow.com/questions/48017792/strava-api-how-to-get-route-image
        segment.duration = v.duration;
        segment.title = (v.title ? v.title : null);
        segment.description = (v.description ? v.description : null);
      } catch (error) {
        console.log(`Error: ${error}`);
      }
      console.log('Getting segment via Puppeteer', id);
      try {
        await page.goto(`https://www.strava.com/segments/${id}`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('.table-leaderboard tr');
        const leaderboard = await page.$$eval('.table-leaderboard tr', tr => {
          const results = [];
          tr.forEach(async (row, index) => {
            if (row.querySelector('td:first-child').textContent == "Rank") return;
            // Jul 15, 2021
            const date = row.querySelector('td:nth-child(3)').textContent;
            const rank = index + 1;
            const name = row.querySelector('td:nth-child(2)').textContent; 
            const profileURL = row.querySelector('td:nth-child(2) a[href]').href;
            const profileID = profileURL.match(/\d+/)[0];
            const effortURL = row.querySelector('td:nth-child(3) a[href]').href; // redirects to activity url
            // const effortID = effortURL.match(/\d+/)[0];
            const pace = row.querySelector('td:nth-child(4)').textContent;
            const hr = row.querySelector('td:nth-child(5)').textContent;
            const time = row.querySelector('td:nth-child(6)').textContent;
            //if (date) { // if date within the segment timeframe
              results.push({ rank, name, date, pace, hr, time, profileURL, profileID, effortURL });
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
    if (database.length !== 0) {
      try {
        // write segment data to file
        fs.writeFileSync(databasePath, JSON.stringify(database));
        console.log('Data saved to file');
      } catch (err) {
        console.error(err);
      }
    }
    console.log('Closing browser');
    if (browser) await browser.close();
  }
})();



function getAccessToken() {
  return new Promise((resolve, reject) => {
    const options = {
      'method': 'POST',
      'hostname': 'www.strava.com',
      'path': `/api/v3/oauth/token?client_id=${client_id}&client_secret=${client_secret}&grant_type=refresh_token&refresh_token=${refresh_token}`,
      'headers': {
      },
      'maxRedirects': 20
    };
    var req = https.request(options, async function (res) {
      var chunks = [];

      res.on("data", function (chunk) {
        chunks.push(chunk);
      });

      res.on("end", function (chunk) {
        var body = Buffer.concat(chunks);
        stravaConfig = JSON.parse(body.toString());
        fs.writeFileSync(stravaConfigFile, JSON.stringify(stravaConfig));
        resolve(stravaConfig);
      });

      res.on("error", function (error) {
        console.error(error);
        reject(error);
      });
    });
    req.end();
  });
}
