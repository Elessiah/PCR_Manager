import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

type Mode = 'loading' | 'mac' | 'totp' | 'setup';
type MacStep = 'idle' | 'waiting' | 'failed';

export default function LoginPage() {
  const navigate = useNavigate();
  const { confirmAuth } = useAuth();

  const [mode, setMode]   = useState<Mode>('loading');
  const [error, setError] = useState<string | null>(null);

  // Mac auth
  const [macStep, setMacStep] = useState<MacStep>('idle');

  // TOTP auth
  const [totpCode, setTotpCode]       = useState('');
  const [totpLoading, setTotpLoading] = useState(false);

  // First-time setup
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    const detect = async () => {
      const [macAvail, totpAvail] = await Promise.all([
        api.macAuth.available().catch(() => false),
        api.totpAuth.available().catch(() => false),
      ]);
      if (macAvail)       setMode('mac');
      else if (totpAvail) setMode('totp');
      else                setMode('setup');
    };
    detect();
  }, []);

  // ── Mac Keychain auth ──────────────────────────────────────────────────────

  const startMacAuth = useCallback(async () => {
    setMacStep('waiting');
    setError(null);
    try {
      await api.macAuth.start();
      const ok = await confirmAuth();
      if (ok) navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMacStep('failed');
    }
  }, [confirmAuth, navigate]);

  // ── TOTP auth ──────────────────────────────────────────────────────────────

  const submitTotpCode = useCallback(async (code: string) => {
    if (code.length !== 6) return;
    setTotpLoading(true);
    setError(null);
    try {
      await api.totpAuth.login(code);
      const ok = await confirmAuth();
      if (ok) navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setTotpCode('');
    } finally {
      setTotpLoading(false);
    }
  }, [confirmAuth, navigate]);

  const handleTotpInput = useCallback((value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setTotpCode(digits);
    if (digits.length === 6) submitTotpCode(digits);
  }, [submitTotpCode]);

  // ── First-time setup ───────────────────────────────────────────────────────

  const activateMacAuth = useCallback(async () => {
    setActivating(true);
    setError(null);
    try {
      await api.macAuth.activate();
      setActivating(false);
      setMode('mac');
      setMacStep('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setActivating(false);
    }
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-textSoft text-sm">Chargement…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-sm p-8 space-y-6">

        <div className="text-center space-y-1">
          <div className="text-2xl font-bold text-text">PCR Manager</div>
          <div className="text-textSoft text-sm">
            {mode === 'mac'  ? 'Déverrouillage requis' :
             mode === 'totp' ? 'Code d\'authentification' :
             'Configuration initiale'}
          </div>
        </div>

        {/* ── Mac Keychain ── */}
        {mode === 'mac' && (
          <div className="space-y-4">
            {macStep === 'waiting' ? (
              <div className="text-center py-4 text-textSoft text-sm animate-pulse">
                Vérification en cours…
              </div>
            ) : (
              <>
                {error && <p className="text-danger text-sm text-center">{error}</p>}
                <button
                  onClick={startMacAuth}
                  className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
                >
                  🔐 Déverrouiller PCR Manager
                </button>
                <p className="text-xs text-textSoft text-center">
                  Votre mot de passe macOS vous sera demandé.
                </p>
              </>
            )}
          </div>
        )}

        {/* ── TOTP ── */}
        {mode === 'totp' && (
          <div className="space-y-4">
            <p className="text-sm text-textSoft text-center">
              Saisissez le code à 6 chiffres affiché dans Google Authenticator ou Authy.
            </p>
            {error && <p className="text-danger text-sm text-center">{error}</p>}
            <input
              type="tel"
              inputMode="numeric"
              maxLength={6}
              value={totpCode}
              onChange={e => handleTotpInput(e.target.value)}
              disabled={totpLoading}
              placeholder="000000"
              autoFocus
              className="w-full text-center text-3xl tracking-[0.5em] font-mono py-3 px-4 rounded-lg bg-surface2 border border-border text-text disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            {totpLoading && (
              <div className="text-center text-textSoft text-sm animate-pulse">
                Vérification…
              </div>
            )}
          </div>
        )}

        {/* ── Première installation ── */}
        {mode === 'setup' && (
          <div className="space-y-4">
            {activating ? (
              <div className="text-center py-4 text-textSoft text-sm animate-pulse">
                Activation en cours…
              </div>
            ) : (
              <>
                <p className="text-sm text-textSoft text-center">
                  Choisissez comment protéger l'accès à vos données.
                </p>
                {error && <p className="text-danger text-sm text-center">{error}</p>}
                <button
                  onClick={activateMacAuth}
                  className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
                >
                  🔐 Protéger avec le Keychain macOS
                </button>
                <p className="text-xs text-textSoft text-center -mt-2">
                  Votre mot de passe macOS (ou Touch ID si disponible) sera demandé à chaque ouverture.
                </p>
                <button
                  onClick={() => navigate('/totp-setup')}
                  className="w-full py-2 text-sm text-textSoft hover:text-text transition-colors border border-border rounded-lg"
                >
                  Configurer avec Google Authenticator / Authy
                </button>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
