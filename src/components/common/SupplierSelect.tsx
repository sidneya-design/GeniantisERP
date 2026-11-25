import React, { useEffect, useState } from 'react';
import { SupplierService } from '../../services/supplierService';
import { Supplier } from '../../types/supplier';

const NEW = '__novo__';

/**
 * Lista de fornecedores cadastrados. O valor é o NOME do fornecedor (campo "provider");
 * o banco liga o registro ao cadastro pelo nome e cria o fornecedor se ele não existir.
 */
export const SupplierSelect: React.FC<{
  value: string | null | undefined;
  onChange: (name: string) => void;
  className?: string;
}> = ({ value, onChange, className }) => {
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    SupplierService.list()
      .then(setSuppliers)
      .catch(() => setFailed(true));
  }, []);

  // Sem acesso ao cadastro (ou migration não aplicada): mantém o campo de texto
  if (failed) {
    return <input value={value || ''} onChange={(e) => onChange(e.target.value)} className={className} />;
  }

  const current = (value || '').trim();
  const options = (suppliers || []).filter((s) => s.status === 'ativo' || s.name.toLowerCase() === current.toLowerCase());
  const known = options.some((s) => s.name.toLowerCase() === current.toLowerCase());

  return (
    <select
      value={known ? options.find((s) => s.name.toLowerCase() === current.toLowerCase())!.name : current}
      onChange={(e) => {
        if (e.target.value !== NEW) {
          onChange(e.target.value);
          return;
        }
        const name = window.prompt('Nome do novo fornecedor:')?.trim();
        if (name) onChange(name);
      }}
      className={className}
      disabled={!suppliers}
    >
      <option value="">{suppliers ? 'Nenhum' : 'Carregando...'}</option>
      {options.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
      {current && !known && <option value={current}>{current} (novo)</option>}
      <option value={NEW}>+ Cadastrar novo fornecedor…</option>
    </select>
  );
};
