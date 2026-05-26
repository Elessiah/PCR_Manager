import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { QrCode } from '../../components/ui/QrCode';

type Step = 'loading' | 'scan' | 'confirm' | 'error';

export default function TotpSetupPage() {
  const navigate = useNavigate();
  const { confirmAuth } = useAuth();

  const [step, setStep]       = useState<Step>('loading');
  const [qrUri, setQrUri]     = useState('');
  const [code, setCode]       = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    api.totpAuth.setupStart()
      .then(uri => { setQrUri(uri); setStep('scan'); })
      .catch(e => { setError(e instanceof Error ? e.message : String(e)); setStep('error'); });
  }, []);

  const submitCode = useCallback(async (codeValue: string) => {
    if (codeValue.length !== 6) return;
    setVerifying(true);
    setError(null);
    try {
      await api.totpAuth.setupConfirm(codeValue);
      const ok = await confirmAuth();
      if (ok) navigate('/', { replace: true });
      else navigate('/login', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCode('');
    } finally {
      setVerifying(false);
    }
  }, [confirmAuth, navigate]);

  const handleCodeInput = useCallback((value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) submitCode(digits);
  }, [submitCode]);

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-textSoft text-sm">Génération du secret…</div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-sm p-8 space-y-4 text-center">
          <p className="text-danger text-sm">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full py-2 text-sm text-textSoft hover:text-text transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-sm p-8 space-y-6">

        <div className="text-center space-y-1">
          <div className="text-2xl font-bold text-text">Configuration TOTP</div>
          <div className="text-textSoft text-sm">Google Authenticator / Authy</div>
        </div>

        {/* QR code */}
        <div className="space-y-3">
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-xl shadow-sm">
              <QrCode data={qrUri} size={200} />
            </div>
          </div>
          <p className="text-xs text-textSoft text-center">
            Scannez ce QR code avec <strong>Google Authenticator</strong> ou <strong>Authy</strong>.
            <br />Un code à 6 chiffres apparaîtra, renouvelé toutes les 30 secondes.
          </p>
        </div>

        {/* Code de confirmation */}
        <div className="space-y-3">
          <p className="text-sm text-textSoft text-center">
            Entrez le code affiché pour confirmer la configuration.
          </p>
          {error && <p className="text-danger text-sm text-center">{error}</p>}
          <input
            type="tel"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => handleCodeInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitCode(code)}
            disabled={verifying}
            placeholder="000000"
            autoFocus
            className="w-full text-center text-3xl tracking-[0.5em] font-mono py-3 px-4 rounded-lg bg-surface2 border border-border text-text disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            onClick={() => submitCode(code)}
            disabled={code.length !== 6 || verifying}
            className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {verifying ? 'Vérification…' : 'Confirmer'}
          </button>
        </div>

        <button
          onClick={() => navigate('/login', { replace: true })}
          className="w-full py-2 text-xs text-textSoft hover:text-text transition-colors"
        >
          Annuler
        </button>

      </div>
    </div>
  );
}
