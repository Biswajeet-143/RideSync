import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';
import { PlusCircle, LogIn, AlertCircle } from 'lucide-react';

export default function Home() {
  const [createName, setCreateName] = useState('');
  const [createDestination, setCreateDestination] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleCreateRide = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/rides', { name: createName, destination: createDestination });
      navigate(`/ride/${res.data.ride.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not initialize ride session.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRide = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/rides/join', { rideCode: joinCode.trim().toUpperCase() });
      navigate(`/ride/${res.data.ride.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or non-existent ride code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navbar />
      <main style={{ maxWidth: '960px', margin: '3rem auto', padding: '0 1rem' }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 600 }}>Active Ride Management</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Initialize a new coordinate broadcast group or join an active session via code.
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.85rem',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid var(--danger)',
            color: '#fca5a5',
            borderRadius: '6px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Create Ride Form */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '1.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <PlusCircle size={20} color="#3b82f6" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Create New Ride</h2>
            </div>
            <form onSubmit={handleCreateRide} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Ride Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Coastal Route Group"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-main)',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Destination (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sector 5 Hub"
                  value={createDestination}
                  onChange={(e) => setCreateDestination(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-main)',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--primary)',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: '0.5rem'
                }}
              >
                Initialize Ride
              </button>
            </form>
          </div>

          {/* Join Ride Form */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '1.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <LogIn size={20} color="#16a34a" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Join With Code</h2>
            </div>
            <form onSubmit={handleJoinRide} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Ride Access Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RS7K29"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-main)',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ height: '58px' }} /> {/* Spacer to align card buttons */}

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Join Session
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}