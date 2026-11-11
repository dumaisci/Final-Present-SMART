import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { apiClient } from '../lib/apiClient';
import { PublicScannerModal } from './PublicScannerModal';
import { 
  Lock, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  ArrowRight,
  Sparkles,
  AlertCircle,
  QrCode,
  Camera,
  Activity,
  Radio,
  Zap
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: User, expiresAt?: number) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isPublicScannerOpen, setIsPublicScannerOpen] = useState(false);

  // Auto-open public scanner if user accessed the page via a QR code link (e.g. ?code=... or ?qr=... or ?scan=true)
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code') || params.get('qr') || params.get('id') || params.get('asset_number') || params.get('tag_number') || params.get('scan');
      if (code) {
        setIsPublicScannerOpen(true);
      }
    } catch (e) {}
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('Masukkan username atau NPP Anda.');
      return;
    }
    if (!password) {
      setErrorMsg('Masukkan password Anda.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const { user, expiresAt } = await apiClient.login(username.trim(), password);
      onLoginSuccess(user, expiresAt);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal login. Periksa username dan password Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-between font-sans antialiased selection:bg-emerald-100 selection:text-[#005DAA] relative overflow-hidden">
      
      {/* Background Decorative Soft Blobs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-200/40 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-emerald-200/40 rounded-full blur-3xl pointer-events-none" />
      
      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e120_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e120_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" 
      />

      {/* Top Corporate Branding Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 bg-[#005DAA] text-white py-2.5 px-4 sm:px-8 shadow-md border-b border-blue-800"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-white p-1.5 rounded-xl flex items-center justify-center shrink-0 shadow-xs border border-white/20"
            >
              <img
                src="https://i.ibb.co.com/xKsyxsWX/logo-sucofindo.png"
                alt="Logo SUCOFINDO"
                className="h-7 sm:h-8 w-auto object-contain"
              />
            </motion.div>
            <div>
              <div className="font-extrabold text-base sm:text-lg tracking-tight uppercase text-white leading-none flex items-center gap-2">
                <span>SUCOFINDO</span>
              </div>
              <span className="text-emerald-300 font-extrabold text-[9px] tracking-[0.2em] uppercase block mt-1">
                DIGITAL ASSET MONITORING SYSTEM
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-emerald-100 bg-emerald-900/40 px-3 py-1 rounded-full border border-emerald-400/30 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span>Sistem Terintegrasi Live</span>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => setIsPublicScannerOpen(true)}
              className="flex items-center gap-2 text-xs text-white bg-[#008C45] hover:bg-[#007037] px-3.5 py-1.5 rounded-full font-bold shadow-md border border-emerald-400/40 transition-all cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-200" />
              <span className="hidden sm:inline">Scan QR Aset</span>
              <span className="sm:hidden">Scan QR</span>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Main Login Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 py-3 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-10 my-auto">
        
        {/* Left Side: Visual Hero & Asset Monitoring Features */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="w-full lg:w-7/12 space-y-4"
        >
          {/* Badge & Title */}
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-emerald-50 text-[#008C45] border border-emerald-200 text-xs px-3 py-1 rounded-full font-bold shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#008C45]" />
              <span>SMART SCI Centralized Asset Intelligence</span>
            </div>
            
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              Sistem Monitoring & Kalibrasi Aset <span className="text-[#005DAA]">Real-Time</span>
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
              Platform inspeksi dan manajemen aset terintegrasi PT SUCOFINDO (Persero). Mengoptimalkan operasional laboratorium, inspeksi teknik, dan kalibrasi dengan tingkat kepatuhan tinggi.
            </p>
          </div>

          {/* Interactive Hero Image Banner with Floating Glass Overlay */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-md group bg-slate-900">
            {/* Main Visual Image */}
            <div className="relative h-44 sm:h-52 lg:h-60 w-full overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80"
                alt="Monitoring Aset Laboratorium & Inspeksi Teknik"
                className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700 ease-out brightness-95"
                referrerPolicy="no-referrer"
              />
              
              {/* Gradient Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-blue-950/60 via-transparent to-slate-950/60" />
            </div>

            {/* Floating Live HUD Badges over Image */}
            <div className="absolute inset-0 p-3 sm:p-4 flex flex-col justify-between pointer-events-none">
              
              {/* Top Row Indicators */}
              <div className="flex items-center justify-between">
                <motion.div 
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="bg-white/90 backdrop-blur-md text-slate-800 border border-white/60 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Activity className="w-3.5 h-3.5 text-[#008C45] animate-pulse" />
                  <span>200+ Unit Aset Terdata</span>
                </motion.div>

                <motion.div 
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 1 }}
                  className="bg-[#005DAA]/90 backdrop-blur-md text-white border border-blue-400/40 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Radio className="w-3.5 h-3.5 text-blue-200" />
                  <span>Verified QR System</span>
                </motion.div>
              </div>

              {/* Bottom Row Hud Overlay */}
              <div>
                <div className="bg-white/95 backdrop-blur-md border border-white/80 p-2.5 sm:p-3 rounded-xl shadow-lg flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-50 text-[#008C45] border border-emerald-200">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>Peringatan Kalibrasi Otomatis H-30</span>
                        <span className="bg-emerald-100 text-[#008C45] text-[9px] px-1.5 py-0.2 rounded-full font-extrabold border border-emerald-200">
                          AKTIF
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Melindungi integritas hasil pengujian laboratorium & kelaikan alat
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </motion.div>

        {/* Right Side: Login Form Card */}
        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full lg:w-5/12 max-w-md shrink-0 space-y-3"
        >
          
          {/* Public Scanner Card for Field Staff */}
          <motion.div 
            whileHover={{ scale: 1.01 }}
            className="bg-gradient-to-r from-[#008C45] to-emerald-700 rounded-2xl p-3 text-white shadow-md space-y-2.5 border border-emerald-500/50 relative overflow-hidden"
          >
            <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none" />
            
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
                <QrCode className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-extrabold text-xs sm:text-sm leading-tight text-white flex items-center gap-1.5">
                  <span>Akses Petugas / Staff Lapangan</span>
                  <span className="text-[8px] bg-white/20 text-white border border-white/30 px-1.5 py-0.2 rounded font-mono">
                    PUBLIK
                  </span>
                </h3>
                <p className="text-[10px] text-emerald-100 mt-0.5">
                  Scan QR code aset langsung di lokasi tanpa perlu autentikasi login
                </p>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => setIsPublicScannerOpen(true)}
              className="w-full py-2 bg-white hover:bg-emerald-50 text-[#008C45] font-extrabold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-[#008C45]" />
              <span>Buka Scanner QR Code Aset Lapangan</span>
            </motion.button>
          </motion.div>

          {/* Main Login Form Box */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-4 sm:p-6 space-y-4 relative overflow-hidden">
            
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#005DAA] to-[#008C45]" />

            <div className="text-center space-y-1">
              <div className="bg-white p-2 rounded-xl border border-slate-200 inline-flex items-center justify-center shadow-xs mx-auto mb-1">
                <img
                  src="https://i.ibb.co.com/xKsyxsWX/logo-sucofindo.png"
                  alt="Logo SUCOFINDO"
                  className="h-7 w-auto object-contain"
                />
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Login Portal SMART SCI</h2>
              <p className="text-[11px] text-slate-500">
                Gunakan Username / NPP dan Password resmi SUCOFINDO
              </p>
            </div>

            <AnimatePresence>
              {errorMsg && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-800 text-xs"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleLogin} className="space-y-3">
              {/* Username Input */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Username / NPP
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Contoh: admin, 22275, pic_inspeksi"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#005DAA] focus:border-[#005DAA] outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password akun Anda"
                    className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#005DAA] focus:border-[#005DAA] outline-none transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#005DAA] hover:bg-blue-800 text-white py-2.5 rounded-xl font-bold text-xs shadow-md shadow-blue-900/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 mt-1 cursor-pointer border border-blue-700/30"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Memverifikasi Akses...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span>Masuk ke Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                )}
              </motion.button>

              {/* Divider */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-2 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">atau</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {/* Direct QR Scanner without Login for Field Staff */}
              <button
                type="button"
                onClick={() => setIsPublicScannerOpen(true)}
                className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-xs cursor-pointer group"
              >
                <div className="p-1 bg-[#008C45] text-white rounded-md group-hover:scale-105 transition-transform">
                  <Camera className="w-3.5 h-3.5" />
                </div>
                <span>Scan QR Lapangan (Tanpa Perlu Login)</span>
              </button>
              <p className="text-[10px] text-center text-slate-500 leading-tight">
                Staff lapangan dapat langsung memindai QR code aset untuk pengembalian (foto fisik &amp; titik GPS) atau update status pemakaian tanpa perlu login akun.
              </p>
            </form>

            {/* Quick Demo Hint */}
            <div className="pt-2 border-t border-slate-100 text-center">
              <p className="text-[10px] text-slate-500">
                Lupa kata sandi? Hubungi Administrator Fungsi Umum / TI Cabang.
              </p>
            </div>

          </div>
        </motion.div>

      </main>

      {/* Corporate Footer - Light Theme */}
      <footer className="relative z-10 bg-white text-slate-600 py-3 px-6 text-xs border-t border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-center md:text-left">
            <span className="font-bold text-slate-800 tracking-tight">PT SUCOFINDO (Persero)</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 text-[11px]">FLP Generalist Program &copy; 2026</span>
          </div>

          <div className="flex items-center space-x-3 text-[11px]">
            <span className="text-slate-500 font-medium">SMART SCI Asset Intelligence</span>
          </div>
        </div>
      </footer>

      {/* Public Scanner Modal for Staff Lapangan */}
      <PublicScannerModal
        isOpen={isPublicScannerOpen}
        onClose={() => setIsPublicScannerOpen(false)}
      />

    </div>
  );
};

