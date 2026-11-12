import React from 'react';
import logoSvg from '../../assets/logo-geniantis.svg?raw';

// Logo embutido como SVG inline (e não <img>): o navegador desenha os vetores
// direto na posição final, sem rasterizar e reposicionar em meio pixel — o que
// deixava as letras finas de "Inteligência Coletiva" tremidas.
const markup = logoSvg
  .replace(/<\?xml[^>]*\?>/, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(
    '<svg ',
    '<svg width="100%" shape-rendering="geometricPrecision" role="img" aria-label="Geniantis — Inteligência Coletiva" style="display:block;height:auto" '
  );

export const LogoGeniantis: React.FC<{ className?: string }> = ({ className }) => (
  <div className={className} dangerouslySetInnerHTML={{ __html: markup }} />
);
