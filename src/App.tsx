import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Aset, 
  Bidang, 
  Cabang,
  User, 
  Role,
  DashboardStats, 
  Pengajuan, 
  AuditLog,
  isKepalaBidangDukunganBisnis,
  isKepalaCabang,
  isKepalaBidang
} from './types';
import { apiClient } from './lib/apiClient';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardOverview } from './components/DashboardOverview';
import { MasterDataAset } from './components/MasterDataAset';
import { QRScannerModal } from './components/QRScannerModal';
import { AssignmentModal } from './components/AssignmentModal';
import { KalibrasiManager } from './components/KalibrasiManager';
import { ApprovalWorkflow } from './components/ApprovalWorkflow';
import { AuditTrailView } from './components/AuditTrailView';
import { UserManagementView } from './components/UserManagementView';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { LoginPage } from './components/LoginPage';
import { OrderManagementView } from './components/OrderManagementView';
import { UtilisasiManagementView } from './components/UtilisasiManagementView';
import { RefreshCw, AlertCircle, ShieldCheck, Building2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  // Auth State (Strict JWT Token + 2 hour session limit)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const savedUser = localStorage.getItem('sucofindo_user');
    const expiresAt = localStorage.getItem('sucofindo_session_expires');
    const token = localStorage.getItem('sucofindo_jwt_token');
    if (savedUser && token && expiresAt && !isNaN(Number(expiresAt))) {
      if (Date.now() < Number(expiresAt)) {
        return true;
      }
    }
    localStorage.removeItem('sucofindo_user');
    localStorage.removeItem('sucofindo_session_expires');
    localStorage.removeItem('sucofindo_jwt_token');
    return false;
  });
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('sucofindo_user');
    const expiresAt = localStorage.getItem('sucofindo_session_expires');
    const token = localStorage.getItem('sucofindo_jwt_token');
    if (!savedUser || !token || !expiresAt || isNaN(Number(expiresAt)) || Date.now() >= Number(expiresAt)) {
      localStorage.removeItem('sucofindo_user');
      localStorage.removeItem('sucofindo_session_expires');
      localStorage.removeItem('sucofindo_jwt_token');
      return null;
    }
    try { return JSON.parse(savedUser); } catch (e) { return null; }
  });

  // Data States
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [asets, setAsets] = useState<Aset[]>([]);
  const [bidangList, setBidangList] = useState<Bidang[]>([]);
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [pengajuanList, setPengajuanList] = useState<Pengajuan[]>([]);

  // UI Modals
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerInitialAsset, setScannerInitialAsset] = useState<Aset | null>(null);
  const [assignAssetId, setAssignAssetId] = useState<string | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const handleOpenScanner = (asset?: Aset) => {
    setScannerInitialAsset(asset || null);
    setIsScannerOpen(true);
  };

  // Loading & Refresh State
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Ref to track currentUser without triggering callback recreate loops
  const currentUserRef = useRef<User | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Session Expiry & Validity Check (2 hours JWT token rule)
  const checkSession = useCallback(() => {
    const cur = currentUserRef.current;
    const expiresAt = localStorage.getItem('sucofindo_session_expires');
    const token = localStorage.getItem('sucofindo_jwt_token');
    const savedUser = localStorage.getItem('sucofindo_user');

    if (!savedUser || !token || !expiresAt || isNaN(Number(expiresAt)) || Date.now() >= Number(expiresAt)) {
      if (cur?.id) {
        apiClient.logout(cur.id).catch(() => {});
      }
      localStorage.removeItem('sucofindo_user');
      localStorage.removeItem('sucofindo_session_expires');
      localStorage.removeItem('sucofindo_jwt_token');
      currentUserRef.current = null;
      setCurrentUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      return false;
    }
    return true;
  }, []);

  // Fetch all data from Express REST API
  const loadAllData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [
        statsData, 
        asetsData, 
        bidangData, 
        usersData, 
        auditData, 
        pengajuanData,
        cabangsData
      ] = await Promise.all([
        apiClient.getStats().catch(() => null),
        apiClient.getAsets().catch(() => []),
        apiClient.getBidang().catch(() => []),
        apiClient.getUsers().catch(() => []),
        apiClient.getAuditLogs().catch(() => []),
        apiClient.getPengajuan().catch(() => []),
        apiClient.getCabangs().catch(() => [])
      ]);

      // Deduplicate arrays by unique ID safely
      const uniqueAsets = Array.from(new Map((asetsData || []).filter(a => a && (a.id_aset || a.nama_aset)).map(a => [a.id_aset || a.nama_aset, a])).values());
      const uniqueUsers = Array.from(new Map((usersData || []).filter(u => u && (u.username || u.id)).map(u => [u.username ? u.username.toLowerCase() : u.id, u])).values());
      const uniqueAudit = Array.from(new Map((auditData || []).filter(l => l && (l.id_log || l.waktu)).map(l => [l.id_log || `${l.waktu}_${l.aktor}`, l])).values());
      const uniquePengajuan = Array.from(new Map((pengajuanData || []).filter(p => p && (p.id_pengajuan || p.id_aset)).map(p => [p.id_pengajuan || `${p.id_aset}_${p.pemohon_nama}`, p])).values());

      if (statsData) setStats(statsData);
      setAsets(uniqueAsets);
      setBidangList(bidangData || []);
      setCabangList(cabangsData || []);
      setUsers(uniqueUsers);
      setAuditLogs(uniqueAudit);
      setPengajuanList(uniquePengajuan);

      // Verify or update current user if found in updated user list
      const cur = currentUserRef.current;
      if (cur && Array.isArray(usersData) && usersData.length > 0) {
        const found = usersData.find(u => u && (
          (u.username && cur.username && u.username.toLowerCase() === cur.username.toLowerCase()) ||
          (u.id && cur.id && u.id === cur.id)
        ));
        if (found) {
          const isDualRole = isKepalaBidangDukunganBisnis(cur);
          // If dual-role user has explicitly switched mode, retain the chosen role
          const currentChosenRole = isDualRole ? cur.role : found.role;

          const hasCoreChanges =
            found.nama !== cur.nama ||
            found.email !== cur.email ||
            (!isDualRole && found.role !== cur.role) ||
            found.mustChangePassword !== cur.mustChangePassword ||
            found.id_bidang !== cur.id_bidang ||
            found.jabatan !== cur.jabatan;

          if (hasCoreChanges) {
            const updatedUser = { ...cur, ...found, role: currentChosenRole };
            setCurrentUser(updatedUser);
            localStorage.setItem('sucofindo_user', JSON.stringify(updatedUser));
          }
        }
      }

      setErrorMsg('');
    } catch (err: any) {
      console.error('API Fetch Error:', err);
      if (!isSilent) {
        setErrorMsg('Gagal terhubung ke API Server. Silakan periksa koneksi atau coba muat ulang.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load, Session Expiry Check, & Heartbeat Sync
  useEffect(() => {
    if (isAuthenticated) {
      const isValid = checkSession();
      if (!isValid) {
        setIsLoading(false);
        return;
      }

      loadAllData();
      if (currentUser?.id) {
        apiClient.heartbeat(currentUser.id);
      }

      // Auto refresh data & send user heartbeat every 10 seconds
      const syncInterval = setInterval(() => {
        const isSessionValid = checkSession();
        if (isSessionValid) {
          if (currentUser?.id) {
            apiClient.heartbeat(currentUser.id);
          }
          loadAllData(true);
        }
      }, 10000);

      return () => clearInterval(syncInterval);
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, currentUser?.id, checkSession, loadAllData]);

  // Handle Login Success
  const handleLoginSuccess = (user: User, expiresAt?: number) => {
    const sessionExpires = expiresAt || (Date.now() + 2 * 60 * 60 * 1000);
    currentUserRef.current = user;
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('sucofindo_user', JSON.stringify(user));
    localStorage.setItem('sucofindo_session_expires', String(sessionExpires));
    loadAllData();
  };

  // Handle Logout
  const handleLogout = async () => {
    if (currentUser?.id) {
      await apiClient.logout(currentUser.id);
    }
    localStorage.removeItem('sucofindo_user');
    localStorage.removeItem('sucofindo_session_expires');
    localStorage.removeItem('sucofindo_jwt_token');
    currentUserRef.current = null;
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  // Handle Switch Role / Active User
  const handleSwitchUser = async (userId: string) => {
    try {
      const updatedUser = await apiClient.switchRole(userId);
      currentUserRef.current = updatedUser;
      setCurrentUser(updatedUser);
      localStorage.setItem('sucofindo_user', JSON.stringify(updatedUser));
      loadAllData(true);
    } catch (err) {
      console.error(err);
    }
  };

  // Switch Access Mode (Dual-Role capability for Kepala Bidang Dukungan Bisnis)
  const handleSwitchAccessMode = (newRole: Role) => {
    if (!currentUser) return;
    const updatedUser: User = {
      ...currentUser,
      role: newRole,
    };
    currentUserRef.current = updatedUser;
    setCurrentUser(updatedUser);
    localStorage.setItem('sucofindo_user', JSON.stringify(updatedUser));
  };

  // Update User PIC Profile
  const handleUpdateUser = async (id: string, data: Partial<User>) => {
    const updated = await apiClient.updateUser(id, data);
    if (updated) {
      setUsers(prev => prev.map(u => u.id === id ? updated : u));
      if (currentUser?.id === id) {
        setCurrentUser(updated);
      }
    }
    await loadAllData(true);
  };

  // Create User PIC
  const handleCreateUser = async (data: Partial<User>) => {
    const created = await apiClient.createUser(data);
    if (created) {
      setUsers(prev => [...prev, created]);
    }
    await loadAllData(true);
  };

  // Delete User PIC
  const handleDeleteUser = async (id: string) => {
    const ok = await apiClient.deleteUser(id);
    if (ok) {
      setUsers(prev => prev.filter(u => u.id !== id));
    }
    await loadAllData(true);
  };

  // Create New Asset
  const handleCreateAsset = async (data: any) => {
    try {
      await apiClient.createAset(data);
      await loadAllData(true);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan aset');
    }
  };

  // Edit Asset
  const handleUpdateAsset = async (id: string, data: any) => {
    try {
      await apiClient.updateAset(id, data);
      await loadAllData(true);
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah aset');
    }
  };

  // Delete Asset - Disabled per policy
  const handleDeleteAsset = async (_id: string) => {
    alert('Penghapusan aset tidak diperkenankan dalam sistem ini.');
  };

  // Mobile QR Code Update Status
  const handleUpdateStatusMobile = async (idOrQr: string, data: any) => {
    await apiClient.updateAsetMobile(idOrQr, data);
    await loadAllData(true);
  };

  // Assign Asset to Bidang / PIC
  const handleAssignAsset = async (id: string, data: { id_bidang: string; id_pic: string; keterangan: string; diserah_oleh: string }) => {
    await apiClient.assignAset(id, data);
    await loadAllData(true);
  };

  // Add Calibration Certificate
  const handleAddKalibrasi = async (id: string, data: any) => {
    await apiClient.addKalibrasi(id, data);
    await loadAllData(true);
  };

  // Submit Pengajuan
  const handleSubmitPengajuan = async (data: any) => {
    await apiClient.submitPengajuan(data);
    await loadAllData(true);
  };

  // Approve Pengajuan
  const handleApprovePengajuan = async (id: string, note: string) => {
    if (!currentUser) return;
    try {
      const res = await apiClient.approvePengajuan(id, currentUser, note);
      if (res) {
        if (res.pengajuan) {
          setPengajuanList(prev => prev.map(p => p.id_pengajuan === res.pengajuan!.id_pengajuan ? res.pengajuan! : p));
        }
        if (res.aset) {
          setAsets(prev => prev.map(a => a.id_aset === res.aset!.id_aset ? res.aset! : a));
        }
      }
      await loadAllData(true);
    } catch (err: any) {
      alert(err.message || 'Gagal menyetujui pengajuan');
    }
  };

  // Reject Pengajuan
  const handleRejectPengajuan = async (id: string, note: string) => {
    if (!currentUser) return;
    try {
      const res = await apiClient.rejectPengajuan(id, currentUser, note);
      if (res) {
        if (res.pengajuan) {
          setPengajuanList(prev => prev.map(p => p.id_pengajuan === res.pengajuan!.id_pengajuan ? res.pengajuan! : p));
        }
        if (res.aset) {
          setAsets(prev => prev.map(a => a.id_aset === res.aset!.id_aset ? res.aset! : a));
        }
      }
      await loadAllData(true);
    } catch (err: any) {
      alert(err.message || 'Gagal menolak pengajuan');
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    window.open(apiClient.getExportCsvUrl(), '_blank');
  };

  // Role-Based Access Control Filtering:
  // 1. Staff PUMA (Pusat): Aset inventarisasi yang diadakan/dibuat di PUMA
  // 2. Cabang (Fungsi UMUM / Management Cabang): Hanya aset di cabangnya
  // 3. Bidang (PIC Bidang): Hanya aset di bidangnya yang ada di cabangnya
  const visibleAsets = useMemo(() => {
    if (!currentUser) return [];

    // 1. Staff PUMA: Hanya aset inventarisasi yang diadakan/dibuat oleh PUMA
    if (currentUser.role === 'puma') {
      return asets.filter(a => 
        a.sumber_aset === 'PUMA' || 
        a.jenis_pengadaan === 'Investasi' || 
        a.dibuat_oleh_puma
      );
    }

    return asets.filter(a => {
      // 2. Cabang (Fungsi Umum): Wajib berada di cabangnya sendiri (tidak boleh cabang lain)
      if (currentUser.id_cabang && currentUser.id_cabang !== 'ALL') {
        const matchesBranchId = Boolean(a.id_cabang && a.id_cabang === currentUser.id_cabang);
        const matchesBranchName = Boolean(a.nama_cabang && currentUser.nama_cabang && a.nama_cabang.toLowerCase().trim() === currentUser.nama_cabang.toLowerCase().trim());
        
        // Bila asset tidak memiliki cabang dan nama cabang, atau cabang berbeda, jangan tampilkan di cabang ini
        if (!matchesBranchId && !matchesBranchName) {
          return false;
        }
      }

      // 3. Bidang (PIC Bidang): Hanya aset di bidangnya yang ada di cabangnya
      if (currentUser.role === 'pic_bidang') {
        const matchesBidangId = Boolean(currentUser.id_bidang && a.id_bidang_sekarang === currentUser.id_bidang);
        const matchesBidangName = Boolean(
          currentUser.nama_bidang && 
          a.nama_bidang_sekarang && 
          a.nama_bidang_sekarang.toLowerCase().trim() === currentUser.nama_bidang.toLowerCase().trim()
        );
        const matchesPic = Boolean(
          (currentUser.id && a.id_pic_sekarang === currentUser.id) ||
          (currentUser.nama && a.nama_pic_sekarang && a.nama_pic_sekarang.toLowerCase().trim() === currentUser.nama.toLowerCase().trim())
        );

        if (!matchesBidangId && !matchesBidangName && !matchesPic) {
          return false;
        }
      }

      return true;
    });
  }, [asets, currentUser]);

  const isFullAccess = currentUser ? (currentUser.role === 'admin' || currentUser.role === 'management' || currentUser.role === 'pimpinan' || currentUser.role === 'puma') : false;

  const visiblePengajuan = useMemo(() => {
    if (!currentUser) return [];
    return pengajuanList.filter(p => 
      visibleAsets.some(a => a.id_aset === p.id_aset) ||
      p.pemohon_id === currentUser.id ||
      p.pemohon_nama?.toLowerCase() === currentUser.nama?.toLowerCase() ||
      p.id_bidang_asal === currentUser.id_bidang ||
      p.id_bidang_tujuan === currentUser.id_bidang
    );
  }, [pengajuanList, visibleAsets, currentUser]);

  const visibleAuditLogs = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'puma') return auditLogs;
    if (currentUser.id_cabang && currentUser.id_cabang !== 'ALL') {
      return auditLogs.filter(l => !l.id_cabang || l.id_cabang === currentUser.id_cabang || visibleAsets.some(a => a.id_aset === l.id_aset));
    }
    return auditLogs;
  }, [auditLogs, currentUser, visibleAsets]);

  const visibleStats = useMemo(() => {
    if (!currentUser) return null;

    const totalAset = visibleAsets.length;
    const digunakan = visibleAsets.filter(a => a.status === 'Digunakan').length;
    const tersedia = visibleAsets.filter(a => a.status === 'Tersedia').length;
    const dalamPemeliharaan = visibleAsets.filter(a => a.status === 'Dalam Pemeliharaan').length;
    const dipinjamkan = visibleAsets.filter(a => a.status === 'Dipinjamkan').length;
    const prosesDisposal = visibleAsets.filter(a => a.status === 'Proses Disposal').length;
    const disposal = visibleAsets.filter(a => a.status === 'Disposal').length;
    const tidakTersedia = visibleAsets.filter(a => a.status === 'Tidak Tersedia').length;
    const idle = tersedia;
    const maintenance = dalamPemeliharaan;

    const terlambatPengembalian = visibleAsets.filter(a => {
      if (a.status !== 'Digunakan' || !a.tgl_rencana_pengembalian) return false;
      const target = new Date(a.tgl_rencana_pengembalian);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return target < today;
    }).length;

    const kalibrasiAlerts = visibleAsets.filter(a => {
      if (!a.tgl_kalibrasi_berikutnya) return false;
      const due = new Date(a.tgl_kalibrasi_berikutnya).getTime();
      const now = new Date().getTime();
      const daysDiff = (due - now) / (1000 * 3600 * 24);
      return daysDiff <= 30;
    });

    const pengajuanPending = visiblePengajuan.filter(p => p.status_approval === 'Pending').length;

    const katMap: Record<string, number> = {};
    visibleAsets.forEach(a => {
      katMap[a.kategori] = (katMap[a.kategori] || 0) + 1;
    });
    const asetPerKategori = Object.keys(katMap).map(kategori => ({
      kategori,
      jumlah: katMap[kategori]
    }));

    const normalizeBidang = (name?: string, id?: string) => {
      if (!name && !id) return 'Bidang Dukungan Bisnis';
      const lower = (name || '').toLowerCase();
      if (lower.includes('fungsi umum') || lower.includes('dukungan bisnis') || id === 'BDG-01') {
        return 'Bidang Dukungan Bisnis';
      }
      return name || 'Bidang Dukungan Bisnis';
    };

    const bdgMap: Record<string, number> = {};
    visibleAsets.forEach(a => {
      const rawName = a.nama_bidang_sekarang || currentUser?.nama_bidang || currentUser?.bidang;
      const bName = normalizeBidang(rawName, a.id_bidang_sekarang);
      bdgMap[bName] = (bdgMap[bName] || 0) + 1;
    });
    const asetPerBidang = Object.keys(bdgMap).map(bName => ({
      nama_bidang: bName,
      jumlah: bdgMap[bName],
      persen: totalAset > 0 ? Math.round((bdgMap[bName] / totalAset) * 100) : 0
    }));

    return {
      totalAset,
      digunakan,
      tersedia,
      dalamPemeliharaan,
      dipinjamkan,
      prosesDisposal,
      disposal,
      tidakTersedia,
      idle,
      maintenance,
      terlambatPengembalian,
      butuhKalibrasiSegera: kalibrasiAlerts.length,
      pengajuanPending,
      asetPerBidang,
      asetPerKategori,
      kalibrasiAlerts
    };
  }, [visibleAsets, visiblePengajuan, currentUser]);

  const pendingApprovalsCount = visiblePengajuan.filter(p => p.status_approval === 'Pending').length;
  const calibrationAlertsCount = visibleStats?.butuhKalibrasiSegera || 0;
  const currentAssetForAssign = visibleAsets.find(a => a.id_aset === assignAssetId) || null;

  // Login Gate: If not authenticated, render LoginPage
  if (!isAuthenticated || !currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Loading Gate: Loading API data after login
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center space-y-4 max-w-sm w-full border border-slate-200">
          <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs inline-block mx-auto">
            <img
              src="https://i.ibb.co.com/xKsyxsWX/logo-sucofindo.png"
              alt="Logo SUCOFINDO"
              className="h-12 w-auto object-contain mx-auto animate-pulse"
            />
          </div>
          <div>
            <h2 className="font-extrabold text-slate-900 text-base">PT SUCOFINDO (Persero)</h2>
            <p className="text-xs text-[#008C45] font-bold mt-0.5">Sistem Monitoring Aset Real - Time (SMART SCI)</p>
          </div>

          {errorMsg ? (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">{errorMsg}</p>
              <button
                onClick={() => loadAllData()}
                className="w-full py-2 px-4 bg-[#005DAA] hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Muat Ulang Data</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2 text-xs text-slate-500">
              <RefreshCw className="w-4 h-4 animate-spin text-[#005DAA]" />
              <span>Memuat Data API & Database...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased selection:bg-emerald-100 selection:text-[#005DAA]">
      
      {/* Navbar Header */}
      <Header
        currentUser={currentUser}
        allUsers={users}
        onSwitchUser={handleSwitchUser}
        onSwitchAccessMode={handleSwitchAccessMode}
        onLogout={handleLogout}
        onOpenScanner={() => handleOpenScanner()}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        pendingApprovalsCount={pendingApprovalsCount}
        calibrationAlertsCount={calibrationAlertsCount}
        onNavigateToTab={(tab) => setActiveTab(tab)}
      />

      {/* Main Workspace */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row">
        
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingApprovalsCount={pendingApprovalsCount}
          calibrationAlertsCount={calibrationAlertsCount}
          userRole={currentUser.role}
        />

        {/* Content View Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-hidden">
          
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'dashboard' && visibleStats && (
            <DashboardOverview
              stats={visibleStats}
              asets={visibleAsets}
              auditLogs={visibleAuditLogs}
              pendingRequests={visiblePengajuan.filter(p => p.status_approval === 'Pending')}
              currentUser={currentUser}
              onNavigateToTab={(tab) => setActiveTab(tab)}
              onApproveRequest={handleApprovePengajuan}
              onRejectRequest={handleRejectPengajuan}
              onOpenScanner={() => handleOpenScanner()}
            />
          )}

          {(activeTab === 'master' || activeTab === 'assignment') && (
            <MasterDataAset
              asets={visibleAsets}
              bidangList={bidangList}
              userList={users}
              currentUser={currentUser}
              onCreateAsset={handleCreateAsset}
              onUpdateAsset={handleUpdateAsset}
              onAssignAsset={(id) => setAssignAssetId(id)}
              onExportCsv={handleExportCsv}
              onOpenScanner={handleOpenScanner}
              onSubmitRequest={handleSubmitPengajuan}
              auditLogs={visibleAuditLogs}
              pengajuanList={pengajuanList}
              cabangList={cabangList}
              onRefreshData={() => loadAllData(true)}
            />
          )}

          {activeTab === 'utilisasi' && (
            <UtilisasiManagementView
              currentUser={currentUser}
              asets={visibleAsets}
              bidangList={bidangList}
              cabangList={cabangList}
            />
          )}

          {activeTab === 'orders' && (
            <OrderManagementView currentUser={currentUser} />
          )}

          {activeTab === 'mobile_update' && (
            (currentUser.role === 'management' || currentUser.role === 'pimpinan') ? (
              <div className="bg-white p-8 rounded-2xl border border-amber-200 shadow-sm text-center space-y-3 max-w-lg mx-auto">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto font-bold text-lg">
                  !
                </div>
                <h2 className="font-extrabold text-slate-900 text-base">Modul Ditiadakan: Update Mandiri PIC</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Fitur Pemutakhiran Status Mandiri PIC (Scan QR) ditiadakan untuk akun <strong>Management</strong>. Role Management fokus pada pemantauan real-time aset dan persetujuan eksekutif.
                </p>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="bg-[#005DAA] hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs"
                >
                  Kembali ke Dashboard
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3 max-w-lg mx-auto">
                  <div className="w-12 h-12 bg-blue-50 text-[#005DAA] rounded-2xl flex items-center justify-center mx-auto">
                    <span className="font-extrabold text-xl">QR</span>
                  </div>
                  <h2 className="font-extrabold text-slate-900 text-base">Modul Pemutakhiran Mandiri PIC (Scan QR)</h2>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Buka antarmuka pemindaian QR code untuk memperbarui lokasi fisik, kondisi alat, dan status pemakaian secara instan dari perangkat seluler di lapangan.
                  </p>
                  <button
                    onClick={() => setIsScannerOpen(true)}
                    className="bg-[#005DAA] hover:bg-blue-800 text-white px-6 py-3 rounded-xl font-bold text-xs shadow-md inline-flex items-center space-x-2"
                  >
                    <span>Buka Scanner Kamera QR</span>
                  </button>
                </div>
              </div>
            )
          )}

          {activeTab === 'kalibrasi' && (
            <KalibrasiManager
              asets={visibleAsets}
              currentUser={currentUser}
              onAddKalibrasi={handleAddKalibrasi}
            />
          )}

          {activeTab === 'approvals' && (
            <ApprovalWorkflow
              requests={visiblePengajuan}
              asets={visibleAsets}
              bidangList={bidangList}
              userList={users}
              currentUser={currentUser}
              onSubmitRequest={handleSubmitPengajuan}
              onApproveRequest={handleApprovePengajuan}
              onRejectRequest={handleRejectPengajuan}
            />
          )}

          {activeTab === 'audit' && (
            (currentUser.role === 'admin' || currentUser.role === 'puma') ? (
              <AuditTrailView logs={visibleAuditLogs} />
            ) : (
              <div className="bg-white p-8 rounded-2xl border border-rose-200 shadow-sm text-center space-y-3 max-w-lg mx-auto">
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto font-bold text-lg">
                  !
                </div>
                <h2 className="font-extrabold text-slate-900 text-base">Akses Terbatas: Audit Trail</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Modul Audit Trail & Log Activity Sistem khusus diperuntukkan bagi akun <strong>Staff PUMA</strong> dan <strong>Fungsi UMUM</strong> untuk keperluan pengawasan dan kepatuhan audit.
                </p>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="bg-[#005DAA] hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs"
                >
                  Kembali ke Dashboard
                </button>
              </div>
            )
          )}

          {activeTab === 'users' && (
            (currentUser.role === 'admin' || currentUser.role === 'puma') ? (
              <UserManagementView
                users={users}
                bidangList={bidangList}
                currentUser={currentUser}
                onSwitchUser={handleSwitchUser}
                onUpdateUser={handleUpdateUser}
                onCreateUser={handleCreateUser}
                onDeleteUser={handleDeleteUser}
              />
            ) : (
              <div className="bg-white p-8 rounded-2xl border border-rose-200 shadow-sm text-center space-y-3 max-w-lg mx-auto">
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto font-bold text-lg">
                  !
                </div>
                <h2 className="font-extrabold text-slate-900 text-base">Akses Terbatas: Modul Kelola Cabang & PIC</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Pengelolaan Cabang, Bidang, dan PIC Bidang hanya dapat diakses oleh akun <strong>Staff PUMA</strong> atau <strong>Fungsi UMUM</strong>.
                </p>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="bg-[#005DAA] hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs"
                >
                  Kembali ke Dashboard
                </button>
              </div>
            )
          )}

        </main>
      </div>

      {/* Global Modals */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => {
          setIsScannerOpen(false);
          setScannerInitialAsset(null);
        }}
        asets={asets}
        currentUser={currentUser}
        onUpdateStatusMobile={handleUpdateStatusMobile}
        onAddKalibrasi={handleAddKalibrasi}
        initialAsset={scannerInitialAsset}
      />

      <AssignmentModal
        isOpen={!!assignAssetId}
        onClose={() => setAssignAssetId(null)}
        aset={currentAssetForAssign}
        bidangList={bidangList}
        userList={users}
        currentUser={currentUser}
        onAssignSubmit={handleAssignAsset}
      />

      {currentUser && (
        <ChangePasswordModal
          isOpen={isChangePasswordOpen || !!currentUser.mustChangePassword}
          onClose={() => setIsChangePasswordOpen(false)}
          currentUser={currentUser}
          isForced={!!currentUser.mustChangePassword}
          onPasswordChangedSuccess={(updated) => {
            if (updated) {
              setCurrentUser(updated);
              localStorage.setItem('sucofindo_user', JSON.stringify(updated));
            } else if (currentUser) {
              const cleared = { ...currentUser, mustChangePassword: false };
              setCurrentUser(cleared);
              localStorage.setItem('sucofindo_user', JSON.stringify(cleared));
            }
            setIsChangePasswordOpen(false);
            loadAllData(true);
          }}
        />
      )}

      {/* Professional Corporate Footer - Light Theme */}
      <footer className="bg-white text-slate-600 border-t border-slate-200/80 py-3.5 px-6 mt-auto text-xs shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 text-center md:text-left">
            <div className="flex items-center space-x-2 font-semibold text-slate-900 tracking-tight">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#005DAA] to-[#008C45] flex items-center justify-center text-white shadow-xs">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-slate-800">PT SUCOFINDO (Persero)</span>
            </div>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="text-slate-600 bg-slate-100/80 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-slate-200/60">
              FLP Generalist Program &copy; 2026
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[11px]">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200/80 text-[#008C45] rounded-full font-medium">
              <span>SMART Asset Intelligence Online</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
