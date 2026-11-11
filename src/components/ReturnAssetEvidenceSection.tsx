import React, { useRef, useState } from 'react';
import { Camera, MapPin, CheckCircle2, AlertCircle, RefreshCw, Trash2, ExternalLink, Sparkles } from 'lucide-react';

interface ReturnAssetEvidenceSectionProps {
  foto: string;
  onFotoChange: (fotoDataUrl: string) => void;
  lokasiGps: { lat: number; lng: number; accuracy?: number } | null;
  onLokasiGpsChange: (gps: { lat: number; lng: number; accuracy?: number } | null, formattedText?: string) => void;
  lokasiFisik: string;
  onLokasiFisikChange: (lokasi: string) => void;
  namaAset?: string;
  disabled?: boolean;
}

/**
 * Utility to compress any camera capture / image file down to max 800x800 JPEG (~50-80KB)
 * to ensure blazing-fast transmission and lightweight database persistence.
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress to JPEG with 0.75 quality
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
        resolve(compressedDataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export const ReturnAssetEvidenceSection: React.FC<ReturnAssetEvidenceSectionProps> = ({
  foto,
  onFotoChange,
  lokasiGps,
  onLokasiGpsChange,
  lokasiFisik,
  onLokasiFisikChange,
  namaAset,
  disabled = false
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string>('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setIsProcessingPhoto(true);
    try {
      const compressed = await compressImage(file);
      onFotoChange(compressed);
    } catch (err) {
      console.error('Error compressing return photo:', err);
      // Fallback to raw data url
      const reader = new FileReader();
      reader.onload = (re) => {
        if (re.target?.result) onFotoChange(re.target.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsProcessingPhoto(false);
      // Reset input value so same photo can be re-selected if desired
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGetLocation = () => {
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('Perangkat/Browser ini tidak mendukung Geolocation API.');
      return;
    }

    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const gpsObj = {
          lat: Number(latitude.toFixed(6)),
          lng: Number(longitude.toFixed(6)),
          accuracy: Math.round(accuracy)
        };

        // Formatted coordinate string
        const coordsText = `Lat: ${gpsObj.lat}, Long: ${gpsObj.lng}`;
        let updatedLokasi = lokasiFisik.trim();

        // If lokasiFisik doesn't already contain GPS coords, append them
        if (!updatedLokasi.includes('Lat:')) {
          updatedLokasi = updatedLokasi
            ? `${updatedLokasi} (${coordsText})`
            : `Lokasi Pengembalian (${coordsText})`;
          onLokasiFisikChange(updatedLokasi);
        }

        onLokasiGpsChange(gpsObj, coordsText);
        setIsGettingGps(false);
      },
      (error) => {
        setIsGettingGps(false);
        console.warn('Geolocation error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError('Akses lokasi (GPS) ditolak oleh browser/sistem. Harap izinkan akses lokasi di ikon gembok browser.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setGpsError('Informasi sinyal lokasi GPS tidak tersedia.');
        } else if (error.code === error.TIMEOUT) {
          setGpsError('Waktu pencarian lokasi GPS habis (timeout). Coba lagi.');
        } else {
          setGpsError('Gagal memperoleh titik lokasi GPS.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-blue-50/80 border-2 border-emerald-300 rounded-xl p-3.5 space-y-3 shadow-xs">
      {/* Banner Title */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-xs">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
              <span>Bukti Fisik & Lokasi Selesai Pakai</span>
              <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.2 rounded font-black uppercase tracking-wide">
                Wajib
              </span>
            </h4>
            <p className="text-[11px] text-slate-600 leading-tight">
              Aset akan ditransisikan dari <strong>Digunakan</strong> ke <strong>Tersedia</strong>. Lampirkan foto fisik barang dan kunci titik GPS pengembalian.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Pengambilan Gambar / Foto Barang */}
      <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-emerald-200">
        <div className="flex items-center justify-between text-xs">
          <label className="font-bold text-slate-800 flex items-center space-x-1.5">
            <Camera className="w-3.5 h-3.5 text-emerald-600" />
            <span>1. Foto Kondisi Fisik Barang Selesai Pakai *</span>
          </label>
          {foto && (
            <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Foto Terlampir
            </span>
          )}
        </div>

        {/* Hidden Camera Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          disabled={disabled || isProcessingPhoto}
          className="hidden"
        />

        {/* Photo View / Upload Trigger */}
        {foto ? (
          <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex flex-col sm:flex-row items-center gap-3 p-2">
            <img
              src={foto}
              alt={namaAset ? `Foto ${namaAset}` : 'Foto Pengembalian Aset'}
              className="w-24 h-24 sm:w-28 sm:h-24 object-cover rounded-md border border-slate-300 shrink-0 shadow-2xs"
            />
            <div className="flex-1 text-xs space-y-1 w-full">
              <div className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Foto Fisik Berhasil Direkam</span>
              </div>
              <p className="text-[10px] text-slate-500">
                Gambar terkompresi otomatis (&lt;100 KB) untuk riwayat audit pemakaian.
              </p>
              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  disabled={disabled || isProcessingPhoto}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Ambil Ulang</span>
                </button>
                <button
                  type="button"
                  disabled={disabled || isProcessingPhoto}
                  onClick={() => onFotoChange('')}
                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[11px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Hapus</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            onClick={() => {
              if (!disabled && !isProcessingPhoto) fileInputRef.current?.click();
            }}
            className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 p-4 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all text-center space-y-1.5"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              {isProcessingPhoto ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="font-extrabold text-xs text-emerald-950">
                {isProcessingPhoto ? 'Memproses Foto...' : 'Ketuk untuk Buka Kamera / Pilih Foto Barang *'}
              </div>
              <p className="text-[10px] text-emerald-800/80">
                Ambil foto fisik alat terkini untuk memastikan kondisi selesai dipakai
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Akses Lokasi (GPS Geolocation) */}
      <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-sky-200">
        <div className="flex items-center justify-between text-xs">
          <label className="font-bold text-slate-800 flex items-center space-x-1.5">
            <MapPin className="w-3.5 h-3.5 text-sky-600" />
            <span>2. Titik Lokasi Pengembalian (GPS) *</span>
          </label>
          {lokasiGps && (
            <span className="inline-flex items-center text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
              <CheckCircle2 className="w-3 h-3 mr-1 text-sky-600" />
              GPS Terkunci
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            type="button"
            disabled={disabled || isGettingGps}
            onClick={handleGetLocation}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-xs cursor-pointer ${
              lokasiGps
                ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300'
                : 'bg-sky-600 hover:bg-sky-700 text-white'
            }`}
          >
            {isGettingGps ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Mendeteksi Satelit GPS...</span>
              </>
            ) : (
              <>
                <MapPin className="w-3.5 h-3.5" />
                <span>{lokasiGps ? 'Perbarui Titik GPS' : 'Ambil Lokasi Saat Ini (GPS) *'}</span>
              </>
            )}
          </button>

          {lokasiGps && (
            <a
              href={`https://www.google.com/maps?q=${lokasiGps.lat},${lokasiGps.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition-colors border border-slate-200"
              title="Buka titik koordinat di Google Maps"
            >
              <span>{lokasiGps.lat.toFixed(5)}, {lokasiGps.lng.toFixed(5)}</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>
          )}
        </div>

        {gpsError && (
          <div className="p-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-800 flex items-start space-x-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
            <span>{gpsError}</span>
          </div>
        )}

        {/* Input Keterangan Ruangan / Rak / Tempat Pengembalian */}
        <div>
          <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
            Detail Ruangan / Lemari / Gedung Pengembalian:
          </label>
          <input
            type="text"
            required
            placeholder="Contoh: Gudang Instrumen - Lemari B-02 / Lab Uji Fisik"
            value={lokasiFisik}
            onChange={(e) => onLokasiFisikChange(e.target.value)}
            disabled={disabled}
            className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-hidden focus:ring-2 focus:ring-sky-600 bg-slate-50/50"
          />
        </div>
      </div>
    </div>
  );
};
