import React from 'react';
import { Award, CheckCircle, AlertTriangle, ShieldAlert, BarChart3, PieChart, TrendingUp } from 'lucide-react';

/**
 * Score Distribution Histogram Bar Chart (Native SVG)
 */
export function ScoreDistributionChart({ data = {} }) {
  const buckets = [
    { label: '0-20%', count: data['0-20%'] || 0, color: '#f43f5e' },
    { label: '21-40%', count: data['21-40%'] || 0, color: '#fb923c' },
    { label: '41-60%', count: data['41-60%'] || 0, color: '#fbbf24' },
    { label: '61-80%', count: data['61-80%'] || 0, color: '#38bdf8' },
    { label: '81-100%', count: data['81-100%'] || 0, color: '#34d399' }
  ];

  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const totalStudents = buckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <div className="glass-card" style={{ padding: '1.5rem', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <BarChart3 size={18} color="var(--primary)" /> Score Distribution
        </h4>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {totalStudents} Candidates
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {buckets.map((b, idx) => {
          const pctWidth = Math.max((b.count / maxCount) * 100, b.count > 0 ? 8 : 0);
          const share = totalStudents > 0 ? Math.round((b.count / totalStudents) * 100) : 0;
          return (
            <div key={idx}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '600', color: '#e2e8f0' }}>{b.label}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  <strong>{b.count}</strong> students ({share}%)
                </span>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.06)',
                borderRadius: '6px',
                height: '22px',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{
                  width: `${pctWidth}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${b.color}88, ${b.color})`,
                  borderRadius: '6px',
                  transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: b.count > 0 ? `0 0 10px ${b.color}44` : 'none'
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Pass vs Fail vs Terminated Donut Gauge Chart (Native SVG)
 */
export function PassFailDonutChart({ passFail = {} }) {
  const passed = passFail.passed || 0;
  const failed = passFail.failed || 0;
  const terminated = passFail.terminated || 0;
  const total = passed + failed + terminated;

  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  // SVG circle calculations
  const size = 160;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const passOffset = circumference - (passed / (total || 1)) * circumference;
  const failLength = (failed / (total || 1)) * circumference;
  const termLength = (terminated / (total || 1)) * circumference;

  return (
    <div className="glass-card" style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <PieChart size={18} color="var(--emerald)" /> Outcome Breakdown
        </h4>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {total} Total Records
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', flex: 1, flexWrap: 'wrap' }}>
        {/* SVG Donut */}
        <div style={{ position: 'relative', width: `${size}px`, height: `${size}px` }}>
          <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            {/* Background Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth={strokeWidth}
            />
            {/* Passed Arc */}
            {passed > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="#10b981"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={passOffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
            )}
          </svg>

          {/* Centered Percentage Label */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ffffff', lineHeight: 1 }}>
              {passRate}%
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.2rem' }}>
              Pass Rate
            </span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', minWidth: '140px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
              <span>Passed</span>
            </div>
            <strong>{passed}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f43f5e' }} />
              <span>Failed</span>
            </div>
            <strong>{failed}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fbbf24' }} />
              <span>Terminated</span>
            </div>
            <strong style={{ color: terminated > 0 ? '#fbbf24' : 'inherit' }}>{terminated}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Department Comparison Bar Chart (Native SVG)
 */
export function DepartmentComparisonChart({ departments = [] }) {
  if (!departments || departments.length === 0) return null;

  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <TrendingUp size={18} color="var(--primary)" /> Departmental Performance Comparison
        </h4>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {departments.length} Academic Departments
        </span>
      </div>

      <div className="table-responsive">
        <table className="data-table" style={{ width: '100%', fontSize: '0.88rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Department</th>
              <th style={{ textAlign: 'center' }}>Total Candidates</th>
              <th style={{ textAlign: 'left', width: '35%' }}>Average Score (%)</th>
              <th style={{ textAlign: 'center' }}>Pass Percentage</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((dept, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: '600', color: '#f8fafc' }}>
                  🏛️ {dept.department}
                </td>
                <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  {dept.totalCandidates}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '6px',
                      height: '14px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${Math.min(dept.averageScore, 100)}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                        borderRadius: '6px'
                      }} />
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', minWidth: '45px' }}>
                      {dept.averageScore}%
                    </span>
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`badge ${dept.passRate >= 50 ? 'badge-published' : 'badge-draft'}`} style={{ fontWeight: '700' }}>
                    {dept.passRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
