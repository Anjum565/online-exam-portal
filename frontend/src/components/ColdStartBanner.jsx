import React, { useState, useEffect } from 'react';
import { Server, AlertTriangle } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (
  typeof window !== 'undefined'
    ? `${window.location.origin}/api`
    : 'http://localhost:5000/api'
);

export default function ColdStartBanner() {
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [backendReady, setBackendReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkBackend = async () => {
      try {
        const startTime = Date.now();
        const res = await axios.get(`${API_BASE_URL}/health`, { timeout: 4000 });
        if (isMounted && res.data.status === 'ok') {
          setBackendReady(true);
          setIsWakingUp(false);
        }
      } catch (err) {
        if (isMounted) {
          setIsWakingUp(true);
          // Ping again in 3 seconds until awake
          setTimeout(checkBackend, 3000);
        }
      }
    };

    checkBackend();
    return () => { isMounted = false; };
  }, []);

  if (backendReady || !isWakingUp) return null;

  return (
    <div style={{
      background: 'linear-gradient(90deg, #9333ea, #6366f1)',
      color: '#ffffff',
      padding: '0.6rem 1rem',
      fontSize: '0.875rem',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
    }}>
      <Server className="pulse" size={18} />
      <span>
        <strong>Free-Tier Hosting Notice:</strong> The cloud backend server is warming up from sleep (Render free tier limit). Please wait ~15 seconds...
      </span>
    </div>
  );
}
