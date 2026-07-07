/**
 * Approximate GeoJSON polygons for North, Central, South zones
 * (peninsular Malaysia - PLUS highway coverage). Expanded to cover
 * Sepang, KUL, Triang and avoid gaps. Coordinates [longitude, latitude].
 */
export const ZONE_POLYGONS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { zone: 'North' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [99.8, 4.2],
          [102.0, 4.2],
          [102.0, 6.6],
          [99.8, 6.6],
          [99.8, 4.2]
        ]]
      }
    },
    {
      type: 'Feature',
      properties: { zone: 'Central' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [100.8, 2.5],
          [102.6, 2.5],
          [102.6, 4.5],
          [100.8, 4.5],
          [100.8, 2.5]
        ]]
      }
    },
    {
      type: 'Feature',
      properties: { zone: 'South' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [101.0, 1.1],
          [104.2, 1.1],
          [104.2, 3.0],
          [101.0, 3.0],
          [101.0, 1.1]
        ]]
      }
    }
  ]
};
