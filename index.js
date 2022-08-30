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
    leaderboard = '<table><strong>Leaderboard</strong><br />';
    segment.leaderboard.forEach((leader) => {
      leaderboard += `<tr><td><strong>${leader[0]}</strong></td><td>${leader[2]}</td><td>${leader[1]}</td><td>${leader[3]}</td><td>${leader[4]}</td><td>${leader[5]}</td></tr>`;
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
  res.send(`<!DOCTYPE html><head>
    <title>RunAround - Virtual Running Events</title>
<link rel="stylesheet" href="./style.css">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.8.0/dist/leaflet.css"
   integrity="sha512-hoalWLoI8r4UszCkZ5kL8vayOGVae1oxXe/2A4AO6J9+580uKHDO3JdHb7NzwwzK5xr/Fs0W40kiNHxM9vyTtQ=="
   crossorigin=""/>
<script src="https://unpkg.com/leaflet@1.8.0/dist/leaflet.js"
   integrity="sha512-BB3hKbKWOc9Ez/TAwyWxNXeoV9c1v6FIeYiBieIWkpLjauysF18NzgR1MBNBXf8/KABdlkX68nAhlwcDFLGPCQ=="
   crossorigin=""></script>
<script src="database.json"></script>
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
<p>Our goal is to give Townsville runners the opportunity to regularly test themselves on different running courses. Each race will be different. Some races will be flat, others will be hilly. Some races are more like an urban trail while others are only on dirt trails. We hope that this will challenge runners to run on terrains that they are more or less adapted to. Furthermore, each race is designed by a different runner from the <a href="https://www.facebook.com/groups/723606077775909">Hungry Runner group</a>. So maybe you will discover new paths through Townville City or Castle Hill!</p>
<p>2022 will have 5 Virtual Races throughout the year as well as a general classification.<br />
January, Race 1<br />
March, Race 2<br />
June, Race 3<br />
August, Race 4<br />
October Race 5</p>
<h2>How to enter</h2>
<p>We will use Strava segments for the rankings. You will be ranked for each Virtual Race in the month the specific race opens. In addition there will be a general classification with your accumulated fastest overall time for all the races. Everyone is welcome to participate, you do not need to be a Hungry Runner! Also, there is no registration and it is free.</p>
<h2>Ranking for each Virtual Race</h2>
<p>For each race you will have one month to clock your fastest time. You can run it as many times as you want within that month. We will take your fastest time for the ranking. We will have rewards for the first 3 males and females for every virtual race! Prizes will be awarded during a Hungry Runner group run the week following the virtual race.</p>
<h2>Ranking for the General Classification</h2>
<p>For the General Classification, you can run the races any time through the year to clock your fastest time! It doesn't matter if the Virtual Race already took place. All the race maps are available below. So you can run the races at any time of the year to register a time or better your time. However, to be ranked on the General Classification, you will need to run all the courses! The deadline is December 1 2022! We will have great rewards for the first 3 males and females!</p>

<div id="map"></div>

<div>${html}</div>

<hr>
<div>
<a href="https://www.facebook.com/RunAroundAUS">Facebook</a> <a href="https://www.instagram.com/runaroundaus/">Instagram</a>
</div>
<footer>&copy; <a href="https://wanderstories.space/">Wanderstories</a> &amp; <a href="https://www.hungryrunner.net/">Hungry Runner</a></footer>
</div>
<div></div>
</body></html>`);
});

app.listen(port, () => {
  console.log(`RunAround listening on port ${port}`);
});
