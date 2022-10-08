const fs = require('fs');
const express = require('express');
//const cors = require("cors");
const nodemailer = require("nodemailer");
const multiparty = require("multiparty");
require("dotenv").config();

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
let activeRaces = [];
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
    if (now > from && now < to && !activeRaces.includes(segment.id)) {
      active = true;
      activeRaces.push(segment.id);
      html += getSegment(segment);
      a += `<a href="./races/${segment.id}" title="${segment.name}">${segment.title}</a><br />`;
    }
  });
});


function header(data) {
  if (!data.baseurl) {
    data.baseurl = './';
  }
  if (!data.url) {
    data.url = '/';
  }
  return `<!DOCTYPE html><head>
<title>${data.title} - RunAround</title>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${data.description}" />
<link rel="icon" href="/favicon.ico" type="image/x-icon" />
<link rel="canonical" href="https://runaround.com.au${data.url}" />
<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous" />
<link rel="stylesheet" href="${data.baseurl}style.css">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.8.0/dist/leaflet.css"
integrity="sha512-hoalWLoI8r4UszCkZ5kL8vayOGVae1oxXe/2A4AO6J9+580uKHDO3JdHb7NzwwzK5xr/Fs0W40kiNHxM9vyTtQ=="
crossorigin=""/>

<script type="text/javascript" src="https://code.jquery.com/jquery-3.4.1.min.js"></script>
<script src="https://unpkg.com/instafeed.js@2.0.0/dist/instafeed.js"></script>
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
${data.extra ? data.extra : ''}
</head><body><div class="wrapper"><img class="logo" src="${data.baseurl}runaround-logo.png" alt="RunAround logo - Virtual Running Events">
<h1>${data.title}</h1>
${menu({baseurl: data.baseurl})}`;
}

const footer = `<hr>
<div>
<a href="https://www.facebook.com/RunAroundAUS">Facebook</a> <a href="https://www.instagram.com/runaroundaus/">Instagram</a><br />
<i>Townsville, North Queensland, Australia</i>
</div>
<script>
$.getJSON("https://ig.instant-tokens.com/users/1d55f8ff-2133-4175-9f7e-4e9b03aa6dea/instagram/17841455046922576/token?userSecret=ifvgxbc8ctat0l1cvha6co", function(json) {
  var feed = new Instafeed({
    accessToken: json.Token,
    target: 'instafeed',
    limit: 10,
    success: function(array){
      function shuffle(a) {
        var j, x, i;
        for (i = a.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            x = a[i];
            a[i] = a[j];
            a[j] = x;
        }
        return a;
      }
      array.data = shuffle(array.data);
      array.data = array.data.slice(0, 50); // truncate to 50 results
      return array;
    },
    template: '<a href="\{\{link\}\}"><img src="\{\{image\}\}" alt="\{\{location\}\}" loading="lazy" /></a>'
  });
  feed.run();
});
</script>
<div id="instafeed"></div>
<footer>Website built by <a href="/about/luen-warneke">Luen Warneke</a><br />
<a href="https://wanderstories.space/">Wanderstories</a> &amp; <a href="https://www.hungryrunner.net/">Hungry Runner</a> &copy; ${new Date().getFullYear()}</footer>
</div>
<div></div></body></html>`;


app.get('/', (req, res) => {
  res.send(`${header({url: '/', title:'RunAround Home', description: 'RunAround is a Townsville-based running website that aims to promote running in our community, inspire others to get outdoors, and stay connected with like-minded people. This virtual running series allows participants the flexibility that conventional races can\'t offer.'})}
<p>Active Races:<br />${a}</p>

<div id="map" data-id="active"></div>

${footer}`);
});

