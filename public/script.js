polylinedecode = function(str, precision) {
  var index = 0,
    lat = 0,
    lng = 0,
    coordinates = [],
    shift = 0,
    result = 0,
    byte = null,
    latitude_change,
    longitude_change,
    factor = Math.pow(10, precision || 5);

  // Coordinates have variable length when encoded, so just keep
  // track of whether we've hit the end of the string. In each
  // loop iteration, a single coordinate is decoded.
  while (index < str.length) {

    // Reset shift, result, and byte
    byte = null;
    shift = 0;
    result = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

    shift = result = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

    lat += latitude_change;
    lng += longitude_change;

    coordinates.push([lat / factor, lng / factor]);
  }

  return coordinates;
};
function flipped(coords) {
  var flipped = [];
  for (var i = 0; i < coords.length; i++) {
    flipped.push(coords[i].slice().reverse());
  }
  return flipped;
}
polylinetoGeoJSON = function(str, precision) {
  var coords = polylinedecode(str, precision);
  return {
    type: 'LineString',
    coordinates: flipped(coords)
  };
};

var map = L.map('map').setView([-19.22517, 146.70953], 11); // eslint-disable-line

map.attributionControl.setPrefix(false); // disable default map attribution (to be replaced with custom version)
// https://maps.wanderstories.space/outdoor/{z}/{x}/{y}
// https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png
// https://c.tile.opentopomap.org/{z}/{x}/{y}.png
// https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=01a11fd78058448393f44810a68e989c
// https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=01a11fd78058448393f44810a68e989c
L.tileLayer('https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=01a11fd78058448393f44810a68e989c', { // eslint-disable-line
  maxZoom: 19,
  attribution: 'tile style © <a href="https://wanderstories.space/maps/">Wanderstories</a>, map engine © <a href="https://leafletjs.com/">Leaflet</a>, tile generator © <a href="https://www.mapbox.com/">Mapbox</a>, map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> &amp; <a href="https://wanderstories.space/">WS</a> under <a href="http://opendatacommons.org/licenses/odbl/summary/">ODbL</a>, <a href="https://www.openstreetmap.org/edit">Improve</a></div>',
}).addTo(map);

function makeColor(colorNum, colors) {
  if (colors < 1) colors = 1; // eslint-disable-line
  return colorNum * (360 / colors) % 360; // eslint-disable-line
}
const layerGroup = L.featureGroup(); // eslint-disable-line
layerGroup.addTo(map);

const m = document.getElementById("map").getAttribute("data-id");

segments.forEach((segment, i) => {
  segment.duration.forEach((d) => {
    var d1 = d[0].split("/"); // start
    var d2 = d[1].split("/"); // end
    var from = new Date('20'+d1[2], parseInt(d1[1]), d1[0]);  // -1 because months are from 0 to 11
    var to = new Date('20'+d2[2], parseInt(d2[1]), d2[0]);
    var now = new Date();
    if ((now > from && now < to && m == 'active') || m == 'all' || m == segment.id) {
      L.geoJSON(polylinetoGeoJSON(segment.map.polyline), { // eslint-disable-line
        style: {
          color: `hsl(${makeColor(i, segments.length)}, 100%, 50%)`,
          weight: 3,
          opacity: 0.85,
        },
        onEachFeature(feature, layer) {
          layer.bindTooltip(segment.name);
          layer.bindPopup(`<p style="font-weight:bold;">${segment.name}</p>
              <p>Distance: ${segment.distance}<br />
              Total elevation gain: ${segment.total_elevation_gain}<br />
              Overall: ${segment.xoms.overall}<br />
              <a href="https://www.strava.com/segments/${segment.id}" target="_blank">Strava Segment Link</a>`);
        },
      }).addTo(layerGroup);
      return;
    }
  });
});
map.fitBounds(layerGroup.getBounds());


const form = document.getElementById("contact-form");

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
    return response.json();
  });
};