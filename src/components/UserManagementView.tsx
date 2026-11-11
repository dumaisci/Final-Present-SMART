import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, 
  Bidang, 
  Cabang,
  SmtpConfig, 
  EmailLog, 
  isFungsiUmum, 
  isStaffPuma,
  isKepalaBidangDukunganBisnis, 
  isKepalaCabang, 
  isKepalaBidang, 
  Role 
} from '../types';
import { apiClient } from '../lib/apiClient';
import { PaginationControls } from './PaginationControls';
import { 
  Users, 
  Radio, 
  Edit3, 
  Plus, 
  History, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Sliders, 
  X, 
  Lock, 
  UserPlus, 
  Search, 
  Building, 
  Building2, 
  AtSign, 
  ShieldCheck, 
  Briefcase, 
  Trash2, 
  KeyRound, 
  RotateCcw, 
  Sparkles, 
  Award, 
  MapPin, 
  Phone, 
  Layers, 
  Shield, 
  Globe 
} from 'lucide-react';

interface UserManagementViewProps {
  users: User[];
  bidangList?: Bidang[];
  currentUser: User;
  onSwitchUser: (userId: string) => void;
  onUpdateUser?: (id: string, data: Partial<User>) => Promise<void>;
  onCreateUser?: (data: Partial<User>) => Promise<void>;
  onDeleteUser?: (id: string) => Promise<void>;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  bidangList = [],
  currentUser,
  onSwitchUser,
  onUpdateUser,
  onCreateUser,
  onDeleteUser
}) => {
  const isPuma = isStaffPuma(currentUser) || currentUser.role === 'puma';
  const isUmum = isFungsiUmum(currentUser) || isPuma;
  const onlineCount = users.filter(u => u.isOnline).length;

  // Active Tab: Staff PUMA starts on CABANG; Fungsi UMUM starts on PICS or BIDANG
  const [activeTab, setActiveTab] = useState<'CABANG' | 'BIDANG' | 'PICS' | 'SMTP_SETTINGS' | 'LOGS'>(() => {
    return isPuma ? 'CABANG' : 'PICS';
  });

  // Global Notice
  const [emailNotice, setEmailNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ----------------------------------------------------
  // CABANG STATE (Staff PUMA)
  // ----------------------------------------------------
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [isLoadingCabangs, setIsLoadingCabangs] = useState(false);
  const [cabangSearch, setCabangSearch] = useState('');

  // Add Cabang Modal
  const [isAddCabangOpen, setIsAddCabangOpen] = useState(false);
  const [newCabangKode, setNewCabangKode] = useState('');
  const [newCabangNama, setNewCabangNama] = useState('');
  const [newCabangAlamat, setNewCabangAlamat] = useState('');
  const [newCabangKontak, setNewCabangKontak] = useState('');
  const [isSavingCabang, setIsSavingCabang] = useState(false);

  // Edit Cabang Modal
  const [editingCabang, setEditingCabang] = useState<Cabang | null>(null);
  const [editCabangKode, setEditCabangKode] = useState('');
  const [editCabangNama, setEditCabangNama] = useState('');
  const [editCabangAlamat, setEditCabangAlamat] = useState('');
  const [editCabangKontak, setEditCabangKontak] = useState('');
  const [editCabangStatus, setEditCabangStatus] = useState<'Active' | 'Inactive'>('Active');
  const [isUpdatingCabang, setIsUpdatingCabang] = useState(false);

  // Delete Cabang Modal
  const [deletingCabang, setDeletingCabang] = useState<Cabang | null>(null);
  const [isDeletingCabang, setIsDeletingCabang] = useState(false);

  // ----------------------------------------------------
  // BIDANG STATE (Fungsi UMUM Cabang & Staff PUMA)
  // ----------------------------------------------------
  const [localBidangList, setLocalBidangList] = useState<Bidang[]>(bidangList);
  const [selectedCabangForBidang, setSelectedCabangForBidang] = useState<string>(() => {
    return isPuma ? 'ALL' : (currentUser.id_cabang || 'ALL');
  });
  const [bidangSearch, setBidangSearch] = useState('');
  const [isLoadingBidang, setIsLoadingBidang] = useState(false);

  // Add Bidang Modal
  const [isAddBidangOpen, setIsAddBidangOpen] = useState(false);
  const [newBidangNama, setNewBidangNama] = useState('');
  const [newBidangJenis, setNewBidangJenis] = useState<'Bidang' | 'Unit Pelayanan'>('Bidang');
  const [newBidangPic, setNewBidangPic] = useState('');
  const [newBidangKontak, setNewBidangKontak] = useState('');
  const [newBidangLokasi, setNewBidangLokasi] = useState('');
  const [newBidangCabangId, setNewBidangCabangId] = useState<string>(() => currentUser.id_cabang || 'CBG-01');
  const [isSavingBidang, setIsSavingBidang] = useState(false);

  // Edit Bidang Modal
  const [editingBidang, setEditingBidang] = useState<Bidang | null>(null);
  const [editBidangNama, setEditBidangNama] = useState('');
  const [editBidangJenis, setEditBidangJenis] = useState<'Bidang' | 'Unit Pelayanan'>('Bidang');
  const [editBidangPic, setEditBidangPic] = useState('');
  const [editBidangKontak, setEditBidangKontak] = useState('');
  const [editBidangLokasi, setEditBidangLokasi] = useState('');
  const [isUpdatingBidang, setIsUpdatingBidang] = useState(false);

  // Delete Bidang Modal
  const [deletingBidang, setDeletingBidang] = useState<Bidang | null>(null);
  const [isDeletingBidang, setIsDeletingBidang] = useState(false);

  // ----------------------------------------------------
  // USERS / PIC STATE
  // ----------------------------------------------------
  const [search, setSearch] = useState('');
  const [selectedBidang, setSelectedBidang] = useState('ALL');
  const [selectedUserCabang, setSelectedUserCabang] = useState<string>(() => {
    return isPuma ? 'ALL' : (currentUser.id_cabang || 'ALL');
  });
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'ALL' | 'admin' | 'pic_bidang' | 'management' | 'puma'>('ALL');

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNpp, setEditNpp] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editJabatan, setEditJabatan] = useState('');
  const [editRole, setEditRole] = useState<Role>('pic_bidang');
  const [editTipeManagement, setEditTipeManagement] = useState<'kepala_cabang' | 'kepala_bidang'>('kepala_cabang');
  const [editIdBidang, setEditIdBidang] = useState('');
  const [editCabangId, setEditCabangId] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Delete User Modal State
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Reset Password Modal State
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [isResettingUser, setIsResettingUser] = useState(false);

  // New User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newNama, setNewNama] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newNpp, setNewNpp] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('password123');
  const [newJabatan, setNewJabatan] = useState('');
  const [newRole, setNewRole] = useState<Role>('pic_bidang');
  const [newTipeManagement, setNewTipeManagement] = useState<'kepala_cabang' | 'kepala_bidang'>('kepala_cabang');
  const [newIdBidang, setNewIdBidang] = useState('BDG-01');
  const [newUserCabangId, setNewUserCabangId] = useState<string>(() => currentUser.id_cabang || 'CBG-01');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // ----------------------------------------------------
  // EMAIL SMTP & LOGS STATE
  // ----------------------------------------------------
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [isSendingTrigger, setIsSendingTrigger] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');

  // ----------------------------------------------------
  // LOADERS
  // ----------------------------------------------------
  const loadCabangs = async () => {
    setIsLoadingCabangs(true);
    try {
      const list = await apiClient.getCabangs();
      setCabangList(list);
    } catch (err) {
      console.error('Failed to load cabangs:', err);
    } finally {
      setIsLoadingCabangs(false);
    }
  };

  const loadBidangData = async (targetCabang?: string) => {
    setIsLoadingBidang(true);
    try {
      const list = await apiClient.getBidang(targetCabang && targetCabang !== 'ALL' ? targetCabang : undefined);
      setLocalBidangList(list);
    } catch (err) {
      console.error('Failed to load bidang:', err);
    } finally {
      setIsLoadingBidang(false);
    }
  };

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
    loadCabangs();
    loadBidangData(selectedCabangForBidang);
    loadEmailData();
  }, []);

  useEffect(() => {
    if (bidangList.length > 0 && localBidangList.length === 0) {
      setLocalBidangList(bidangList);
    }
  }, [bidangList]);

  // ----------------------------------------------------
  // CABANG HANDLERS (Staff PUMA)
  // ----------------------------------------------------
  const handleCreateCabang = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCabangKode || !newCabangNama) {
      setEmailNotice({ type: 'error', message: 'Kode cabang dan nama cabang wajib diisi' });
      return;
    }
    setIsSavingCabang(true);
    try {
      const created = await apiClient.createCabang({
        kode_cabang: newCabangKode.trim().toUpperCase(),
        nama_cabang: newCabangNama.trim(),
        alamat: newCabangAlamat.trim(),
        kontak: newCabangKontak.trim(),
        status: 'Active'
      });
      setEmailNotice({ type: 'success', message: `Cabang ${created.nama_cabang} (${created.kode_cabang}) berhasil dibuat beserta default Bidang Dukungan Bisnis!` });
      setIsAddCabangOpen(false);
      setNewCabangKode('');
      setNewCabangNama('');
      setNewCabangAlamat('');
      setNewCabangKontak('');
      await loadCabangs();
      await loadBidangData();
    } catch (err: any) {
      setEmailNotice({ type: 'error', message: err?.message || 'Gagal membuat cabang baru' });
    } finally {
      setIsSavingCabang(false);
    }
  };

  const handleUpdateCabang = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCabang) return;
    setIsUpdatingCabang(true);
    try {
      const updated = await apiClient.updateCabang(editingCabang.id_cabang, {
        kode_cabang: editCabangKode.trim().toUpperCase(),
        nama_cabang: editCabangNama.trim(),
        alamat: editCabangAlamat.trim(),
        kontak: editCabangKontak.trim(),
        status: editCabangStatus
      });
      setEmailNotice({ type: 'success', message: `Data Cabang ${updated.nama_cabang} berhasil diperbarui!` });
      setEditingCabang(null);
      await loadCabangs();
      await loadBidangData();
    } catch (err: any) {
      setEmailNotice({ type: 'error', message: err?.message || 'Gagal memperbarui cabang' });
    } finally {
      setIsUpdatingCabang(false);
    }
  };

  const handleDeleteCabang = async () => {
    if (!deletingCabang) return;
    setIsDeletingCabang(true);
    try {
      await apiClient.deleteCabang(deletingCabang.id_cabang);
      setEmailNotice({ type: 'success', message: `Cabang ${deletingCabang.nama_cabang} berhasil dihapus!` });
      setDeletingCabang(null);
      await loadCabangs();
      await loadBidangData();
    } catch (err: any) {
      setEmailNotice({ type: 'error', message: err?.message || 'Gagal menghapus cabang' });
    } finally {
      setIsDeletingCabang(false);
    }
  };

  // Quick helper: Staff PUMA creates initial Fungsi UMUM for a newly created or existing Branch
  const handleOpenAddAdminForCabang = (c: Cabang) => {
    setNewUserCabangId(c.id_cabang);
    setNewRole('admin');
    setNewJabatan('Administrator Cabang (Fungsi UMUM)');
    setNewNama('');
    setNewEmail('');
    setNewNpp('');
    setNewUsername(`admin_${c.kode_cabang.toLowerCase()}`);
    setNewPassword('password123');
    setIsAddModalOpen(true);
  };

  // ----------------------------------------------------
  // BIDANG HANDLERS (Fungsi UMUM Cabang & Staff PUMA)
  // ----------------------------------------------------
  const handleCreateBidang = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBidangNama) {
      setEmailNotice({ type: 'error', message: 'Nama bidang wajib diisi' });
      return;
    }
    const targetCabangId = isPuma ? newBidangCabangId : (currentUser.id_cabang || 'CBG-01');
    const cMatch = cabangList.find(c => c.id_cabang === targetCabangId);
    setIsSavingBidang(true);
    try {
      const created = await apiClient.createBidang({
        nama_bidang: newBidangNama.trim(),
        jenis: newBidangJenis,
        pic_utama: newBidangPic.trim() || '-',
        kontak: newBidangKontak.trim() || '-',
        lokasi_kantor: newBidangLokasi.trim() || (cMatch ? `Kantor ${cMatch.nama_cabang}` : '-'),
        id_cabang: targetCabangId,
        nama_cabang: cMatch?.nama_cabang || ''
      });
      setEmailNotice({ type: 'success', message: `Bidang ${created.nama_bidang} berhasil ditambahkan di ${cMatch?.nama_cabang || 'Cabang'}!` });
      setIsAddBidangOpen(false);
      setNewBidangNama('');
      setNewBidangPic('');
      setNewBidangKontak('');
      setNewBidangLokasi('');
      await loadBidangData(selectedCabangForBidang);
    } catch (err: any) {
      setEmailNotice({ type: 'error', message: err?.message || 'Gagal menambahkan bidang' });
    } finally {
      setIsSavingBidang(false);
    }
  };

  const handleUpdateBidang = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBidang) return;
    setIsUpdatingBidang(true);
    try {
      const updated = await apiClient.updateBidang(editingBidang.id_bidang, {
        nama_bidang: editBidangNama.trim(),
        jenis: editBidangJenis,
        pic_utama: editBidangPic.trim(),
        kontak: editBidangKontak.trim(),
        lokasi_kantor: editBidangLokasi.trim()
      });
      setEmailNotice({ type: 'success', message: `Bidang ${updated.nama_bidang} berhasil diperbarui!` });
      setEditingBidang(null);
      await loadBidangData(selectedCabangForBidang);
    } catch (err: any) {
      setEmailNotice({ type: 'error', message: err?.message || 'Gagal memperbarui bidang' });
    } finally {
      setIsUpdatingBidang(false);
    }
  };

  const handleDeleteBidang = async () => {
    if (!deletingBidang) return;
    setIsDeletingBidang(true);
    try {
      await apiClient.deleteBidang(deletingBidang.id_bidang);
      setEmailNotice({ type: 'success', message: `Bidang ${deletingBidang.nama_bidang} berhasil dihapus!` });
      setDeletingBidang(null);
      await loadBidangData(selectedCabangForBidang);
    } catch (err: any) {
      setEmailNotice({ type: 'error', message: err?.message || 'Gagal menghapus bidang' });
    } finally {
      setIsDeletingBidang(false);
    }
  };

  // ----------------------------------------------------
  // USER HANDLERS
  // ----------------------------------------------------
  const handleResetPassword = async () => {
    if (!resettingUser) return;
    setIsResettingUser(true);
    try {
      await apiClient.resetUserPassword(resettingUser.id);
      setEmailNotice({
        type: 'success',
        message: `Password pengguna ${resettingUser.nama} (${resettingUser.username || resettingUser.npp}) berhasil direset ke default: password123.`
      });
      setResettingUser(null);
    } catch (err: any) {
      setEmailNotice({
        type: 'error',
        message: err?.message || 'Gagal mereset password pengguna.'
      });
    } finally {
      setIsResettingUser(false);
    }
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setEditNama(u.nama);
    setEditEmail(u.email);
    setEditNpp(u.npp);
    setEditUsername(u.username || (u.email ? u.email.split('@')[0] : ''));
    setEditJabatan(u.jabatan);
    setEditRole(u.role);
    setEditCabangId(u.id_cabang || (u.role === 'puma' ? 'ALL' : 'CBG-01'));
    setEditTipeManagement(u.tipe_management || (u.jabatan?.toLowerCase().includes('kepala cabang') ? 'kepala_cabang' : 'kepala_bidang'));
    setEditIdBidang(u.id_bidang || 'BDG-01');
    setEditPassword('');
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSavingUser(true);

    let finalIdBidang = editIdBidang || 'BDG-01';
    let finalNamaBidang = 'Bidang Dukungan Bisnis';

    if (editRole === 'puma') {
      finalIdBidang = 'BDG-PUMA';
      finalNamaBidang = 'Pengadaan Umum & Manajemen Aset';
    } else if (editRole === 'admin') {
      finalIdBidang = 'BDG-01';
      finalNamaBidang = 'Bidang Dukungan Bisnis (Fungsi UMUM)';
    } else if (editRole === 'management' || editRole === 'pimpinan') {
      if (editTipeManagement === 'kepala_cabang') {
        finalIdBidang = 'BDG-01';
        finalNamaBidang = 'Management Cabang';
      } else {
        const bMatch = localBidangList.find(b => b.id_bidang === editIdBidang);
        finalNamaBidang = bMatch ? bMatch.nama_bidang : 'Bidang Dukungan Bisnis';
      }
    } else {
      const bMatch = localBidangList.find(b => b.id_bidang === editIdBidang);
      finalNamaBidang = bMatch ? bMatch.nama_bidang : 'Bidang Dukungan Bisnis';
    }

    const cMatch = cabangList.find(c => c.id_cabang === editCabangId);

    const updatedData: Partial<User> = {
      nama: editNama,
      email: editEmail,
      npp: editNpp,
      username: editUsername.trim() || (editEmail ? editEmail.split('@')[0] : editingUser.username),
      jabatan: editJabatan || (
        editRole === 'puma'
          ? 'Staff PUMA (Pusat)'
          : editRole === 'admin' 
          ? 'Administrator Cabang (Fungsi UMUM)' 
          : (editRole === 'management' || editRole === 'pimpinan')
          ? (editTipeManagement === 'kepala_cabang' ? 'Management / Kepala Cabang PT SUCOFINDO' : `Kepala ${finalNamaBidang}`)
          : `PIC ${finalNamaBidang}`
      ),
      role: editRole,
      tipe_management: (editRole === 'management' || editRole === 'pimpinan') ? editTipeManagement : undefined,
      id_bidang: finalIdBidang,
      nama_bidang: finalNamaBidang,
      id_cabang: editRole === 'puma' ? 'ALL' : (editCabangId || editingUser.id_cabang || 'CBG-01'),
      nama_cabang: editRole === 'puma' ? 'Kantor Pusat PUMA' : (cMatch?.nama_cabang || editingUser.nama_cabang || ''),
      password: editPassword || undefined
    };

    try {
      if (onUpdateUser) {
        await onUpdateUser(editingUser.id, updatedData);
      } else {
        await apiClient.updateUser(editingUser.id, updatedData);
      }
      setEmailNotice({ type: 'success', message: `Data & Profil pengguna ${editNama} (${editEmail}) berhasil diperbarui!` });
      setEditingUser(null);
    } catch (err: any) {
      setEmailNotice({ type: 'error', message: err?.message || 'Gagal memperbarui data PIC' });
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeletingUser(true);
    try {
      if (onDeleteUser) {
        await onDeleteUser(deletingUser.id);
      } else {
        await apiClient.deleteUser(deletingUser.id);
      }
      setEmailNotice({ type: 'success', message: `Akun PIC ${deletingUser.nama} berhasil dihapus!` });
      setDeletingUser(null);
    } catch (err: any) {
      setEmailNotice({ type: 'error', message: err?.message || 'Gagal menghapus akun PIC' });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);

    let finalIdBidang = 'BDG-01';
    let finalNamaBidang = 'Bidang Dukungan Bisnis';

    if (newRole === 'puma') {
      finalIdBidang = 'BDG-PUMA';
      finalNamaBidang = 'Pengadaan Umum & Manajemen Aset';
    } else if (newRole === 'admin') {
      finalIdBidang = 'BDG-01';
      finalNamaBidang = 'Bidang Dukungan Bisnis (Fungsi UMUM)';
    } else if (newRole === 'management' || newRole === 'pimpinan') {
      if (newTipeManagement === 'kepala_cabang') {
        finalIdBidang = 'BDG-01';
        finalNamaBidang = 'Management Cabang';
      } else {
        finalIdBidang = newIdBidang || 'BDG-01';
        const bMatch = localBidangList.find(b => b.id_bidang === finalIdBidang);
        finalNamaBidang = bMatch ? bMatch.nama_bidang : 'Bidang Dukungan Bisnis';
      }
    } else {
      finalIdBidang = newIdBidang || 'BDG-01';
      const bMatch = localBidangList.find(b => b.id_bidang === finalIdBidang);
      finalNamaBidang = bMatch ? bMatch.nama_bidang : 'Bidang Dukungan Bisnis';
    }

    const calculatedUsername = newUsername.trim() || (newEmail ? newEmail.split('@')[0] : 'user_' + Date.now());

    const defaultJabatan = newRole === 'puma'
      ? 'Staff PUMA (Pusat)'
      : newRole === 'admin' 
      ? 'Administrator Cabang (Fungsi UMUM)' 
      : (newRole === 'management' || newRole === 'pimpinan')
      ? (newTipeManagement === 'kepala_cabang' ? 'Management / Kepala Cabang PT SUCOFINDO' : `Kepala ${finalNamaBidang}`)
      : `PIC ${finalNamaBidang}`;

    const targetCabangId = newRole === 'puma' ? 'ALL' : (isPuma ? newUserCabangId : (currentUser.id_cabang || 'CBG-01'));
    const cMatch = cabangList.find(c => c.id_cabang === targetCabangId);

    const newUserData: Partial<User> = {
      nama: newNama,
      email: newEmail,
      npp: newNpp,
      username: calculatedUsername,
      password: newPassword || 'password123',
      jabatan: newJabatan || defaultJabatan,
      role: newRole,
      tipe_management: (newRole === 'management' || newRole === 'pimpinan') ? newTipeManagement : undefined,
      id_bidang: finalIdBidang,
      nama_bidang: finalNamaBidang,
      id_cabang: targetCabangId,
      nama_cabang: newRole === 'puma' ? 'Kantor Pusat PUMA' : (cMatch?.nama_cabang || currentUser.nama_cabang || '')
    };

    try {
      if (onCreateUser) {
        await onCreateUser(newUserData);
      } else {
        await apiClient.createUser(newUserData);
      }
      setEmailNotice({ type: 'success', message: `Pengguna baru ${newNama} (${newEmail}) berhasil didaftarkan di ${newUserData.nama_cabang || 'Cabang'}!` });
      setIsAddModalOpen(false);
      setNewNama('');
      setNewEmail('');
      setNewNpp('');
      setNewUsername('');
      setNewJabatan('');
      setNewPassword('password123');
    } catch (err: any) {
      setEmailNotice({ type: 'error', message: err?.message || 'Gagal menambahkan PIC baru' });
    } finally {
      setIsCreatingUser(false);
    }
  };

  // ----------------------------------------------------
  // FILTERING & PAGINATION (PICS)
  // ----------------------------------------------------
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Level restriction: Non-Puma users (Fungsi UMUM) can only view users in their branch
      if (!isPuma) {
        if (currentUser.id_cabang && u.id_cabang && u.id_cabang !== currentUser.id_cabang) {
          return false;
        }
      }

      // Role filter (allows Staff PUMA to easily filter only Akun Fungsi UMUM)
      if (selectedRoleFilter !== 'ALL') {
        if (selectedRoleFilter === 'admin' && u.role !== 'admin') return false;
        if (selectedRoleFilter === 'pic_bidang' && u.role !== 'pic_bidang') return false;
        if (selectedRoleFilter === 'management' && u.role !== 'management' && u.role !== 'pimpinan') return false;
        if (selectedRoleFilter === 'puma' && u.role !== 'puma') return false;
      }

      const q = (search || '').toLowerCase().trim();
      const matchesQuery = 
        !q ||
        (u.nama || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.npp || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.jabatan || '').toLowerCase().includes(q) ||
        (u.nama_cabang || '').toLowerCase().includes(q) ||
        (u.nama_bidang || '').toLowerCase().includes(q);

      if (!matchesQuery) return false;
      if (selectedBidang !== 'ALL' && u.id_bidang !== selectedBidang) return false;
      if (selectedUserCabang !== 'ALL' && u.id_cabang !== selectedUserCabang) return false;

      return true;
    });
  }, [users, search, selectedBidang, selectedUserCabang, selectedRoleFilter, isPuma, currentUser.id_cabang]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedBidang, selectedUserCabang, selectedRoleFilter]);

  const totalUserItems = filteredUsers.length;
  const totalUserPages = Math.max(1, Math.ceil(totalUserItems / pageSize));
  const startUserIndex = (currentPage - 1) * pageSize;
  const paginatedUsers = filteredUsers.slice(startUserIndex, startUserIndex + pageSize);

  // Role Counts for Staff PUMA overview
  const countAllAdmins = useMemo(() => users.filter(u => u.role === 'admin').length, [users]);
  const countAllPics = useMemo(() => users.filter(u => u.role === 'pic_bidang').length, [users]);
  const countAllMgmt = useMemo(() => users.filter(u => u.role === 'management' || u.role === 'pimpinan').length, [users]);

  // Filtered Cabangs
  const filteredCabangs = useMemo(() => {
    const q = (cabangSearch || '').toLowerCase().trim();
    if (!q) return cabangList;
    return cabangList.filter(c => 
      c.kode_cabang.toLowerCase().includes(q) ||
      c.nama_cabang.toLowerCase().includes(q) ||
      (c.alamat || '').toLowerCase().includes(q) ||
      (c.kontak || '').toLowerCase().includes(q)
    );
  }, [cabangList, cabangSearch]);

  // Filtered Bidang (Fungsi UMUM can only view & manage bidangs in their own branch)
  const filteredBidang = useMemo(() => {
    return localBidangList.filter(b => {
      // Level restriction: Fungsi UMUM can only see their own branch's bidangs
      if (!isPuma) {
        if (currentUser.id_cabang && b.id_cabang && b.id_cabang !== currentUser.id_cabang) {
          return false;
        }
      } else if (selectedCabangForBidang !== 'ALL') {
        if (b.id_cabang && b.id_cabang !== selectedCabangForBidang) {
          return false;
        }
      }

      const q = (bidangSearch || '').toLowerCase().trim();
      if (!q) return true;
      return (
        b.nama_bidang.toLowerCase().includes(q) ||
        (b.pic_utama || '').toLowerCase().includes(q) ||
        (b.lokasi_kantor || '').toLowerCase().includes(q) ||
        (b.nama_cabang || '').toLowerCase().includes(q)
      );
    });
  }, [localBidangList, selectedCabangForBidang, bidangSearch, isPuma, currentUser.id_cabang]);

  return (
    <div className="space-y-5 font-sans">
      
      {/* Top Header Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-xl text-white ${isPuma ? 'bg-purple-700' : 'bg-[#005DAA]'}`}>
              {isPuma ? <Globe className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 flex items-center space-x-2">
                <span>{isPuma ? 'Pusat Manajemen Cabang & PIC (Staff PUMA)' : 'Modul Pengelolaan Bidang & PIC (Fungsi UMUM)'}</span>
                {isPuma && (
                  <span className="text-[10px] bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-full font-bold">
                    Level 1 - Kantor Pusat
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isPuma
                  ? 'Pengadaan Umum & Manajemen Aset Pusat'
                  : `Cabang ${currentUser.nama_cabang || 'Aktif'}`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isPuma && (
            <button
              onClick={() => setIsAddCabangOpen(true)}
              className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Cabang Baru</span>
            </button>
          )}

          {isUmum && (
            <button
              onClick={() => {
                setNewRole(isPuma ? 'admin' : 'pic_bidang');
                setIsAddModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-[#005DAA] hover:bg-[#004278] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <UserPlus className="w-4 h-4 text-sky-200" />
              <span>{isPuma ? 'Tambah Pengguna' : 'Tambah PIC Baru'}</span>
            </button>
          )}

          <div className="flex items-center space-x-2 bg-emerald-50 text-[#008C45] border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold">
            <Radio className="w-4 h-4 text-[#008C45] animate-pulse" />
            <span>{onlineCount} Online</span>
          </div>
        </div>
      </div>

      {/* Global Notice Alert */}
      {emailNotice && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between shadow-xs ${
            emailNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2 font-medium">
            {emailNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{emailNotice.message}</span>
          </div>
          <button onClick={() => setEmailNotice(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
          {/* TAB CABANG (Staff PUMA Only) */}
          {isPuma && (
            <button
              onClick={() => setActiveTab('CABANG')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
                activeTab === 'CABANG'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Master Cabang ({cabangList.length})</span>
            </button>
          )}

          {/* TAB BIDANG (Customizable by Fungsi UMUM & Staff PUMA) */}
          <button
            onClick={() => setActiveTab('BIDANG')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
              activeTab === 'BIDANG'
                ? 'bg-[#005DAA] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Kostumisasi Bidang ({filteredBidang.length})</span>
          </button>

          {/* TAB PICS */}
          <button
            onClick={() => setActiveTab('PICS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
              activeTab === 'PICS'
                ? 'bg-[#005DAA] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Daftar Pengguna & PIC ({users.length})</span>
          </button>

          {/* TAB SMTP */}
          <button
            onClick={() => setActiveTab('SMTP_SETTINGS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
              activeTab === 'SMTP_SETTINGS'
                ? 'bg-[#005DAA] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Server SMTP Email</span>
          </button>

          {/* TAB LOGS */}
          <button
            onClick={() => {
              setActiveTab('LOGS');
              loadEmailData();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
              activeTab === 'LOGS'
                ? 'bg-[#005DAA] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Log Email ({emailLogs.length})</span>
          </button>
        </div>

        {isPuma ? (
          <div className="px-3 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-lg text-[11px] font-bold flex items-center space-x-1.5">
            <Shield className="w-3.5 h-3.5 text-purple-700" />
            <span>Akses Tertinggi: Staff PUMA (Kantor Pusat)</span>
          </div>
        ) : (
          <div className="px-3 py-1 bg-emerald-50 text-[#008C45] border border-emerald-200 rounded-lg text-[11px] font-bold flex items-center space-x-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#008C45]" />
            <span>Fungsi UMUM: {currentUser.nama_cabang || 'Cabang'}</span>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* TAB 1: MASTER CABANG (Khusus Staff PUMA) */}
      {/* ==================================================== */}
      {activeTab === 'CABANG' && isPuma && (
        <div className="space-y-4">
          {/* Top Summary Metrics for Staff PUMA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">Total Cabang Operasional</span>
                <span className="text-lg font-black text-slate-800">{cabangList.length} Cabang</span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#008C45] flex items-center justify-center font-bold shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">Cabang Ber-Fungsi UMUM</span>
                <span className="text-lg font-black text-[#008C45]">
                  {cabangList.filter(c => users.some(u => u.id_cabang === c.id_cabang && u.role === 'admin')).length} / {cabangList.length}
                </span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">Cabang Belum Ada Admin</span>
                <span className="text-lg font-black text-amber-700">
                  {cabangList.filter(c => !users.some(u => u.id_cabang === c.id_cabang && u.role === 'admin')).length} Cabang
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={cabangSearch}
                onChange={(e) => setCabangSearch(e.target.value)}
                placeholder="Cari kode, nama cabang, kota..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:ring-2 focus:ring-purple-600"
              />
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={loadCabangs}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1 text-slate-600"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCabangs ? 'animate-spin' : ''}`} />
                <span>Segarkan</span>
              </button>
              <button
                onClick={() => setIsAddCabangOpen(true)}
                className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Cabang Baru</span>
              </button>
            </div>
          </div>

          {filteredCabangs.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-extrabold text-slate-700 text-sm">Belum Ada Cabang Terdaftar</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Silakan buat cabang baru pertama Anda. Setiap cabang yang dibuat otomatis memiliki Bidang Dukungan Bisnis untuk siap dikelola oleh Fungsi UMUM cabang.
              </p>
              <button
                onClick={() => setIsAddCabangOpen(true)}
                className="px-4 py-2 bg-purple-700 text-white rounded-xl text-xs font-bold"
              >
                + Buat Cabang Sekarang
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCabangs.map((c) => {
                const adminList = users.filter(u => u.id_cabang === c.id_cabang && u.role === 'admin');
                const adminCount = adminList.length;
                const totalUserInCabang = users.filter(u => u.id_cabang === c.id_cabang).length;
                const bidangCount = localBidangList.filter(b => b.id_cabang === c.id_cabang).length;

                return (
                  <div
                    key={c.id_cabang}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-10 h-10 rounded-xl bg-purple-700 text-white flex items-center justify-center font-black text-sm shadow-xs">
                            {c.kode_cabang}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-slate-900 text-sm">{c.nama_cabang}</h3>
                            <span className="text-[10px] font-mono text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded">
                              ID: {c.id_cabang}
                            </span>
                          </div>
                        </div>

                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          c.status === 'Active' ? 'bg-emerald-100 text-[#008C45]' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {c.status}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1 text-slate-700 border border-slate-100">
                        <p className="flex items-center space-x-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{c.alamat || 'Alamat belum diisi'}</span>
                        </p>
                        <p className="flex items-center space-x-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{c.kontak || 'Kontak belum diisi'}</span>
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-purple-50/60 p-2 rounded-xl border border-purple-100">
                          <span className="text-[10px] text-purple-700 font-bold block">Fungsi UMUM</span>
                          <span className="font-extrabold text-purple-900 text-sm">{adminCount}</span>
                        </div>
                        <div className="bg-blue-50/60 p-2 rounded-xl border border-blue-100">
                          <span className="text-[10px] text-blue-700 font-bold block">Bidang</span>
                          <span className="font-extrabold text-blue-900 text-sm">{bidangCount}</span>
                        </div>
                        <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-100">
                          <span className="text-[10px] text-emerald-700 font-bold block">Total PIC</span>
                          <span className="font-extrabold text-emerald-900 text-sm">{totalUserInCabang}</span>
                        </div>
                      </div>

                      {/* Dedicated Section: Akun Fungsi UMUM Cabang */}
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-extrabold text-slate-700 flex items-center space-x-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#008C45]" />
                            <span>Akun Fungsi UMUM Cabang:</span>
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {adminCount} Akun
                          </span>
                        </div>

                        {adminList.length === 0 ? (
                          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-800 flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                              <span className="text-[11px] font-semibold">Belum ada Akun Fungsi UMUM</span>
                            </div>
                            <button
                              onClick={() => handleOpenAddAdminForCabang(c)}
                              className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold shadow-xs"
                            >
                              + Buat Akun
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {adminList.map((adm) => (
                              <div
                                key={adm.id}
                                className="bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-xs flex items-center justify-between transition-all"
                              >
                                <div className="flex items-center space-x-2 min-w-0">
                                  <div className="relative shrink-0">
                                    <div className="w-7 h-7 rounded-lg bg-[#008C45] text-white flex items-center justify-center font-bold text-xs">
                                      {adm.nama.charAt(0)}
                                    </div>
                                    <span
                                      className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-white ${
                                        adm.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                                      }`}
                                      title={adm.isOnline ? 'Online' : 'Offline'}
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-extrabold text-slate-900 text-xs truncate flex items-center space-x-1">
                                      <span className="truncate">{adm.nama}</span>
                                      {adm.npp && (
                                        <span className="text-[9px] font-mono text-slate-500 font-normal shrink-0">
                                          ({adm.npp})
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate flex items-center space-x-1">
                                      <span className="font-mono text-[#008C45] font-bold">@{adm.username || (adm.email ? adm.email.split('@')[0] : 'admin')}</span>
                                      <span>•</span>
                                      <span className="truncate">{adm.email}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-1 shrink-0 ml-1.5">
                                  <button
                                    onClick={() => setResettingUser(adm)}
                                    title="Reset Password Akun Fungsi UMUM"
                                    className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-md"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => openEditModal(adm)}
                                    title="Edit Akun Fungsi UMUM"
                                    className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                      <button
                        onClick={() => handleOpenAddAdminForCabang(c)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#008C45] border border-emerald-200 rounded-lg text-xs font-bold flex items-center space-x-1"
                        title="Buat akun Fungsi UMUM untuk cabang ini"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Fungsi UMUM</span>
                      </button>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setEditingCabang(c);
                            setEditCabangKode(c.kode_cabang);
                            setEditCabangNama(c.nama_cabang);
                            setEditCabangAlamat(c.alamat || '');
                            setEditCabangKontak(c.kontak || '');
                            setEditCabangStatus(c.status);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                          title="Edit data cabang"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeletingCabang(c)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                          title="Hapus cabang"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: KOSTUMISASI BIDANG CABANG (Fungsi UMUM & PUMA) */}
      {/* ==================================================== */}
      {activeTab === 'BIDANG' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2 w-full sm:w-auto flex-wrap gap-y-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={bidangSearch}
                  onChange={(e) => setBidangSearch(e.target.value)}
                  placeholder="Cari nama bidang..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                />
              </div>

              {/* Branch Selector for Staff PUMA */}
              {isPuma ? (
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold text-slate-500 shrink-0">Cabang:</span>
                  <select
                    value={selectedCabangForBidang}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedCabangForBidang(val);
                      loadBidangData(val);
                    }}
                    className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                  >
                    <option value="ALL">Semua Cabang</option>
                    {cabangList.map((c) => (
                      <option key={c.id_cabang} value={c.id_cabang}>
                        {c.nama_cabang} ({c.kode_cabang})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 text-[#008C45] border border-emerald-200 rounded-lg text-xs font-bold shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-[#008C45]" />
                  <span>Cabang: {currentUser.nama_cabang || 'Cabang Anda'}</span>
                  <span className="text-[10px] bg-[#008C45] text-white px-1.5 py-0.2 rounded font-semibold ml-1">
                    Level 2 Mandiri
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => loadBidangData(selectedCabangForBidang)}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1 text-slate-600"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBidang ? 'animate-spin' : ''}`} />
                <span>Segarkan</span>
              </button>

              <button
                onClick={() => {
                  setNewBidangNama('');
                  setNewBidangPic('');
                  setNewBidangKontak('');
                  setNewBidangLokasi('');
                  setNewBidangCabangId(isPuma && selectedCabangForBidang !== 'ALL' ? selectedCabangForBidang : (currentUser.id_cabang || 'CBG-01'));
                  setIsAddBidangOpen(true);
                }}
                className="px-3.5 py-1.5 bg-[#005DAA] hover:bg-[#004278] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Bidang Baru</span>
              </button>
            </div>
          </div>

          <div className="bg-sky-50/70 border border-sky-200 p-3 rounded-xl text-xs text-sky-900 flex items-start space-x-2">
            <Sparkles className="w-4 h-4 text-[#005DAA] shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold">
                {isPuma ? 'Pengawasan Bidang Multi-Cabang (Staff PUMA Pusat):' : `Pengelolaan Bidang Mandiri — ${currentUser.nama_cabang || 'Cabang'}:`}
              </span>{' '}
              {isPuma
                ? 'Sebagai Staff PUMA, Anda dapat memantau seluruh bidang di setiap cabang dan membantu konfigurasi jika diperlukan.'
                : 'Fungsi UMUM memiliki wewenang penuh untuk mengatur, menambah, mengubah nama, atau menghapus bidang/unit di cabang sendiri (misal: Laboratorium Lingkungan, Inspeksi Teknik & Maritim, Sertifikasi Produk, dsb). Perubahan nama bidang akan otomatis tersinkronisasi ke seluruh data PIC dan Aset cabang.'}
            </div>
          </div>

          {filteredBidang.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
              <Layers className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-extrabold text-slate-700 text-sm">Belum Ada Bidang Terdaftar</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Tambahkan bidang baru untuk mengorganisasikan aset dan PIC di cabang ini.
              </p>
              <button
                onClick={() => setIsAddBidangOpen(true)}
                className="px-4 py-2 bg-[#005DAA] text-white rounded-xl text-xs font-bold"
              >
                + Tambah Bidang
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBidang.map((b) => {
                const userCount = users.filter(u => u.id_bidang === b.id_bidang).length;
                const isDefaultDukbis = b.id_bidang === 'BDG-01' || b.nama_bidang.toLowerCase().includes('dukungan bisnis');

                return (
                  <div
                    key={b.id_bidang}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold text-xs shadow-xs ${
                            isDefaultDukbis ? 'bg-[#005DAA]' : 'bg-[#008C45]'
                          }`}>
                            <Layers className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-slate-900 text-sm line-clamp-1">{b.nama_bidang}</h3>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-100 px-1.5 py-0.2 rounded">
                                {b.id_bidang}
                              </span>
                              <span className="text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold">
                                {b.jenis || 'Bidang'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1 text-slate-700 border border-slate-100">
                        <p><span className="font-bold text-slate-400">Cabang:</span> <span className="font-semibold text-slate-800">{b.nama_cabang || 'Cabang Utama'}</span></p>
                        <p><span className="font-bold text-slate-400">PIC Utama:</span> {b.pic_utama || '-'}</p>
                        <p><span className="font-bold text-slate-400">Kontak:</span> {b.kontak || '-'}</p>
                        <p><span className="font-bold text-slate-400">Lokasi:</span> {b.lokasi_kantor || '-'}</p>
                      </div>

                      <div className="flex items-center justify-between text-xs px-1">
                        <span className="text-slate-500 font-medium">Pengguna Terdaftar:</span>
                        <span className="font-extrabold text-[#005DAA] bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                          {userCount} PIC
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => {
                          setEditingBidang(b);
                          setEditBidangNama(b.nama_bidang);
                          setEditBidangJenis(b.jenis || 'Bidang');
                          setEditBidangPic(b.pic_utama || '');
                          setEditBidangKontak(b.kontak || '');
                          setEditBidangLokasi(b.lokasi_kantor || '');
                        }}
                        className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-[#005DAA] border border-sky-200 rounded-lg text-xs font-bold flex items-center space-x-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Bidang</span>
                      </button>

                      {!isDefaultDukbis && (
                        <button
                          onClick={() => setDeletingBidang(b)}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center space-x-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: DAFTAR PENGGUNA & PIC */}
      {/* ==================================================== */}
      {activeTab === 'PICS' && (
        <div className="space-y-4">
          {/* Quick Role Directory Pills for Staff PUMA and Admins */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedRoleFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedRoleFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Semua Pengguna ({users.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedRoleFilter('admin')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center space-x-1.5 ${
                selectedRoleFilter === 'admin'
                  ? 'bg-[#008C45] text-white shadow-xs'
                  : 'bg-emerald-50 text-[#008C45] hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>👑 Khusus Fungsi UMUM Cabang ({countAllAdmins})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRoleFilter('pic_bidang')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedRoleFilter === 'pic_bidang'
                  ? 'bg-[#005DAA] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              PIC Bidang ({countAllPics})
            </button>

            <button
              type="button"
              onClick={() => setSelectedRoleFilter('management')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedRoleFilter === 'management'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Management Cabang ({countAllMgmt})
            </button>

            {isPuma && (
              <button
                type="button"
                onClick={() => setSelectedRoleFilter('puma')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center space-x-1 ${
                  selectedRoleFilter === 'puma'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Staff PUMA Pusat</span>
              </button>
            )}
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, email, NPP, username PIC..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:ring-2 focus:ring-[#005DAA]"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap gap-y-2">
              {/* Branch Filter for Staff PUMA vs Locked Badge for Fungsi UMUM */}
              {isPuma ? (
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold text-slate-500">Cabang:</span>
                  <select
                    value={selectedUserCabang}
                    onChange={(e) => setSelectedUserCabang(e.target.value)}
                    className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                  >
                    <option value="ALL">Semua Cabang</option>
                    {cabangList.map((c) => (
                      <option key={c.id_cabang} value={c.id_cabang}>
                        {c.nama_cabang}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 text-[#008C45] border border-emerald-200 rounded-lg text-xs font-bold shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-[#008C45]" />
                  <span>Cabang: {currentUser.nama_cabang || 'Cabang Anda'}</span>
                </div>
              )}

              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-semibold text-slate-500">Bidang:</span>
                <select
                  value={selectedBidang}
                  onChange={(e) => setSelectedBidang(e.target.value)}
                  className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                >
                  <option value="ALL">Semua Bidang</option>
                  {localBidangList.map((b) => (
                    <option key={b.id_bidang} value={b.id_bidang}>
                      {b.nama_bidang}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedUsers.map((u) => {
              const isMe = u.id === currentUser.id;
              const isPumaUser = u.role === 'puma';

              return (
                <div 
                  key={u.id} 
                  className={`bg-white rounded-2xl border p-4 shadow-xs flex flex-col justify-between transition-all hover:shadow-md ${
                    isMe ? 'border-[#005DAA] ring-2 ring-[#005DAA]/10' : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold text-sm shadow-xs ${
                          isPumaUser ? 'bg-purple-700' : 'bg-[#005DAA]'
                        }`}>
                          {u.nama.charAt(0)}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 text-sm flex items-center space-x-1.5">
                            <span className="line-clamp-1">{u.nama}</span>
                            {isMe && (
                              <span className="text-[10px] bg-sky-100 text-[#005DAA] px-1.5 py-0.2 rounded font-bold shrink-0">
                                Anda
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-medium">NPP: {u.npp}</div>
                        </div>
                      </div>

                      <span className={`flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                        u.isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${u.isOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
                        <span>{u.isOnline ? 'Online' : 'Offline'}</span>
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1.5 text-slate-700 border border-slate-100">
                      <div className="flex items-center space-x-1.5 font-semibold text-[#005DAA] bg-sky-50/70 p-1.5 rounded-lg border border-sky-100">
                        <AtSign className="w-3.5 h-3.5 shrink-0 text-[#005DAA]" />
                        <span className="truncate font-mono text-[11px]">{u.email}</span>
                      </div>
                      <p><span className="font-bold text-slate-400">Username Login:</span> <span className="font-mono font-bold text-slate-800">{u.username || u.npp || 'N/A'}</span></p>
                      <p><span className="font-bold text-slate-400">Cabang:</span> <span className="font-semibold text-purple-900">{u.nama_cabang || (u.role === 'puma' ? 'Kantor Pusat PUMA' : 'Cabang Utama')}</span></p>
                      <p><span className="font-bold text-slate-400">Jabatan:</span> {u.jabatan}</p>
                      <p><span className="font-bold text-slate-400">Bidang:</span> {u.nama_bidang}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                      {isPumaUser ? (
                        <span className="text-[10px] bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-md font-bold uppercase flex items-center space-x-1">
                          <Award className="w-3 h-3 text-purple-700" />
                          <span>Staff PUMA • Pusat</span>
                        </span>
                      ) : isKepalaCabang(u) ? (
                        <span className="text-[10px] bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-md font-extrabold uppercase flex items-center space-x-1">
                          <Award className="w-3 h-3 text-purple-600" />
                          <span>Management • Kepala Cabang</span>
                        </span>
                      ) : isKepalaBidang(u) ? (
                        <span className="text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md font-bold uppercase flex items-center space-x-1">
                          <Award className="w-3 h-3 text-indigo-600" />
                          <span>Management • Kepala Bidang</span>
                        </span>
                      ) : u.role === 'admin' ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold uppercase">
                          Fungsi UMUM
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-bold uppercase">
                          PIC Bidang
                        </span>
                      )}

                      {isKepalaBidangDukunganBisnis(u) && (
                        <span className="text-[9.5px] bg-blue-50 text-[#005DAA] border border-blue-200 px-2 py-0.5 rounded-md font-bold flex items-center space-x-1">
                          <Sparkles className="w-2.5 h-2.5 text-[#005DAA]" />
                          <span>Dual Role (Dukbis & Admin)</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5 flex-wrap justify-end">
                      {isUmum && (
                        <button
                          onClick={() => openEditModal(u)}
                          className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-[#005DAA] border border-sky-200 rounded-lg text-xs font-bold flex items-center space-x-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      )}

                      {isUmum && (
                        <button
                          onClick={() => setResettingUser(u)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold"
                          title="Reset password ke default (password123)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isUmum && !isMe && (
                        <button
                          onClick={() => setDeletingUser(u)}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold"
                          title="Hapus akun"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2">
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalUserPages}
              totalItems={totalUserItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 4: SMTP CONFIG & TAB 5: LOGS */}
      {/* ==================================================== */}
      {activeTab === 'SMTP_SETTINGS' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 max-w-2xl">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-200">
            <Sliders className="w-5 h-5 text-[#005DAA]" />
            <h3 className="font-extrabold text-slate-900 text-sm">Pengaturan Server SMTP Notifikasi</h3>
          </div>
          <p className="text-xs text-slate-500">
            Sistem terkonfigurasi dengan SMTP Server untuk pengiriman email notifikasi jatuh tempo kalibrasi (H-30) dan peringatan keterlambatan pengembalian aset.
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
            <p><span className="font-bold text-slate-400">Host:</span> <span className="font-mono">{smtpConfig?.host || 'smtp.sucofindo.co.id'}</span></p>
            <p><span className="font-bold text-slate-400">Port:</span> <span className="font-mono">{smtpConfig?.port || 587}</span></p>
            <p><span className="font-bold text-slate-400">Sender:</span> <span className="font-mono">{smtpConfig?.auth?.user || 'notifikasi-aset@sucofindo.co.id'}</span></p>
          </div>
        </div>
      )}

      {activeTab === 'LOGS' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-[#005DAA]" />
              <h3 className="font-extrabold text-slate-900 text-sm">Riwayat Pengiriman Email Notifikasi</h3>
            </div>
            <button onClick={loadEmailData} className="text-xs text-[#005DAA] font-bold flex items-center space-x-1">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Segarkan</span>
            </button>
          </div>

          {emailLogs.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Belum ada riwayat email terkirim.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {emailLogs.slice(0, 15).map((l) => (
                <div key={l.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">{l.subject}</p>
                    <p className="text-slate-500 font-mono text-[11px]">Kepada: {l.recipient} • {new Date(l.sentAt).toLocaleString('id-ID')}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${l.status === 'Sent' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {l.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: TAMBAH CABANG BARU (Staff PUMA) */}
      {/* ==================================================== */}
      {isAddCabangOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-purple-700" />
                <h3 className="font-extrabold text-slate-900 text-sm">Tambah Cabang Baru PT SUCOFINDO</h3>
              </div>
              <button onClick={() => setIsAddCabangOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCabang} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Cabang (3-5 Huruf) *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: MDN, PKU, JKT, SUB"
                  maxLength={6}
                  value={newCabangKode}
                  onChange={(e) => setNewCabangKode(e.target.value.toUpperCase())}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Cabang *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Cabang Medan"
                  value={newCabangNama}
                  onChange={(e) => setNewCabangNama(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alamat Kantor Cabang</label>
                <input
                  type="text"
                  placeholder="Alamat jalan / kota"
                  value={newCabangAlamat}
                  onChange={(e) => setNewCabangAlamat(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kontak / Telepon</label>
                <input
                  type="text"
                  placeholder="(061) xxx-xxxx"
                  value={newCabangKontak}
                  onChange={(e) => setNewCabangKontak(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 text-[11px] text-purple-900 leading-relaxed">
                ✨ <strong>Otomatisasi:</strong> Sistem akan otomatis membuat departemen awal <em>"Bidang Dukungan Bisnis"</em> untuk cabang baru ini sehingga Fungsi UMUM cabang dapat langsung operasional.
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddCabangOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingCabang}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold shadow-xs disabled:opacity-50"
                >
                  {isSavingCabang ? 'Membuat...' : 'Buat Cabang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: EDIT CABANG (Staff PUMA) */}
      {/* ==================================================== */}
      {editingCabang && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-purple-700" />
                <h3 className="font-extrabold text-slate-900 text-sm">Edit Data Cabang: {editingCabang.nama_cabang}</h3>
              </div>
              <button onClick={() => setEditingCabang(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCabang} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Cabang *</label>
                <input
                  type="text"
                  required
                  value={editCabangKode}
                  onChange={(e) => setEditCabangKode(e.target.value.toUpperCase())}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Cabang *</label>
                <input
                  type="text"
                  required
                  value={editCabangNama}
                  onChange={(e) => setEditCabangNama(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alamat Kantor</label>
                <input
                  type="text"
                  value={editCabangAlamat}
                  onChange={(e) => setEditCabangAlamat(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kontak / Telepon</label>
                <input
                  type="text"
                  value={editCabangKontak}
                  onChange={(e) => setEditCabangKontak(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Operasional *</label>
                <select
                  value={editCabangStatus}
                  onChange={(e) => setEditCabangStatus(e.target.value as 'Active' | 'Inactive')}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="Active">Active (Aktif)</option>
                  <option value="Inactive">Inactive (Non-aktif)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingCabang(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingCabang}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold shadow-xs disabled:opacity-50"
                >
                  {isUpdatingCabang ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: HAPUS CABANG */}
      {/* ==================================================== */}
      {deletingCabang && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm">Hapus Cabang {deletingCabang.nama_cabang}?</h3>
            <p className="text-xs text-slate-500">
              Apakah Anda yakin ingin menghapus cabang ini? Cabang hanya dapat dihapus jika tidak ada aset dan pengguna aktif yang terdaftar di dalamnya.
            </p>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCabang(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingCabang}
                onClick={handleDeleteCabang}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {isDeletingCabang ? 'Menghapus...' : 'Ya, Hapus Cabang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: TAMBAH BIDANG BARU (Fungsi UMUM & PUMA) */}
      {/* ==================================================== */}
      {isAddBidangOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-[#005DAA]" />
                <h3 className="font-extrabold text-slate-900 text-sm">Tambah Bidang / Unit Baru</h3>
              </div>
              <button onClick={() => setIsAddBidangOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBidang} className="space-y-3 text-xs">
              {isPuma ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pilih Cabang *</label>
                  <select
                    value={newBidangCabangId}
                    onChange={(e) => setNewBidangCabangId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  >
                    {cabangList.map((c) => (
                      <option key={c.id_cabang} value={c.id_cabang}>
                        {c.nama_cabang} ({c.kode_cabang})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cabang Penempatan</label>
                  <div className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-xl font-bold text-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-[#008C45]" />
                      <span>{currentUser.nama_cabang || 'Cabang Anda'}</span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-[#008C45] px-2 py-0.5 rounded-full font-bold">
                      Terkunci (Kewenangan Cabang)
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Bidang / Unit / Lab *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bidang Inspeksi Teknik & Maritim, Lab Lingkungan"
                  value={newBidangNama}
                  onChange={(e) => setNewBidangNama(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipe Unit *</label>
                <select
                  value={newBidangJenis}
                  onChange={(e) => setNewBidangJenis(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                >
                  <option value="Bidang">Bidang</option>
                  <option value="Unit Pelayanan">Unit Pelayanan / Lab / Seksi</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">PIC Utama / Koordinator</label>
                <input
                  type="text"
                  placeholder="Nama PIC koordinator"
                  value={newBidangPic}
                  onChange={(e) => setNewBidangPic(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kontak / Ext</label>
                <input
                  type="text"
                  placeholder="No. Telp / Extension"
                  value={newBidangKontak}
                  onChange={(e) => setNewBidangKontak(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lokasi Ruang / Kantor</label>
                <input
                  type="text"
                  placeholder="Gedung A Lantai 2 / Ruang Lab"
                  value={newBidangLokasi}
                  onChange={(e) => setNewBidangLokasi(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddBidangOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingBidang}
                  className="px-5 py-2 bg-[#005DAA] hover:bg-[#004278] text-white rounded-xl font-bold shadow-xs disabled:opacity-50"
                >
                  {isSavingBidang ? 'Menyimpan...' : 'Tambah Bidang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: EDIT BIDANG */}
      {/* ==================================================== */}
      {editingBidang && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-[#005DAA]" />
                <h3 className="font-extrabold text-slate-900 text-sm">Edit Bidang: {editingBidang.nama_bidang}</h3>
              </div>
              <button onClick={() => setEditingBidang(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateBidang} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Bidang / Unit / Lab *</label>
                <input
                  type="text"
                  required
                  value={editBidangNama}
                  onChange={(e) => setEditBidangNama(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipe Unit *</label>
                <select
                  value={editBidangJenis}
                  onChange={(e) => setEditBidangJenis(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                >
                  <option value="Bidang">Bidang</option>
                  <option value="Unit Pelayanan">Unit Pelayanan / Lab / Seksi</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">PIC Utama / Koordinator</label>
                <input
                  type="text"
                  value={editBidangPic}
                  onChange={(e) => setEditBidangPic(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kontak / Ext</label>
                <input
                  type="text"
                  value={editBidangKontak}
                  onChange={(e) => setEditBidangKontak(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lokasi Ruang / Kantor</label>
                <input
                  type="text"
                  value={editBidangLokasi}
                  onChange={(e) => setEditBidangLokasi(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingBidang(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingBidang}
                  className="px-5 py-2 bg-[#005DAA] hover:bg-[#004278] text-white rounded-xl font-bold shadow-xs disabled:opacity-50"
                >
                  {isUpdatingBidang ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: HAPUS BIDANG */}
      {/* ==================================================== */}
      {deletingBidang && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm">Hapus Bidang {deletingBidang.nama_bidang}?</h3>
            <p className="text-xs text-slate-500">
              Apakah Anda yakin ingin menghapus bidang ini? Bidang hanya dapat dihapus jika tidak ada aset atau pengguna yang terdaftar di dalamnya.
            </p>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingBidang(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingBidang}
                onClick={handleDeleteBidang}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {isDeletingBidang ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: TAMBAH USER / PIC BARU */}
      {/* ==================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="shrink-0 flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-[#005DAA]" />
                <h3 className="font-extrabold text-slate-900 text-sm">Tambah Akun PIC / Pengguna Baru</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewUser} className="overflow-y-auto flex-1 min-h-0 space-y-3 text-xs pr-1">
              {/* Branch Selector for Staff PUMA */}
              {isPuma && newRole !== 'puma' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pilih Cabang Pengguna *</label>
                  <select
                    value={newUserCabangId}
                    onChange={(e) => setNewUserCabangId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  >
                    {cabangList.map((c) => (
                      <option key={c.id_cabang} value={c.id_cabang}>
                        {c.nama_cabang} ({c.kode_cabang})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap PIC *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ahmad Subagyo"
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alamat Email *</label>
                <input
                  type="email"
                  required
                  placeholder="ahmad@sucofindo.co.id"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NPP (Nomor Pegawai) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 19876"
                    value={newNpp}
                    onChange={(e) => setNewNpp(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Username Login *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: ahmad_subagyo"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role Akun *</label>
                <select
                  value={newRole}
                  onChange={(e) => {
                    const r = e.target.value as Role;
                    setNewRole(r);
                    if (r === 'management') {
                      if (!newTipeManagement) setNewTipeManagement('kepala_bidang');
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                >
                  <option value="pic_bidang">PIC Setiap Bidang</option>
                  <option value="management">Management / Pimpinan Cabang</option>
                  <option value="admin">Fungsi UMUM (Admin Cabang)</option>
                  {isPuma && <option value="puma">Staff PUMA (Pusat)</option>}
                </select>
              </div>

              {/* Tipe Management Selector */}
              {(newRole === 'management' || newRole === 'pimpinan') && (
                <div className="bg-indigo-50/70 border border-indigo-200 p-3 rounded-xl space-y-2">
                  <label className="block font-bold text-indigo-950 text-xs">Kategori Jabatan Management *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewTipeManagement('kepala_cabang');
                        setNewJabatan('Management / Kepala Cabang PT SUCOFINDO');
                      }}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                        newTipeManagement === 'kepala_cabang'
                          ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-extrabold flex items-center space-x-1">
                        <Award className="w-3.5 h-3.5" />
                        <span>Kepala Cabang</span>
                      </div>
                      <div className={`text-[10.5px] mt-0.5 font-normal ${newTipeManagement === 'kepala_cabang' ? 'text-purple-100' : 'text-slate-500'}`}>
                        Pimpinan Cabang (Akses Monitoring Cabang)
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNewTipeManagement('kepala_bidang');
                        const bMatch = localBidangList.find(b => b.id_bidang === (newIdBidang || 'BDG-01'));
                        setNewJabatan(bMatch ? `Kepala ${bMatch.nama_bidang}` : 'Kepala Bidang Dukungan Bisnis');
                      }}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                        newTipeManagement === 'kepala_bidang'
                          ? 'bg-[#005DAA] text-white border-[#004278] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-extrabold flex items-center space-x-1">
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>Kepala Bidang</span>
                      </div>
                      <div className={`text-[10.5px] mt-0.5 font-normal ${newTipeManagement === 'kepala_bidang' ? 'text-sky-100' : 'text-slate-500'}`}>
                        Pimpinan Bidang Teknis
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {newRole !== 'puma' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bidang / Unit Kerja *</label>
                  <select
                    value={
                      newRole === 'admin' 
                        ? 'BDG-01' 
                        : (newRole === 'management' || newRole === 'pimpinan') && newTipeManagement === 'kepala_cabang'
                        ? 'BDG-01'
                        : newIdBidang
                    }
                    onChange={(e) => {
                      const newBid = e.target.value;
                      setNewIdBidang(newBid);
                      if (newRole === 'management' && newTipeManagement === 'kepala_bidang') {
                        const bMatch = localBidangList.find(b => b.id_bidang === newBid);
                        if (bMatch) setNewJabatan(`Kepala ${bMatch.nama_bidang}`);
                      }
                    }}
                    disabled={newRole === 'admin' || (newRole === 'management' && newTipeManagement === 'kepala_cabang')}
                    className={`w-full p-2.5 border rounded-xl font-medium transition-colors ${
                      (newRole === 'admin' || (newRole === 'management' && newTipeManagement === 'kepala_cabang'))
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                        : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    {localBidangList
                      .filter(b => isPuma ? (b.id_cabang === newUserCabangId || !b.id_cabang) : true)
                      .map((b) => (
                        <option key={b.id_bidang} value={b.id_bidang}>
                          {b.nama_bidang}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jabatan Struktural</label>
                <input
                  type="text"
                  placeholder="Contoh: Administrator Cabang / PIC Lab"
                  value={newJabatan}
                  onChange={(e) => setNewJabatan(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="shrink-0 pt-3 flex items-center justify-end space-x-2 border-t border-slate-200 mt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-5 py-2 bg-[#005DAA] hover:bg-[#004278] text-white rounded-xl font-bold shadow-xs disabled:opacity-50"
                >
                  {isCreatingUser ? 'Mendaftarkan...' : 'Daftarkan Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: EDIT USER */}
      {/* ==================================================== */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="shrink-0 flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-[#005DAA]" />
                <h3 className="font-extrabold text-slate-900 text-sm">Edit Data Pengguna: {editingUser.nama}</h3>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="overflow-y-auto flex-1 min-h-0 space-y-3 text-xs pr-1">
              {isPuma && editRole !== 'puma' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pilih Cabang Pengguna *</label>
                  <select
                    value={editCabangId}
                    onChange={(e) => setEditCabangId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  >
                    {cabangList.map((c) => (
                      <option key={c.id_cabang} value={c.id_cabang}>
                        {c.nama_cabang} ({c.kode_cabang})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap PIC *</label>
                <input
                  type="text"
                  required
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alamat Email *</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NPP *</label>
                  <input
                    type="text"
                    required
                    value={editNpp}
                    onChange={(e) => setEditNpp(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Username Login *</label>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role Akun *</label>
                <select
                  value={editRole}
                  onChange={(e) => {
                    const r = e.target.value as Role;
                    setEditRole(r);
                    if (r === 'management') {
                      if (!editTipeManagement) setEditTipeManagement('kepala_bidang');
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                >
                  <option value="pic_bidang">PIC Setiap Bidang</option>
                  <option value="management">Management / Pimpinan Cabang</option>
                  <option value="admin">Fungsi UMUM</option>
                  {isPuma && <option value="puma">Staff PUMA (Pusat)</option>}
                </select>
              </div>

              {editRole !== 'puma' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bidang / Unit Kerja *</label>
                  <select
                    value={editIdBidang}
                    onChange={(e) => setEditIdBidang(e.target.value)}
                    disabled={editRole === 'admin'}
                    className={`w-full p-2.5 border rounded-xl font-medium ${
                      editRole === 'admin' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    {localBidangList
                      .filter(b => isPuma ? (b.id_cabang === editCabangId || !b.id_cabang) : true)
                      .map((b) => (
                        <option key={b.id_bidang} value={b.id_bidang}>
                          {b.nama_bidang}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jabatan Struktural</label>
                <input
                  type="text"
                  value={editJabatan}
                  onChange={(e) => setEditJabatan(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="shrink-0 pt-3 flex items-center justify-end space-x-2 border-t border-slate-200 mt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="px-5 py-2 bg-[#005DAA] hover:bg-[#004278] text-white rounded-xl font-bold shadow-xs disabled:opacity-50"
                >
                  {isSavingUser ? 'Memperbarui...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: RESET PASSWORD */}
      {/* ==================================================== */}
      {resettingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm">Reset Password ke Default?</h3>
            <p className="text-xs text-slate-500">
              Password untuk akun <strong className="text-slate-800">{resettingUser.nama}</strong> ({resettingUser.username}) akan direset ke <code className="bg-slate-100 px-1 py-0.5 rounded font-bold text-slate-800">password123</code>.
            </p>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setResettingUser(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isResettingUser}
                onClick={handleResetPassword}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {isResettingUser ? 'Mereset...' : 'Ya, Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: HAPUS USER */}
      {/* ==================================================== */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm">Hapus Akun {deletingUser.nama}?</h3>
            <p className="text-xs text-slate-500">
              Apakah Anda yakin ingin menghapus akun PIC ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {isDeletingUser ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
