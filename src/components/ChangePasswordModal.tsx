import React, { useState } from 'react';
import { User } from '../types';
import { apiClient } from '../lib/apiClient';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, X, ShieldCheck, Lock } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  isForced?: boolean;
  onPasswordChangedSuccess?: (updatedUser?: User) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  isForced = false,
  onPasswordChangedSuccess
}) => {
  if (!isOpen) return null;

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!oldPassword) {
      setErrorMsg('Masukkan password lama / password default saat ini.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Password baru minimal 6 karakter.');
      return;
    }
    if (newPassword === 'password123') {
      setErrorMsg('Password baru tidak boleh menggunakan password default (password123).');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi password baru tidak cocok.');
      return;
    }

    setIsLoading(true);
    try {
      const updatedUser = await apiClient.changePassword(currentUser.id, oldPassword, newPassword);
      setSuccessMsg('Password akun Anda berhasil diperbarui!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccessMsg('');
        if (onPasswordChangedSuccess) {
          onPasswordChangedSuccess(updatedUser);
        } else {
          onClose();
        }
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui password. Pastikan password lama sesuai.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
      <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="shrink-0 flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-xl bg-[#005DAA] text-white flex items-center justify-center font-bold shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                {isForced ? 'Wajib Ganti Password Pertama Kali' : 'Ubah Password Akun'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isForced ? 'Silakan ganti password default Anda' : `Ganti password untuk ${currentUser.nama}`}
              </p>
            </div>
          </div>
          {!isForced && (
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Forced Notice Banner */}
        {isForced && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
            <div className="flex items-center space-x-1.5 font-extrabold text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Ganti Password Diperlukan</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Akun Anda baru saja dibuat atau di-reset ke password default (<code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">password123</code>). Untuk alasan keamanan, Anda <strong>wajib membuat password baru</strong> sebelum dapat mengakses aplikasi.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0 space-y-3.5 text-xs pr-1">
          
          {/* User Profile Summary */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Akun Pengguna</div>
              <div className="font-bold text-slate-900 text-xs">{currentUser.nama}</div>
              <div className="text-[11px] text-slate-500">NPP: {currentUser.npp} | {currentUser.nama_bidang || 'Fungsi UMUM'}</div>
            </div>
            <ShieldCheck className="w-5 h-5 text-[#005DAA]" />
          </div>

          {/* Password Lama */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Password Lama / Default Saat Ini *
            </label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                required
                placeholder={isForced ? "Ketik 'password123'" : "Masukkan password lama Anda"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full p-2.5 pr-10 border border-slate-300 rounded-xl outline-hidden focus:ring-2 focus:ring-[#005DAA] font-medium"
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password Baru */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Password Baru (Min. 6 Karakter) *
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                required
                placeholder="Masukkan password baru pilihan Anda"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-2.5 pr-10 border border-slate-300 rounded-xl outline-hidden focus:ring-2 focus:ring-[#005DAA] font-medium"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Konfirmasi Password Baru */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Konfirmasi Password Baru *
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                placeholder="Ulangi password baru Anda"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2.5 pr-10 border border-slate-300 rounded-xl outline-hidden focus:ring-2 focus:ring-[#005DAA] font-medium"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            {!isForced && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 bg-[#005DAA] hover:bg-[#004278] text-white rounded-xl font-bold shadow-xs flex items-center space-x-1.5 disabled:opacity-50 transition-colors w-full sm:w-auto justify-center"
            >
              <Lock className="w-4 h-4" />
              <span>{isLoading ? 'Memproses...' : 'Simpan & Perbarui Password'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
