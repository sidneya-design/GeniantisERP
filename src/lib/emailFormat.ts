/**
 * Texto simples digitado no ERP → HTML de e-mail (estilos inline, que é o que os
 * clientes de e-mail respeitam).
 *   linha em branco  → novo parágrafo
 *   ## Título        → subtítulo
 *   - item           → lista
 *   **texto**        → negrito
 *   links http(s)    → clicáveis
 * {{nome}} e {{nome_completo}} ficam no HTML e são trocados no envio, pessoa a pessoa.
 */

const escape = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(text: string): string {
  return escape(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" style="color:#2563eb">$1</a>');
}

export function textToEmailHtml(text: string): string {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block) => {
    if (block.startsWith('## ')) {
      return `<h3 style="margin:20px 0 8px;font-size:16px;color:#0f172a">${inline(block.slice(3))}</h3>`;
    }
    const lines = block.split('\n');
    if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
      const items = lines.map((l) => `<li style="margin:2px 0">${inline(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('');
      return `<ul style="margin:0 0 14px;padding-left:20px">${items}</ul>`;
    }
    return `<p style="margin:0 0 14px">${lines.map(inline).join('<br>')}</p>`;
  }).join('');
}

/** Prévia no navegador: troca {{nome}} como o servidor fará */
export function personalizeHtml(html: string, fullName: string): string {
  const name = fullName.trim();
  const first = name.split(/\s+/)[0] || name;
  return html
    .replace(/{{\s*nome\s*}}/g, escape(first))
    .replace(/{{\s*nome_completo\s*}}/g, escape(name));
}

export function signatureHtml(signature: string): string {
  return signature
    ? `<p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #e2e8f0;color:#475569;font-size:13px">${escape(signature).replace(/\n/g, '<br>')}</p>`
    : '';
}
