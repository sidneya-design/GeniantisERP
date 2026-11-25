// Nomes de exibição dos códigos de ativos (categoria, situação, condição)
export const ASSET_CATEGORY_LABEL: Record<string, string> = {
  notebook: 'Notebook',
  desktop: 'Desktop',
  monitor: 'Monitor',
  celular: 'Celular / Tablet',
  servidor: 'Servidor',
  impressora: 'Impressora',
  rede: 'Equipamento de rede',
  perifericos: 'Periférico',
};

export const ASSET_STATUS_LABEL: Record<string, string> = {
  disponivel: 'Disponível',
  em_uso: 'Em uso',
  em_manutencao: 'Em manutenção',
  baixado: 'Baixado',
};

/** Categorias que têm dados de computador (SO, memória, processador, hostname) */
export const COMPUTER_CATEGORIES = ['notebook', 'desktop', 'servidor'];
export const isComputer = (category: string) => COMPUTER_CATEGORIES.includes(category);

/** Sugestões do campo Sistema Operacional */
export const OS_SUGGESTIONS = ['Windows 11 Pro', 'Windows 11 Home', 'Windows 10 Pro', 'Windows 10 Home', 'macOS', 'Ubuntu', 'Linux', 'ChromeOS'];

export const categoryLabel = (code: string) => ASSET_CATEGORY_LABEL[code] || code;
