import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Asset } from '../types/asset';
import { Maintenance, MaintenanceStatus } from '../types/maintenance';
import { AssetService } from './assetService';

const STORAGE_KEY = 'geniantis_maintenances';
const INVOICES_BUCKET = 'maintenance-invoices';

type SaveMaintenanceInput = {
  asset_id: string;
  issue: string;
  opened_at: string;
  forecast_date?: string | null;
  provider?: string | null;
  cost?: number | null;
  notes?: string | null;
  invoice_file_path?: string | null;
  invoice_file_name?: string | null;
};

function getEquipment(asset: Asset) {
  return [asset.brand, asset.model].filter(Boolean).join(' ') || asset.category;
}

function mapRow(row: any): Maintenance {
  const asset = Array.isArray(row.asset) ? row.asset[0] : row.asset;
  return {
    id: row.id,
    asset_id: row.asset_id,
    patrimony: asset?.patrimony || row.patrimony || row.asset_id,
    equipment: asset ? getEquipment(asset) : row.equipment || 'Equipamento não identificado',
    issue: row.issue,
    opened_at: row.opened_at,
    provider: row.provider || null,
    status: row.status,
    forecast_date: row.forecast_date || null,
    completed_at: row.completed_at || null,
    cost: row.cost === null || row.cost === undefined ? null : Number(row.cost),
    invoice_file_path: row.invoice_file_path || null,
    invoice_file_name: row.invoice_file_name || null,
    notes: row.notes || null,
    custody_note: row.custody_note || null,
    created_at: row.created_at,
  };
}

export const MaintenanceService = {
  async uploadInvoice(file: File): Promise<{ path: string; name: string }> {
    if (!isSupabaseConfigured) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Não foi possível ler a nota fiscal.'));
        reader.readAsDataURL(file);
      });
      return { path: dataUrl, name: file.name };
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from(INVOICES_BUCKET).upload(path, file, {
      contentType: 'application/pdf',
      upsert: false,
    });
    if (error) throw new Error(`Não foi possível carregar a nota fiscal: ${error.message}`);
    return { path, name: file.name };
  },

  async getInvoiceUrl(path: string): Promise<string> {
    if (path.startsWith('data:')) return path;
    const { data, error } = await supabase.storage.from(INVOICES_BUCKET).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) throw new Error(error?.message || 'Não foi possível abrir a nota fiscal.');
    return data.signedUrl;
  },

  async getMaintenances(): Promise<Maintenance[]> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) as Maintenance[] : [];
    }

    const { data, error } = await supabase
      .from('maintenance_orders')
      .select('*, asset:assets(id, patrimony, category, brand, model)')
      .order('opened_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapRow);
  },

  async saveMaintenance(input: SaveMaintenanceInput): Promise<Maintenance> {
    if (!input.asset_id || !input.issue.trim()) throw new Error('Selecione um ativo e informe o defeito relatado.');

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('register_maintenance', {
        p_asset_id: input.asset_id,
        p_issue: input.issue.trim(),
        p_opened_at: input.opened_at,
        p_forecast_date: input.forecast_date || null,
        p_provider: input.provider || null,
        p_cost: input.cost ?? null,
        p_notes: input.notes || null,
        p_invoice_file_path: input.invoice_file_path || null,
        p_invoice_file_name: input.invoice_file_name || null,
      });
      if (error) throw error;
      const rows = await this.getMaintenances();
      const saved = rows.find((item) => item.id === data);
      if (!saved) throw new Error('Chamado salvo, mas não foi possível carregá-lo.');
      return saved;
    }

    const [assets, maintenances] = await Promise.all([AssetService.getAssets(), this.getMaintenances()]);
    const asset = assets.find((item) => item.id === input.asset_id);
    if (!asset) throw new Error('Ativo não encontrado.');
    if (asset.status === 'baixado' || asset.status === 'em_manutencao') throw new Error('Este ativo não pode receber um novo chamado agora.');

    await AssetService.saveAsset({
      id: asset.id,
      patrimony: asset.patrimony,
      serial_number: asset.serial_number,
      category: asset.category,
      brand: asset.brand,
      model: asset.model,
      unit: asset.unit,
      condition: asset.condition,
      status: 'em_manutencao',
      assigned_employee_id: asset.assigned_employee_id,
      warranty_until: asset.warranty_until,
      acquisition_date: asset.acquisition_date,
      purchase_cost: asset.purchase_cost,
      notes: asset.notes,
    });

    const saved: Maintenance = {
      id: `maintenance-${Date.now()}`,
      asset_id: asset.id,
      patrimony: asset.patrimony,
      equipment: getEquipment(asset),
      issue: input.issue.trim(),
      opened_at: input.opened_at,
      provider: input.provider || null,
      status: 'em_andamento',
      forecast_date: input.forecast_date || null,
      completed_at: null,
      cost: input.cost ?? null,
      invoice_file_path: input.invoice_file_path || null,
      invoice_file_name: input.invoice_file_name || null,
      notes: input.notes || null,
      custody_note: asset.assigned_employee_id ? 'Vínculo com o responsável preservado durante o reparo.' : 'Equipamento retirado do estoque para manutenção.',
      created_at: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([saved, ...maintenances]));
    return saved;
  },

  async updateStatus(id: string, status: MaintenanceStatus, completion?: { invoice_file_path?: string | null; invoice_file_name?: string | null; cost?: number | null; notes?: string | null }): Promise<Maintenance> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('update_maintenance_status', {
        p_maintenance_id: id,
        p_status: status,
        p_invoice_file_path: completion?.invoice_file_path || null,
        p_invoice_file_name: completion?.invoice_file_name || null,
        p_cost: completion?.cost ?? null,
        p_notes: completion?.notes || null,
      });
      if (error) throw error;
      const rows = await this.getMaintenances();
      const updated = rows.find((item) => item.id === (data || id));
      if (!updated) throw new Error('Status atualizado, mas não foi possível carregar o chamado.');
      return updated;
    }

    const [assets, maintenances] = await Promise.all([AssetService.getAssets(), this.getMaintenances()]);
    const index = maintenances.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Chamado de manutenção não encontrado.');
    const current = maintenances[index];
    const asset = assets.find((item) => item.id === current.asset_id);
    if (!asset) throw new Error('Ativo do chamado não encontrado.');

    const finalStatus = status === 'em_andamento' ? 'em_manutencao' : status === 'baixado' ? 'baixado' : 'disponivel';
    await AssetService.saveAsset({
      id: asset.id,
      patrimony: asset.patrimony,
      serial_number: asset.serial_number,
      category: asset.category,
      brand: asset.brand,
      model: asset.model,
      unit: asset.unit,
      condition: asset.condition,
      status: finalStatus,
      assigned_employee_id: status === 'em_andamento' ? asset.assigned_employee_id : null,
      warranty_until: asset.warranty_until,
      acquisition_date: asset.acquisition_date,
      purchase_cost: asset.purchase_cost,
      notes: asset.notes,
    });

    const updated = {
      ...current,
      status,
      completed_at: status === 'em_andamento' ? null : new Date().toISOString().slice(0, 10),
      invoice_file_path: completion?.invoice_file_path || current.invoice_file_path || null,
      invoice_file_name: completion?.invoice_file_name || current.invoice_file_name || null,
      cost: completion?.cost ?? current.cost ?? null,
      notes: completion?.notes || current.notes || null,
    };
    maintenances[index] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(maintenances));
    return updated;
  },
};
