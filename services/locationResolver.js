const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

async function resolveLocation(lat, lon) {
    console.log("resolveLocation CALLED:", lat, lon);
    console.log("TOKEN EXISTS:", !!MAPBOX_TOKEN);

    if (lat == null || lon == null) return null;

    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);

    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLon)) {
        console.error("Invalid coordinates:", lat, lon);
        return null;
    }

    const roundedLat = parsedLat.toFixed(4);
    const roundedLon = parsedLon.toFixed(4);

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${roundedLon},${roundedLat}.json?access_token=${MAPBOX_TOKEN}`;

    console.log("Mapbox URL:", url);

    try {
        const res = await fetch(url);

        console.log("Status:", res.status);

        if (!res.ok) {
            const errText = await res.text();
            console.error("Mapbox HTTP error:", errText);
            return null;
        }

        const data = await res.json();

        const feature = data?.features?.[0];

        if (!feature) {
            console.error("No geocoding result for:", roundedLat, roundedLon);
            return null;
        }

        return {
            full: feature.place_name,
            short: extractShortLocation(feature),
        };

    } catch (err) {
        console.error("Mapbox request failed:", err.message);
        return null;
    }
}

function extractShortLocation(feature) {
    const context = feature.context || [];

    const street = feature.text;

    const neighborhood = context.find(c => c.id?.includes("neighborhood"))?.text;
    const suburb = context.find(c => c.id?.includes("locality"))?.text;
    const place = context.find(c => c.id?.includes("place"))?.text;

    const parts = [
        street,
        neighborhood,
        suburb,
        place
    ].filter(Boolean);

    // remove duplicates while preserving order
    const unique = [...new Set(parts)];

    return unique.slice(0, 3).join(", ");
}

module.exports = { resolveLocation };