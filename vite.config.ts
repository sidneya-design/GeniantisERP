import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Política de segurança de conteúdo (CSP) do ERP. Entra só no build: em
// `npm run dev` o Vite usa scripts inline (recarregamento rápido) que ela bloquearia.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // atributos style do React e o <style> do logo SVG
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const cspPlugin = (): Plugin => ({
  name: 'geniantis-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
  },
});

export default defineConfig({
  plugins: [react(), cspPlugin()],
  build: {
    outDir: 'dist',
    // Sem mapas de código-fonte em produção (não expõe o código original)
    sourcemap: false,
  },
  server: {
    port: 5173,
    host: true,
  },
});
