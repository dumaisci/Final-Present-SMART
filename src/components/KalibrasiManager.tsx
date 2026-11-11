import React, { useState, useEffect } from 'react';
import { Aset, RiwayatKalibrasi, User, KondisiAset, SmtpConfig, EmailLog, isFungsiUmum } from '../types';
import { apiClient } from '../lib/apiClient';
import { 
  CalendarClock, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  FileCheck, 
  Search, 
  FileText,
  X,
  Upload,
  Mail,
  Send,
  Settings,
  XCircle,
  RefreshCw,
  History,
  Clock,
  Sliders
} from 'lucide-react';

interface KalibrasiManagerProps {
  asets: Aset[];
  currentUser: User;
  onAddKalibrasi: (id: string, data: Partial<RiwayatKalibrasi>) => Promise<void>;
}

export const KalibrasiManager: React.FC<KalibrasiManagerProps> = ({
  asets,
  currentUser,
  onAddKalibrasi
}) => {
  const [filter, setFilter] = useState<'ALL' | 'H30' | 'OVERDUE' | 'SAFE'>('H30');
  const [search, setSearch] = useState('');
  const [selectedAssetForKalibrasi, setSelectedAssetForKalibrasi] = useState<Aset | null>(null);

  // Email state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTab, setEmailTab] = useState<'TRIGGER' | 'SETTINGS' | 'LOGS'>('TRIGGER');
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [isSendingTrigger, setIsSendingTrigger] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [emailNotice, setEmailNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [lembaga, setLembaga] = useState('SUCOFINDO Calibration Services Center');
  const [noSertifikat, setNoSertifikat] = useState('');
  const [jatuhTempoBerikutnya, setJatuhTempoBerikutnya] = useState('');
  const [kondisiSetelah, setKondisiSetelah] = useState<KondisiAset>('Baik');
  const [catatan, setCatatan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date();
  const alertWindow = new Date();
  alertWindow.setDate(today.getDate() + 30);

  // Load email data on modal open or mount
  const loadEmailData = async () => {
    try {
      const [cfg, logs] = await Promise.all([
        apiClient.getEmailSettings(),
        apiClient.getEmailLogs()
      ]);
      setSmtpConfig(cfg);
      setEmailLogs(logs);
      if (cfg?.defaultRecipient) {
        setTestRecipient(cfg.defaultRecipient);
      }
    } catch (err) {
      console.error('Failed to load email data:', err);
    }
  };

  useEffect(() => {
    loadEmailData();
  }, []);

  const handleTriggerEmailCheck = async () => {
    setIsSendingTrigger(true);
    setEmailNotice(null);
    try {
      const res = await apiClient.triggerCalibrationEmailCheck();
      setEmailNotice({
        type: res.success ? 'success' : 'error',
        message: res.message
      });
      await loadEmailData();
    } catch (err: any) {
      setEmailNotice({
        type: 'error',
        message: err?.message || 'Gagal mengirim email notifikasi'
      });
    } finally {
      setIsSendingTrigger(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpConfig) return;
    try {
      const updated = await apiClient.saveEmailSettings(smtpConfig);
      setSmtpConfig(updated);
      setEmailNotice({ type: 'success', message: 'Pengaturan server SMTP berhasil disimpan!' });
    } catch (err: any) {
      setEmailNotice({ type: 'error', message: err?.message || 'Gagal menyimpan pengaturan SMTP' });
    }
  };

  const handleSendTestEmail = async () => {
    setIsSendingTest(true);
    setEmailNotice(null);
    try {
      const res = await apiClient.sendTestEmail(testRecipient);
      if (res.success) {
        setEmailNotice({ type: 'success', message: res.message });
      } else {
        setEmailNotice({ type: 'error', message: res.message });
      }
      await loadEmailData();
    } catch (err: any) {
      setEmailNotice({ type: 'error', message: err?.message || 'Gagal mengirim email test' });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Filter Assets based on calibration condition
  const filteredAsets = asets.filter((a) => {
    if (!a.tgl_kalibrasi_berikutnya) return filter === 'ALL';

    const dueDate = new Date(a.tgl_kalibrasi_berikutnya);
    const isOverdue = dueDate < today;
    const isH30 = dueDate <= alertWindow && !isOverdue;

    const q = (search || '').toLowerCase().trim();
    const matchesSearch = 
      !q ||
      (a.nama || '').toLowerCase().includes(q) ||
      (a.id_aset || '').toLowerCase().includes(q) ||
      (a.sertifikat_kalibrasi_no || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (filter === 'H30') return isH30 || isOverdue;
    if (filter === 'OVERDUE') return isOverdue;
    if (filter === 'SAFE') return !isH30 && !isOverdue;
    return true;
  });

  const handleOpenAddModal = (asset: Aset) => {
    setSelectedAssetForKalibrasi(asset);
    setTanggal(new Date().toISOString().split('T')[0]);
    // Default next due date: +1 year
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setJatuhTempoBerikutnya(nextYear.toISOString().split('T')[0]);
    setNoSertifikat(`CERT/SCI/${new Date().getFullYear()}/${Math.floor(Math.random() * 8999 + 1000)}`);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetForKalibrasi) return;

    setIsSubmitting(true);
    try {
      await onAddKalibrasi(selectedAssetForKalibrasi.id_aset, {
        tanggal,
        lembaga_kalibrasi: lembaga,
        nomor_sertifikat: noSertifikat,
        jatuh_tempo_berikutnya: jatuhTempoBerikutnya,
        kondisi_setelah: kondisiSetelah,
        catatan,
        pic_input: currentUser.nama
      });

      setIsSubmitting(false);
      setSelectedAssetForKalibrasi(null);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <CalendarClock className="w-5 h-5 text-[#005DAA]" />
            <span>Manajemen & Reminder Kalibrasi Aset</span>
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {isFungsiUmum(currentUser) && (
            <>
              <button
                onClick={() => {
                  setShowEmailModal(true);
                  setEmailTab('TRIGGER');
                }}
                className="px-3 py-1.5 bg-[#005DAA] hover:bg-[#004278] text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
              >
                <Mail className="w-4 h-4 text-sky-200" />
                <span>Kirim Notifikasi Email</span>
              </button>

              <button
                onClick={() => {
                  setShowEmailModal(true);
                  setEmailTab('SETTINGS');
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center space-x-1.5 border border-slate-200 transition-all"
              >
                <Settings className="w-4 h-4 text-slate-500" />
                <span>Pengaturan SMTP</span>
              </button>
            </>
          )}

          {/* Filter Pills */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFilter('H30')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filter === 'H30' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              H-30 / Overdue
            </button>
            <button
              onClick={() => setFilter('OVERDUE')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filter === 'OVERDUE' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Jatuh Tempo!
            </button>
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filter === 'ALL' ? 'bg-[#005DAA] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Aset
            </button>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nama aset, sertifikat, atau ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-xs outline-hidden focus:ring-2 focus:ring-[#002B66]"
          />
        </div>
      </div>

      {/* Asset Calibration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAsets.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-xl border border-gray-200 text-center text-gray-400 text-xs">
            Tidak ada peralatan yang memerlukan kalibrasi sesuai filter pilihan.
          </div>
        ) : (
          filteredAsets.map((a) => {
            const dueDate = a.tgl_kalibrasi_berikutnya ? new Date(a.tgl_kalibrasi_berikutnya) : null;
            const isOverdue = dueDate && dueDate < today;
            const isNear = dueDate && dueDate <= alertWindow && !isOverdue;

            return (
              <div 
                key={a.id_aset} 
                className={`bg-white rounded-xl border p-4 shadow-xs flex flex-col justify-between transition-all ${
                  isOverdue ? 'border-rose-300 ring-1 ring-rose-200' :
                  isNear ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 font-mono">{a.id_aset}</span>
                      <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{a.nama}</h3>
                    </div>
                    
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] shrink-0 ${
                      isOverdue ? 'bg-rose-100 text-rose-800 animate-pulse' :
                      isNear ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {isOverdue ? 'Jatuh Tempo!' : isNear ? 'Perlu Kalibrasi' : 'Kalibrasi Valid'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-600 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <p><span className="font-semibold text-gray-500">Jatuh Tempo Berikutnya:</span> <strong className="text-gray-900">{a.tgl_kalibrasi_berikutnya || '-'}</strong></p>
                    <p><span className="font-semibold text-gray-500">Kalibrasi Terakhir:</span> {a.tgl_kalibrasi_terakhir || '-'}</p>
                    <p><span className="font-semibold text-gray-500">No. Sertifikat:</span> {a.sertifikat_kalibrasi_no || '-'}</p>
                    <p><span className="font-semibold text-gray-500">Pemegang:</span> {a.nama_bidang_sekarang} ({a.nama_pic_sekarang})</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">Status Aset: {a.kondisi}</span>
                  <button
                    onClick={() => handleOpenAddModal(a)}
                    className="bg-[#002B66] hover:bg-[#001D47] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#00A3E0]" />
                    <span>Update Kalibrasi</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Pengiriman Email & Server SMTP */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="shrink-0 flex items-center justify-between pb-3 border-b border-slate-200 mb-2">
              <div className="flex items-center space-x-2">
                <Mail className="w-5 h-5 text-[#005DAA]" />
                <h3 className="font-bold text-slate-900 text-sm">Layanan Notifikasi Email Kalibrasi Otomatis</h3>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub Tabs */}
            <div className="flex border-b border-slate-200 space-x-4 text-xs font-bold">
              <button
                onClick={() => setEmailTab('TRIGGER')}
                className={`pb-2.5 flex items-center space-x-1.5 border-b-2 transition-all ${
                  emailTab === 'TRIGGER'
                    ? 'border-[#005DAA] text-[#005DAA]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>Kirim Email Langsung</span>
              </button>

              <button
                onClick={() => setEmailTab('SETTINGS')}
                className={`pb-2.5 flex items-center space-x-1.5 border-b-2 transition-all ${
                  emailTab === 'SETTINGS'
                    ? 'border-[#005DAA] text-[#005DAA]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>Konfigurasi SMTP Server</span>
              </button>

              <button
                onClick={() => {
                  setEmailTab('LOGS');
                  loadEmailData();
                }}
                className={`pb-2.5 flex items-center space-x-1.5 border-b-2 transition-all ${
                  emailTab === 'LOGS'
                    ? 'border-[#005DAA] text-[#005DAA]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Log Pengiriman ({emailLogs.length})</span>
              </button>
            </div>

            {/* Notice Alert */}
            {emailNotice && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center justify-between ${
                  emailNotice.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {emailNotice.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{emailNotice.message}</span>
                </div>
                <button onClick={() => setEmailNotice(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* TAB 1: Trigger Dispatch */}
            {emailTab === 'TRIGGER' && (
              <div className="space-y-4 text-xs">
                <div className="bg-sky-50 border border-sky-200 p-4 rounded-xl text-sky-900 space-y-2">
                  <div className="font-bold text-sm text-[#005DAA] flex items-center space-x-1.5">
                    <Clock className="w-4 h-4" />
                    <span>Mekanisme Peringatan H-30, H-7, & Hari H</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Sistem mengecek seluruh master aset peralatan. Setiap aset yang belum dikalibrasi pada milestone 
                    <strong> H-30 Hari</strong>, <strong>H-7 Hari</strong>, atau <strong>Hari H / Melewati Jatuh Tempo</strong> akan langsung dikirimkan email pemberitahuan ke PIC/Pemegang Aset.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-800">Status Server Email Notifikasi saat ini:</h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <div>
                      <span className="text-slate-400">Server SMTP:</span> <strong className="text-slate-800">{smtpConfig?.host || 'smtp.gmail.com'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Pengirim:</span> <strong className="text-slate-800">{smtpConfig?.fromEmail || smtpConfig?.user || 'fatwasembiring8@gmail.com'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Default Target:</span> <strong className="text-slate-800">{smtpConfig?.defaultRecipient || 'fatwasembiring8@gmail.com'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Status Modul:</span> <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${smtpConfig?.enabled !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{smtpConfig?.enabled !== false ? 'AKTIF (Sistem Otomatis)' : 'NONAKTIF'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <div className="text-slate-500 text-[11px]">
                    * Sistem secara otomatis menjalankan pemeriksaan background setiap 12 jam.
                  </div>
                  <button
                    onClick={handleTriggerEmailCheck}
                    disabled={isSendingTrigger}
                    className="px-5 py-2.5 bg-[#005DAA] hover:bg-[#004278] text-white rounded-xl font-bold shadow-md flex items-center space-x-2 disabled:opacity-50"
                  >
                    {isSendingTrigger ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 text-sky-200" />
                    )}
                    <span>{isSendingTrigger ? 'Memproses Pengiriman Email...' : 'Kirim Email Reminder Sekarang'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: SMTP Settings */}
            {emailTab === 'SETTINGS' && (
              <form onSubmit={handleSaveSmtp} className="space-y-3 text-xs">
                {(!smtpConfig?.pass || smtpConfig?.pass === '••••••••••••') && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900 leading-relaxed text-[11px]">
                    <strong>Petunjuk Sandi SMTP (Gmail / Google Workspace):</strong><br />
                    Gunakan <strong>App Password 16 karakter</strong> dari Akun Google (Google Account &gt; Security &gt; 2-Step Verification &gt; App Passwords) untuk mengizinkan aplikasi mengirim email kalibrasi secara otomatis.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">SMTP Host Server *</label>
                    <input
                      type="text"
                      required
                      placeholder="smtp.gmail.com"
                      value={smtpConfig?.host || ''}
                      onChange={(e) => setSmtpConfig(prev => prev ? { ...prev, host: e.target.value } : null)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">SMTP Port *</label>
                    <input
                      type="number"
                      required
                      placeholder="587"
                      value={smtpConfig?.port || 587}
                      onChange={(e) => setSmtpConfig(prev => prev ? { ...prev, port: Number(e.target.value) } : null)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email Pengirim (SMTP User) *</label>
                    <input
                      type="email"
                      required
                      placeholder="ade.sembiring@sucofindo.co.id"
                      value={smtpConfig?.user || ''}
                      onChange={(e) => setSmtpConfig(prev => prev ? { ...prev, user: e.target.value } : null)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Password / App Password *</label>
                    <input
                      type="password"
                      placeholder="Password App / Password SMTP"
                      value={smtpConfig?.pass || ''}
                      onChange={(e) => setSmtpConfig(prev => prev ? { ...prev, pass: e.target.value } : null)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Tampilan Pengirim (Sender Name)</label>
                    <input
                      type="text"
                      placeholder="SUCOFINDO - Monitoring Aset"
                      value={smtpConfig?.fromName || ''}
                      onChange={(e) => setSmtpConfig(prev => prev ? { ...prev, fromName: e.target.value } : null)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Default Target Receiver Email</label>
                    <input
                      type="email"
                      placeholder="fatwasembiring8@gmail.com"
                      value={smtpConfig?.defaultRecipient || ''}
                      onChange={(e) => setSmtpConfig(prev => prev ? { ...prev, defaultRecipient: e.target.value } : null)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                    />
                  </div>
                </div>

                {/* Test Email Bar */}
                <div className="pt-3 mt-3 border-t border-slate-200 bg-slate-50 p-3 rounded-xl flex items-center justify-between gap-3">
                  <div className="grow">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Uji Coba Pengiriman Langsung ke Email:</label>
                    <input
                      type="email"
                      value={testRecipient}
                      onChange={(e) => setTestRecipient(e.target.value)}
                      placeholder="fatwasembiring8@gmail.com"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={isSendingTest}
                    className="self-end px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center space-x-1 shrink-0"
                  >
                    {isSendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Kirim Test Email</span>
                  </button>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#005DAA] hover:bg-[#004278] text-white rounded-lg font-bold shadow-xs"
                  >
                    Simpan Pengaturan SMTP
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: Email History Logs */}
            {emailTab === 'LOGS' && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Menampilkan history real-time email notifikasi kalibrasi:</span>
                  <button
                    onClick={loadEmailData}
                    className="text-[#005DAA] hover:underline flex items-center space-x-1 font-bold"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Muat Ulang Log</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-2.5">Waktu</th>
                        <th className="p-2.5">Milestone</th>
                        <th className="p-2.5">Aset</th>
                        <th className="p-2.5">Penerima</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {emailLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400">
                            Belum ada riwayat pengiriman email notifikasi.
                          </td>
                        </tr>
                      ) : (
                        emailLogs.map((log) => (
                          <tr key={log.id_email} className="hover:bg-slate-50">
                            <td className="p-2.5 text-slate-500 whitespace-nowrap">
                              {new Date(log.sent_at).toLocaleString('id-ID')}
                            </td>
                            <td className="p-2.5 font-bold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                log.milestone === 'Hari H' ? 'bg-rose-100 text-rose-800' :
                                log.milestone === 'H-7' ? 'bg-amber-100 text-amber-800' :
                                log.milestone === 'H-30' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-800'
                              }`}>
                                {log.milestone}
                              </span>
                            </td>
                            <td className="p-2.5 font-semibold text-slate-800 line-clamp-1">
                              {log.nama_aset ? `${log.nama_aset} (${log.id_aset})` : '-'}
                            </td>
                            <td className="p-2.5 text-slate-600 font-mono text-[11px]">
                              {log.recipient}
                            </td>
                            <td className="p-2.5 font-bold">
                              {log.status === 'SENT' ? (
                                <span className="text-emerald-600 flex items-center space-x-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>TERKIRIM</span>
                                </span>
                              ) : (
                                <span className="text-rose-600 flex items-center space-x-1" title={log.error_message}>
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>GAGAL</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAL: Input Sertifikat Kalibrasi Baru */}
      {selectedAssetForKalibrasi && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-gray-100 my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="shrink-0 flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <div className="flex items-center space-x-2">
                <CalendarClock className="w-5 h-5 text-[#002B66]" />
                <h3 className="font-extrabold text-gray-900 text-sm">Update Data Sertifikat Kalibrasi</h3>
              </div>
              <button onClick={() => setSelectedAssetForKalibrasi(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="shrink-0 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-0.5 mb-3">
              <div className="font-bold text-[#002B66]">{selectedAssetForKalibrasi.nama}</div>
              <div className="text-gray-500">ID: {selectedAssetForKalibrasi.id_aset} | Bidang: {selectedAssetForKalibrasi.nama_bidang_sekarang}</div>
            </div>

            <form onSubmit={handleFormSubmit} className="overflow-y-auto flex-1 min-h-0 space-y-3 text-xs pr-1">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Lembaga Kalibrasi *</label>
                <input
                  type="text"
                  required
                  value={lembaga}
                  onChange={(e) => setLembaga(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Nomor Sertifikat Kalibrasi *</label>
                <input
                  type="text"
                  required
                  value={noSertifikat}
                  onChange={(e) => setNoSertifikat(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Tanggal Pengujian *</label>
                  <input
                    type="date"
                    required
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Jatuh Tempo Berikutnya *</label>
                  <input
                    type="date"
                    required
                    value={jatuhTempoBerikutnya}
                    onChange={(e) => setJatuhTempoBerikutnya(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Kondisi Alat Setelah Kalibrasi</label>
                <select
                  value={kondisiSetelah}
                  onChange={(e) => setKondisiSetelah(e.target.value as KondisiAset)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                >
                  <option value="Baik">Baik</option>
                  <option value="Rusak Ringan">Rusak Ringan</option>
                  <option value="Rusak Berat">Rusak Berat</option>
                  <option value="Hilang">Hilang</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Catatan Pengujian</label>
                <textarea
                  rows={2}
                  placeholder="Catatan deviasi atau akurasi hasil pengujian..."
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                />
              </div>

              <div className="shrink-0 flex items-center justify-end space-x-2 pt-3 border-t border-gray-100 mt-3">
                <button
                  type="button"
                  onClick={() => setSelectedAssetForKalibrasi(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#002B66] hover:bg-[#001D47] text-white rounded-lg font-bold shadow-sm"
                >
                  Simpan Kalibrasi Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

