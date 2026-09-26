import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// SVG-based markers that never fail to load in Vite/Webpack
const createColorIcon = (colorHex) => {
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="
      background-color: ${colorHex};
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 8px rgba(0,0,0,0.6);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const youIcon = createColorIcon('#3b82f6');   // Blue marker
const peerIcon = createColorIcon('#22c55e');  // Green marker

function RecenterAutomatically({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
}

export default function LiveMap({ myLocation, peerLocations = {} }) {
  const defaultCenter = [20.2961, 85.8245]; // Default: Bhubaneswar
  const center = myLocation ? [myLocation.latitude, myLocation.longitude] : defaultCenter;

  return (
    <div style={{ height: '60vh', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {myLocation && (
          <>
            <Marker position={[myLocation.latitude, myLocation.longitude]} icon={youIcon}>
              <Popup>
                <strong>You</strong> <br />
                {myLocation.latitude.toFixed(4)}, {myLocation.longitude.toFixed(4)}
              </Popup>
            </Marker>
            <RecenterAutomatically lat={myLocation.latitude} lng={myLocation.longitude} />
          </>
        )}

        {Object.values(peerLocations).map((peer) => (
          <Marker
            key={peer.userId}
            position={[peer.latitude, peer.longitude]}
            icon={peerIcon}
          >
            <Popup>
              <strong>{peer.userName || `Member #${peer.userId}`}</strong> <br />
              Lat: {Number(peer.latitude).toFixed(4)} <br />
              Lng: {Number(peer.longitude).toFixed(4)}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}