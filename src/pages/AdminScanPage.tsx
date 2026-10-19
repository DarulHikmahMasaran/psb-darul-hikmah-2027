import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { scheduleService, CandidateVerifiedQrResult } from '../services/scheduleService';
import { AttendanceStatus, CandidateQrScanLog, QrScanMethod } from '../types/database';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { Alert } from '../components/Alert';
import { LoadingSpinner } from '../components/Loading';
import { formatDateIndonesian } from '../utils/formatters';
import { BrowserQRCodeReader, BrowserCodeReader, IScannerControls } from '@zxing/browser';
import {
  Camera,
  Keyboard,
  QrCode,
  Search,
  CheckCircle,
  AlertTriangle,
  User,
  Clock,
  MapPin,
  Calendar,
  Check,
  X,
  ScanLine,
  RefreshCw,
  Sparkles,
  Zap,
  ZapOff,
  SwitchCamera,
  Pause,
  Play,
  ShieldCheck,
  History,
  Info
} from 'lucide-react';

export const AdminScanPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');

  // Manual search state
  const [queryInput, setQueryInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedResult, setVerifiedResult] = useState<CandidateVerifiedQrResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState(false);
  const [attendanceNote, setAttendanceNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Camera scanner state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scannerControls, setScannerControls] = useState<IScannerControls | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraPermissionState, setCameraPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unavailable'>('prompt');
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [torchOn, setTorchOn] = useState(false);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isScanningPaused, setIsScanningPaused] = useState(false);

  // Recent scan logs
  const [recentLogs, setRecentLogs] = useState<CandidateQrScanLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Audio Beep generator via Web Audio API (instant, no external network assets)
  const playSuccessBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12); // E6 note

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch {
      // Audio autoplay policy ignored
    }
  }, []);

  // Fetch recent scan logs
  const loadRecentLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await scheduleService.getScanLogs(10);
      setRecentLogs(logs);
    } catch (e) {
      console.error('Failed to load recent scan logs', e);
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    loadRecentLogs();
  }, [loadRecentLogs]);

  // Enumerate camera devices
  const enumerateDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        setCameraPermissionState('unavailable');
        setCameraErrorMessage('Kamera tidak didukung oleh browser pada perangkat ini.');
        return;
      }
      const videoDevices = await BrowserCodeReader.listVideoInputDevices();
      setDevices(videoDevices);
      if (videoDevices.length === 0) {
        setCameraPermissionState('unavailable');
        setCameraErrorMessage('Kamera tidak terdeteksi pada perangkat ini. Silakan gunakan pemindai manual (barcode gun) atau input nomor registrasi.');
        return;
      }
      if (videoDevices.length > 0 && !selectedDeviceId) {
        // Prioritize rear/environment camera on phones
        const rearCam = videoDevices.find((d) =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('belakang') ||
          d.label.toLowerCase().includes('environment') ||
          d.label.toLowerCase().includes('rear')
        );
        setSelectedDeviceId(rearCam ? rearCam.deviceId : videoDevices[0].deviceId);
      }
    } catch (err: any) {
      console.warn('[CAMERA_SCANNER] Error listing video devices:', err?.message || err);
    }
  }, [selectedDeviceId]);

  // Start Camera QR Scanner
  const startCamera = useCallback(async (deviceIdToUse?: string) => {
    if (!videoRef.current) return;

    // Stop existing controls if running
    if (scannerControls) {
      try {
        scannerControls.stop();
      } catch {
        // ignore
      }
      setScannerControls(null);
    }

    setCameraErrorMessage(null);
    setIsCameraActive(false);

    // Check mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermissionState('unavailable');
      setCameraErrorMessage('Kamera tidak tersedia pada perangkat ini.');
      return;
    }

    try {
      const codeReader = new BrowserQRCodeReader();

      const targetDeviceId = deviceIdToUse || selectedDeviceId;
      const constraints: MediaStreamConstraints = {
        video: targetDeviceId
          ? { deviceId: { exact: targetDeviceId } }
          : { facingMode: { ideal: 'environment' } }
      };

      // Request stream & permission with graceful fallback constraint
      let controls;
      try {
        controls = await codeReader.decodeFromConstraints(
          constraints,
          videoRef.current,
          (result, error, activeControls) => {
            if (result) {
              const rawText = result.getText();
              if (rawText && rawText.trim()) {
                activeControls.stop();
                setIsCameraActive(false);
                setScannerControls(null);
                setIsScanningPaused(true);

                playSuccessBeep();
                handleVerify(rawText, 'QR_CAMERA');
              }
            }
          }
        );
      } catch (firstErr: any) {
        // If exact device or ideal facingMode was not found, attempt generic video constraint
        if (targetDeviceId || constraints.video) {
          controls = await codeReader.decodeFromConstraints(
            { video: true },
            videoRef.current,
            (result, error, activeControls) => {
              if (result) {
                const rawText = result.getText();
                if (rawText && rawText.trim()) {
                  activeControls.stop();
                  setIsCameraActive(false);
                  setScannerControls(null);
                  setIsScanningPaused(true);

                  playSuccessBeep();
                  handleVerify(rawText, 'QR_CAMERA');
                }
              }
            }
          );
        } else {
          throw firstErr;
        }
      }

      setScannerControls(controls);
      setIsCameraActive(true);
      setCameraPermissionState('granted');
      setIsScanningPaused(false);

      // Check torch capability
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        const track = stream?.getVideoTracks()[0];
        if (track && 'getCapabilities' in track) {
          const caps = (track as any).getCapabilities?.();
          setIsTorchSupported(!!caps?.torch);
        }
      } catch {
        setIsTorchSupported(false);
      }

      await enumerateDevices();
    } catch (err: any) {
      console.warn('[CAMERA_SCANNER] Kamera tidak dapat diakses:', err?.message || err);
      setIsCameraActive(false);
      setScannerControls(null);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraPermissionState('denied');
        setCameraErrorMessage('Kamera tidak diizinkan. Silakan izinkan akses kamera pada pengaturan browser.');
      } else if (
        err.name === 'NotFoundError' || 
        err.name === 'DevicesNotFoundError' || 
        err.name === 'OverconstrainedError' ||
        err.message?.includes('Requested device not found') ||
        err.message?.includes('device not found')
      ) {
        setCameraPermissionState('unavailable');
        setCameraErrorMessage('Kamera tidak terdeteksi pada perangkat ini. Silakan gunakan pemindai manual (barcode gun) atau input nomor registrasi.');
      } else {
        setCameraPermissionState('unavailable');
        setCameraErrorMessage(`Gagal mengakses kamera: ${err.message || 'Perangkat kamera tidak dapat diakses.'}`);
      }
    }
  }, [selectedDeviceId, scannerControls, enumerateDevices, playSuccessBeep]);

  // Stop camera when unmounting or switching to manual tab
  const stopCamera = useCallback(() => {
    if (scannerControls) {
      try {
        scannerControls.stop();
      } catch {
        // Ignored
      }
      setScannerControls(null);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      } catch {
        // Ignored
      }
    }
    setIsCameraActive(false);
    setTorchOn(false);
  }, [scannerControls]);

  // Tab change handler
  useEffect(() => {
    if (activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
      inputRef.current?.focus();
    }

    return () => {
      stopCamera();
    };
  }, [activeTab]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn('Torch toggle failed', err);
    }
  };

  // Switch Camera device (Front / Back)
  const handleSwitchCamera = () => {
    if (devices.length <= 1) return;
    const currentIndex = devices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextDevice = devices[nextIndex];
    setSelectedDeviceId(nextDevice.deviceId);
    startCamera(nextDevice.deviceId);
  };

  // Core verification logic
  const handleVerify = async (val?: string, method: QrScanMethod = 'MANUAL') => {
    const target = val !== undefined ? val : queryInput;
    if (!target.trim()) return;

    setErrorMessage(null);
    setSuccessToast(null);
    setIsVerifying(true);

    try {
      const res = await scheduleService.verifyCandidateByQr(
        target,
        user ? { id: user.id, email: user.email, name: user.profile?.full_name || 'Panitia' } : undefined,
        method,
        { userAgent: navigator.userAgent }
      );

      if (res.success && res.result) {
        setVerifiedResult(res.result);
        if (res.result.alreadyPresent) {
          setSuccessToast(`Peserta ini sudah tercatat HADIR pada sesi ${res.result.alreadyPresentDetails?.sessionTitle || 'ujian'}.`);
        }
      } else {
        setVerifiedResult(null);
        setErrorMessage(res.error || 'Data peserta tidak valid atau tidak ditemukan.');
      }
    } catch (err: any) {
      setVerifiedResult(null);
      setErrorMessage(err.message || 'Gagal memverifikasi QR code.');
    } finally {
      setIsVerifying(false);
      loadRecentLogs();
    }
  };

  // Update Attendance Status
  const handleUpdateAttendance = async (
    scheduleId: string,
    status: AttendanceStatus,
    sessionTitle: string
  ) => {
    if (!verifiedResult || !user) return;
    setIsUpdatingAttendance(true);
    setSuccessToast(null);

    const res = await scheduleService.updateAttendance({
      scheduleId,
      candidateId: verifiedResult.candidate.id,
      status,
      note: attendanceNote,
      scanMethod: activeTab === 'camera' ? 'QR_CAMERA' : 'MANUAL',
      qrToken: verifiedResult.verificationToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.profile?.full_name || 'Panitia Seleksi',
      },
    });

    setIsUpdatingAttendance(false);

    if (res.success) {
      const statusLabel =
        status === 'HADIR' ? 'HADIR' : status === 'TERLAMBAT' ? 'TERLAMBAT' : 'TIDAK HADIR';
      setSuccessToast(`Presensi ${sessionTitle} berhasil diperbarui: ${statusLabel}.`);
      setAttendanceNote('');

      // Update state in verifiedResult
      setVerifiedResult((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          alreadyPresent: status === 'HADIR',
          alreadyPresentDetails:
            status === 'HADIR'
              ? {
                  sessionTitle,
                  scannedAt: new Date().toISOString(),
                  scannedByName: user.profile?.full_name || 'Panitia Seleksi',
                  status: 'HADIR',
                }
              : undefined,
          schedules: prev.schedules.map((s) =>
            s.scheduleId === scheduleId
              ? {
                  ...s,
                  attendance_status: status,
                  scanned_at: new Date().toISOString(),
                  scanned_by_name: user.profile?.full_name || 'Panitia Seleksi',
                }
              : s
          ),
        };
      });

      loadRecentLogs();
    } else {
      setErrorMessage(res.error || 'Gagal memperbarui presensi.');
    }
  };

  // Reset scan to process the next candidate
  const handleResetScan = () => {
    setQueryInput('');
    setVerifiedResult(null);
    setErrorMessage(null);
    setSuccessToast(null);
    setAttendanceNote('');
    setIsScanningPaused(false);

    if (activeTab === 'camera') {
      startCamera();
    } else {
      inputRef.current?.focus();
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ScanLine className="w-7 h-7 text-emerald-700" />
            Pemindaian QR & Presensi Peserta Seleksi
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pindai QR Code pada Kartu Peserta Ujian PSB TP 2027/2028 menggunakan kamera perangkat atau cari nomor registrasi.
          </p>
        </div>

        {verifiedResult && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleResetScan}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Pindai Peserta Berikutnya
          </Button>
        )}
      </div>

      {/* Method Selection Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1 shadow-xs border">
        <button
          type="button"
          onClick={() => setActiveTab('camera')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition ${
            activeTab === 'camera'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Camera className="w-4 h-4" />
          TAB 1: 📷 SCAN DENGAN KAMERA
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition ${
            activeTab === 'manual'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Keyboard className="w-4 h-4" />
          TAB 2: ⌨️ CARI NOMOR PESERTA
        </button>
      </div>

      {/* TAB 1: CAMERA QR SCANNER */}
      {activeTab === 'camera' && (
        <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-lg border border-slate-800 space-y-4">
          {/* Camera Viewfinder & Overlay */}
          <div className="relative w-full max-w-md mx-auto aspect-4/3 sm:aspect-square bg-black rounded-2xl overflow-hidden border-2 border-slate-700 flex items-center justify-center">
            {/* Live Video Feed */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />

            {/* Target Scanning Box Overlay */}
            {isCameraActive && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                <div className="relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                  {/* Glowing Corner Accents */}
                  <span className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr" />
                  <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl" />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br" />

                  {/* Animated Laser Scanning Line */}
                  <div className="absolute left-2 right-2 h-0.5 bg-emerald-400 shadow-[0_0_10px_#10b981] animate-pulse top-1/2 -translate-y-1/2" />
                </div>

                <p className="mt-4 px-3 py-1 bg-black/75 backdrop-blur-xs text-[11px] font-semibold text-emerald-300 rounded-full border border-emerald-500/30">
                  Arahkan kamera ke QR Code pada Kartu Peserta
                </p>
              </div>
            )}

            {/* Paused / Scanning Inactive State Overlay */}
            {isScanningPaused && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <CheckCircle className="w-12 h-12 text-emerald-400 animate-bounce" />
                <h4 className="text-sm font-bold text-white">QR Code Berhasil Dipindai!</h4>
                <p className="text-xs text-slate-300">
                  Data calon santri sedang divalidasi dan ditampilkan di bawah.
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold"
                  onClick={handleResetScan}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Pindai Lagi
                </Button>
              </div>
            )}

            {/* Camera Permission / Unavailable Fallback */}
            {!isCameraActive && !isScanningPaused && (
              <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <AlertTriangle className="w-10 h-10 text-amber-400" />
                <h4 className="text-sm font-bold text-white">
                  {cameraPermissionState === 'denied'
                    ? 'Akses Kamera Ditolak'
                    : cameraPermissionState === 'unavailable'
                    ? 'Kamera Tidak Tersedia'
                    : 'Meminta Izin Kamera'}
                </h4>
                <p className="text-xs text-slate-300 max-w-xs">
                  {cameraErrorMessage || 'Pastikan browser diizinkan mengakses kamera perangkat.'}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    size="sm"
                    variant="primary"
                    className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs"
                    onClick={() => startCamera()}
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Coba Deteksi Lagi
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700"
                    onClick={() => setActiveTab('manual')}
                    leftIcon={<Keyboard className="w-3.5 h-3.5" />}
                  >
                    Beralih ke Input Manual
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Camera Controls & Status Bar */}
          <div className="max-w-md mx-auto flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800 text-xs">
            {/* Live Indicator */}
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isCameraActive ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
              <span className="font-semibold text-slate-200">
                {isCameraActive ? '🟢 Kamera aktif' : '🔴 Kamera tidak aktif'}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5">
              {devices.length > 1 && (
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  title="Ganti Kamera (Depan / Belakang)"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition"
                >
                  <SwitchCamera className="w-3.5 h-3.5" />
                  <span>Ganti Kamera</span>
                </button>
              )}

              {isTorchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  title={torchOn ? 'Matikan Senter' : 'Nyalakan Senter'}
                  className={`p-1.5 rounded-lg border transition ${
                    torchOn
                      ? 'bg-amber-500 text-black border-amber-400 font-bold'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  {torchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
                </button>
              )}

              <button
                type="button"
                onClick={() => (isCameraActive ? stopCamera() : startCamera())}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition"
              >
                {isCameraActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isCameraActive ? 'Jeda' : 'Mulai'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MANUAL SEARCH / SCANNER INPUT */}
      {activeTab === 'manual' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerify(undefined, 'MANUAL');
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="flex-1">
              <Input
                ref={inputRef}
                placeholder="Scan barcode QR atau ketik Nomor Registrasi (contoh: DH-2027-0001)..."
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                leftIcon={<QrCode className="w-4 h-4 text-slate-400" />}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              isLoading={isVerifying}
              className="bg-emerald-700 hover:bg-emerald-800 font-bold shrink-0"
              leftIcon={<Search className="w-4 h-4" />}
            >
              Cari Peserta
            </Button>
          </form>

          {/* Quick simulator buttons for testing */}
          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap pt-1">
            <span>Uji Cepat Simulasi:</span>
            <button
              type="button"
              onClick={() => {
                setQueryInput('DH-2027-0001');
                handleVerify('DH-2027-0001', 'MANUAL');
              }}
              className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-mono text-[11px] font-bold border border-emerald-200 hover:bg-emerald-100 transition"
            >
              DH-2027-0001 (Farhan)
            </button>
          </div>
        </div>
      )}

      {/* Alerts & Notifications */}
      {errorMessage && (
        <Alert
          type="error"
          title="Verifikasi Gagal"
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {successToast && (
        <Alert
          type="success"
          title="Presensi Berhasil"
          message={successToast}
          onClose={() => setSuccessToast(null)}
        />
      )}

      {/* VERIFIED CANDIDATE DISPLAY (Privacy Protected: NO NIK, NO Address, NO Parent data) */}
      {verifiedResult && (
        <div className="bg-white rounded-3xl border-2 border-emerald-600 shadow-md p-6 space-y-6 animate-in fade-in duration-300">
          {/* Double Scan Notification if Already Present */}
          {verifiedResult.alreadyPresent && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-900 space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                Peserta ini sudah tercatat HADIR sebelumnya.
              </div>
              <p className="text-xs text-amber-800 leading-relaxed pl-7">
                Waktu Presensi: <strong>{verifiedResult.alreadyPresentDetails?.scannedAt ? formatDateIndonesian(verifiedResult.alreadyPresentDetails.scannedAt) : 'Hari ini'}</strong>
                {' • '}
                Petugas Verifikator: <strong>{verifiedResult.alreadyPresentDetails?.scannedByName || 'Panitia Seleksi'}</strong>
              </p>
            </div>
          )}

          {/* Valid Header Badge */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> ✓ QR VALID
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Token: <strong className="text-slate-800">{verifiedResult.verificationToken || 'DH-SECURE-TOKEN'}</strong>
              </span>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleResetScan}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Scan Peserta Lain
            </Button>
          </div>

          {/* Candidate Profile Details */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Passport Photo */}
            <div className="w-28 h-36 sm:w-32 sm:h-40 rounded-2xl border-2 border-slate-200 bg-slate-50 overflow-hidden shrink-0 shadow-xs flex items-center justify-center">
              {verifiedResult.photoUrl ? (
                <img
                  src={verifiedResult.photoUrl}
                  alt={verifiedResult.candidate.full_name}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <div className="p-2 text-center text-slate-400">
                  <User className="w-10 h-10 mx-auto mb-1 text-slate-300" />
                  <span className="text-[10px] block leading-tight">Foto Santri</span>
                </div>
              )}
            </div>

            {/* Structured Card Fields */}
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="font-mono font-black text-xl text-emerald-900 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                  {verifiedResult.candidate.registration_number}
                </span>
                <Badge status={verifiedResult.candidate.status} size="sm" />
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Nama Calon Santri
                </span>
                <h2 className="text-2xl font-black text-slate-900 leading-tight">
                  {verifiedResult.candidate.full_name}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">NISN</span>
                  <span className="font-mono font-bold text-slate-800">
                    {verifiedResult.candidate.nisn || '3124567890'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Asal Sekolah</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {verifiedResult.candidate.school_name || 'SD/MI Pendaftar'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SESSIONS & ATTENDANCE ACTIONS */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-700" />
              Jadwal Sesi Ujian & Tombol Presensi
            </h3>

            {verifiedResult.schedules.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                Peserta ini belum dijadwalkan pada sesi ujian seleksi apapun.
              </div>
            ) : (
              <div className="space-y-4">
                {verifiedResult.schedules.map((sch) => {
                  const isPresent = sch.attendance_status === 'HADIR';
                  const isLate = sch.attendance_status === 'TERLAMBAT';
                  const isAbsent = sch.attendance_status === 'TIDAK_HADIR';

                  return (
                    <div
                      key={sch.participantId}
                      className={`p-5 rounded-2xl border-2 transition-all ${
                        isPresent
                          ? 'bg-emerald-50/60 border-emerald-400'
                          : isLate
                          ? 'bg-amber-50/60 border-amber-400'
                          : isAbsent
                          ? 'bg-rose-50/60 border-rose-400'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-base text-slate-900">
                              {sch.title}
                            </span>
                            <span className="font-mono text-xs font-black text-emerald-900 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-200 shadow-2xs">
                              Kursi: {sch.seat_number}
                            </span>
                            {sch.attendance_status !== 'BELUM_HADIR' && (
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  isPresent
                                    ? 'bg-emerald-200 text-emerald-900'
                                    : isLate
                                    ? 'bg-amber-200 text-amber-900'
                                    : 'bg-rose-200 text-rose-900'
                                }`}
                              >
                                {sch.attendance_status}
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                            <span className="font-medium">{formatDateIndonesian(sch.test_date)}</span>
                            <span>•</span>
                            <span className="font-mono font-semibold">{sch.start_time} - {sch.end_time} WIB</span>
                            <span>•</span>
                            <span>Ruangan: <strong>{sch.room}</strong> ({sch.location})</span>
                          </div>

                          {sch.scanned_at && (
                            <p className="text-[11px] text-slate-500 pt-0.5">
                              Tercatat: {formatDateIndonesian(sch.scanned_at)} oleh {sch.scanned_by_name || 'Panitia'}
                            </p>
                          )}
                        </div>

                        {/* Presensi Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
                          {/* PRIMARY PRESENSI BUTTON */}
                          <Button
                            size="md"
                            variant="primary"
                            disabled={isUpdatingAttendance}
                            className={`font-black tracking-wide text-xs px-4 py-2.5 rounded-xl shadow-xs ${
                              isPresent
                                ? 'bg-emerald-800 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                            leftIcon={<Check className="w-4 h-4 stroke-[3]" />}
                            onClick={() => handleUpdateAttendance(sch.scheduleId, 'HADIR', sch.title)}
                          >
                            {isPresent ? '✓ SUDAH HADIR' : '✓ TANDAI HADIR'}
                          </Button>

                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={isUpdatingAttendance}
                            className={`text-xs ${isLate ? 'border-amber-400 bg-amber-200 text-amber-900 font-bold' : ''}`}
                            onClick={() => handleUpdateAttendance(sch.scheduleId, 'TERLAMBAT', sch.title)}
                          >
                            Terlambat
                          </Button>

                          <Button
                            size="sm"
                            variant="danger"
                            disabled={isUpdatingAttendance}
                            className={`text-xs ${isAbsent ? 'bg-rose-700 text-white font-bold' : ''}`}
                            onClick={() => handleUpdateAttendance(sch.scheduleId, 'TIDAK_HADIR', sch.title)}
                          >
                            Tidak Hadir
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Privacy & Security Safe Note */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-center sm:text-left">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              Sistem Keamanan Terpadu: NIK, Alamat Lengkap, dan Data Orang Tua dirahasiakan sesuai standar perlindungan data santri.
            </span>
            <span className="font-mono text-emerald-800 font-semibold text-[10px] shrink-0">
              DH-VERIFY-2027
            </span>
          </div>
        </div>
      )}

      {/* RECENT SCAN LOGS AUDIT TRAIL */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-4 h-4 text-emerald-700" />
            Riwayat Pemindaian & Log Presensi Terkini
          </h3>
          <button
            type="button"
            onClick={loadRecentLogs}
            className="text-xs text-slate-500 hover:text-emerald-700 flex items-center gap-1 font-medium"
          >
            <RefreshCw className="w-3 h-3" /> Muat Ulang
          </button>
        </div>

        {isLoadingLogs ? (
          <LoadingSpinner text="Memuat riwayat scan..." className="py-6" />
        ) : recentLogs.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Belum ada riwayat pemindaian.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Metode</th>
                  <th className="py-2.5 px-3">No. Registrasi</th>
                  <th className="py-2.5 px-3">Nama Santri</th>
                  <th className="py-2.5 px-3">Hasil Pemindaian</th>
                  <th className="py-2.5 px-3">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recentLogs.map((log) => {
                  const isSuccess = log.scan_result === 'SUCCESS';
                  const isAlready = log.scan_result === 'SUCCESS_ALREADY_PRESENT';
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="py-2 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(log.scanned_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.scan_method === 'QR_CAMERA'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {log.scan_method === 'QR_CAMERA' ? '📷 Kamera' : '⌨️ Manual'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {log.registration_number || '-'}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-800">
                        {log.candidate_name || 'Tidak Ditemukan'}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          isSuccess
                            ? 'bg-emerald-100 text-emerald-800'
                            : isAlready
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {log.scan_result}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500 text-[11px]">
                        {log.scanned_by_name || 'Panitia'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
