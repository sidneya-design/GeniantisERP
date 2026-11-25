import React, { useEffect, useRef, useState } from 'react';
import { BellRing, CheckCircle2, Eye, FileText, Loader2, Mail, Megaphone, Save, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../common/ConfirmDialog';
import { CommunicationService } from '../../services/communicationService';
import { ALERT_GROUP_LABEL, AlertItem, EmailService, EmailSettings, TERM_PLACEHOLDERS } from '../../services/emailService';

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600';
const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Msg = { ok: boolean; text: string } | null;

const parseList = (text: string) => text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
const parseDays = (text: string) =>
  Array.from(new Set(parseList(text).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 365))).sort((a, b) => b - a);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }> = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
    {label}
  </label>
);

const Notice: React.FC<{ msg: Msg }> = ({ msg }) => msg && (
  <div className={`px-3 py-2 rounded-lg text-xs flex items-start gap-2 border ${msg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
    {msg.ok && <CheckCircle2 className="w-4 h-4 shrink-0" />}<span>{msg.text}</span>
  </div>
);

/** Configurações › E-mails: remetente, alertas de vencimento e termo assinado por e-mail */
export const EmailSettingsEditor: React.FC = () => {
  const { user, profile } = useAuth();
  const [saved, setSaved] = useState<EmailSettings | null>(null);
  const [draft, setDraft] = useState<EmailSettings | null>(null);
  const [recipientsText, setRecipientsText] = useState('');
  const [daysText, setDaysText] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<Msg>(null);
  const [testTo, setTestTo] = useState('');
  const [testMsg, setTestMsg] = useState<Msg>(null);
  const [alertMsg, setAlertMsg] = useState<Msg>(null);
  const [preview, setPreview] = useState<AlertItem[] | null>(null);
  const termBodyRef = useRef<HTMLTextAreaElement>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  // Conta que envia os comunicados: undefined = carregando/indisponível, null = não configurada
  const [commAccount, setCommAccount] = useState<string | null | undefined>(undefined);
  useEffect(() => { CommunicationService.sender().then((r) => setCommAccount(r.address)).catch(() => setCommAccount(undefined)); }, []);

  const apply = (s: EmailSettings) => {
    setSaved(s);
    setDraft(s);
    setRecipientsText((s.alert_recipients || []).join(', '));
    setDaysText((s.alert_days || []).join(', '));
  };

  useEffect(() => {
    EmailService.getSettings()
      .then((s) => (s ? apply(s) : setLoadError('Rode a migration 20261118000028_email_settings.sql no Supabase para liberar esta seção.')))
      .catch((e) => setLoadError(e?.message || 'Não foi possível carregar as configurações de e-mail.'));
  }, []);

  useEffect(() => { setTestTo(profile?.email || user?.email || ''); }, [profile?.email, user?.email]);

  if (loadError) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-sm text-slate-600 flex items-center gap-2">
        <Mail className="w-5 h-5 text-slate-400" /> {loadError}
      </div>
    );
  }
  if (!draft || !saved) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando configurações de e-mail…
      </div>
    );
  }

  const update = (patch: Partial<EmailSettings>) => { setSaveMsg(null); setDraft({ ...draft, ...patch }); };

  const recipients = parseList(recipientsText);
  const days = parseDays(daysText);
  const invalidRecipients = recipients.filter((e) => !EMAIL_RE.test(e));
  const current: EmailSettings = { ...draft, alert_recipients: recipients, alert_days: days };
  const isDirty = JSON.stringify(current) !== JSON.stringify(saved);

  const handleSave = async () => {
    if (invalidRecipients.length) { setSaveMsg({ ok: false, text: `E-mail inválido: ${invalidRecipients.join(', ')}` }); return; }
    if (draft.reply_to && !EMAIL_RE.test(draft.reply_to)) { setSaveMsg({ ok: false, text: 'O "Responder para" não é um e-mail válido.' }); return; }
    if (draft.comm_reply_to && !EMAIL_RE.test(draft.comm_reply_to)) { setSaveMsg({ ok: false, text: 'O "Responder para" dos comunicados não é um e-mail válido.' }); return; }
    if (draft.alerts_enabled && !recipients.length) { setSaveMsg({ ok: false, text: 'Informe ao menos um destinatário para os alertas.' }); return; }
    if (draft.alerts_enabled && !days.length) { setSaveMsg({ ok: false, text: 'Informe ao menos uma faixa de dias (ex.: 30, 7, 1).' }); return; }
    setBusy('save');
    try {
      apply(await EmailService.saveSettings(current, user?.id));
      setSaveMsg({ ok: true, text: 'Configurações de e-mail salvas.' });
    } catch (e: any) {
      setSaveMsg({ ok: false, text: e?.message || 'Não foi possível salvar.' });
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async () => {
    if (!EMAIL_RE.test(testTo)) { setTestMsg({ ok: false, text: 'Informe um e-mail válido.' }); return; }
    setBusy('test'); setTestMsg(null);
    try {
      const r = await EmailService.sendTest(testTo);
      setTestMsg({ ok: true, text: `E-mail de teste enviado para ${r.to}. Confira a caixa de entrada (e o spam).` });
    } catch (e: any) {
      setTestMsg({ ok: false, text: e?.message || 'Falha no envio.' });
    } finally {
      setBusy(null);
    }
  };

  const handlePreview = async () => {
    setBusy('preview'); setAlertMsg(null);
    try {
      const r = await EmailService.previewAlerts();
      setPreview(r.itens);
      setAlertMsg({ ok: true, text: `${r.message}${isDirty ? ' (prévia com as configurações já salvas)' : ''}` });
    } catch (e: any) {
      setAlertMsg({ ok: false, text: e?.message || 'Não foi possível gerar a prévia.' });
    } finally {
      setBusy(null);
    }
  };

  const handleRunAlerts = async () => {
    const ok = await confirm({
      title: 'Enviar alertas agora?',
      icon: <BellRing className="w-5 h-5" />,
      confirmLabel: 'Enviar alertas',
      message: (
        <div className="space-y-2">
          <p>O resumo com os itens ainda não avisados vai para:</p>
          <div className="flex flex-wrap gap-1.5">
            {saved.alert_recipients.map((e) => <span key={e} className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-xs font-medium text-blue-700">{e}</span>)}
          </div>
          <p className="text-[11px] text-slate-500">Os itens enviados ficam marcados como avisados e não se repetem no envio automático.</p>
        </div>
      ),
    });
    if (!ok) return;
    setBusy('run'); setAlertMsg(null);
    try {
      const r = await EmailService.runAlerts();
      setAlertMsg({ ok: true, text: r.message });
      setPreview(null);
    } catch (e: any) {
      setAlertMsg({ ok: false, text: e?.message || 'Falha ao enviar os alertas.' });
    } finally {
      setBusy(null);
    }
  };

  const insertPlaceholder = (key: string) => {
    const el = termBodyRef.current;
    const token = `{{${key}}}`;
    const body = draft.term_body;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? start;
    update({ term_body: body.slice(0, start) + token + body.slice(end) });
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  };

  const saveButton = (
    <button
      type="button"
      onClick={handleSave}
      disabled={!isDirty || busy === 'save'}
      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow-xs"
    >
      {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar e-mails
    </button>
  );

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
      {confirmDialog}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3 border-slate-100">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
          <Mail className="w-5 h-5 text-blue-600" /> E-mails
        </h3>
        {saveButton}
      </div>

      <Notice msg={saveMsg} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 text-sm">
        {/* Remetente */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Remetente</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block"><span className={labelCls}>Nome exibido</span>
              <input value={draft.sender_name} onChange={(e) => update({ sender_name: e.target.value })} className={inputCls} placeholder="Geniantis ERP" />
            </label>
            <label className="block"><span className={labelCls}>Responder para</span>
              <input value={draft.reply_to} onChange={(e) => update({ reply_to: e.target.value.trim() })} className={inputCls} placeholder="Vazio = a própria conta" />
            </label>
          </div>
          <label className="block"><span className={labelCls}>Assinatura (vai no fim dos e-mails do ERP)</span>
            <textarea rows={3} value={draft.signature} onChange={(e) => update({ signature: e.target.value })} className={inputCls} placeholder={'Equipe de TI\nGeniantis'} />
          </label>
          <p className="text-[11px] text-slate-500">
            O endereço de envio é a conta do Google configurada no servidor (<code>GMAIL_USER</code>). Os e-mails de aniversário continuam com o modelo do painel de Aniversariantes.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <span className={labelCls}>Testar envio</span>
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={testTo} onChange={(e) => setTestTo(e.target.value.trim())} className={inputCls} placeholder="email@empresa.com" />
              <button type="button" onClick={handleTest} disabled={busy === 'test'} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50 rounded-lg text-xs font-semibold whitespace-nowrap">
                {busy === 'test' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar teste
              </button>
            </div>
            <Notice msg={testMsg} />
          </div>
        </section>

        {/* Termo */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5"><FileText className="w-4 h-4" /> Termo assinado por e-mail</h4>
            <Toggle checked={draft.term_email_enabled} onChange={(v) => update({ term_email_enabled: v })} label="Ativo" />
          </div>
          <p className="text-[11px] text-slate-500">
            Ao anexar o PDF assinado em Entregas &amp; Devoluções, o ERP oferece enviar uma cópia para o e-mail do funcionário. A movimentação também ganha o botão de reenviar.
          </p>
          <fieldset disabled={!draft.term_email_enabled} className="space-y-3 disabled:opacity-50">
            <label className="block"><span className={labelCls}>Assunto</span>
              <input value={draft.term_subject} onChange={(e) => update({ term_subject: e.target.value })} className={inputCls} />
            </label>
            <div>
              <span className={labelCls}>Inserir informação</span>
              <div className="flex flex-wrap gap-1.5">
                {TERM_PLACEHOLDERS.map((p) => (
                  <button key={p.key} type="button" onClick={() => insertPlaceholder(p.key)} title={`{{${p.key}}}`}
                    className="px-2 py-1 text-[11px] font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block"><span className={labelCls}>Mensagem (o PDF vai em anexo)</span>
              <textarea ref={termBodyRef} rows={8} value={draft.term_body} onChange={(e) => update({ term_body: e.target.value })} className={`${inputCls} font-mono leading-relaxed`} />
            </label>
          </fieldset>
        </section>
      </div>

      {/* Comunicados */}
      {draft.comm_sender_name !== undefined && (
        <section className="space-y-3 text-sm border-t border-slate-100 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5"><Megaphone className="w-4 h-4" /> Remetente dos Comunicados</h4>
            {commAccount ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Conta: {commAccount}</span>
            ) : commAccount === null ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Conta não configurada no servidor</span>
            ) : null}
          </div>
          <p className="text-[11px] text-slate-500">
            Os comunicados saem de uma conta própria (<code>COMUNICADOS_GMAIL_USER</code> e <code>COMUNICADOS_GMAIL_APP_PASSWORD</code> nas variáveis da Netlify), separada da conta dos alertas e termos.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block"><span className={labelCls}>Nome exibido</span>
              <input value={draft.comm_sender_name || ''} onChange={(e) => update({ comm_sender_name: e.target.value })} className={inputCls} placeholder="RH Geniantis" />
            </label>
            <label className="block"><span className={labelCls}>Responder para</span>
              <input value={draft.comm_reply_to || ''} onChange={(e) => update({ comm_reply_to: e.target.value.trim() })} className={inputCls} placeholder="Vazio = a própria conta" />
            </label>
          </div>
          <label className="block"><span className={labelCls}>Assinatura dos comunicados</span>
            <textarea rows={3} value={draft.comm_signature || ''} onChange={(e) => update({ comm_signature: e.target.value })} className={inputCls} placeholder={'Recursos Humanos\nGeniantis'} />
          </label>
        </section>
      )}

      {/* Alertas */}
      <section className="space-y-3 text-sm border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5"><BellRing className="w-4 h-4" /> Alertas de vencimento</h4>
          <Toggle checked={draft.alerts_enabled} onChange={(v) => update({ alerts_enabled: v })} label="Enviar todo dia às 08:00" />
        </div>
        <p className="text-[11px] text-slate-500">
          Um resumo único por dia, só quando houver algo novo. Cada item é avisado uma vez em cada faixa (ex.: 30, 7 e 1 dia antes) e de novo se vencer.
          Em contratos com aviso prévio, a data considerada é o último dia para avisar o fornecedor.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <label className="block lg:col-span-2"><span className={labelCls}>Destinatários (separe por vírgula)</span>
            <input value={recipientsText} onChange={(e) => { setSaveMsg(null); setRecipientsText(e.target.value); }} className={inputCls} placeholder="ti@empresa.com, financeiro@empresa.com" />
            {invalidRecipients.length > 0 && <span className="text-[11px] text-rose-600 mt-1 block">Inválido: {invalidRecipients.join(', ')}</span>}
          </label>
          <label className="block"><span className={labelCls}>Avisar com quantos dias de antecedência</span>
            <input value={daysText} onChange={(e) => { setSaveMsg(null); setDaysText(e.target.value); }} className={inputCls} placeholder="30, 7, 1" />
          </label>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Toggle checked={draft.alert_domains} onChange={(v) => update({ alert_domains: v })} label="Domínios" />
          <Toggle checked={draft.alert_contracts} onChange={(v) => update({ alert_contracts: v })} label="Contratos de fornecedores" />
          <Toggle checked={draft.alert_subscriptions} onChange={(v) => update({ alert_subscriptions: v })} label="Renovação de assinaturas" />
          <Toggle checked={draft.alert_maintenance} onChange={(v) => update({ alert_maintenance: v })} label="Manutenções com previsão vencida" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handlePreview} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 rounded-lg text-xs font-semibold">
            {busy === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Ver o que seria avisado hoje
          </button>
          <button type="button" onClick={handleRunAlerts} disabled={!!busy || !saved.alerts_enabled} title={saved.alerts_enabled ? '' : 'Ative e salve os alertas primeiro'} className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50 rounded-lg text-xs font-semibold">
            {busy === 'run' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar alertas agora
          </button>
        </div>
        <Notice msg={alertMsg} />
        {preview && preview.length > 0 && (
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500">
                <tr><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Item</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Prazo</th><th className="px-3 py-2">Situação</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((i) => (
                  <tr key={i.key}>
                    <td className="px-3 py-2 whitespace-nowrap">{ALERT_GROUP_LABEL[i.grupo]}</td>
                    <td className="px-3 py-2"><span className="font-semibold text-slate-800">{i.titulo}</span>{i.detalhe && <span className="block text-slate-500">{i.detalhe}</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(`${i.vencimento}T12:00:00Z`).toLocaleDateString('pt-BR')}</td>
                    <td className={`px-3 py-2 whitespace-nowrap font-semibold ${i.dias < 0 ? 'text-rose-700' : i.dias <= 7 ? 'text-amber-700' : 'text-slate-700'}`}>{i.prazo}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{i.ja_avisado ? <span className="text-slate-400">já avisado</span> : <span className="text-blue-700 font-semibold">vai no próximo envio</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-white/95 backdrop-blur-xs border-t border-slate-100 rounded-b-2xl flex flex-col sm:flex-row sm:items-center justify-end gap-3">
        <div className="flex-1 min-w-0">
          {saveMsg ? <Notice msg={saveMsg} /> : isDirty ? <span className="text-xs font-semibold text-amber-700">Há alterações não salvas.</span> : <span className="text-xs text-slate-400">Tudo salvo.</span>}
        </div>
        {saveButton}
      </div>
    </div>
  );
};
