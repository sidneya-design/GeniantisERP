// Banners A4 para imprimir: modelo, persistência e o HTML usado tanto na prévia quanto na impressão.
import { supabase } from './supabase';

export interface BannerCard {
  title: string;
  text: string; // uma informação por linha
}

/** Cores (hex) e tamanhos (pt) do banner */
export interface BannerStyle {
  primary: string;      // topo, bordas e títulos dos blocos
  headerText: string;   // textos sobre o topo azul
  cardTitle: string;    // títulos dos blocos
  cardText: string;     // textos dos blocos
  titleSize: number;
  subtitleSize: number;
  introSize: number;
  cardTitleSize: number;
  cardTextSize: number;
}

export const DEFAULT_STYLE: BannerStyle = {
  primary: '#3266C1',
  headerText: '#FFFFFF',
  cardTitle: '#3266C1',
  cardText: '#6F6767',
  titleSize: 27,
  subtitleSize: 13,
  introSize: 10.5,
  cardTitleSize: 13,
  cardTextSize: 10.5,
};

export interface Banner {
  id?: string;
  style?: Partial<BannerStyle>;
  name: string;
  title: string;
  subtitle: string;
  intro: string;
  cards: BannerCard[];
  footer: string;
  show_logo: boolean;
  updated_at?: string;
}

/** Ponto de partida: calendário de fim de ano (textos de exemplo para trocar) */
export const DEFAULT_BANNER: Banner = {
  name: 'Calendário de fim de ano',
  title: 'Calendário final de ano',
  subtitle: 'Olá, Geniantes!',
  intro: 'Confira as datas importantes deste fim de ano e programe-se.',
  cards: [
    { title: '13º Salário', text: '1ª parcela: até 28/11\n2ª parcela: até 19/12' },
    { title: 'Confraternização', text: 'Data: 12/12, a partir das 18h\nLocal: a definir' },
    { title: 'Recesso de fim de ano', text: 'De 24/12 a 01/01\nRetorno das atividades em 02/01' },
    { title: 'Atendimento durante o recesso', text: 'Chamados urgentes pelo WhatsApp da TI' },
    { title: 'Feriados', text: '25/12 — Natal\n01/01 — Confraternização Universal' },
  ],
  footer: '',
  show_logo: true,
};

export const blankBanner = (): Banner => ({
  name: 'Novo banner', title: 'Título do banner', subtitle: '', intro: '',
  cards: [{ title: 'Título do bloco', text: 'Texto do bloco' }], footer: '', show_logo: true,
});

function fail(error: { message: string; code?: string }): never {
  if (/style/.test(error.message) && /column|schema cache/i.test(error.message)) {
    throw new Error('Falta a coluna de cores e tamanhos. Rode a migration 20261116000026_banner_style.sql no Supabase.');
  }
  if (error.code === '42P01' || /does not exist|schema cache/i.test(error.message)) {
    throw new Error('A tabela de banners ainda não existe. Rode a migration 20261116000025_banners.sql no Supabase.');
  }
  if (error.code === '42501') throw new Error('Sem permissão para esta ação.');
  throw new Error(error.message);
}

const mapRow = (row: any): Banner => ({ ...row, cards: Array.isArray(row.cards) ? row.cards : [], style: row.style && typeof row.style === 'object' ? row.style : {} });

export const styleOf = (b: Banner): BannerStyle => ({ ...DEFAULT_STYLE, ...(b.style || {}) });

export async function listBanners(): Promise<Banner[]> {
  const { data, error } = await supabase.from('banners').select('*').order('updated_at', { ascending: false });
  if (error) fail(error);
  return (data || []).map(mapRow);
}

export async function saveBanner(banner: Banner): Promise<Banner> {
  const { data: auth } = await supabase.auth.getUser();
  const payload = {
    name: banner.name.trim() || 'Sem nome',
    title: banner.title,
    subtitle: banner.subtitle,
    intro: banner.intro,
    cards: banner.cards.filter((c) => c.title.trim() || c.text.trim()),
    footer: banner.footer,
    show_logo: banner.show_logo,
    style: banner.style || {},
    updated_by: auth.user?.id || null,
  };
  const query = banner.id
    ? supabase.from('banners').update(payload).eq('id', banner.id)
    : supabase.from('banners').insert(payload);
  const { data, error } = await query.select().single();
  if (error) fail(error);
  return mapRow(data);
}

