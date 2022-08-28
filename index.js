const express = require('express');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 4008;

app.use('/', express.static(`${__dirname}/public/`));

const segments = JSON.parse(fs.readFileSync('./public/database.json'));

let html = '';
segments.forEach((segment) => {
  const localLegend = (segment.local_legend ? `${segment.local_legend.title} with ${segment.local_legend.effort_description}` : 'N/A');
  let leaderboard;
  if (segment.leaderboard) {
    leaderboard = '<table><b>Leaderboard</b><br />';
    segment.leaderboard.forEach((leader) => {
      leaderboard += `<tr><td>${leader[0]}</td><td>${leader[2]}</td><td>${leader[1]}</td><td>${leader[3]}</td><td>${leader[4]}</td><td>${leader[5]}</td></tr>`;
      // Jul 15, 2021
    });
    leaderboard += '</table>';
  }

  html += `<div>
  <a href="https://www.strava.com/segments/${segment.id}" target="_blank"><h1>${segment.name}</h1></a>
  <div>Distance: ${(segment.distance / 1000).toFixed(1)}km</div>
  <div>Total elevation gain: ${Math.round(segment.total_elevation_gain)}m</div>
  <div>KOM: ${segment.xoms.kom}</div>
  <div>QOM: ${segment.xoms.qom}</div>
  <div>${segment.effort_count} efforts by ${segment.athlete_count} athletes</div>
  <div>Local Legend: ${localLegend}</div>
  <div>${leaderboard}</div>
  <div><a href="https://www.strava.com/segments/${segment.id}" target="_blank">Link to segment on Strava</a></div>
  <img src="${segment.elevation_profile}" alt="${segment.name} elevation plot">
</div>`;
});

app.get('/', (req, res) => {
  res.send(`<html><head>
    <title>RunAround - Virtual Running Events</title>
<link rel="stylesheet" href="./style.css">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.8.0/dist/leaflet.css"
   integrity="sha512-hoalWLoI8r4UszCkZ5kL8vayOGVae1oxXe/2A4AO6J9+580uKHDO3JdHb7NzwwzK5xr/Fs0W40kiNHxM9vyTtQ=="
   crossorigin=""/>
<script src="https://unpkg.com/leaflet@1.8.0/dist/leaflet.js"
   integrity="sha512-BB3hKbKWOc9Ez/TAwyWxNXeoV9c1v6FIeYiBieIWkpLjauysF18NzgR1MBNBXf8/KABdlkX68nAhlwcDFLGPCQ=="
   crossorigin=""></script>
<script type="text/javascript" src="database.json"></script>
<script src="./script.js" defer="defer"></script>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1X8FP56G6T"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-1X8FP56G6T');
</script>
</head><body>
<div class="wrapper">
<img class="logo" src="./runaround-logo.png" alt="RunAround logo - Virtual Running Events">
    <h1>About RunAround</h1>
    <p>RunAround is a Townsville-based running website that aims to promote running in our community, inspire others to get outdoors, and stay connected with like-minded people.
The Townsville Virtual Running Series is the brainchild of Sidney Willis from <a href="https://www.hungryrunner.net/">Hungry Runner Coaching</a>. This virtual running series allows participants the flexibility that conventional races can't offer.</p>

<div id="map"></div>

<div>${html}</div>

<hr>
<div>
<a href="https://www.facebook.com/RunAroundAUS">Facebook</a>
</div>
<footer>&copy; <a href="https://wanderstories.space/">Wanderstories</a> &amp; <a href="https://www.hungryrunner.net/">Hungry Runner</a></footer>
</div>
<div></div>
</body></html>`);
});

app.listen(port, () => {
  console.log(`RunAround listening on port ${port}`);
});
