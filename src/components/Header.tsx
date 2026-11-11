import React, { useState, useEffect } from 'react';
import { User, Role, isKepalaBidangDukunganBisnis } from '../types';
import { 
  ShieldCheck, 
  QrCode, 
  ChevronDown, 
  UserCheck, 
  Wifi, 
  Bell, 
  FileText,
  Building2,
  Sparkles,
  LogOut,
  KeyRound,
  Database,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  X,
  Sliders,
  User as UserIcon
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';

interface HeaderProps {
  currentUser: User;
  allUsers: User[];
  onSwitchUser: (userId: string) => void;
  onSwitchAccessMode?: (role: Role) => void;
  onLogout?: () => void;
  onOpenScanner: () => void;
  onOpenChangePassword?: () => void;
  pendingApprovalsCount: number;
  calibrationAlertsCount: number;
  onNavigateToTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers,
  onSwitchUser,
  onSwitchAccessMode,
  onLogout,
  onOpenScanner,
  onOpenChangePassword,
  pendingApprovalsCount,
  calibrationAlertsCount,
  onNavigateToTab
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ mongoConnected: boolean; connectionError?: string | null; host?: string; databaseName?: string } | null>(null);
  const [showMongoModal, setShowMongoModal] = useState(false);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isKabidDukbis = isKepalaBidangDukunganBisnis(currentUser);

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
    const interval = setInterval(checkDbStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setTestResult(null);
    try {
      const res = await apiClient.reconnectDb();
      if (res.mongoConnected) {
        setDbStatus({ mongoConnected: true, connectionError: null });
        setTestResult({ type: 'success', text: 'Koneksi ke MongoDB Atlas Sangat Baik & Terhubung!' });
      } else {
        setDbStatus({ mongoConnected: false, connectionError: res.message });
        setTestResult({ type: 'error', text: res.message || 'Gagal terhubung. Pastikan IP 0.0.0.0/0 sudah di-whitelist di Atlas Network Access.' });
      }
    } catch (err: any) {
      setDbStatus({ mongoConnected: false, connectionError: err?.message });
      setTestResult({ type: 'error', text: 'Gagal terhubung ke MongoDB Atlas.' });
    } finally {
      setIsTestingConn(false);
    }
  };

  const isConnected = dbStatus?.mongoConnected ?? false;

  const getRoleBadge = (role: string) => {
    if (isKabidDukbis) {
      return (
        <span className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-50 to-emerald-50 text-blue-900 border border-blue-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
          <span className={`w-2 h-2 rounded-full ${role === 'admin' ? 'bg-[#005DAA]' : 'bg-[#008C45]'}`}></span>
          <span>{role === 'admin' ? 'Fungsi UMUM (Admin Penuh)' : 'Kepala Dukungan Bisnis (Management)'}</span>
        </span>
      );
    }
    switch (role) {
      case 'puma':
        return <span className="bg-purple-100 text-purple-900 border border-purple-300 text-xs px-2.5 py-0.5 rounded-full font-bold">Staff PUMA (Pusat)</span>;
      case 'admin':
        return <span className="bg-[#005DAA]/10 text-[#005DAA] border border-[#005DAA]/30 text-xs px-2 py-0.5 rounded-full font-bold">Fungsi UMUM</span>;
      case 'pic_bidang':
        return <span className="bg-sky-500/20 text-sky-800 border border-sky-400/30 text-xs px-2 py-0.5 rounded-full font-bold">PIC Setiap Bidang</span>;
      case 'management':
      case 'pimpinan':
        return <span className="bg-emerald-500/20 text-emerald-800 border border-emerald-400/30 text-xs px-2 py-0.5 rounded-full font-bold">Management</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs px-2 py-0.5 rounded-full font-bold">PIC Bidang</span>;
    }
  };

  return (
    <>
      <header className="bg-white border-b border-slate-200 text-slate-800 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Left: Title & Subtitle */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2.5">
                <div className="bg-white p-1 rounded-xl flex items-center justify-center shrink-0 border border-slate-200 shadow-xs">
                  <img
                    src="https://i.ibb.co.com/xKsyxsWX/logo-sucofindo.png"
                    alt="Logo SUCOFINDO"
                    className="h-8 w-auto object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                    SMART SCI <span className="text-[#008C45] font-light">| Real-time Monitor</span>
                  </h1>
                  <p className="text-[11px] text-slate-500 hidden sm:block">
                    Sistem Monitoring Aset Real - Time (SMART SCI)
                  </p>
                </div>
              </div>
            </div>

            {/* Right Controls & User Profile */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              
              {/* MongoDB Atlas Connection Test Button - Khusus Fungsi Umum (Hidden di mobile) */}
              {currentUser.role === 'admin' && (
                <button
                  onClick={() => {
                    setShowMongoModal(true);
                    handleTestConnection();
                  }}
                  className={`hidden sm:flex items-center space-x-2 text-xs font-bold px-3 py-1.5 rounded-full border transition-all active:scale-95 cursor-pointer shadow-2xs ${
                    isConnected
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  }`}
                  title="Klik untuk tes koneksi MongoDB Atlas (Fungsi Umum)"
                >
                  <Database className="w-3.5 h-3.5 text-[#008C45]" />
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  </span>
                  <span>Database: {isConnected ? 'Terhubung' : 'Cek Status'}</span>
                </button>
              )}

              {/* Quick Mobile/Desktop QR Scanner Trigger */}
              <button
                onClick={onOpenScanner}
                className="flex items-center space-x-1.5 bg-[#008C45] hover:bg-[#007037] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-colors active:scale-95"
                title="Scan QR Code Aset di Lapangan"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">Scan QR Aset</span>
              </button>

              {/* Notifications Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                  className="relative p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                  aria-label="Notifikasi"
                >
                  <Bell className="w-5 h-5" />
                  {(pendingApprovalsCount > 0 || calibrationAlertsCount > 0) && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white">
                      {pendingApprovalsCount + calibrationAlertsCount}
                    </span>
                  )}
                </button>

                {showNotifDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-white text-gray-800 rounded-xl shadow-xl border border-slate-200 py-2 z-50 text-sm animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">Pemberitahuan Sistem</span>
                      <span className="text-[10px] bg-emerald-100 text-[#008C45] px-2 py-0.5 rounded-full font-bold">MongoDB Sync</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {pendingApprovalsCount > 0 && (
                        <button
                          onClick={() => {
                            onNavigateToTab('approvals');
                            setShowNotifDropdown(false);
                          }}
                          className="w-full text-left p-3 hover:bg-amber-50/70 transition-colors flex items-start space-x-2.5"
                        >
                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-xs">Persetujuan Menunggu ({pendingApprovalsCount})</p>
                            <p className="text-xs text-slate-600 mt-0.5">Ada pengajuan transfer/disposal yang membutuhkan persetujuan Fungsi Umum.</p>
                          </div>
                        </button>
                      )}

                      {calibrationAlertsCount > 0 && (
                        <button
                          onClick={() => {
                            onNavigateToTab('kalibrasi');
                            setShowNotifDropdown(false);
                          }}
                          className="w-full text-left p-3 hover:bg-rose-50/70 transition-colors flex items-start space-x-2.5"
                        >
                          <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                            <Bell className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-xs">Peringatan Kalibrasi ({calibrationAlertsCount})</p>
                            <p className="text-xs text-slate-600 mt-0.5">Aset mendekati atau telah melewati tanggal jatuh tempo kalibrasi (H-30).</p>
                          </div>
                        </button>
                      )}

                      {pendingApprovalsCount === 0 && calibrationAlertsCount === 0 && (
                        <div className="p-4 text-center text-slate-500 text-xs">
                          Tidak ada pemberitahuan mendesak saat ini. Semua kalibrasi & pengajuan terkendali.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Role Switcher & User Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 transition-all text-slate-800"
                >
                  <div className="w-7 h-7 rounded-full bg-[#008C45] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    {currentUser.nama.charAt(0)}
                  </div>
                  <div className="text-left hidden md:block">
                    <div className="text-xs font-bold leading-tight truncate max-w-[140px] text-slate-900">
                      {currentUser.nama}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                      NPP: {currentUser.npp}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Profil Pengguna</div>
                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            setShowProfileModal(true);
                          }}
                          className="text-[11px] text-[#005DAA] hover:underline font-bold flex items-center space-x-1"
                        >
                          <UserIcon className="w-3 h-3" />
                          <span>Detail Profil</span>
                        </button>
                      </div>
                      <div className="font-bold text-slate-900 text-sm">{currentUser.nama}</div>
                      <div className="text-xs text-slate-600 font-medium">NPP: <span className="font-semibold text-slate-800">{currentUser.npp}</span></div>
                      {currentUser.email && (
                        <div className="text-xs text-slate-600 font-medium truncate">Email: <span className="font-semibold text-slate-800">{currentUser.email}</span></div>
                      )}
                      <div className="text-xs text-slate-600 font-medium">Jabatan: <span className="font-semibold text-slate-800">{currentUser.jabatan}</span></div>
                      <div className="text-xs text-slate-600 font-medium">Bidang: <span className="font-semibold text-slate-800">{currentUser.nama_bidang || currentUser.bidang || '-'}</span></div>
                      <div className="text-xs text-slate-600 font-medium">Cabang: <span className="font-semibold text-slate-800">{currentUser.nama_cabang || (currentUser.role === 'puma' ? 'Kantor Pusat PUMA' : 'Cabang Utama')}</span></div>
                      <div className="pt-1.5">{getRoleBadge(currentUser.role)}</div>
                    </div>

                    {/* DUAL-ACCESS QUICK SWITCHER FOR KEPALA BIDANG DUKUNGAN BISNIS */}
                    {isKabidDukbis && onSwitchAccessMode && (
                      <div className="p-3 bg-gradient-to-br from-blue-50/80 to-emerald-50/80 border-b border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-extrabold text-slate-800 flex items-center space-x-1">
                            <Sliders className="w-3.5 h-3.5 text-[#005DAA]" />
                            <span>Pilih Mode Akses:</span>
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">
                            {currentUser.role === 'admin' ? 'Akses Admin' : 'Akses Pimpinan'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSwitchAccessMode('admin')}
                            className={`p-2 rounded-lg border text-left transition-all ${
                              currentUser.role === 'admin'
                                ? 'bg-white border-[#005DAA] text-[#005DAA] shadow-xs ring-1 ring-[#005DAA]'
                                : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[11px] font-extrabold">Fungsi UMUM</span>
                              {currentUser.role === 'admin' && <CheckCircle className="w-3 h-3 text-[#005DAA]" />}
                            </div>
                            <p className="text-[9.5px] text-slate-500 line-clamp-2 leading-tight">
                              Akses Penuh Kelola Aset & Kalibrasi
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => onSwitchAccessMode('management')}
                            className={`p-2 rounded-lg border text-left transition-all ${
                              currentUser.role === 'management' || currentUser.role === 'pimpinan'
                                ? 'bg-white border-[#008C45] text-[#008C45] shadow-xs ring-1 ring-[#008C45]'
                                : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[11px] font-extrabold">Kepala Dukbis</span>
                              {(currentUser.role === 'management' || currentUser.role === 'pimpinan') && (
                                <CheckCircle className="w-3 h-3 text-[#008C45]" />
                              )}
                            </div>
                            <p className="text-[9.5px] text-slate-500 line-clamp-2 leading-tight">
                              Akses Pimpinan & Tinjauan Eksekutif
                            </p>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-slate-100 p-2 bg-slate-50 space-y-1.5">
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          setShowProfileModal(true);
                        }}
                        className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs transition-colors"
                      >
                        <UserIcon className="w-4 h-4 text-slate-500" />
                        <span>Buka Profil & Pengaturan Akses</span>
                      </button>

                      {onOpenChangePassword && (
                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            onOpenChangePassword();
                          }}
                          className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#005DAA] font-bold text-xs transition-colors"
                        >
                          <KeyRound className="w-4 h-4" />
                          <span>Ganti Password Akun</span>
                        </button>
                      )}

                      {onLogout && (
                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            onLogout();
                          }}
                          className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Keluar / Logout Akun</span>
                        </button>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-1 px-3">
                      <div className="text-[10px] text-slate-400 text-center py-1">
                        Role-Based Access Control (RBAC) Aktif
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      </header>

      {/* MODAL TES KONEKSI MONGODB ATLAS (Khusus Fungsi Umum) */}
      {currentUser.role === 'admin' && showMongoModal && (
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
                  <h3 className="font-extrabold text-slate-900 text-base">Cek & Tes Koneksi MongoDB Atlas</h3>
                  <p className="text-xs font-mono text-slate-500">{dbStatus?.host || 'smart.xnh2obj.mongodb.net'}</p>
                </div>
              </div>
              <button
                onClick={() => setShowMongoModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Connection Box */}
            {isConnected ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-emerald-900">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Database MongoDB Atlas Terhubung Langsung</div>
                  <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                    Semua input dari berbagai komputer/HP otomatis tersimpan ke cluster MongoDB Atlas secara terpusat.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Akses IP Perlu Whitelist di Atlas</div>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Aplikasi berjalan pada server Cloud Run dengan IP dinamis. Buka dashboard MongoDB Atlas &rarr; <strong>Network Access</strong> &rarr; tambahkan <code>0.0.0.0/0</code> (Allow Access from Anywhere).
                  </p>
                </div>
              </div>
            )}

            {/* Test Connection Output */}
            {testResult && (
              <div className={`p-3 rounded-xl border text-xs font-bold ${
                testResult.type === 'success' ? 'bg-emerald-100 border-emerald-300 text-emerald-900' : 'bg-rose-100 border-rose-300 text-rose-900'
              }`}>
                {testResult.text}
              </div>
            )}

            {/* Connection Instructions */}
            <div className="space-y-2 text-xs">
              <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                Langkah Cepat Whitelist MongoDB Atlas:
              </h4>

              <ol className="space-y-1.5 list-decimal list-inside text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <li className="leading-relaxed">
                  Buka MongoDB Atlas di{' '}
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
                <li className="leading-relaxed">Pilih menu <strong>Network Access</strong> di bilah kiri.</li>
                <li className="leading-relaxed">Klik tombol <strong>+ Add IP Address</strong>.</li>
                <li className="leading-relaxed">Klik <strong>ALLOW ACCESS FROM ANYWHERE</strong> (IP: <code>0.0.0.0/0</code>).</li>
                <li className="leading-relaxed">Klik tombol <strong>Confirm</strong> lalu tekan tombol tes di bawah.</li>
              </ol>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">
                MongoDB URI Configured
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
                  onClick={handleTestConnection}
                  disabled={isTestingConn}
                  className="px-4 py-2 bg-[#008C45] hover:bg-[#007037] text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingConn ? 'animate-spin' : ''}`} />
                  <span>{isTestingConn ? 'Menguji...' : 'Tes Connection MongoDB'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL PROFIL & PENGATURAN AKSES */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 text-slate-800 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#005DAA] to-[#008C45] text-white flex items-center justify-center text-lg font-extrabold shadow-sm">
                  {currentUser.nama.charAt(0)}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">Profil Pengguna & Hak Akses</h3>
                  <p className="text-xs text-slate-500">PT SUCOFINDO — SMART SCI Asset Management</p>
                </div>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Nama Lengkap</div>
                  <div className="text-base font-bold text-slate-900">{currentUser.nama}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Nomor Pokok Pegawai (NPP)</div>
                  <div className="text-sm font-mono font-bold text-slate-800">{currentUser.npp}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Email Kedinasan:</span>
                  <p className="font-semibold text-slate-800 mt-0.5 truncate">{currentUser.email || '-'}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Username Login:</span>
                  <p className="font-mono font-semibold text-slate-800 mt-0.5">{currentUser.username}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Jabatan Saat Ini:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{currentUser.jabatan}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Bidang / Unit Kerja:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{currentUser.nama_bidang || currentUser.bidang || 'Bidang Dukungan Bisnis'}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Role / Mode Aktif:</span>
                <div>{getRoleBadge(currentUser.role)}</div>
              </div>
            </div>

            {/* DUAL-ACCESS MODE SELECTION FOR KEPALA BIDANG DUKUNGAN BISNIS */}
            {isKabidDukbis ? (
              <div className="space-y-3 bg-gradient-to-br from-blue-50/90 via-slate-50 to-emerald-50/90 p-4 rounded-2xl border border-blue-200 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-[#005DAA] text-white rounded-lg">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">Pilihan Mode Akses (Dual Role)</h4>
                      <p className="text-[11px] text-slate-600">Khusus Kepala Bidang Dukungan Bisnis dapat memilih 2 mode akses operasional</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Option 1: Full Fungsi UMUM */}
                  <div
                    onClick={() => onSwitchAccessMode && onSwitchAccessMode('admin')}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                      currentUser.role === 'admin'
                        ? 'bg-white border-[#005DAA] shadow-md ring-2 ring-[#005DAA]/20'
                        : 'bg-white/80 border-slate-200 hover:border-blue-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#005DAA] flex items-center justify-center font-bold">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 text-xs sm:text-sm">Akses Full Fungsi UMUM</div>
                          <span className="text-[10px] bg-blue-100 text-[#005DAA] px-1.5 py-0.5 rounded font-bold">Admin Penuh</span>
                        </div>
                      </div>
                      {currentUser.role === 'admin' ? (
                        <span className="flex items-center space-x-1 text-[11px] font-bold text-[#005DAA] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Aktif</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="text-[11px] font-bold text-slate-500 hover:text-[#005DAA]"
                        >
                          Pilih Mode
                        </button>
                      )}
                    </div>

                    <ul className="mt-3 space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                      <li>Kelola seluruh Master Data Aset & Inventaris</li>
                      <li>Pencatatan & Pengingat Kalibrasi Alat Uji</li>
                      <li>Verifikasi & Approval Pengajuan Aset</li>
                      <li>Kelola Manajemen Pengguna & Sistem</li>
                    </ul>

                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSwitchAccessMode) onSwitchAccessMode('admin');
                        }}
                        className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          currentUser.role === 'admin'
                            ? 'bg-[#005DAA] text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-[#005DAA]'
                        }`}
                      >
                        {currentUser.role === 'admin' ? '✓ Mode Sedang Digunakan' : 'Beralih ke Fungsi UMUM'}
                      </button>
                    </div>
                  </div>

                  {/* Option 2: Kepala Dukungan Bisnis (Management) */}
                  <div
                    onClick={() => onSwitchAccessMode && onSwitchAccessMode('management')}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                      currentUser.role === 'management' || currentUser.role === 'pimpinan'
                        ? 'bg-white border-[#008C45] shadow-md ring-2 ring-[#008C45]/20'
                        : 'bg-white/80 border-slate-200 hover:border-emerald-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#008C45] flex items-center justify-center font-bold">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 text-xs sm:text-sm">Kepala Dukungan Bisnis</div>
                          <span className="text-[10px] bg-emerald-100 text-[#008C45] px-1.5 py-0.5 rounded font-bold">Management / Pimpinan</span>
                        </div>
                      </div>
                      {currentUser.role === 'management' || currentUser.role === 'pimpinan' ? (
                        <span className="flex items-center space-x-1 text-[11px] font-bold text-[#008C45] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Aktif</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="text-[11px] font-bold text-slate-500 hover:text-[#008C45]"
                        >
                          Pilih Mode
                        </button>
                      )}
                    </div>

                    <ul className="mt-3 space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                      <li>Tinjauan Dashboard Eksekutif & Statistik</li>
                      <li>Persetujuan Pimpinan (Level 2 Approval)</li>
                      <li>Pengawasan Kepatuhan Kalibrasi & Audit</li>
                      <li>Monitoring Distribusi Aset Seluruh Bidang</li>
                    </ul>

                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSwitchAccessMode) onSwitchAccessMode('management');
                        }}
                        className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          currentUser.role === 'management' || currentUser.role === 'pimpinan'
                            ? 'bg-[#008C45] text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-[#008C45]'
                        }`}
                      >
                        {currentUser.role === 'management' || currentUser.role === 'pimpinan' ? '✓ Mode Sedang Digunakan' : 'Beralih ke Kepala Dukbis'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Footer Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              {onOpenChangePassword ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    onOpenChangePassword();
                  }}
                  className="px-3.5 py-2 border border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-[#005DAA] font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Ganti Password Akun</span>
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                Selesai / Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

