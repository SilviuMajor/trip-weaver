import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

/* ---- Mock data ---- */
const mockEntries = [
  { time: '09:00 – 10:30', name: 'Anne Frank House', category: '🏛 Museum', color: '#6366f1' },
  { time: '12:00 – 13:30', name: 'Foodhallen', category: '🍴 Food', color: '#f97316' },
  { time: '15:00 – 17:00', name: 'Vondelpark', category: '☀️ Chill', color: '#22c55e' },
];

const travelSegment = { duration: '12 min', mode: '🚶 Walk', distance: '0.9 km' };

/* ============ STYLE A — CLEAN & MINIMAL ============ */
const CleanMinimal = () => (
  <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
    <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-neutral-400">Clean & Minimal</h3>
    <p className="mb-5 text-sm text-neutral-500">Apple Calendar style — whitespace, thin borders, system fonts</p>

    {/* Day header */}
    <div className="mb-4 border-b border-neutral-100 pb-2">
      <p className="text-sm font-medium text-neutral-800">Friday, 14 March</p>
    </div>

    <div className="space-y-2">
      {mockEntries.map((e, i) => (
        <div key={i}>
          <div className="flex items-start gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-900">{e.name}</p>
              <p className="text-xs text-neutral-400">{e.time}</p>
            </div>
            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
              {e.category.split(' ')[1]}
            </span>
          </div>

          {/* Travel segment between entries */}
          {i < mockEntries.length - 1 && (
            <div className="ml-4 flex items-center gap-2 py-1.5">
              <div className="h-4 w-px bg-neutral-200" />
              <p className="text-[10px] text-neutral-400">{travelSegment.mode} · {travelSegment.duration}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

/* ============ STYLE B — COLOURFUL & PLAYFUL ============ */
const ColourfulPlayful = () => (
  <div className="rounded-3xl bg-amber-50 p-5" style={{ fontFamily: '"DM Sans", sans-serif' }}>
    <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-amber-600">Colourful & Playful</h3>
    <p className="mb-5 text-sm text-amber-700/70">Bold colours, big emojis, rounded shapes, warm palette</p>

    {/* Day header */}
    <div className="mb-4 flex items-center gap-2">
      <span className="text-2xl">🌤</span>
      <div>
        <p className="font-bold text-amber-900">Friday, 14 March</p>
        <p className="text-xs text-amber-600">3 activities planned</p>
      </div>
    </div>

    <div className="space-y-3">
      {mockEntries.map((e, i) => (
        <div key={i}>
          <div
            className="rounded-2xl p-4 shadow-md"
            style={{
              backgroundColor: e.color + '18',
              borderLeft: `4px solid ${e.color}`,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{e.category.split(' ')[0]}</span>
              <div>
                <p className="font-bold text-neutral-900">{e.name}</p>
                <p className="text-xs font-medium" style={{ color: e.color }}>{e.time}</p>
              </div>
            </div>
          </div>

          {i < mockEntries.length - 1 && (
            <div className="ml-6 flex items-center gap-2 py-2">
              <span className="text-sm">🚶</span>
              <div className="flex-1 border-t-2 border-dashed border-amber-300" />
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                {travelSegment.duration}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

/* ============ STYLE C — DARK & MODERN ============ */
const DarkModern = () => (
  <div className="rounded-2xl bg-neutral-900 p-5" style={{ fontFamily: '"DM Sans", sans-serif' }}>
    <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-neutral-500">Dark & Modern</h3>
    <p className="mb-5 text-sm text-neutral-600">Glassmorphism, subtle gradients, neon accents</p>

    {/* Day header */}
    <div className="mb-4 border-b border-neutral-800 pb-2">
      <p className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-sm font-bold text-transparent">
        Friday, 14 March
      </p>
    </div>

    <div className="space-y-3">
      {mockEntries.map((e, i) => (
        <div key={i}>
          <div
            className="rounded-xl border border-neutral-800 p-4"
            style={{
              background: `linear-gradient(135deg, ${e.color}12 0%, transparent 60%)`,
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-neutral-100">{e.name}</p>
                <p className="text-xs text-neutral-500">{e.time}</p>
              </div>
              <span
                className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  color: e.color,
                  backgroundColor: e.color + '20',
                  border: `1px solid ${e.color}40`,
                }}
              >
                {e.category.split(' ')[1]}
              </span>
            </div>
          </div>

          {i < mockEntries.length - 1 && (
            <div className="ml-4 flex items-center gap-2 py-1.5">
              <div className="h-4 w-px bg-neutral-800" />
              <p className="text-[10px] text-neutral-600">{travelSegment.mode} · {travelSegment.duration}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

/* ============ SHOWCASE PAGE ============ */
const StyleShowcase = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: '"Playfair Display", serif' }}>
              Choose a Style
            </h1>
            <p className="text-sm text-neutral-500">Pick the visual direction for your timeline</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          <CleanMinimal />
          <ColourfulPlayful />
          <DarkModern />
        </div>

        <p className="mt-8 text-center text-sm text-neutral-500">
          Tell me which style you prefer (A, B, or C) and I'll apply it to your app!
        </p>
      </main>
    </div>
  );
};

export default StyleShowcase;
