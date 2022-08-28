fetch("database.json").then(response => response.json()).then(segments => { // eslint-disable-line

  var map = L.map('map').setView([-19.22517, 146.70953], 11); // eslint-disable-line

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { // eslint-disable-line
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(map);

  // '#'+Math.floor(Math.random()*16777215).toString(16), // random color
  function getRandomColor() {
    const availableCharacters = '0123456789ABCDEF';
    const availableCharacterLength = availableCharacters.length;

    let color = '#';

    for (let i = 0; i < 6; i++) { // eslint-disable-line
      color += availableCharacters[Math.floor(Math.random() * availableCharacterLength)];
    }

    return color;
  }

  const layerGroup = L.featureGroup(); // eslint-disable-line
  layerGroup.addTo(map);

  segments.forEach((segment) => {
    L.geoJSON(segment.map.geoJSON, { // eslint-disable-line
      style: {
        color: getRandomColor(),
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
