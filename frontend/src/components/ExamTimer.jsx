import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';

export default function ExamTimer({ endTime, onTimeExpire }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
        if (onTimeExpire) onTimeExpire();
      } else {
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds, isExpired: false });
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [endTime, onTimeExpire]);

  if (!timeLeft) return null;

  const isUrgent = !timeLeft.isExpired && timeLeft.hours === 0 && timeLeft.minutes < 10;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.6rem',
      padding: '0.6rem 1.2rem',
      borderRadius: '12px',
      background: timeLeft.isExpired
        ? 'rgba(244, 63, 94, 0.15)'
        : isUrgent ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.15)',
      border: `1px solid ${
        timeLeft.isExpired
          ? 'rgba(244, 63, 94, 0.4)'
          : isUrgent ? 'rgba(245, 158, 11, 0.4)' : 'rgba(99, 102, 241, 0.4)'
      }`,
      color: timeLeft.isExpired ? '#f43f5e' : isUrgent ? '#f59e0b' : '#818cf8',
      fontFamily: 'monospace',
      fontSize: '1.1rem',
      fontWeight: '700'
    }}>
      {timeLeft.isExpired ? (
        <>
          <AlertCircle size={20} />
          <span>EXAM TIME EXPIRED (AUTO-LOCKED)</span>
        </>
      ) : (
        <>
          <Clock size={20} className={isUrgent ? 'pulse' : ''} />
          <span>
            {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-muted)' }}>REMAINING</span>
        </>
      )}
    </div>
  );
}
