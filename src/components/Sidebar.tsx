import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ArrowRightLeft, 
  QrCode, 
  CalendarClock, 
  CheckCircle2, 
  History, 
  Users,
  Building,
  Database,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  X,
  CheckCircle,
  AlertTriangle,
  ReceiptText,
  Gauge
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingApprovalsCount: number;
  calibrationAlertsCount: number;
  userRole: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingApprovalsCount,
  calibrationAlertsCount,
  userRole
}) => {
  const [dbStatus, setDbStatus] = useState<{ mongoConnected: boolean; connectionError?: string | null; host?: string; databaseName?: string } | null>(null);
  const [showMongoModal, setShowMongoModal] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectMsg, setReconnectMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const checkDbStatus = async () => {
    try {
      const res = await apiClient.getDbStatus();
      setDbStatus(res);
    } catch {
      setDbStatus({ mongoConnected: false });
    }
  };

  useEffect(() => {
    checkDbStatus();
    const interval = setInterval(checkDbStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    setReconnectMsg(null);
    try {
      const res = await apiClient.reconnectDb();
      if (res.mongoConnected) {
        setDbStatus({ mongoConnected: true, connectionError: null });
        setReconnectMsg({ type: 'success', text: 'Berhasil terhubung ke MongoDB Atlas!' });
      } else {
        setDbStatus({ mongoConnected: false, connectionError: res.message });
        setReconnectMsg({ type: 'error', text: res.message || 'Gagal terhubung. Pastikan IP 0.0.0.0/0 sudah di-whitelist di Atlas.' });
      }
    } catch (err: any) {
      setDbStatus({ mongoConnected: false, connectionError: err?.message });
      setReconnectMsg({ type: 'error', text: 'Gagal terhubung ke MongoDB. Periksa koneksi.' });
    } finally {
      setIsReconnecting(false);
    }
  };

  const rawNavItems = [
    {
      id: 'dashboard',
      label: 'Dashboard Real-Time',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'master',
      label: 'Master & Assignment Aset',
      icon: Package,
      badge: null
    },
    {
      id: 'utilisasi',
      label: 'Detail Utilisasi Aset',
      icon: Gauge,
      badge: 'Per Aset',
      badgeColor: 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/30'
    },
    {
      id: 'orders',
      label: 'Data Order',
      icon: ReceiptText,
      badge: userRole === 'admin' ? 'Fungsi Umum' : null,
      badgeColor: 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/30'
    },
    {
      id: 'mobile_update',
      label: 'Update Mandiri PIC',
      icon: QrCode,
      badge: 'Scan QR',
      badgeColor: 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/30'
    },
    {
      id: 'kalibrasi',
      label: 'Jadwal & Kalibrasi',
      icon: CalendarClock,
      badge: calibrationAlertsCount > 0 ? `${calibrationAlertsCount}` : null,
      badgeColor: 'bg-rose-500 text-white'
    },
    {
      id: 'approvals',
      label: 'Approval Workflow',
      icon: CheckCircle2,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount}` : null,
      badgeColor: 'bg-amber-500 text-white'
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      icon: History,
      badge: userRole === 'puma' ? 'Semua Log' : 'Fungsi Umum',
      adminOnly: true
    },
    {
      id: 'users',
      label: userRole === 'puma' ? 'Kelola Cabang & PIC' : 'Kelola Bidang & PIC',
      icon: Users,
      badge: userRole === 'puma' ? 'PUMA Pusat' : 'Fungsi Umum',
      adminOnly: true
    }
  ];

  const navItems = rawNavItems.filter((item) => {
    if (item.adminOnly) {
      return userRole === 'admin' || userRole === 'puma';
    }
    // Update Mandiri PIC scan QR ditiadakan untuk role Management
    if (item.id === 'mobile_update' && (userRole === 'management' || userRole === 'pimpinan')) {
      return false;
    }
    return true;
  });

  const isConnected = dbStatus?.mongoConnected ?? false;

  return (
    <>
      <aside className="bg-[#005DAA] text-white border-r border-blue-800 w-full md:w-64 shrink-0 p-4 flex flex-col justify-between shadow-md font-sans">
        <div className="space-y-4">
          {/* Brand Header with Official Sucofindo Logo */}
          <div className="pb-4 border-b border-blue-700/50 flex items-center gap-3">
            <div className="bg-white p-1.5 rounded-xl flex items-center justify-center shrink-0 shadow-xs border border-white/20">
              <img
                src="https://i.ibb.co.com/xKsyxsWX/logo-sucofindo.png"
                alt="Logo SUCOFINDO"
                className="h-8 w-auto object-contain"
              />
            </div>
            <div>
              <div className="font-extrabold text-lg tracking-tight uppercase text-white leading-none">
                SUCOFINDO
              </div>
              <span className="text-emerald-300 font-black text-[10px] tracking-[0.2em] uppercase block mt-1">
                DIGITAL DASHBOARD
              </span>
            </div>
          </div>

          <div className="px-1 text-[10px] font-bold text-blue-200 uppercase tracking-widest">
            Menu Utama Monitoring
          </div>

          {/* Navigation List */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors duration-150 ${
                    isActive
                      ? 'bg-[#008C45] text-white shadow-xs'
                      : 'text-blue-100 hover:bg-blue-700/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-start space-x-2.5 min-w-0 flex-1">
                    <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${isActive ? 'text-white' : 'text-blue-200'}`} />
                    <span className="text-left leading-snug break-words">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 self-center ${
                        item.badgeColor || 'bg-white/20 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-6 border-t border-blue-700/50 mt-6 space-y-2">
          {/* MongoDB Atlas Status Card - Khusus Fungsi Umum */}
          {userRole === 'admin' && (
            <button
              onClick={() => setShowMongoModal(true)}
              className={`w-full text-left rounded-xl p-2.5 text-xs transition-all border shadow-xs ${
                isConnected
                  ? 'bg-emerald-950/70 border-emerald-500/50 hover:bg-emerald-900/80 text-emerald-100'
                  : 'bg-amber-950/70 border-amber-500/60 hover:bg-amber-900/80 text-amber-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  </span>
                  <span className="font-bold text-[11px]">
                    MongoDB Atlas
                  </span>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  isConnected
                    ? 'bg-emerald-800/80 text-emerald-200'
                    : 'bg-amber-800/90 text-amber-100'
                }`}>
                  {isConnected ? 'Terhubung' : 'Panduan Whitelist'}
                </span>
              </div>
              <p className="text-[10px] opacity-80 mt-1 leading-tight">
                {isConnected
                  ? 'Database terhubung secara realtime'
                  : 'Perlu whitelist IP 0.0.0.0/0 di Atlas. Klik di sini!'}
              </p>
            </button>
          )}

          <div className="bg-blue-900/40 border border-blue-700/50 rounded-xl p-3 text-xs text-blue-100">
            <div className="flex items-center space-x-2 text-white font-bold">
              <Building className="w-4 h-4 text-[#008C45]" />
              <span>PT SUCOFINDO</span>
            </div>
            <p className="text-[11px] text-blue-200/80 mt-1 leading-relaxed">
              4 Bidang & 1 Unit Pelayanan. Sistem Desentralisasi Input & Sentralisasi Kontrol.
            </p>
          </div>
        </div>
      </aside>

      {/* MODAL PANDUAN CONFIG & WHITELIST MONGODB ATLAS (Khusus Fungsi Umum) */}
      {userRole === 'admin' && showMongoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                  isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Status Database MongoDB Atlas</h3>
                  <p className="text-xs text-slate-500 font-mono">{dbStatus?.host || 'smart.xnh2obj.mongodb.net'}</p>
                </div>
              </div>
              <button
                onClick={() => setShowMongoModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Alert Banner */}
            {isConnected ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start space-x-3 text-xs text-emerald-900">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">MongoDB Atlas Aktif dan Terhubung!</div>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Data transaksi aset, kalibrasi, user, dan audit trail otomatis tersinkronisasi ke cluster MongoDB Atlas Anda.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start space-x-3 text-xs text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Akses IP Perlu Di-Whitelist di MongoDB Atlas</div>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Aplikasi berjalan pada server Google Cloud dengan IP dinamis. Supaya MongoDB Atlas mengizinkan koneksi, pastikan menambahkan IP Whitelist <strong>0.0.0.0/0</strong> (Allow Access from Anywhere).
                  </p>
                </div>
              </div>
            )}

            {/* Reconnect message notice */}
            {reconnectMsg && (
              <div className={`p-3 rounded-xl border text-xs font-semibold ${
                reconnectMsg.type === 'success' ? 'bg-emerald-100 border-emerald-300 text-emerald-900' : 'bg-rose-100 border-rose-300 text-rose-900'
              }`}>
                {reconnectMsg.text}
              </div>
            )}

            {/* Whitelist Step-by-Step Instructions */}
            <div className="space-y-2 text-xs">
              <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                Langkah Cepat Whitelist IP (2 Menit):
              </h4>

              <ol className="space-y-2 list-decimal list-inside text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <li className="leading-relaxed">
                  Buka dashboard MongoDB Atlas Anda di{' '}
                  <a
                    href="https://cloud.mongodb.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[#005DAA] underline inline-flex items-center space-x-1"
                  >
                    <span>cloud.mongodb.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li className="leading-relaxed">
                  Buka menu <strong>Security</strong> &rarr; <strong>Network Access</strong> di panel sebelah kiri.
                </li>
                <li className="leading-relaxed">
                  Klik tombol <strong>+ Add IP Address</strong>.
                </li>
                <li className="leading-relaxed">
                  Klik pilihan <strong>ALLOW ACCESS FROM ANYWHERE</strong> (sistem akan otomatis mengisi <code>0.0.0.0/0</code>).
                </li>
                <li className="leading-relaxed">
                  Klik tombol <strong>Confirm</strong>.
                </li>
              </ol>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Fallback otomatis ke penyimpanan lokal saat offline.
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowMongoModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleReconnect}
                  disabled={isReconnecting}
                  className="px-4 py-2 bg-[#008C45] hover:bg-[#007037] text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? 'animate-spin' : ''}`} />
                  <span>{isReconnecting ? 'Menghubungkan...' : 'Coba Hubungkan Ulang'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

