import React, { useEffect, useState } from 'react';
import { Camera, CheckCircle2, FileText, Loader2, Mail, Printer, RotateCcw, Upload, X } from 'lucide-react';
import { Employee } from '../../types/employee';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../common/ConfirmDialog';
import { loadTermTemplates, renderTermHtml } from '../../lib/termTemplate';
import { IMAGE_STATUS_CLS, IMAGE_STATUS_LABEL, ImageTerm, ImageTermService, ImageTermStatus } from '../../services/imageTermService';
import { EmailService } from '../../services/emailService';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const dateBR = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR');

/** Ficha do funcionário › Uso de imagem: imprimir, anexar o assinado, marcar a situação e enviar cópia */
export const ImageTermPanel: React.FC<{
  employee: Employee;
  canEdit: boolean;
  onChange?: (employeeId: string, term: ImageTerm | null) => void;
}> = ({ employee, canEdit, onChange }) => {
  const { profile } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [term, setTerm] = useState<ImageTerm | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<ImageTerm['status']>('autorizado');
  const [signedAt, setSignedAt] = useState(today());
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sendCopy, setSendCopy] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [busy, setBusy] = useState<'save' | 'email' | 'reset' | null>(null);

  useEffect(() => {
    setTerm(undefined); setEditing(false); setError(null); setInfo(null);
    ImageTermService.get(employee.id).then(setTerm).catch((e) => { setError(e?.message); setTerm(null); });
  }, [employee.id]);

  // Envio por e-mail segue a chave do termo em Configurações › E-mails
  useEffect(() => { EmailService.getSettings().then((s) => setEmailEnabled(!!s?.term_email_enabled)).catch(() => setEmailEnabled(false)); }, []);

  const current: ImageTermStatus = term ? term.status : 'pendente';
  const email = employee.email?.trim() || '';

  const openForm = () => {
    setStatus(term?.status || 'autorizado');
    setSignedAt(term?.signed_at || today());
    setNotes(term?.notes || '');
    setFile(null);
    setSendCopy(true);
    setError(null); setInfo(null);
    setEditing(true);
  };

  const print = async () => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { setError('Não foi possível abrir o termo. Verifique o bloqueador de pop-ups.'); return; }
    w.document.write('<p style="font-family: Arial; color: #64748b; padding: 24px">Gerando termo…</p>');
    const templates = await loadTermTemplates();
    const html = renderTermHtml(templates.termo_imagem, {
      type: 'imagem',
      employee: {
        full_name: employee.full_name,
        email: employee.email,
        role_title: employee.role_title,
        department: employee.department,
        unit: employee.unit,
        registration_number: employee.registration_number,
        cpf: employee.cpf,
        birth_date: employee.birth_date,
      },
      items: [],
      date: today(),
      responsible: profile?.full_name || '',
    });
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  const sendEmail = async (t: ImageTerm, ask = true) => {
    if (ask) {
      const ok = await confirm({
        title: t.emailed_at ? 'Reenviar licença por e-mail?' : 'Enviar licença por e-mail?',
        icon: <Mail className="w-5 h-5" />,
        confirmLabel: t.emailed_at ? 'Reenviar' : 'Enviar e-mail',
        message: (
          <div className="space-y-3">
            <p>A cópia da licença de uso de imagem assinada vai em anexo.</p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex gap-2"><span className="w-16 shrink-0 text-slate-500">Para</span><span className="font-semibold text-slate-800">{employee.preferential_name || employee.full_name}</span></div>
              <div className="flex gap-2"><span className="w-16 shrink-0 text-slate-500">E-mail</span><span className="font-medium text-blue-700">{email}</span></div>
              <div className="flex gap-2"><span className="w-16 shrink-0 text-slate-500">Anexo</span><span className="inline-flex items-center gap-1 text-slate-700"><FileText className="w-3.5 h-3.5 text-rose-500" />{t.file_name || 'licenca.pdf'}</span></div>
            </div>
            {t.emailed_at && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">Já enviado em {new Date(t.emailed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.</p>}
          </div>
        ),
      });
      if (!ok) return;
    }
    setBusy('email'); setError(null);
    try {
      const r = await ImageTermService.sendEmail(employee.id);
      const updated = { ...t, emailed_at: r.sent_at, emailed_to: r.to };
      setTerm(updated); onChange?.(employee.id, updated);
      setInfo(`Cópia enviada para ${r.to}.`);
    } catch (e: any) {
      setError(`E-mail não enviado: ${e?.message || 'erro desconhecido'}`);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (status === 'autorizado' && !file && !term?.file_path) { setError('Anexe o PDF assinado para registrar a autorização.'); return; }
    setBusy('save'); setError(null); setInfo(null);
    try {
      const saved = await ImageTermService.save(employee.id, { status, signed_at: signedAt || null, notes: notes.trim() || null, file, keepFile: term || null });
      setTerm(saved); onChange?.(employee.id, saved);
      setEditing(false);
      setInfo(`Situação registrada: ${IMAGE_STATUS_LABEL[saved.status]}.`);
      if (file && sendCopy && emailEnabled && email && saved.file_path) {
        setBusy(null);
        await sendEmail(saved, false);
      }
    } catch (e: any) {
      setError(e?.message || 'Não foi possível salvar.');
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    const ok = await confirm({
      title: 'Voltar para pendente?',
      icon: <RotateCcw className="w-5 h-5" />,
      tone: 'rose',
      confirmLabel: 'Voltar para pendente',
      message: 'A situação e o PDF anexado deixam de valer para este funcionário. Use quando o termo foi registrado por engano.',
    });
    if (!ok) return;
    setBusy('reset'); setError(null);
    try {
      await ImageTermService.reset(employee.id);
      setTerm(null); onChange?.(employee.id, null);
      setInfo('Voltou para pendente.');
    } catch (e: any) {
      setError(e?.message || 'Não foi possível alterar.');
    } finally {
      setBusy(null);
    }
  };

  const openPdf = async () => {
    if (!term?.file_path) return;
    try { window.open(await ImageTermService.fileUrl(term.file_path), '_blank', 'noopener,noreferrer'); } catch (e: any) { setError(e?.message); }
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
      {dialog}
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-800 flex items-center gap-2 text-sm"><Camera className="w-4 h-4 text-blue-600" /> Uso de imagem</span>
        {term === undefined
          ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          : <span className={`px-2.5 py-0.5 rounded-full font-semibold border ${IMAGE_STATUS_CLS[current]}`}>{IMAGE_STATUS_LABEL[current]}</span>}
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2">{error}</div>}
      {info && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />{info}</div>}

      {term && !editing && (
        <div className="text-slate-600 space-y-1">
          <div>{term.signed_at ? `Assinado em ${dateBR(term.signed_at)}` : 'Data da assinatura não informada'}{term.file_path && <> · <button type="button" onClick={openPdf} className="font-semibold text-emerald-700 hover:text-emerald-900">Ver PDF</button></>}</div>
          {term.emailed_at && <div className="flex items-center gap-1 text-slate-500"><Mail className="w-3 h-3" /> Cópia enviada em {new Date(term.emailed_at).toLocaleDateString('pt-BR')}{term.emailed_to ? ` para ${term.emailed_to}` : ''}</div>}
          {term.notes && <div className="text-slate-500 italic">{term.notes}</div>}
        </div>
      )}
      {term === null && !editing && <p className="text-slate-500">Ainda sem termo registrado. Imprima, colete a assinatura e anexe o PDF.</p>}

      {editing && (
        <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="flex flex-wrap gap-2">
            {(['autorizado', 'nao_autorizado'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-lg border font-semibold ${status === s ? IMAGE_STATUS_CLS[s] : 'bg-white border-slate-200 text-slate-600'}`}>{IMAGE_STATUS_LABEL[s]}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block"><span className="block font-semibold text-slate-700 mb-1">Data da assinatura</span>
              <input type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white" />
            </label>
            <label className="block"><span className="block font-semibold text-slate-700 mb-1">Observação</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white" />
            </label>
          </div>
          <label className="block"><span className="block font-semibold text-slate-700 mb-1">{term?.file_path ? 'Substituir PDF assinado' : `PDF assinado${status === 'autorizado' ? ' *' : ''}`}</span>
            <input type="file" accept="application/pdf,.pdf" onChange={(e) => { const f = e.target.files?.[0] || null; if (f && (f.type !== 'application/pdf' || f.size > 10 * 1024 * 1024)) { setError('Selecione um PDF de até 10 MB.'); e.target.value = ''; setFile(null); return; } setError(null); setFile(f); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:rounded-md" />
            {!file && term?.file_path && <span className="text-[11px] text-slate-500 mt-1 block">PDF atual: {term.file_name || 'termo.pdf'} (mantido se nenhum arquivo for escolhido)</span>}
          </label>
          {file && emailEnabled && (email
            ? <label className="flex items-center gap-2 cursor-pointer bg-blue-50 border border-blue-100 rounded-lg px-3 py-2"><input type="checkbox" checked={sendCopy} onChange={(e) => setSendCopy(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" /><Mail className="w-4 h-4 text-blue-600" /><span className="text-slate-700"><strong>Enviar cópia por e-mail</strong> para {email}</span></label>
            : <p className="text-[11px] text-slate-500">Sem e-mail no cadastro: a cópia não será enviada.</p>)}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-600 bg-white"><X className="w-3.5 h-3.5" /> Cancelar</button>
            <button type="button" onClick={save} disabled={busy === 'save'} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-semibold">{busy === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Salvar</button>
          </div>
        </div>
      )}

      {canEdit && !editing && term !== undefined && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={print} className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-lg font-semibold"><Printer className="w-3.5 h-3.5" /> Imprimir termo</button>
          <button type="button" onClick={openForm} className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-semibold"><Upload className="w-3.5 h-3.5" /> {term ? 'Alterar' : 'Registrar assinatura'}</button>
          {term?.file_path && emailEnabled && email && <button type="button" onClick={() => sendEmail(term)} disabled={busy === 'email'} className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 rounded-lg font-semibold"><Mail className="w-3.5 h-3.5" /> {busy === 'email' ? 'Enviando…' : term.emailed_at ? 'Reenviar por e-mail' : 'Enviar por e-mail'}</button>}
          {term && <button type="button" onClick={reset} disabled={busy === 'reset'} className="ml-auto inline-flex items-center gap-1 px-2 py-1.5 text-slate-400 hover:text-rose-600 font-semibold" title="Voltar para pendente"><RotateCcw className="w-3.5 h-3.5" /></button>}
        </div>
      )}
    </div>
  );
};