app.get('/races', (req, res) => {
  res.send(`${header({url: '/races', title:'Virtual Running Events', description: 'We have ' + activeRaces.length + ' active virtual running races around Townsville, North Queensland, Australia.'})}
  <br /><br />
  All Races:<br />
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
  let segment;
  segments.forEach((s, i) => {
    if (s.id == id) {
      segment = segments[i];
    }
  })
  res.send(`${header({url: '/races/'+id, title:segment.title, baseurl: '../', description: segment.description})}
  <br /><br />
  <h2>${segment.name}</h2>
  <p>${segment.description}</p>
  <div id="map" data-id="${segment.id}"></div>
  ${getSegment(segment)}
  <br />
  ${footer}`);
});

app.get('/about', (req, res) => {
  res.send(`${header({url: '/about', title:'About RunAround', description: 'The Townsville Virtual Running Series is the brainchild of Sidney Willis from Hungry Runner Coaching. RunAround promotes running in our community, inspire others to get outdoors, and stay connected with like-minded people.'})}
  <br />
  <p>RunAround is a Townsville-based running website that aims to promote running in our community, inspire others to get outdoors, and stay connected with like-minded people. The Townsville Virtual Running Series is the brainchild of <a href="/about/sidney-willis">Sidney Willis</a> from <a href="https://www.hungryrunner.net/">Hungry Runner Coaching</a>. This virtual running series allows participants the flexibility that conventional races can't offer.</p>
  <p>Our goal is to give Townsville runners the opportunity to regularly test themselves on different running courses. Each race will be different. Some races will be flat, others will be hilly. Some races are more like an urban trail while others are only on dirt trails. We hope that this will challenge runners to run on terrains that they are more or less adapted to. Furthermore, each race is designed by a different runner from the <a href="https://www.facebook.com/groups/723606077775909">Hungry Runner group</a>. So maybe you will discover new paths through Townville City or Castle Hill!</p>
  <p>Race data is updated nightly</p>
  <p>Read more about <a href="/about/luen-warneke">Luen Warneke</a> and <a href="/about/sidney-willis">Sidney Willis</a>.</p>
  <img src="./Run-Hungry-2022-virtual-run-series.webp" alt="Run Hungry 2022 virtual run series" />
  <p>2022 will have 5 Virtual Races throughout the year as well as a general classification.</p>
  <h2>How to enter</h2>
  <p>We will use Strava segments for the rankings. You will be ranked for each Virtual Race in the month the specific race opens. In addition there will be a general classification with your accumulated fastest overall time for all the races. Everyone is welcome to participate, you do not need to be a Hungry Runner! Also, there is no registration and it is free.</p>
  <h2>Ranking for each Virtual Race</h2>
  <p>For each race you will have one month to clock your fastest time. You can run it as many times as you want within that month. We will take your fastest time for the ranking. We will have rewards for the first 3 males and females for every virtual race! Prizes will be awarded during a Hungry Runner group run the week following the virtual race.</p>
  <h2>Ranking for the General Classification</h2>
  <p>For the General Classification, you can run the races any time through the year to clock your fastest time! It doesn't matter if the Virtual Race already took place. All the race maps are available below. So you can run the races at any time of the year to register a time or better your time. However, to be ranked on the General Classification, you will need to run all the courses! The deadline is December 1 2022! We will have great rewards for the first 3 males and females!</p>
  <h2>Map of Castle Hill</h2>
  <img src="./castle-hill-map.jpg" alt="Castle Hill map" style="width:100%;" />
  ${footer}`);
});


app.get('/about/luen-warneke', (req, res) => {
  res.send(`${header({url: '/about/luen-warneke', title:'About Luen Warneke', baseurl: '../', description: ''})}
  <br /><br />
  <img src="https://luenwarneke.com/img/luen-warneke.jpg" alt="Luen Warneke" style="max-height:120px;" />
  <h2>Luen Warneke</h2>
  <p>Professional Adventurer</p>
  <p>Luen has been living in Townsville for most of his life and loves to explore the great outdoors. For the past several years, Luen has been writing articles for the <a href="https://wanderstories.space/">Wanderstories</a> website which documents the Townsville region's natural landscapes, such as waterfalls, lookouts, and mountains, and associated adventures, such as hiking, canyoning, rock climbing, bikepacking, and packrafting.</p>
  <p>Luen is a trip leader for the Townsville Rock Climbing Club (<a href="https://www.facebook.com/groups/jcu.rockclimbing">RANQ</a>) and the president of the <a href="https://www.townsvillebushwalkingclub.com/">Townsville Bushwalking Club</a>.</p>
  <p><a href="https://wanderstories.space/">Wanderstories</a></p>
  <br />
  ${footer}`);
});

app.get('/about/sidney-willis', (req, res) => {
  res.send(`${header({url: '/about/sidney-willis', title:'About Sidney Willis', baseurl: '../', description: ''})}
  <br /><br />
  <img src="https://static.wixstatic.com/media/62e31f_b5925d57fcfe4117a6cdceccdf9c4fff~mv2.jpg" alt="Sidney Willis" style="max-height:120px;" />
  <h2>Sidney Willis</h2>
  <p>Head Coach</p>
  <p>Sidney is an Australian Frenchy with a passion for endurance sports. Sidney played tennis at a national level during his childhood and later switched sports to rock climbing to enjoy amazing cliffs all over France, developing a love for mountains. He then started trail running, which has become slightly obsessive features over the years, and has performed in many road and mountain races throughout Europe and Australia - from 10km distance up to 100km ultra's.</p>
  <p>His passion for sports and eye for detail had him start coaching fellow sport enthusiasts. Sidney's always been passionate about training and loves to help people reach their goals. He uses his skills and experience to offer personalised training programs.</p>
  <p><a href="https://hungryrunner.net/">Hungry Runner Coaching</a></p>
  <br />
  ${footer}`);
});

app.get('/contact', (req, res) => {
  res.send(`${header({url: '/contact', title:'Contact RunAround', description: 'How to get in touch with us. We are a friendly bunch of people. Send us a message and feel free to ask any quesitons you may have.'})}
  <br /><br />
  <script>
  document.addEventListener("DOMContentLoaded", function(event) {
    const form = document.getElementById("contact-form"); 
    console.log(form);
    const formEvent = form.addEventListener("submit", (event) => {
      event.preventDefault();
      let mail = new FormData(form);
      sendMail(mail);
    });
    const sendMail = (mail) => {
      fetch("/send", {
        method: "post",
        body: mail,
      }).then((response) => {
        const r = response.json()
        console.log(r);
        alert(r.message);
        return response.json();
      });
    };
  });
  </script>
  <p>Try contacting us at <a href="https://hungryrunner.net/">hungryrunner.net</a> if the form does not work.</p>
  <form id="contact-form" method="POST" action="send" enctype="multipart/form-data">
    <div class="form-group">
      <div class="row">
        <div class="col-md-6">
          <input placeholder="Name" id="name" name="name" type="text" class="form-control" required />
        </div>
        <div class="col-md-6">
          <input placeholder="Email" id="email" type="email" name="email" class="form-control" aria-describedby="emailHelp" required />
        </div>
      </div>
    </div>
    <div class="form-group">
      <input placeholder="Subject" id="subject" name="subject" type="text" class="form-control" required />
    </div>
    <div class="form-group">
      <textarea placeholder="Message" id="message" name="message" class="form-control" rows="3" required></textarea>
    </div>
    <button type="submit" value="submit" class="btn btn-primary">Submit</button>
  </form>
  ${footer}`);
});

app.post("/send", (req, res) => {
  //const EMAIL = 'info@runaround.com.au';
  const EMAIL = 'contact@wanderstories.space';
  const transporter = nodemailer.createTransport({
    host: 'smtp.mailgun.org',
    port: 587,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASS,
    },
  });
  // verify connection configuration
  transporter.verify(function (error, success) {
    if (error) {
      console.log(error);
    } else {
      console.log("Server is ready to take messages");
    }
  });
  let form = new multiparty.Form();
  let data = {};
  form.parse(req, function (err, fields) {
    Object.keys(fields).forEach(function (property) {
      data[property] = fields[property].toString();
    });
    console.log(data);
    const mail = {
      sender: `${data.name} <${data.email}>`,
      to: EMAIL, // receiver email,
      subject: data.subject,
      text: `${data.name} <${data.email}> \n${data.message}`,
    };
    transporter.sendMail(mail, (err, data) => {
      if (err) {
        console.log(err);
        res.status(500).json({ success: false, message: `How to get in touch with us. We are a friendly bunch of people. Send us a message and feel free to ask any quesitons you may have.<br /><h1>Something went wrong.</h1><br />Try contacting us at <a href="https://hungryrunner.net/">hungryrunner.net</a>.` });
      } else {
        res.status(200).json({ success: true, message: 'Email successfully sent to recipient!' });
      }
    });
  });
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
    <loc>https://runaround.com.au/about/luen-warneke</loc>
  </url>
  <url>
    <loc>https://runaround.com.au/about/sidney-willis</loc>
  </url>
  <url>
    <loc>https://runaround.com.au/contact</loc>
  </url>
</urlset>`);
});

app.listen(port, () => {
  console.log(`RunAround listening on port ${port}`);
});
