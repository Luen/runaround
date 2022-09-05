const express = require('express');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 4008;

app.use('/', express.static(`${__dirname}/public/`));

const databasePath = './database.json';

const segments = JSON.parse(fs.readFileSync(databasePath));

let submenu = segments.map((segment) => '<a href="./races/' + segment.id + '">' + segment.id + '</a> ').join('')
// const menu = `<a href="./">Home</a> <a href="#">Races</a> ${submenu} <a href="./about">About</a> <a href="./contact">Contact</a>`;
const menu = (data) => `<a href="${data.baseurl}">Home</a> <a href="${data.baseurl}races">Races</a> <a href="${data.baseurl}about">About</a> <a href="${data.baseurl}contact">Contact</a>`;

let html = ''; 
function getSegment(segment) {
  const localLegend = (segment.local_legend ? `${segment.local_legend.title} with ${segment.local_legend.effort_description}` : 'N/A');
  let leaderboard;
  if (segment.leaderboard) {
    leaderboard = '<table><strong>Leaderboard</strong><br />';
    segment.leaderboard.forEach((leader) => {
      let name = leader.name;
      if (name == name.toLowerCase()) {
        // toTitleCase
        name = name.replace(
          /\w\S*/g,
          function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
          }
        );
      }
      name = name.replace(' // www.HungryRunner.net', '');

      leaderboard += `<tr><td><strong>${leader.rank}</strong></td><td><a href="${leader.effortURL}">${leader.date}</a></td><td><a href="${leader.profileURL}">${name}</a></td><td>${leader.pace}</td><td>${leader.hr}</td><td>${leader.time}</td></tr>`;
    });
    leaderboard += '</table>';
  }

  return `<div>
  <a href="https://www.strava.com/segments/${segment.id}" target="_blank"><h1 title="${segment.name}">${segment.title}</h1></a>
  <img src="${segment.elevation_profile}" alt="${segment.name} elevation plot">
  <div>Distance: ${(segment.distance / 1000).toFixed(1)}km</div>
  <div>Total elevation gain: ${Math.round(segment.total_elevation_gain)}m</div>
  <div>KOM: ${segment.xoms.kom}</div>
  <div>QOM: ${segment.xoms.qom}</div>
  <div>${segment.effort_count} efforts by ${segment.athlete_count} athletes</div>
  <div>Local Legend: ${localLegend}</div>
  <div>${leaderboard}</div>
</div>`;
}
let a = ''
segments.forEach((segment) => {
  // if active 
  active = false;
  segment.duration.forEach((d) => {
    var d1 = d[0].split("/"); // start
    var d2 = d[1].split("/"); // end
    var from = new Date('20'+d1[2], parseInt(d1[1]), d1[0]);  // -1 because months are from 0 to 11
    var to = new Date('20'+d2[2], parseInt(d2[1]), d2[0]);
    var now = new Date();
    
    //console.log(to, 'to', from, 'now:', now);
    //console.log(now > from && now < to);
    if (now > from && now < to) {
      active = true;
      html += getSegment(segment);
      a += `<a href="./races/${segment.id}" title="${segment.name}">${segment.title}</a><br />`;
    }
  });
});


function header(data) {
  if (!data.baseurl) {
  console.log(data.baseurl);
    data.baseurl = './';
  }
  return `<!DOCTYPE html><head>
<title>${data.title} - RunAround</title>
<link rel="stylesheet" href="${data.baseurl}style.css">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.8.0/dist/leaflet.css"
integrity="sha512-hoalWLoI8r4UszCkZ5kL8vayOGVae1oxXe/2A4AO6J9+580uKHDO3JdHb7NzwwzK5xr/Fs0W40kiNHxM9vyTtQ=="
crossorigin=""/>
<script src="https://unpkg.com/leaflet@1.8.0/dist/leaflet.js"
integrity="sha512-BB3hKbKWOc9Ez/TAwyWxNXeoV9c1v6FIeYiBieIWkpLjauysF18NzgR1MBNBXf8/KABdlkX68nAhlwcDFLGPCQ=="
crossorigin=""></script>
<script>
var segments = ${fs.readFileSync(databasePath).toString()};
</script>
<script src="${data.baseurl}script.js" defer="defer"></script>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1X8FP56G6T"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-1X8FP56G6T');
</script>
</head><body><div class="wrapper"><img class="logo" src="${data.baseurl}runaround-logo.png" alt="RunAround logo - Virtual Running Events">
<h1>RunAround</h1>
${menu({baseurl: data.baseurl})}`;
}

