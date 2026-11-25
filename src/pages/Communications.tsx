import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Copy, History, Loader2, Mail, Paperclip, PenSquare, RotateCcw, Search, Send, ShieldAlert, Trash2, Users, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../lib/usePermission';
import { useConfirm } from '../components/common/ConfirmDialog';
import { EmailService } from '../services/emailService';
import {
  BatchResult, Communication, CommunicationRecipient, CommunicationService, RecipientCandidate,
} from '../services/communicationService';
import { personalizeHtml, signatureHtml, textToEmailHtml } from '../lib/emailFormat';

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600';
const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';
const MAX_FILE = 10 * 1024 * 1024;

const STATUS_CHIP: Record<Communication['status'], { label: string; cls: string }> = {
  enviando: { label: 'Enviando', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  enviado: { label: 'Enviado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  com_falhas: { label: 'Com falhas', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const dateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Moldura igual à do servidor, para a prévia bater com o e-mail */
const previewDoc = (html: string, signature: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1e293b;max-width:640px">${html}${signatureHtml(signature)}</div>`;

/** Resumo de quem recebeu: departamentos inteiros + pessoas avulsas */
function describeAudience(selected: RecipientCandidate[], all: RecipientCandidate[]): string {
  const reachable = all.filter((c) => c.email);
  if (selected.length && selected.length === reachable.length) return 'Todos os funcionários';
  const ids = new Set(selected.map((s) => s.id));
  const byDept = new Map<string, RecipientCandidate[]>();
  reachable.forEach((c) => byDept.set(c.department, [...(byDept.get(c.department) || []), c]));
  const fullDepts = [...byDept.entries()].filter(([, list]) => list.every((c) => ids.has(c.id))).map(([d]) => d);
  const covered = new Set(fullDepts.flatMap((d) => byDept.get(d)!.map((c) => c.id)));
  const extra = selected.filter((s) => !covered.has(s.id));
  const parts = [...fullDepts];
  if (extra.length) parts.push(extra.length <= 3 ? extra.map((e) => e.name).join(', ') : `${extra.length} pessoa(s)`);
  return parts.join(' + ');
}

export const Communications: React.FC = () => {
  const { profile, user } = useAuth();
  const { canEdit, canDelete } = usePermission('communications');
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [tab, setTab] = useState<'novo' | 'historico'>(canEdit ? 'novo' : 'historico');
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [signature, setSignature] = useState('');
  const [sender, setSender] = useState<{ name: string; address: string | null | undefined }>({ name: 'RH Geniantis', address: undefined });
  // As permissões podem chegar depois do primeiro render
  useEffect(() => { if (canEdit) setTab('novo'); }, [canEdit]);

  // ---------- Novo comunicado ----------
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<{ path: string; name: string; key: string } | null>(null);
  const [candidates, setCandidates] = useState<RecipientCandidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [unitFilter, setUnitFilter] = useState<string[]>([]);
  const [includeAway, setIncludeAway] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<'test' | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---------- Envio em andamento ----------
  const [sending, setSending] = useState<{ comm: Communication; progress: BatchResult | null; error: string | null; done: boolean } | null>(null);

  // ---------- Histórico ----------
  const [history, setHistory] = useState<Communication[] | null>(null);
  const [detail, setDetail] = useState<{ comm: Communication; recipients: CommunicationRecipient[] | null } | null>(null);

  const loadHistory = async () => {
    try {
      setHistory(await CommunicationService.list());
    } catch (e: any) {
      setPageError(e?.message || 'Não foi possível carregar os comunicados.');
      setHistory([]);
    }
  };

  useEffect(() => {
    loadHistory();
    EmailService.getSettings().then((s) => {
      setSignature(s?.comm_signature || '');
      if (s?.comm_sender_name) setSender((cur) => ({ ...cur, name: s.comm_sender_name! }));
    }).catch(() => {});
    CommunicationService.sender().then((r) => setSender((cur) => ({ ...cur, address: r.address }))).catch(() => {});
    if (canEdit) {
      CommunicationService.listCandidates().then(setCandidates).catch((e) => { setPageError(e?.message || 'Não foi possível carregar os funcionários.'); setCandidates([]); });
    }
  }, [canEdit]);

  // Avisa antes de fechar a aba no meio de um envio
  useEffect(() => {
    if (!sending || sending.done) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [sending]);

  const departments = useMemo(() => [...new Set((candidates || []).map((c) => c.department))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [candidates]);
  const units = useMemo(() => [...new Set((candidates || []).map((c) => c.unit))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [candidates]);

  const pool = useMemo(() => (candidates || []).filter((c) => includeAway || c.status === 'ativo'), [candidates, includeAway]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pool.filter((c) =>
      (!deptFilter.length || deptFilter.includes(c.department))
      && (!unitFilter.length || unitFilter.includes(c.unit))
      && (!q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)));
  }, [pool, deptFilter, unitFilter, search]);

  const chosen = useMemo(() => pool.filter((c) => selected.has(c.id) && c.email), [pool, selected]);
  const visibleReachable = visible.filter((c) => c.email);
  const allVisibleChosen = visibleReachable.length > 0 && visibleReachable.every((c) => selected.has(c.id));
  const withoutEmail = visible.filter((c) => !c.email).length;

  const bodyHtml = useMemo(() => textToEmailHtml(body), [body]);
  const previewName = chosen[0]?.name || profile?.full_name || 'Maria Silva';

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleVisible = () => setSelected((s) => {
    const n = new Set(s);
    visibleReachable.forEach((c) => (allVisibleChosen ? n.delete(c.id) : n.add(c.id)));
    return n;
  });
  const toggleChip = (list: string[], set: (v: string[]) => void, value: string) => set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const insertName = () => {
    const el = bodyRef.current;
    const token = '{{nome}}';
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? start;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = start + token.length; } });
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_FILE) { setNotice({ ok: false, text: 'O anexo pode ter no máximo 10 MB.' }); return; }
    setNotice(null);
    setFile(f);
  };

  // Sobe o anexo uma vez só (o teste e o envio usam o mesmo arquivo)
  const ensureUpload = async () => {
    if (!file) return null;
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (uploaded?.key === key) return uploaded;
    const up = await CommunicationService.uploadAttachment(file);
    const withKey = { ...up, key };
    setUploaded(withKey);
    return withKey;
  };

  const validate = () => {
    if (!subject.trim()) return 'Informe o assunto.';
    if (!body.trim()) return 'Escreva a mensagem.';
    return null;
  };

  const handleTest = async () => {
    const err = validate();
    if (err) { setNotice({ ok: false, text: err }); return; }
    setBusy('test'); setNotice(null);
    try {
      const att = await ensureUpload();
      const r = await CommunicationService.sendTest({ subject: subject.trim(), body, attachment: att });
      setNotice({ ok: true, text: `Teste enviado para ${r.to}, com o seu nome no lugar de {{nome}}.` });
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message || 'Falha ao enviar o teste.' });
    } finally {
      setBusy(null);
    }
  };

  // Chama o servidor em lotes até acabar (ou até dar erro de comunicação)
  const runBatches = async (comm: Communication, retryFailed = false) => {
    setSending({ comm, progress: null, error: null, done: false });
    let first = true;
    try {
      for (let guard = 0; guard < 2000; guard += 1) {
        const r = await CommunicationService.sendBatch(comm.id, retryFailed && first);
        first = false;
        setSending((s) => s && { ...s, progress: r });
        if (r.pending === 0) break;
      }
      setSending((s) => s && { ...s, done: true });
    } catch (e: any) {
      setSending((s) => s && { ...s, error: e?.message || 'O envio foi interrompido.' });
    }
    loadHistory();
  };

  const handleSend = async () => {
    const err = validate() || (!chosen.length ? 'Escolha ao menos um destinatário.' : null);
    if (err) { setNotice({ ok: false, text: err }); return; }
    const audience = describeAudience(chosen, pool);
    const ok = await confirm({
      title: `Enviar para ${chosen.length} pessoa(s)?`,
      icon: <Send className="w-5 h-5" />,
      confirmLabel: 'Enviar agora',
      message: (
        <div className="space-y-3">
          <p>Cada pessoa recebe o seu próprio e-mail; ninguém vê o endereço dos outros.</p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
            <div className="flex gap-2"><span className="w-16 shrink-0 text-slate-500">Assunto</span><span className="font-semibold text-slate-800">{subject.trim()}</span></div>
            <div className="flex gap-2"><span className="w-16 shrink-0 text-slate-500">Para</span><span className="text-slate-700">{audience}</span></div>
            {file && <div className="flex gap-2"><span className="w-16 shrink-0 text-slate-500">Anexo</span><span className="inline-flex items-center gap-1 text-slate-700"><Paperclip className="w-3.5 h-3.5" />{file.name}</span></div>}
          </div>
        </div>
      ),
    });
    if (!ok) return;
    setNotice(null);
    try {
      const att = await ensureUpload();
      const comm = await CommunicationService.create({
        subject: subject.trim(),
        body,
        body_html: bodyHtml,
        audience,
        attachment: att ? { path: att.path, name: att.name } : null,
        recipients: chosen.map((c) => ({ employee_id: c.id, name: c.name, email: c.email })),
        created_by_name: profile?.full_name || user?.email || '',
      });
      await runBatches(comm);
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message || 'Não foi possível criar o comunicado.' });
    }
  };

  const noticeBox = notice && (
    <div role="status" className={`border rounded-xl px-4 py-3 text-sm flex items-start gap-2 ${notice.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
      {notice.ok ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" /> : <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />}<span>{notice.text}</span>
    </div>
  );

  const closeSending = () => {
    const finished = sending?.done;
    setSending(null);
    if (finished && tab === 'novo') {
      setSubject(''); setBody(''); setFile(null); setUploaded(null); setSelected(new Set());
      setNotice({ ok: true, text: 'Comunicado enviado. Veja o resultado no Histórico.' });
    }
  };

  // ---------- Histórico: ações ----------
  const openDetail = async (comm: Communication) => {
    setDetail({ comm, recipients: null });
    try {
      const recipients = await CommunicationService.recipients(comm.id);
      setDetail({ comm, recipients });
    } catch (e: any) {
      setDetail(null);
      setPageError(e?.message || 'Não foi possível carregar os destinatários.');
    }
  };

  const duplicate = (comm: Communication) => {
    setSubject(comm.subject);
    setBody(comm.body);
    setFile(null);
    setUploaded(null);
    setDetail(null);
    setTab('novo');
    setNotice({ ok: true, text: 'Texto copiado. Escolha os destinatários e, se precisar, anexe o arquivo de novo.' });
  };

  const resume = async (comm: Communication, retryFailed: boolean) => {
    const ok = await confirm({
      title: retryFailed ? `Reenviar para ${comm.failed_count} pessoa(s) que falharam?` : 'Continuar o envio?',
      icon: <RotateCcw className="w-5 h-5" />,
      confirmLabel: retryFailed ? 'Reenviar' : 'Continuar',
      message: retryFailed ? 'Só quem ficou com falha recebe de novo; quem já recebeu não é incomodado.' : 'O envio continua de onde parou, só para quem ainda não recebeu.',
    });
    if (!ok) return;
    setDetail(null);
    await runBatches(comm, retryFailed);
  };

  const remove = async (comm: Communication) => {
    const ok = await confirm({
      title: 'Excluir este comunicado do histórico?',
      icon: <Trash2 className="w-5 h-5" />,
      tone: 'rose',
      confirmLabel: 'Excluir',
      message: 'Os e-mails já enviados não são desfeitos; só o registro sai do histórico.',
    });
    if (!ok) return;
    try {
      await CommunicationService.remove(comm.id);
      setDetail(null);
      loadHistory();
    } catch (e: any) {
      setPageError(e?.message || 'Não foi possível excluir.');
    }
  };

  const progressPct = sending?.progress && sending.progress.total
    ? Math.round(((sending.progress.sent + sending.progress.failed) / sending.progress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {confirmDialog}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Comunicados</h2>
          <p className="text-slate-500 text-sm mt-1">Avisos e lembretes por e-mail para os funcionários. Cada pessoa recebe o seu próprio e-mail.</p>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg self-start md:self-auto">
          {canEdit && (
            <button type="button" onClick={() => setTab('novo')} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-semibold transition-colors ${tab === 'novo' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}><PenSquare className="w-4 h-4" /> Novo comunicado</button>
          )}
          <button type="button" onClick={() => setTab('historico')} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-semibold transition-colors ${tab === 'historico' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}><History className="w-4 h-4" /> Histórico</button>
        </div>
      </div>

      {pageError && <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2"><ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" /><span>{pageError}</span></div>}
      {canEdit && sender.address === null && <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2"><AlertCircle className="w-5 h-5 shrink-0 text-amber-600" /><span>A conta que envia os comunicados ainda não foi configurada no servidor. Cadastre <code>COMUNICADOS_GMAIL_USER</code> e <code>COMUNICADOS_GMAIL_APP_PASSWORD</code> na Netlify.</span></div>}
      {/* No formulário o aviso fica junto dos botões de envio; nas outras abas, aqui no topo */}
      {!(tab === 'novo' && canEdit) && noticeBox}

      {tab === 'novo' && canEdit && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Mensagem */}
          <div className="xl:col-span-3 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-sm">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base border-b pb-3 border-slate-100"><Mail className="w-5 h-5 text-blue-600" /> Mensagem</h3>
              <label className="block"><span className={labelCls}>Assunto *</span>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className={inputCls} placeholder="Ex.: Lembrete: entrega do ponto até sexta" />
              </label>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-700">Texto *</span>
                  <button type="button" onClick={insertName} className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100">+ Nome da pessoa</button>
                </div>
                <textarea ref={bodyRef} rows={12} value={body} onChange={(e) => setBody(e.target.value)} className={`${inputCls} leading-relaxed`} placeholder={'Olá, {{nome}}!\n\nEscreva aqui o aviso…'} />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Linha em branco separa parágrafos. <code>**texto**</code> deixa em negrito, <code>## </code> no começo vira subtítulo e linhas começando com <code>- </code> viram lista. Links ficam clicáveis.
                </span>
              </div>
              <div>
                <span className={labelCls}>Anexo (opcional, até 10 MB)</span>
                {file ? (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <Paperclip className="w-4 h-4 text-slate-500" /><span className="text-xs text-slate-700 flex-1 truncate">{file.name}</span>
                    <button type="button" onClick={() => { setFile(null); setUploaded(null); }} className="text-slate-400 hover:text-rose-600 p-1" title="Remover anexo"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 rounded-lg text-xs font-semibold text-slate-600"><Paperclip className="w-4 h-4" /> Anexar arquivo</button>
                )}
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
            </div>

            {/* Prévia */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm">Prévia</h3>
                <span className="text-[11px] text-slate-500">como {previewName.split(' ')[0]} vai ver</span>
              </div>
              <div className="p-6 bg-slate-50">
                <div className="bg-white border border-slate-200 rounded-xl p-5 max-w-[680px]">
                  <div className="text-xs text-slate-500 border-b border-slate-100 pb-3 mb-4 space-y-0.5">
                    <div><span className="text-slate-400">De:</span> <strong className="text-slate-800">{sender.name}</strong>{sender.address && <span> &lt;{sender.address}&gt;</span>}</div>
                    <div><span className="text-slate-400">Assunto:</span> <strong className="text-slate-800">{(subject || '(sem assunto)').replace(/{{\s*nome\s*}}/g, previewName.split(' ')[0]).replace(/{{\s*nome_completo\s*}}/g, previewName)}</strong></div>
                    {file && <div className="flex items-center gap-1"><Paperclip className="w-3 h-3" />{file.name}</div>}
                  </div>
                  {body.trim()
                    ? <div dangerouslySetInnerHTML={{ __html: previewDoc(personalizeHtml(bodyHtml, previewName), signature) }} />
                    : <p className="text-sm text-slate-400">O texto aparece aqui enquanto você escreve.</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Destinatários */}
          <div className="xl:col-span-2 space-y-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-sm xl:sticky xl:top-20">
              <h3 className="font-bold text-slate-800 flex items-center justify-between gap-2 text-base border-b pb-3 border-slate-100">
                <span className="flex items-center gap-2"><Users className="w-5 h-5 text-blue-600" /> Para quem</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{chosen.length} selecionado(s)</span>
              </h3>

              {!candidates ? (
                <div className="flex items-center gap-2 text-slate-500 text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Carregando funcionários…</div>
              ) : (
                <>
                  <div>
                    <span className={labelCls}>Departamentos</span>
                    <div className="flex flex-wrap gap-1.5">
                      {departments.map((d) => (
                        <button key={d} type="button" onClick={() => toggleChip(deptFilter, setDeptFilter, d)} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${deptFilter.includes(d) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>{d}</button>
                      ))}
                    </div>
                  </div>
                  {units.length > 1 && (
                    <div>
                      <span className={labelCls}>Unidades</span>
                      <div className="flex flex-wrap gap-1.5">
                        {units.map((u) => (
                          <button key={u} type="button" onClick={() => toggleChip(unitFilter, setUnitFilter, u)} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${unitFilter.includes(u) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>{u}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pessoa" className={`${inputCls} pl-9`} />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer whitespace-nowrap"><input type="checkbox" checked={includeAway} onChange={(e) => setIncludeAway(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" /> Incluir afastados</label>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={allVisibleChosen} onChange={toggleVisible} disabled={!visibleReachable.length} className="w-4 h-4 text-blue-600 rounded" />
                        {deptFilter.length || unitFilter.length || search ? `Selecionar os ${visibleReachable.length} da lista` : `Todos os funcionários (${visibleReachable.length})`}
                      </label>
                      {selected.size > 0 && <button type="button" onClick={() => setSelected(new Set())} className="text-[11px] font-semibold text-slate-500 hover:text-rose-600">Limpar</button>}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {visible.map((c) => (
                        <label key={c.id} className={`flex items-center gap-3 px-3 py-2 ${c.email ? 'cursor-pointer hover:bg-slate-50' : 'opacity-50 cursor-not-allowed'}`}>
                          <input type="checkbox" disabled={!c.email} checked={!!c.email && selected.has(c.id)} onChange={() => toggle(c.id)} className="w-4 h-4 text-blue-600 rounded" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold text-slate-800 truncate">{c.name}{c.status === 'afastado' && <span className="ml-1.5 text-[10px] font-semibold text-amber-700">afastado</span>}</span>
                            <span className="block text-[11px] text-slate-500 truncate">{c.email || 'sem e-mail no cadastro'} · {c.department}</span>
                          </span>
                        </label>
                      ))}
                      {visible.length === 0 && <p className="px-3 py-6 text-center text-xs text-slate-500">Ninguém com esses filtros.</p>}
                    </div>
                  </div>
                  {withoutEmail > 0 && <p className="text-[11px] text-amber-700 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {withoutEmail} pessoa(s) da lista sem e-mail no cadastro não vão receber.</p>}
                  {chosen.length > 0 && <p className="text-[11px] text-slate-500">Vai para: <span className="font-semibold text-slate-700">{describeAudience(chosen, pool)}</span></p>}
                </>
              )}

              <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={handleTest} disabled={busy === 'test'} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 rounded-lg text-sm font-semibold">
                  {busy === 'test' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Enviar teste para mim
                </button>
                <button type="button" onClick={handleSend} disabled={!chosen.length} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold shadow-xs">
                  <Send className="w-4 h-4" /> {chosen.length ? `Enviar para ${chosen.length} pessoa(s)` : 'Escolha os destinatários'}
                </button>
              </div>
              {noticeBox}
            </div>
          </div>
        </div>
      )}

      {tab === 'historico' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between"><h3 className="font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-blue-600" /> Comunicados enviados</h3><span className="text-xs text-slate-500">{history?.length ?? 0} registro(s)</span></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                <tr><th className="px-6 py-3">Data</th><th className="px-6 py-3">Assunto</th><th className="px-6 py-3">Para</th><th className="px-6 py-3">Entregues</th><th className="px-6 py-3">Situação</th><th className="px-6 py-3">Por</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!history ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando…</td></tr>
                ) : history.map((c) => (
                  <tr key={c.id} onClick={() => openDetail(c)} className="hover:bg-slate-50/80 cursor-pointer transition-colors">
                    <td className="px-6 py-3 text-xs whitespace-nowrap">{dateTime(c.created_at)}</td>
                    <td className="px-6 py-3 font-semibold text-slate-800">{c.subject}{c.attachment_name && <Paperclip className="w-3.5 h-3.5 inline ml-1.5 text-slate-400" />}</td>
                    <td className="px-6 py-3 text-xs max-w-[220px] truncate" title={c.audience}>{c.audience}</td>
                    <td className="px-6 py-3 text-xs whitespace-nowrap"><span className="font-semibold text-slate-800">{c.sent_count}</span> de {c.total}{c.failed_count > 0 && <span className="text-rose-600 font-semibold"> · {c.failed_count} falha(s)</span>}</td>
                    <td className="px-6 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_CHIP[c.status].cls}`}>{STATUS_CHIP[c.status].label}</span></td>
                    <td className="px-6 py-3 text-xs">{c.created_by_name || '—'}</td>
                  </tr>
                ))}
                {history && history.length === 0 && <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500"><Mail className="w-5 h-5 mx-auto mb-2 text-slate-400" />Nenhum comunicado enviado ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detalhe de um comunicado */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 p-6 border-b border-slate-100">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-800">{detail.comm.subject}</h3>
                <p className="text-xs text-slate-500 mt-1">{dateTime(detail.comm.created_at)} · por {detail.comm.created_by_name || '—'} · {detail.comm.audience}</p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 p-3"><span className="block text-[11px] text-slate-500">Destinatários</span><span className="text-xl font-bold text-slate-800">{detail.comm.total}</span></div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3"><span className="block text-[11px] text-emerald-700">Entregues</span><span className="text-xl font-bold text-emerald-700">{detail.comm.sent_count}</span></div>
                <div className={`rounded-xl border p-3 ${detail.comm.failed_count ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200'}`}><span className={`block text-[11px] ${detail.comm.failed_count ? 'text-rose-700' : 'text-slate-500'}`}>Falhas</span><span className={`text-xl font-bold ${detail.comm.failed_count ? 'text-rose-700' : 'text-slate-800'}`}>{detail.comm.failed_count}</span></div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div dangerouslySetInnerHTML={{ __html: previewDoc(textToEmailHtml(detail.comm.body).replace(/{{\s*(nome|nome_completo)\s*}}/g, '<span style="background:#dbeafe;border-radius:4px;padding:0 4px">nome</span>'), '') }} />
                {detail.comm.attachment_path && (
                  <button type="button" onClick={async () => { try { window.open(await CommunicationService.attachmentUrl(detail.comm.attachment_path!), '_blank', 'noopener,noreferrer'); } catch (e: any) { setPageError(e?.message); } }} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"><Paperclip className="w-3.5 h-3.5" /> {detail.comm.attachment_name}</button>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Destinatários</h4>
                {!detail.recipients ? (
                  <div className="flex items-center gap-2 text-slate-500 text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
                ) : (
                  <div className="border border-slate-200 rounded-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {detail.recipients.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                        <span className="flex-1 min-w-0"><span className="block font-semibold text-slate-800 truncate">{r.name}</span><span className="block text-slate-500 truncate">{r.email}</span></span>
                        {r.status === 'enviado' && <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Enviado</span>}
                        {r.status === 'pendente' && <span className="text-amber-700 font-semibold">Pendente</span>}
                        {r.status === 'falhou' && <span className="text-rose-700 font-semibold max-w-[45%] truncate" title={r.error || ''}>Falhou{r.error ? `: ${r.error}` : ''}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 p-4 border-t border-slate-100">
              {canDelete && <button type="button" onClick={() => remove(detail.comm)} className="sm:mr-auto inline-flex items-center gap-1.5 px-3.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-sm font-semibold"><Trash2 className="w-4 h-4" /> Excluir</button>}
              {canEdit && <button type="button" onClick={() => duplicate(detail.comm)} className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold"><Copy className="w-4 h-4" /> Duplicar</button>}
              {canEdit && detail.comm.status === 'enviando' && <button type="button" onClick={() => resume(detail.comm, false)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"><Send className="w-4 h-4" /> Continuar envio</button>}
              {canEdit && detail.comm.status !== 'enviando' && detail.comm.failed_count > 0 && <button type="button" onClick={() => resume(detail.comm, true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"><RotateCcw className="w-4 h-4" /> Reenviar para quem falhou</button>}
            </div>
          </div>
        </div>
      )}

      {/* Progresso do envio */}
      {sending && (
        <div className="fixed inset-0 z-[55] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${sending.error ? 'bg-rose-50 text-rose-600' : sending.done ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                {sending.error ? <AlertCircle className="w-5 h-5" /> : sending.done ? <CheckCircle2 className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-800">{sending.error ? 'Envio interrompido' : sending.done ? 'Envio concluído' : 'Enviando comunicado…'}</h3>
                <p className="text-sm text-slate-600 mt-1 truncate">{sending.comm.subject}</p>
              </div>
            </div>
            <div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-500 ${sending.error ? 'bg-rose-500' : sending.done ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${sending.done ? 100 : progressPct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1.5">
                <span>{sending.progress ? `${sending.progress.sent} enviado(s)${sending.progress.failed ? ` · ${sending.progress.failed} falha(s)` : ''}` : 'Preparando…'}</span>
                <span>{sending.progress ? `${sending.progress.sent + sending.progress.failed} de ${sending.progress.total}` : ''}</span>
              </div>
            </div>
            {sending.error && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{sending.error} Quem já recebeu não recebe de novo ao continuar.</p>}
            {!sending.done && !sending.error && <p className="text-[11px] text-slate-500">Mantenha esta página aberta até terminar.</p>}
            {sending.done && sending.progress && sending.progress.failed > 0 && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Algumas pessoas não receberam. Abra o comunicado no Histórico para ver o motivo e reenviar.</p>}
            {(sending.done || sending.error) && (
              <div className="flex justify-end gap-2">
                {sending.error && <button type="button" onClick={() => runBatches(sending.comm)} className="inline-flex items-center gap-1.5 px-4 py-2 border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-lg text-sm font-semibold"><RotateCcw className="w-4 h-4" /> Continuar</button>}
                <button type="button" onClick={closeSending} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">Fechar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
