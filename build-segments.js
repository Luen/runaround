let strava = require('strava-v3');
const polyline = require('@mapbox/polyline');
const fs = require('fs');

strava = new strava.client('9e19ee6487d7f9ffbe4f643e9c6eed5cac1ff3f4'); // eslint-disable-line

const races = [30354222, 30505431, 30361147, 30561161, 30500288];

(async () => {
  // Get segments
  races.forEach(async (id, i) => { // eslint-disable-line
    console.log('Getting segment', id);
    try {
      // get segment data
      const segment = await strava.segments.get({ id });
      segment.map.geoJSON = polyline.toGeoJSON(segment.map.polyline); // https://stackoverflow.com/questions/48017792/strava-api-how-to-get-route-image
      // write segment data to file
      fs.writeFileSync(`./database/${id}-segments.json`, JSON.stringify(segment));
      console.log('Segment saved', id);
    } catch (error) {
      console.log(`Error: ${error}`);
    }
  });
})();