const footer = `<hr>
<div>
<a href="https://www.facebook.com/RunAroundAUS">Facebook</a> <a href="https://www.instagram.com/runaroundaus/">Instagram</a><br />
Townsville, North Queensland, Australia.
</div>
<footer>Website built by <a href="https://luenwarneke.com/">Luen Warneke</a><br><a href="https://wanderstories.space/">Wanderstories</a> &amp; <a href="https://www.hungryrunner.net/">Hungry Runner</a> &copy; ${new Date().getFullYear()}</footer>
</div>
<div></div></body></html>`;


app.get('/', (req, res) => {
  res.send(`${header({title:'Virtual Running Events'})}
<p>Active:<br />${a}</p>

<div id="map" data-id="active"></div>

${footer}`);
});

app.get('/races', (req, res) => {
  const id = req.params.id;
  res.send(`${header({title:'Virtual Running Events'})}
  <br /><br />
  Races:<br />
  ${segments.map((segment) => '<a href="./races/' + segment.id + '" title="segment.name">' + segment.title + '</a><br />\n').join('')}
  <div id="map" data-id="all"></div>
  Active races:
  <div>${html}</div>

  ${footer}`);
});

app.get('/races/:id', (req, res) => {
  const id = req.params.id;
  if (!segments.some(segment => segment.id == id)) {
    // If not in database
    res.status(404).send('Not found');
  }
  //console.log(id);
  //i = segments.findIndex(e => e.id === id);
  //i = segments.map(object => object.id).indexOf(id);
  i = 0;
  //console.log(i);
  if (i > -1) {
    segment = segments[i];
    res.send(`${header({title:segment.name, baseurl: '../'})}
    <br /><br />
    <div id="map" data-id="${segment.id}"></div>
    ${getSegment(segment)}
    <br />
    ${footer}`);
  } else {
    res.status(404).send('Not found');
  }
});

app.get('/about', (req, res) => {
  res.send(`${header({title:'About Us'})}<p>RunAround is a Townsville-based running website that aims to promote running in our community, inspire others to get outdoors, and stay connected with like-minded people. The Townsville Virtual Running Series is the brainchild of Sidney Willis from <a href="https://www.hungryrunner.net/">Hungry Runner Coaching</a>. This virtual running series allows participants the flexibility that conventional races can't offer.</p>
  <p>Our goal is to give Townsville runners the opportunity to regularly test themselves on different running courses. Each race will be different. Some races will be flat, others will be hilly. Some races are more like an urban trail while others are only on dirt trails. We hope that this will challenge runners to run on terrains that they are more or less adapted to. Furthermore, each race is designed by a different runner from the <a href="https://www.facebook.com/groups/723606077775909">Hungry Runner group</a>. So maybe you will discover new paths through Townville City or Castle Hill!</p>
  <p>2022 will have 5 Virtual Races throughout the year as well as a general classification.</p>
  <h2>How to enter</h2>
  <p>We will use Strava segments for the rankings. You will be ranked for each Virtual Race in the month the specific race opens. In addition there will be a general classification with your accumulated fastest overall time for all the races. Everyone is welcome to participate, you do not need to be a Hungry Runner! Also, there is no registration and it is free.</p>
  <h2>Ranking for each Virtual Race</h2>
  <p>For each race you will have one month to clock your fastest time. You can run it as many times as you want within that month. We will take your fastest time for the ranking. We will have rewards for the first 3 males and females for every virtual race! Prizes will be awarded during a Hungry Runner group run the week following the virtual race.</p>
  <h2>Ranking for the General Classification</h2>
  <p>For the General Classification, you can run the races any time through the year to clock your fastest time! It doesn't matter if the Virtual Race already took place. All the race maps are available below. So you can run the races at any time of the year to register a time or better your time. However, to be ranked on the General Classification, you will need to run all the courses! The deadline is December 1 2022! We will have great rewards for the first 3 males and females!</p>
  <img src="./Run-Hungry-2022-virtual-run-series.webp" alt="Run Hungry 2022 virtual run series">
  ${footer}`);
});

app.get('/contact', (req, res) => {
  res.send(`${header({title:'Virtual Running Events'})}
  <p>Contact us on the <a href="https://www.hungryrunner.net/">Hungry Runner</a> website</p>
   <img src="./castle-hill-map.jpg" alt="Castle Hill map">
  ${footer}`);
});

app.get('/sitemap.xml', (req, res) => {
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://runaround.com.au/</loc>
  </url>
  <url>
    <loc>https://runaround.com.au/races</loc>
  </url>
${segments.map((segment) => '  <url>\n    <loc>https://runaround.com.au/races/' + segment.id + '</loc>\n  </url>\n').join('')}   <url>
    <loc>https://runaround.com.au/about</loc>
  </url>
  <url>
    <loc>https://runaround.com.au/contact</loc>
  </url>
</urlset>`);
});

app.listen(port, () => {
  console.log(`RunAround listening on port ${port}`);
});
