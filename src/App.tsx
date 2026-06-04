import { useState } from 'react';
import SquadPage from './pages/SquadPage';
import SettingsPage from './pages/SettingsPage';

type Page = 'squad' | 'settings';

function App() {
  const [page, setPage] = useState<Page>('squad');

  return (
    <div style={{
      background: 'transparent',
      color: 'var(--text-primary)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Header — 罗德岛风格顶栏 */}
      <header style={{
        width: '100%', maxWidth: 1120, padding: '24px 20px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* 罗德岛双层菱形标志 */}
          <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
            {/* 外层菱形 — 青绿渐变边框 */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, #0d9488, #2dd4bf)',
              borderRadius: 8, transform: 'rotate(45deg)',
              boxShadow: '0 0 20px rgba(45, 212, 191, 0.3), 0 0 40px rgba(45, 212, 191, 0.1)',
            }} />
            {/* 内层菱形 — 深色镂空 */}
            <div style={{
              position: 'absolute', inset: 3,
              background: '#0a0a0f',
              borderRadius: 6, transform: 'rotate(45deg)',
            }} />
            {/* R 字母 */}
            <span style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, color: '#2dd4bf',
              fontFamily: 'var(--font-mono)',
              textShadow: '0 0 8px rgba(45,212,191,0.4)',
            }}>R</span>
          </div>

          {/* 标题区 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                fontSize: 24, fontWeight: 800, letterSpacing: 2,
                background: 'linear-gradient(135deg, #2dd4bf, #0d9488)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>AK</span>
              <span style={{ color: 'var(--border)', fontWeight: 300, fontSize: 22 }}>:</span>
              <span style={{
                fontSize: 14, fontWeight: 500, letterSpacing: 3,
                color: 'var(--text-secondary)',
              }}>CHALLENGE // BUILDER</span>
            </div>
            <div style={{
              fontSize: 12, fontWeight: 500, letterSpacing: 1.5,
              color: 'rgba(45,212,191,0.35)', marginTop: 3,
            }}>
              RHODES ISLAND · 自限规则器
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* 创作人 */}
          <div style={{
            fontSize: 12, fontWeight: 500, letterSpacing: 0.5,
            color: 'rgba(45,212,191,0.35)',
            borderRight: '1px solid rgba(48,54,80,0.4)',
            paddingRight: 16, lineHeight: 1.6,
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>创作人</span>
              bilibili@STA-是她
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', marginRight: 4, visibility: 'hidden' }}>创作人</span>
              github@STA-running
            </div>
          </div>

          <nav style={{
          display: 'flex', gap: 2,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 8, padding: 3,
          backdropFilter: 'blur(8px)',
        }}>
          {(['squad', 'settings'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                background: page === p
                  ? 'linear-gradient(135deg, #0d9488, #2dd4bf)'
                  : 'transparent',
                color: page === p ? '#fff' : 'var(--text-muted)',
                border: 'none', padding: '7px 18px', borderRadius: 6,
                cursor: 'pointer', fontSize: 15, fontWeight: page === p ? 600 : 400,
                letterSpacing: '0.3px',
              }}
            >
              {p === 'squad' ? '编队' : '设置'}
            </button>
          ))}
        </nav>
        </div>
      </header>

      {/* 分隔线 */}
      <div style={{
        width: '100%', maxWidth: 1080,
        height: 1,
        background: 'linear-gradient(90deg, transparent, var(--border-accent), transparent)',
        marginBottom: 10,
      }} />

      {/* Main */}
      <main style={{ width: '100%', maxWidth: 1120, padding: '12px 20px 20px' }}>
        {page === 'squad' ? <SquadPage /> : <SettingsPage />}
      </main>
    </div>
  );
}

export default App;
