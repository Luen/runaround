fetch("database.json").then(response => response.json()).then(segments => { // eslint-disable-line

  var map = L.map('map').setView([-19.22517, 146.70953], 11); // eslint-disable-line

  map.attributionControl.setPrefix(false); // disable default map attribution (to be replaced with custom version)
  
  L.tileLayer('https://maps.wanderstories.space/outdoor/{z}/{x}/{y}', { // eslint-disable-line
    maxZoom: 19,
    attribution: 'tile style © <a href="https://wanderstories.space/maps/">Wanderstories</a>, map engine © <a href="https://leafletjs.com/">Leaflet</a>, tile generator © <a href="https://www.mapbox.com/">Mapbox</a>, map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> &amp; <a href="https://wanderstories.space/">WS</a> under <a href="http://opendatacommons.org/licenses/odbl/summary/">ODbL</a>, <a href="https://www.openstreetmap.org/edit">Improve</a></div>',
  }).addTo(map);

  function makeColor(colorNum, colors) {
    if (colors < 1) colors = 1; // eslint-disable-line
    return colorNum * (360 / colors) % 360; // eslint-disable-line
  }
  const layerGroup = L.featureGroup(); // eslint-disable-line
  layerGroup.addTo(map);

  segments.forEach((segment, i) => {
    L.geoJSON(segment.map.geoJSON, { // eslint-disable-line
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
  });
  map.fitBounds(layerGroup.getBounds());
});
