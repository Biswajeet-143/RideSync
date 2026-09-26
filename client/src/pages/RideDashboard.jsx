import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import LiveMap from '../components/LiveMap';
import Navbar from '../components/Navbar';
import { Users, Copy, Check, ArrowLeft, Crown, Pause, Play, Square } from 'lucide-react';

export default function RideDashboard() {
  const { rideId } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [ride, setRide] = useState(null);
  const [members, setMembers] = useState([]);
  const [myLocation, setMyLocation] = useState(null);
  const [peerLocations, setPeerLocations] = useState({});
  const [rideStatus, setRideStatus] = useState('active');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const socketRef = useRef(null);
  const watchIdRef = useRef(null);

  const isLeader = ride && user && ride.creator_id === user.id;

  useEffect(() => {
    let isMounted = true;

    const loadRideData = async () => {
      try {
        const res = await api.get(`/rides/${rideId}`);
        if (!isMounted) return;

        if (res.data.ride.status === 'completed') {
          alert('This trip has already ended.');
          navigate('/home');
          return;
        }

        setRide(res.data.ride);
        setRideStatus(res.data.ride.status);

        const syncedMembers = res.data.members.map((m) =>
          m.id === user.id ? { ...m, status: 'online' } : m
        );
        setMembers(syncedMembers);

        const initialPeers = {};
        res.data.members.forEach((m) => {
          if (m.id !== user.id && m.latitude && m.longitude) {
            initialPeers[m.id] = {
              userId: m.id,
              userName: m.name,
              latitude: parseFloat(m.latitude),
              longitude: parseFloat(m.longitude),
            };
          }
        });
        setPeerLocations(initialPeers);
      } catch (err) {
        if (isMounted) setErrorMsg(err.response?.data?.message || 'Access denied or ride not found.');
      }
    };

    loadRideData();

    const socket = io('http://localhost:5000', {
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setMembers((prev) =>
        prev.map((m) => (m.id === user.id ? { ...m, status: 'online' } : m))
      );
    });

    socket.emit('join-ride-room', { rideId });

    socket.on('member-location-updated', (data) => {
      setPeerLocations((prev) => ({
        ...prev,
        [data.userId]: data,
      }));
    });

    socket.on('member-status-changed', ({ userId, status }) => {
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, status } : m))
      );
    });

    // Handle real-time status updates broadcast by the leader
    socket.on('ride-status-updated', ({ status }) => {
      setRideStatus(status);
      if (status === 'completed') {
        alert('The trip leader has ended this ride.');
        navigate('/home');
      }
    });

    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setMyLocation(coords);

          // Only send location if not paused
          socket.emit('send-location', {
            rideId,
            ...coords,
            isPaused: rideStatus === 'paused',
          });
        },
        (err) => console.warn('Geolocation issue:', err.message),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      );
    }

    return () => {
      isMounted = false;
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      socket.disconnect();
    };
  }, [rideId, token, user.id, navigate]);

  const copyCode = () => {
    if (!ride) return;
    navigator.clipboard.writeText(ride.ride_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await api.patch(`/rides/${rideId}/status`, { status: newStatus });
      setRideStatus(newStatus);

      // Notify other room members via WebSocket
      socketRef.current.emit('ride-status-change', { rideId, status: newStatus });

      if (newStatus === 'completed') {
        navigate('/home');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status.');
    }
  };

  const handleLeave = async () => {
    try {
      await api.delete(`/rides/${rideId}/leave`);
      navigate('/home');
    } catch (err) {
      alert('Failed to exit session.');
    }
  };

  if (errorMsg) {
    return (
      <div>
        <Navbar />
        <div style={{ maxWidth: '600px', margin: '4rem auto', padding: '2rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
          <h2 style={{ fontSize: '1.15rem', color: '#fca5a5', marginBottom: '0.75rem' }}>Authorization Error</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{errorMsg}</p>
          <button
            onClick={() => navigate('/home')}
            style={{ padding: '0.5rem 1rem', background: 'var(--bg-subtle)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!ride) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar />

      {/* Paused Banner */}
      {rideStatus === 'paused' && (
        <div style={{
          backgroundColor: '#854d0e',
          color: '#fef08a',
          padding: '0.5rem 1rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          fontWeight: 600,
          letterSpacing: '0.5px'
        }}>
          TRIP TEMPORARILY PAUSED BY LEADER — LOCATION TRACKING ON HOLD
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Information Panel */}
        <aside style={{
          width: '340px',
          borderRight: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
            <button
              onClick={() => navigate('/home')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '0.75rem' }}
            >
              <ArrowLeft size={14} /> Back to Rides
            </button>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 600 }}>{ride.name}</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Destination: {ride.destination || 'Unspecified'}
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '1rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: '4px',
              border: '1px solid var(--border-color)'
            }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                  Ride Code
                </span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem' }}>{ride.ride_code}</span>
              </div>
              <button
                onClick={copyCode}
                title="Copy Code"
                style={{ background: 'none', border: 'none', color: copied ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer' }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          {/* Members List */}
          <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
              <Users size={14} />
              <span>Participants ({members.length})</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {members.map((m) => {
                const isMemberLeader = m.id === ride.creator_id;
                const isYou = m.id === user.id;
                const isOnline = m.status === 'online';
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: '4px',
                      fontSize: '0.85rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: isOnline ? 'var(--success)' : '#6b7280'
                      }} />
                      <span>{m.name} {isYou && <span style={{ color: 'var(--text-muted)' }}>(You)</span>}</span>
                      {isMemberLeader && (
                        <Crown size={14} color="#eab308" title="Ride Leader" />
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: isOnline ? 'var(--success)' : 'var(--text-muted)' }}>
                      {m.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Footer */}
          <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Leader-only controls */}
            {isLeader ? (
              <>
                {rideStatus === 'paused' ? (
                  <button
                    onClick={() => handleStatusChange('active')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.6rem',
                      backgroundColor: 'var(--primary)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Play size={15} /> Resume Trip
                  </button>
                ) : (
                  <button
                    onClick={() => handleStatusChange('paused')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.6rem',
                      backgroundColor: '#eab308',
                      border: 'none',
                      color: '#000',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Pause size={15} /> Pause Trip
                  </button>
                )}

                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to end this trip for everyone?')) {
                      handleStatusChange('completed');
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.6rem',
                    backgroundColor: 'var(--danger)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Square size={15} /> End Trip
                </button>
              </>
            ) : null}

            {/* Any member can leave session */}
            <button
              onClick={handleLeave}
              style={{
                width: '100%',
                padding: '0.6rem',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                borderRadius: '4px',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Exit Ride Session
            </button>
          </div>
        </aside>

        {/* Live Map Area */}
        <section style={{ flex: 1, position: 'relative' }}>
          <LiveMap myLocation={myLocation} peerLocations={peerLocations} />
        </section>
      </div>
    </div>
  );
}