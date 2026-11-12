// Nomes de exibição dos códigos de ativos (categoria, situação, condição)
export const ASSET_CATEGORY_LABEL: Record<string, string> = {
  notebook: 'Notebook',
  desktop: 'Desktop',
  monitor: 'Monitor',
  celular: 'Celular / Tablet',
  rede: 'Equipamento de rede',
  perifericos: 'Periférico',
};

export const ASSET_STATUS_LABEL: Record<string, string> = {
  disponivel: 'Disponível',
  em_uso: 'Em uso',
  em_manutencao: 'Em manutenção',
  baixado: 'Baixado',
};

export const categoryLabel = (code: string) => ASSET_CATEGORY_LABEL[code] || code;
