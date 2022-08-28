fetch("database.json").then(response => response.json()).then(segments => { // eslint-disable-line

  var map = L.map('map').setView([-19.22517, 146.70953], 11); // eslint-disable-line

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { // eslint-disable-line
    maxZoom: 19,
    attribution: '© OpenStreetMap',
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
