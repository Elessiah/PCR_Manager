import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { QrCode } from '../../components/ui/QrCode';

type PairingStep = 'idle' | 'generating' | 'waiting' | 'completed' | 'failed';

export default function PairingPage() {
  const navigate = useNavigate();
  const [step, setStep]         = useState<PairingStep>('idle');
  const [qrData, setQrData]     = useState<string>('');
  const [error, setError]       = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string>('');
  const [countdown, setCountdown]   = useState(300); // 5 min timeout

  // Démarre le serveur d'appairage et obtient le QR code
  const startPairing = useCallback(async () => {
    setStep('generating');
    setError(null);
    try {
      const res = await api.iphoneAuth.pairingStart();
      setQrData(res.qrData);
      setStep('waiting');
      setCountdown(300);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep('failed');
    }
  }, []);

  // Polling toutes les secondes pendant l'attente
  useEffect(() => {
    if (step !== 'waiting') return;

    const interval = setInterval(async () => {
      try {
        const res = await api.iphoneAuth.pairingPoll();
        if (res.status === 'completed') {
          clearInterval(interval);
          setStep('completed');
        } else if (res.status === 'failed') {
          clearInterval(interval);
          setError(res.error ?? 'Appairage échoué');
          setStep('failed');
        }
        // 'pending' → on continue de poller
      } catch (e) {
        clearInterval(interval);
        setError(e instanceof Error ? e.message : String(e));
        setStep('failed');
      }
    }, 1000);

    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timer);
          clearInterval(interval);
          setStep('failed');
          setError("Délai expiré. Relancez l'appairage.");
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [step]);

  const handleCancel = async () => {
    await api.iphoneAuth.cancelPending().catch(() => {});
    navigate('/login');
  };

  const handleDone = () => navigate('/login');

  const mins = String(Math.floor(countdown / 60)).padStart(2, '0');
  const secs = String(countdown % 60).padStart(2, '0');

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md p-8 space-y-6">

        {/* En-tête */}
        <div className="text-center space-y-1">
          <div className="text-2xl font-bold text-text">Ajouter un iPhone</div>
          <div className="text-textSoft text-sm">
            Votre iPhone devient la clé de connexion sécurisée
          </div>
        </div>

        {/* Étape : idle / generating */}
        {(step === 'idle' || step === 'generating') && (
          <div className="space-y-4">
            <div className="bg-surface2 border border-border rounded-lg p-4 text-sm text-textSoft space-y-2">
              <p className="font-semibold text-text">Comment ça fonctionne</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Installez <strong>PCR Authenticator</strong> sur votre iPhone</li>
                <li>Cliquez sur « Générer le QR code » ci-dessous</li>
                <li>Scannez le QR code avec l'app iPhone</li>
                <li>Confirmez avec Face ID ou Touch ID</li>
              </ol>
            </div>
            <button
              onClick={startPairing}
              disabled={step === 'generating'}
              className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {step === 'generating' ? 'Génération…' : 'Générer le QR code'}
            </button>
            <button
              onClick={handleCancel}
              className="w-full py-2 text-sm text-textSoft hover:text-text transition-colors"
            >
              Annuler
            </button>
          </div>
        )}

        {/* Étape : waiting — affichage du QR */}
        {step === 'waiting' && qrData && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="bg-white p-3 rounded-xl shadow-sm">
                <QrCode data={qrData} size={220} />
              </div>
            </div>

            <div className="text-center space-y-1">
              <p className="text-sm text-textSoft">
                Scannez ce code avec <strong>PCR Authenticator</strong> sur votre iPhone
              </p>
              <p className="text-xs text-textSoft opacity-70">
                Les deux appareils doivent être sur le même réseau Wi-Fi
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="animate-pulse w-2 h-2 rounded-full bg-accent inline-block" />
              <span className="text-textSoft">En attente de votre iPhone…</span>
              <span className="font-mono text-xs text-textSoft opacity-60">
                {mins}:{secs}
              </span>
            </div>

            <button
              onClick={handleCancel}
              className="w-full py-2 text-sm text-textSoft hover:text-text transition-colors"
            >
              Annuler
            </button>
          </div>
        )}

        {/* Étape : completed */}
        {step === 'completed' && (
          <div className="space-y-4 text-center">
            <div className="text-5xl">✓</div>
            <div>
              <p className="font-semibold text-text text-lg">Appairage réussi !</p>
              {deviceName && (
                <p className="text-sm text-textSoft mt-1">{deviceName} est maintenant votre clé</p>
              )}
              <p className="text-sm text-textSoft mt-2">
                À chaque connexion, votre iPhone vous demandera Face ID ou Touch ID.
              </p>
            </div>
            <button
              onClick={handleDone}
              className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 transition-colors"
            >
              Continuer
            </button>
          </div>
        )}

        {/* Étape : failed */}
        {step === 'failed' && (
          <div className="space-y-4">
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-sm text-danger">
              <p className="font-semibold">Appairage échoué</p>
              {error && <p className="mt-1 opacity-80">{error}</p>}
            </div>
            <button
              onClick={() => { setStep('idle'); setError(null); setQrData(''); }}
              className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 transition-colors"
            >
              Réessayer
            </button>
            <button
              onClick={handleCancel}
              className="w-full py-2 text-sm text-textSoft hover:text-text transition-colors"
            >
              Retour
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
