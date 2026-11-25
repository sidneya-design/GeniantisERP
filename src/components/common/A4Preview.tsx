import React, { useEffect, useRef, useState } from 'react';

// Folha A4 em pixels CSS (96 dpi): a prévia renderiza neste tamanho e é reduzida por escala
export const A4_W = 794;
export const A4_H = 1123;

/**
 * Prévia A4 que se ajusta à largura disponível, sem depender de script dentro do iframe.
 * scroll = documentos que podem passar de uma página (rolam dentro da folha).
 */
export const A4Preview: React.FC<{ html: string; title?: string; scroll?: boolean }> = ({ html, title = 'Prévia', scroll = false }) => {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / A4_W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="relative w-full overflow-hidden rounded bg-white shadow-md" style={{ height: A4_H * scale }}>
      <iframe
        title={title}
        srcDoc={html}
        scrolling={scroll ? 'auto' : 'no'}
        sandbox="allow-same-origin"
        style={{ width: A4_W, height: A4_H, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'absolute', top: 0, left: 0 }}
      />
    </div>
  );
};