export async function deleteBanner(id: string): Promise<void> {
  const { error } = await supabase.from('banners').delete().eq('id', id);
  if (error) fail(error);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lines = (s: string) => esc(s).split('\n').map((l) => l.trim()).filter(Boolean).join('<br>');

const HEX = /^#([0-9a-f]{6})$/i;
const safeColor = (c: string | undefined, fallback: string) => (c && HEX.test(c) ? c : fallback);
const safeSize = (n: unknown, fallback: number) => { const v = Number(n); return Number.isFinite(v) && v >= 6 && v <= 72 ? v : fallback; };
/** Mistura a cor com preto (amount < 0) ou branco (amount > 0) */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Página A4 completa (prévia e impressão usam o mesmo HTML) */
export function renderBannerHtml(banner: Banner, origin: string = window.location.origin): string {
  const st = styleOf(banner);
  const primary = safeColor(st.primary, DEFAULT_STYLE.primary);
  const vars = [
    `--primary:${primary}`, `--primary-mid:${shade(primary, -0.1)}`, `--primary-dark:${shade(primary, -0.47)}`,
    `--primary-light:${shade(primary, 0.35)}`, `--primary-lighter:${shade(primary, 0.6)}`,
    `--header-text:${safeColor(st.headerText, DEFAULT_STYLE.headerText)}`,
    `--card-title:${safeColor(st.cardTitle, DEFAULT_STYLE.cardTitle)}`, `--card-text:${safeColor(st.cardText, DEFAULT_STYLE.cardText)}`,
    `--title-size:${safeSize(st.titleSize, DEFAULT_STYLE.titleSize)}pt`, `--subtitle-size:${safeSize(st.subtitleSize, DEFAULT_STYLE.subtitleSize)}pt`,
    `--intro-size:${safeSize(st.introSize, DEFAULT_STYLE.introSize)}pt`, `--card-title-size:${safeSize(st.cardTitleSize, DEFAULT_STYLE.cardTitleSize)}pt`,
    `--card-text-size:${safeSize(st.cardTextSize, DEFAULT_STYLE.cardTextSize)}pt`,
  ].join(';');
  const cards = banner.cards
    .filter((c) => c.title.trim() || c.text.trim())
    .map((c) => `<section class="card"><span class="tag"></span>${c.title.trim() ? `<h2>${esc(c.title)}</h2>` : ''}${c.text.trim() ? `<p>${lines(c.text)}</p>` : ''}</section>`)
    .join('');

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(banner.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: 'Poppins', 'Segoe UI', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: geometricPrecision; }
  .bg path { shape-rendering: geometricPrecision; }
  .page { position: relative; width: 210mm; height: 297mm; overflow: hidden; background: #fff; }
  .bg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .content { position: absolute; inset: 0; padding: 14mm 18mm 50mm; display: flex; flex-direction: column; }
  .hero { color: var(--header-text); text-align: center; padding-top: 2mm; min-height: 50mm; }
  .hero h1 { font-size: var(--title-size); font-weight: 700; margin: 0; letter-spacing: 0; }
  .hero .bar { width: 46mm; height: 1mm; background: var(--header-text); margin: 3mm auto 4mm; border-radius: 1mm; }
  .hero .sub { font-size: var(--subtitle-size); font-weight: 600; margin: 0 0 1.5mm; }
  .hero .intro { font-size: var(--intro-size); margin: 0 auto; max-width: 150mm; opacity: .95; }
  .cards { margin-top: 9mm; display: flex; flex-direction: column; justify-content: center; gap: 5mm; flex: 1; min-height: 0; }
  .card { flex: 1 1 0; min-height: 0; max-height: 46mm; display: flex; flex-direction: column; justify-content: center; position: relative; border: 0.55mm solid var(--primary); border-radius: 7mm 0 7mm 0; padding: 4.5mm 7mm; box-shadow: 0 1mm 1.6mm rgba(20,40,90,.16); background: #fff; }
  .card .tag { position: absolute; top: 3.5mm; right: 4.5mm; width: 5mm; height: 1.3mm; background: var(--primary); }
  .card h2 { color: var(--card-title); font-size: var(--card-title-size); font-weight: 600; margin: 0 0 1.5mm; padding-right: 10mm; }
  .card p { color: var(--card-text); font-size: var(--card-text-size); font-weight: 500; line-height: 1.5; margin: 0; }
  .dense .cards { gap: 3.5mm; }
  .dense .card { padding: 2.5mm 6mm; }
  .dense .card h2 { font-size: calc(var(--card-title-size) * 0.88); margin-bottom: 0.8mm; }
  .dense .card p { font-size: calc(var(--card-text-size) * 0.9); line-height: 1.35; }
  .foot { position: absolute; left: 18mm; right: 18mm; bottom: 14mm; display: flex; align-items: flex-end; justify-content: space-between; gap: 6mm; }
  .foot .note { color: #fff; font-size: 9pt; max-width: 110mm; font-weight: 600; }
  .foot img { height: 10mm; }
</style></head><body>
<div style="${vars}" class="page${banner.cards.filter((c) => c.title.trim() || c.text.trim()).length >= 6 ? ' dense' : ''}">
  <svg class="bg" viewBox="0 0 606 844" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--primary)"/><stop offset="0.6" style="stop-color:var(--primary-mid)"/><stop offset="1" style="stop-color:var(--primary-dark)"/></linearGradient>
      <linearGradient id="f1" x1="-157.676" y1="772.185" x2="904.531" y2="768.81" gradientUnits="userSpaceOnUse"><stop offset="0.13" style="stop-color:var(--primary)"/><stop offset="1" stop-color="#7C657C"/></linearGradient>
      <linearGradient id="f2" x1="903.985" y1="797.817" x2="-158.222" y2="801.192" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:var(--primary-light)"/><stop offset="1" style="stop-color:var(--primary-lighter)"/></linearGradient>
      <linearGradient id="f3" x1="-187.676" y1="803.181" x2="874.531" y2="799.806" gradientUnits="userSpaceOnUse"><stop offset="0.12" style="stop-color:var(--primary-mid)"/><stop offset="1" style="stop-color:var(--primary-mid)"/></linearGradient>
    </defs>
    <path fill="url(#h)" d="M907.108 -11.5979C909.923 14.3304 897.096 40.0657 869.359 64.1388C841.622 88.2119 799.518 110.151 745.451 128.704C691.384 147.257 738.038 177.993 665.873 188.201C588.002 180.5 493.002 156.797 295.002 188.201C180.502 206.362 109.822 197.838 35.5023 188.201C-38.8175 178.565 -50.2404 150.156 -108.288 132.041C-166.336 113.926 -213.167 92.3339 -246.106 68.4979C-279.044 44.662 -297.447 19.0487 -300.262 -6.87956L303.423 -9.23868L907.108 -11.5979Z"/>
    <path fill="url(#f1)" d="M904.854 870.636L-157.353 874.01L-158 670.439C151.649 665.531 168.156 841.493 442 833.485C715.844 825.478 724.213 694.334 904.207 667.065L904.854 870.636Z"/>
    <path fill="url(#f2)" d="M884.516 884.358L-177.691 887.733L-178.337 684.162C131.311 679.254 177.656 838.493 451.5 830.485C725.344 822.478 703.875 708.057 883.87 680.788L884.516 884.358Z"/>
    <path fill="url(#f3)" d="M874.854 901.636L-187.353 905.01L-188 701.439C121.649 696.531 162.656 839.485 436.5 831.477C710.344 823.47 694.213 725.334 874.207 698.065L874.854 901.636Z"/>
  </svg>
  <div class="content">
    <header class="hero">
      <h1>${esc(banner.title)}</h1>
      <div class="bar"></div>
      ${banner.subtitle.trim() ? `<p class="sub">${esc(banner.subtitle)}</p>` : ''}
      ${banner.intro.trim() ? `<p class="intro">${lines(banner.intro)}</p>` : ''}
    </header>
    <main class="cards">${cards}</main>
  </div>
  <div class="foot">
    <div class="note">${banner.footer.trim() ? lines(banner.footer) : ''}</div>
    ${banner.show_logo ? `<img src="${origin}/logo-geniantis.svg" alt="Geniantis">` : ''}
  </div>
</div>
</body></html>`;
}

/** Abre a janela de impressão com o banner */
export function printBanner(banner: Banner): boolean {
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) return false;
  win.document.open();
  win.document.write(renderBannerHtml(banner));
  win.document.close();
  const go = () => { win.focus(); win.print(); };
  // espera o logo carregar para não sair em branco
  const img = win.document.querySelector('img');
  if (img && !(img as HTMLImageElement).complete) img.addEventListener('load', () => setTimeout(go, 150));
  else setTimeout(go, 400);
  return true;
}
