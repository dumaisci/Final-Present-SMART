import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, RefreshCw, Upload, AlertCircle, CheckCircle2, SwitchCamera, Image as ImageIcon } from 'lucide-react';

interface CameraScannerProps {
  onScanSuccess: (decodedText: string) => void;
  scannerId?: string;
  autoStart?: boolean;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  onScanSuccess,
  scannerId = 'html5qr-code-full-region',
  autoStart = true
}) => {
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isScanningFile, setIsScanningFile] = useState<boolean>(false);
  const [fileScanError, setFileScanError] = useState<string>('');
  const [lastScannedText, setLastScannedText] = useState<string>('');

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize and get cameras
  useEffect(() => {
    let isMounted = true;

    const initScanner = async () => {
      setIsInitializing(true);
      setCameraError('');

      try {
        // Get list of available cameras
        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer environment/back camera if available
          const backCamera = devices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('rear') || 
            d.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCamera ? backCamera.id : devices[0].id);
        } else {
          setCameraError('Tidak ada kamera yang terdeteksi pada perangkat ini.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('Gagal mendapatkan daftar kamera:', err);
        const isNotAllowed = err?.name === 'NotAllowedError' || String(err).includes('Permission denied') || String(err).includes('NotAllowedError');
        setCameraError(
          isNotAllowed
            ? 'Akses kamera ditolak oleh browser/sistem (Permission denied). Silakan izinkan akses kamera pada ikon gembok di URL browser, atau gunakan fitur Upload Foto / Input Manual di bawah.'
            : (err?.message || 'Akses kamera tidak diizinkan. Mohon berikan izin penggunaan kamera di browser.')
        );
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    };

    initScanner();

    return () => {
      isMounted = false;
      stopCameraScanner();
    };
  }, []);

  // Start scanning when camera is selected or autoStart
  useEffect(() => {
    if (!isInitializing && autoStart && !isScanning && !cameraError) {
      startCameraScanner(selectedCameraId);
    }
  }, [isInitializing, selectedCameraId]);

  const startCameraScanner = async (cameraIdToUse?: string) => {
    setCameraError('');
    setFileScanError('');

    try {
      // Ensure element exists in DOM
      const element = document.getElementById(scannerId);
      if (!element) return;

      // Stop previous instance if running
      await stopCameraScanner();

      const html5Qrcode = new Html5Qrcode(scannerId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A
        ]
      });

      html5QrcodeRef.current = html5Qrcode;

      const cameraConfig = cameraIdToUse 
        ? cameraIdToUse 
        : { facingMode: 'environment' };

      const config = {
        fps: 10,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0
      };

      await html5Qrcode.start(
        cameraConfig,
        config,
        (decodedText) => {
          setLastScannedText(decodedText);
          onScanSuccess(decodedText);
        },
        () => {
          // Frame scan error (ignore frame-by-frame parse failures)
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error('Camera start error:', err);
      setIsScanning(false);
      const isNotAllowed = err?.name === 'NotAllowedError' || String(err).includes('Permission denied') || String(err).includes('NotAllowedError');
      setCameraError(
        isNotAllowed
          ? 'Akses kamera ditolak oleh browser/sistem (Permission denied). Silakan beri izin kamera pada browser, atau gunakan opsi Upload Foto QR / Ketik Kode Aset.'
          : ('Gagal membuka kamera: ' + (err?.message || 'Mohon pastikan izin kamera telah diberikan di browser Anda.'))
      );
    }
  };

  const stopCameraScanner = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        html5QrcodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      } finally {
        html5QrcodeRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const handleCameraChange = async (newCameraId: string) => {
    setSelectedCameraId(newCameraId);
    if (isScanning) {
      await startCameraScanner(newCameraId);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningFile(true);
    setFileScanError('');
    setLastScannedText('');

    try {
      // Temporarily stop live camera to scan file
      await stopCameraScanner();

      const html5Qrcode = new Html5Qrcode(scannerId + '-file');
      const decodedText = await html5Qrcode.scanFile(file, true);
      
      setLastScannedText(decodedText);
      onScanSuccess(decodedText);
      html5Qrcode.clear();
    } catch (err: any) {
      console.error('File scan error:', err);
      setFileScanError('Kode QR/Barcode tidak ditemukan atau tidak terbaca dalam file foto ini.');
    } finally {
      setIsScanningFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      
      {/* Scanner Container Box */}
      <div className="relative bg-slate-900 rounded-2xl overflow-hidden border-2 border-[#008C45]/40 shadow-inner min-h-[260px] flex flex-col items-center justify-center p-2">
        
        {/* HTML5 Reader Element */}
        <div 
          id={scannerId} 
          className="w-full max-w-[320px] rounded-xl overflow-hidden text-white font-sans [&>video]:rounded-xl [&>video]:object-cover"
        />

        {/* Temporary File scanner dummy element */}
        <div id={`${scannerId}-file`} className="hidden" />

        {/* Overlay Scanner Animation when scanning */}
        {isScanning && !cameraError && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between p-4">
            <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-emerald-400 text-[11px] font-bold border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Kamera Aktif & Scanning...</span>
            </div>

            {/* Scanning Laser */}
            <div className="w-64 h-0.5 bg-emerald-400/90 shadow-[0_0_12px_#10b981] animate-bounce"></div>

            <p className="text-[10px] text-slate-300 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg">
              Arahkan kamera ke sticker Barcode atau QR Code Aset
            </p>
          </div>
        )}

        {/* Initializing Spinner */}
        {isInitializing && (
          <div className="flex flex-col items-center space-y-2 text-slate-300 py-8">
            <RefreshCw className="w-8 h-8 animate-spin text-[#008C45]" />
            <span className="text-xs font-semibold">Menyiapkan Kamera Perangkat...</span>
          </div>
        )}

        {/* File Scanning Spinner */}
        {isScanningFile && (
          <div className="flex flex-col items-center space-y-2 text-slate-300 py-8">
            <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
            <span className="text-xs font-semibold">Membaca QR Code dari Foto...</span>
          </div>
        )}

        {/* Camera Error / No Camera Banner */}
        {cameraError && !isScanningFile && (
          <div className="p-4 text-center max-w-sm space-y-2">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
            <p className="text-xs font-bold text-rose-200">{cameraError}</p>
            <p className="text-[11px] text-slate-400">
              Anda tetap dapat mengunggah file foto QR code atau mengetikkan Kode Aset secara manual di bawah.
            </p>
            <button
              type="button"
              onClick={() => startCameraScanner(selectedCameraId)}
              className="mt-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg inline-flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba Buka Kamera Lagi</span>
            </button>
          </div>
        )}

      </div>

      {/* File Scan Error Message */}
      {fileScanError && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{fileScanError}</span>
        </div>
      )}

      {/* Success Scanned Result Banner */}
      {lastScannedText && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Terbaca: <strong className="font-mono text-emerald-700">{lastScannedText}</strong></span>
          </div>
        </div>
      )}

      {/* Camera Controls & File Upload Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        
        {/* Camera Switcher Dropdown */}
        {cameras.length > 1 && (
          <div className="flex items-center space-x-1.5">
            <SwitchCamera className="w-4 h-4 text-slate-500" />
            <select
              value={selectedCameraId}
              onChange={(e) => handleCameraChange(e.target.value)}
              className="bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium p-1.5"
            >
              {cameras.map((cam) => (
                <option key={cam.id} value={cam.id}>
                  {cam.label || `Kamera ${cam.id.substring(0, 5)}...`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Upload QR Image File Button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5 text-[#005DAA]" />
            <span>Upload Foto QR / Barcode</span>
          </button>
        </div>

      </div>

    </div>
  );
};
