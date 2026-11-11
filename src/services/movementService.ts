import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Asset } from '../types/asset';
import { Employee } from '../types/employee';
import { Movement, MovementTermStatus, MovementType } from '../types/movement';
import { AssetService } from './assetService';
import { EmployeeService } from './employeeService';

const STORAGE_KEY = 'geniantis_asset_movements';
const TERMS_BUCKET = 'asset-terms';

type SaveMovementInput = {
  employee_id: string;
  type: MovementType;
  asset_ids: string[];
  movement_date: string;
  term_status: MovementTermStatus;
  notes?: string | null;
  term_file_path?: string | null;
  term_file_name?: string | null;
};

function getAssetDescription(asset: Asset) {
  return [asset.brand, asset.model].filter(Boolean).join(' ') || asset.category;
}

function mapRow(row: any): Movement {
  const items = (row.asset_movement_items || []).map((item: any) => {
    const asset = Array.isArray(item.asset) ? item.asset[0] : item.asset;
    return {
      id: item.asset_id,
      patrimony: asset?.patrimony || item.asset_id,
      description: asset ? getAssetDescription(asset) : undefined,
    };
  });

  const employee = Array.isArray(row.employee) ? row.employee[0] : row.employee;

  return {
    id: row.id,
    employee_id: row.employee_id,
    employee_name: employee?.preferential_name || employee?.full_name || row.employee_name || 'Funcionário não identificado',
    type: row.type,
    asset_ids: items.map((item: { id: string }) => item.id),
    items,
    movement_date: row.movement_date,
    term_status: row.term_status,
    notes: row.notes || null,
    term_file_path: row.term_file_path || null,
    term_file_name: row.term_file_name || null,
    user_in_charge: row.user_in_charge || null,
    created_at: row.created_at,
  };
}

export const MovementService = {
  async uploadTerm(file: File): Promise<{ path: string; name: string }> {
    if (!isSupabaseConfigured) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Não foi possível ler o PDF selecionado.'));
        reader.readAsDataURL(file);
      });
      return { path: dataUrl, name: file.name };
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from(TERMS_BUCKET).upload(path, file, {
      contentType: 'application/pdf',
      upsert: false,
    });
    if (error) throw new Error(`Não foi possível carregar o PDF: ${error.message}`);
    return { path, name: file.name };
  },

  async getTermUrl(path: string): Promise<string> {
    if (path.startsWith('data:')) return path;
    const { data, error } = await supabase.storage.from(TERMS_BUCKET).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) throw new Error(error?.message || 'Não foi possível abrir o PDF.');
    return data.signedUrl;
  },

  async getMovements(): Promise<Movement[]> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) as Movement[] : [];
    }

    const { data, error } = await supabase
      .from('asset_movements')
      .select('*, employee:employees(id, full_name, preferential_name), asset_movement_items(asset_id, asset:assets(id, patrimony, category, brand, model))')
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRow);
  },

  async saveMovement(input: SaveMovementInput): Promise<Movement> {
    if (!input.employee_id || input.asset_ids.length === 0) {
      throw new Error('Selecione um funcionário e ao menos um ativo.');
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('register_asset_movement', {
        p_employee_id: input.employee_id,
        p_type: input.type,
        p_asset_ids: input.asset_ids,
        p_movement_date: input.movement_date,
        p_term_status: input.term_status,
        p_notes: input.notes || null,
        p_term_file_path: input.term_file_path || null,
        p_term_file_name: input.term_file_name || null,
      });

      if (error) throw error;
      const movements = await this.getMovements();
      const saved = movements.find((movement) => movement.id === data);
      if (!saved) throw new Error('Movimentação salva, mas não foi possível carregá-la.');
      return saved;
    }

    const [assets, employees, movements] = await Promise.all([
      AssetService.getAssets(),
      EmployeeService.getEmployees(),
      this.getMovements(),
    ]);
    const employee = employees.find((item) => item.id === input.employee_id);
    if (!employee) throw new Error('Funcionário não encontrado.');
    if (input.type === 'entrega' && employee.status === 'desligado') {
      throw new Error('Não é possível entregar ativos a um funcionário desligado.');
    }

    const selectedAssets = input.asset_ids.map((id) => assets.find((asset) => asset.id === id));
    if (selectedAssets.some((asset) => !asset)) throw new Error('Um ou mais ativos não foram encontrados.');

    const validAssets = selectedAssets as Asset[];
    if (input.type === 'entrega' && validAssets.some((asset) => String(asset.status).toLowerCase() !== 'disponivel')) {
      throw new Error('A entrega só pode utilizar ativos disponíveis.');
    }
    if (input.type === 'devolucao' && validAssets.some((asset) => asset.assigned_employee_id !== input.employee_id || asset.status !== 'em_uso')) {
      throw new Error('A devolução só pode utilizar ativos atualmente vinculados ao funcionário selecionado.');
    }

    for (const asset of validAssets) {
      await AssetService.saveAsset({
        id: asset.id,
        patrimony: asset.patrimony,
        serial_number: asset.serial_number,
        category: asset.category,
        brand: asset.brand,
        model: asset.model,
        unit: asset.unit,
        condition: asset.condition,
        status: input.type === 'entrega' ? 'em_uso' : 'disponivel',
        assigned_employee_id: input.type === 'entrega' ? input.employee_id : null,
        warranty_until: asset.warranty_until,
        acquisition_date: asset.acquisition_date,
        purchase_cost: asset.purchase_cost,
        notes: asset.notes,
      });
    }

    const now = new Date().toISOString();
    const saved: Movement = {
      id: `movement-${Date.now()}`,
      employee_id: employee.id,
      employee_name: employee.preferential_name || employee.full_name,
      type: input.type,
      asset_ids: validAssets.map((asset) => asset.id),
      items: validAssets.map((asset) => ({ id: asset.id, patrimony: asset.patrimony, description: getAssetDescription(asset) })),
      movement_date: input.movement_date,
      term_status: input.term_status,
      notes: input.notes || null,
      term_file_path: input.term_file_path || null,
      term_file_name: input.term_file_name || null,
      user_in_charge: null,
      created_at: now,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([saved, ...movements]));
    return saved;
  },
};
