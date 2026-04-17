const getHeatmapData = async (req, res) => {
  try {
    const incidents = await Incident.findAll({
      attributes: ['latitude', 'longitude'],
      where: {
        status: ['acknowledged']
      }
    });

    // Grid size — adjust based on your needs (0.01 = ~1km)
    const gridSize = 0.01;

    const heatmapGrid = {};

    incidents.forEach(incident => {
      const lat = Math.floor(incident.latitude / gridSize) * gridSize;
      const lng = Math.floor(incident.longitude / gridSize) * gridSize;
      const key = `${lat},${lng}`;

      heatmapGrid[key] = (heatmapGrid[key] || 0) + 1;
    });

    // Convert to array format for Mapbox
    const heatmapData = Object.entries(heatmapGrid).map(([coords, weight]) => {
      const [lat, lng] = coords.split(',');
      return {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        weight: weight
      };
    });

    res.json(heatmapData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};