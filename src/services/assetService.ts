import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Asset } from '../types/asset';

const STORAGE_KEY = 'geniantis_assets';

const DEMO_ASSETS: Asset[] = [];

function mapRow(row: any): Asset {
  const employee = Array.isArray(row.employee) ? row.employee[0] : row.employee;
  return {
    id: row.id,
    patrimony: row.patrimony,
    serial_number: row.serial_number || undefined,
    category: row.category,
    brand: row.brand || undefined,
    model: row.model || undefined,
    unit: row.unit_name,
    condition: row.condition,
    status: row.status,
    assigned_employee_id: row.assigned_employee_id || null,
    assigned_to: employee?.preferential_name || employee?.full_name || null,
    warranty_until: row.warranty_until || null,
    acquisition_date: row.acquisition_date || null,
    purchase_cost: row.purchase_cost || null,
    notes: row.notes || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const AssetService = {
  async getAssets(): Promise<Asset[]> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_ASSETS));
      return [...DEMO_ASSETS];
    }

    const { data, error } = await supabase
      .from('assets')
      .select('*, employee:employees(id, full_name, preferential_name)')
      .order('patrimony', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapRow);
  },

  async saveAsset(asset: Omit<Asset, 'id' | 'created_at' | 'updated_at' | 'assigned_to'> & { id?: string }): Promise<Asset> {
    const payload = {
      ...(asset.id ? { id: asset.id } : {}),
      patrimony: asset.patrimony,
      serial_number: asset.serial_number || null,
      category: asset.category,
      brand: asset.brand || null,
      model: asset.model || null,
      unit_name: asset.unit,
      condition: asset.condition,
      status: asset.status,
      assigned_employee_id: asset.assigned_employee_id || null,
      warranty_until: asset.warranty_until || null,
      acquisition_date: asset.acquisition_date || null,
      purchase_cost: asset.purchase_cost ?? null,
      notes: asset.notes || null,
    };

    if (!isSupabaseConfigured) {
      const assets = await this.getAssets();
      const now = new Date().toISOString();
      const saved: Asset = {
        ...asset,
        id: asset.id || `asset-${Date.now()}`,
        created_at: now,
        updated_at: now,
      };
      const next = asset.id ? assets.map((item) => item.id === asset.id ? { ...item, ...saved } : item) : [...assets, saved];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return saved;
    }

    const query = asset.id
      ? supabase.from('assets').update(payload).eq('id', asset.id)
      : supabase.from('assets').insert(payload);
    const { data, error } = await query.select('*, employee:employees(id, full_name, preferential_name)').single();

    if (error) throw error;
    return mapRow(data);
  },
};
