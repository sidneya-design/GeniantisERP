import React from 'react';

const COLORS = ['bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-amber-500', 'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600'];

function initials(name?: string | null, email?: string | null) {
  const base = (name || email || '?').trim();
  const parts = base.split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

function colorFor(text: string) {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export const Avatar: React.FC<{
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
}> = ({ src, name, email, size = 36, className = '' }) => {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || email || 'Foto do usuário'}
        onError={() => setFailed(true)}
        style={style}
        className={`rounded-full object-cover shrink-0 bg-slate-100 ${className}`}
      />
    );
  }
  return (
    <div
      style={style}
      className={`rounded-full shrink-0 flex items-center justify-center text-white font-bold select-none ${colorFor(email || name || '')} ${className}`}
      aria-label={name || email || 'Usuário'}
    >
      {initials(name, email)}
    </div>
  );
};
