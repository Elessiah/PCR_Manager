import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { QrCode } from '../../components/ui/QrCode';

// ── Types WebAuthn JSON (Safari 17.4+ / Chrome 128+) non encore dans @types/web ──
type ParseCreationFn = (opts: Record<string, unknown>) => CredentialCreationOptions;
type ParseRequestFn  = (opts: Record<string, unknown>) => CredentialRequestOptions;
type PKCStatic = typeof PublicKeyCredential & {
  parseCreationOptionsFromJSON: ParseCreationFn;
  parseRequestOptionsFromJSON:  ParseRequestFn;
};
type PKCWithJSON = PublicKeyCredential & { toJSON: () => Record<string, unknown> };

const isDev = import.meta.env.DEV;

type AuthMode = 'detect' | 'iphone' | 'passkey';
type IphoneAuthStep = 'idle' | 'loading' | 'scanning' | 'done' | 'failed';

export default function LoginPage() {
  const navigate = useNavigate();
  const { confirmAuth } = useAuth();

  const [mode, setMode]                     = useState<AuthMode>('detect');
  const [hasPasskey, setHasPasskey]         = useState<boolean | null>(null);
  const [hasPairedIphone, setHasPairedIphone] = useState<boolean | null>(null);
  const [pairedDevices, setPairedDevices]   = useState<Array<{ pairingId: string; iphoneDeviceName: string }>>([]);
  const [activePairingId, setActivePairingId] = useState<string | null>(null);

  // iPhone auth state
  const [iphoneStep, setIphoneStep]     = useState<IphoneAuthStep>('idle');
  const [iphoneQr, setIphoneQr]         = useState<string>('');
  const [countdown, setCountdown]       = useState(60);

  // Passkey / generic auth state
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const [error, setError]               = useState<string | null>(null);

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (pollRef.current)  clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    pollRef.current = null;
    timerRef.current = null;
  }, []);

  // Détection au montage : iPhone appairé ? Passkey ?
  useEffect(() => {
    const detect = async () => {
      const [iphone, passkey] = await Promise.all([
        api.iphoneAuth.hasPairedDevice().catch(() => false),
        api.passkey.hasCredentials().catch(() => false),
      ]);
      setHasPairedIphone(iphone);
      setHasPasskey(passkey);

      if (iphone) {
        const devices = await api.iphoneAuth.pairingList().catch(() => []);
        setPairedDevices(devices.map(d => ({ pairingId: d.pairingId, iphoneDeviceName: d.iphoneDeviceName })));
        if (devices.length > 0) setActivePairingId(devices[0].pairingId);
        setMode('iphone');
      } else if (passkey) {
        setMode('passkey');
      } else {
        setMode('passkey'); // premier lancement → création passkey
      }
    };
    detect();
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // ── Auth iPhone ────────────────────────────────────────────────────────────

  const startIphoneAuth = useCallback(async () => {
    if (!activePairingId) return;
    clearTimers();
    setIphoneStep('loading');
    setError(null);

    try {
      const res = await api.iphoneAuth.authChallengeStart(activePairingId);
      setIphoneQr(res.qrData);
      setIphoneStep('scanning');
      setCountdown(60);

      // Polling toutes les secondes
      pollRef.current = setInterval(async () => {
        try {
          const poll = await api.iphoneAuth.authPoll();
          if (poll.status === 'authenticated') {
            clearTimers();
            setIphoneStep('done');
            const ok = await confirmAuth();
            if (ok) navigate('/', { replace: true });
          } else if (poll.status === 'failed') {
            clearTimers();
            setError(poll.error ?? 'Authentification échouée');
            setIphoneStep('failed');
          }
        } catch (e) {
          clearTimers();
          setError(e instanceof Error ? e.message : String(e));
          setIphoneStep('failed');
        }
      }, 1000);

      // Compte à rebours
      timerRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearTimers();
            setIphoneStep('failed');
            setError('Délai expiré (60 s). Réessayez.');
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setIphoneStep('failed');
    }
  }, [activePairingId, clearTimers, confirmAuth, navigate]);

  const resetIphone = useCallback(async () => {
    clearTimers();
    await api.iphoneAuth.cancelPending().catch(() => {});
    setIphoneStep('idle');
    setIphoneQr('');
    setError(null);
  }, [clearTimers]);

  // ── Auth Passkey ───────────────────────────────────────────────────────────

  const handlePasskeyLogin = async () => {
    setError(null);
    setPasskeyLoading(true);
    try {
      const { authId, publicKey } = await api.passkey.authStart();
      const PKC = PublicKeyCredential as unknown as PKCStatic;
      const opts = PKC.parseRequestOptionsFromJSON(publicKey);
      const cred = await navigator.credentials.get(opts) as PKCWithJSON;
      await api.passkey.authFinish({ authId, response: cred.toJSON() });
      const ok = await confirmAuth();
      if (ok) navigate('/', { replace: true });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handlePasskeyRegister = async () => {
    setError(null);
    setPasskeyLoading(true);
    try {
      const { regId, publicKey } = await api.passkey.registerStart();
      const PKC = PublicKeyCredential as unknown as PKCStatic;
      const opts = PKC.parseCreationOptionsFromJSON(publicKey);
      const cred = await navigator.credentials.create(opts) as PKCWithJSON;
      await api.passkey.registerFinish({ regId, response: cred.toJSON() });
      setHasPasskey(true);
      await handlePasskeyLogin();
    } catch (e) {
      setError(friendlyError(e));
      setPasskeyLoading(false);
    }
  };

  const handleDevBypass = async () => {
    setError(null);
    setPasskeyLoading(true);
    try {
      await api.passkey.devAuthBypass();
      const ok = await confirmAuth();
      if (ok) navigate('/', { replace: true });
    } catch (e) {
      setError(friendlyError(e));
      setPasskeyLoading(false);
    }
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────

  if (hasPairedIphone === null) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-textSoft text-sm">Chargement…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-sm p-8 space-y-6">

        {/* En-tête */}
        <div className="text-center space-y-1">
          <div className="text-2xl font-bold text-text">PCR Manager</div>
          <div className="text-textSoft text-sm">
            {mode === 'iphone' ? 'Connexion via iPhone' : hasPasskey ? 'Connexion sécurisée' : 'Première connexion'}
          </div>
        </div>

        {/* ── Mode iPhone ── */}
        {mode === 'iphone' && (
          <div className="space-y-4">
            {iphoneStep === 'idle' && (
              <>
                <p className="text-sm text-textSoft text-center">
                  Utilisez votre iPhone pour vous authentifier
                  {pairedDevices.length === 1 && (
                    <> — <strong>{pairedDevices[0].iphoneDeviceName}</strong></>
                  )}
                </p>
                {pairedDevices.length > 1 && (
                  <select
                    value={activePairingId ?? ''}
                    onChange={e => setActivePairingId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface2 border border-border text-text text-sm"
                  >
                    {pairedDevices.map(d => (
                      <option key={d.pairingId} value={d.pairingId}>
                        {d.iphoneDeviceName}
                      </option>
                    ))}
                  </select>
                )}
                {error && <p className="text-danger text-sm text-center">{error}</p>}
                <button
                  onClick={startIphoneAuth}
                  className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
                >
                  <span>📱</span> Authentifier avec l'iPhone
                </button>
              </>
            )}

            {iphoneStep === 'loading' && (
              <div className="text-center py-4 text-textSoft text-sm animate-pulse">
                Génération du challenge…
              </div>
            )}

            {iphoneStep === 'scanning' && iphoneQr && (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-xl shadow-sm">
                    <QrCode data={iphoneQr} size={200} />
                  </div>
                </div>
                <p className="text-xs text-textSoft text-center">
                  Scannez ce code avec <strong>PCR Authenticator</strong>
                  <br />puis validez avec Face ID ou Touch ID
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-textSoft">
                  <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                  En attente de l'iPhone… {countdown}s
                </div>
                <button
                  onClick={resetIphone}
                  className="w-full py-2 text-xs text-textSoft hover:text-text transition-colors"
                >
                  Annuler
                </button>
              </div>
            )}

            {iphoneStep === 'failed' && (
              <div className="space-y-3">
                {error && (
                  <p className="text-danger text-sm text-center">{error}</p>
                )}
                <button
                  onClick={resetIphone}
                  className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 transition-colors"
                >
                  Réessayer
                </button>
              </div>
            )}

            {/* Lien vers la gestion des appairages */}
            <div className="border-t border-border pt-3 space-y-2">
              <button
                onClick={() => navigate('/pairing')}
                className="w-full py-2 text-xs text-textSoft hover:text-text transition-colors"
              >
                + Ajouter un autre iPhone
              </button>
              {hasPasskey && (
                <button
                  onClick={() => setMode('passkey')}
                  className="w-full py-2 text-xs text-textSoft hover:text-text transition-colors"
                >
                  Utiliser une passkey à la place
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Mode Passkey ── */}
        {mode === 'passkey' && (
          <div className="space-y-4">
            {hasPasskey ? (
              <>
                <p className="text-sm text-textSoft text-center">
                  Utilisez votre passkey pour accéder à l'application.
                </p>
                {error && <p className="text-danger text-sm text-center">{error}</p>}
                <button
                  onClick={handlePasskeyLogin}
                  disabled={passkeyLoading}
                  className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {passkeyLoading ? (
                    <span className="animate-pulse">Vérification…</span>
                  ) : (
                    <>🔑 Se connecter avec ma passkey</>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="bg-surface2 border border-border rounded-lg p-4 text-sm text-textSoft space-y-2">
                  <p className="font-semibold text-text">Créez votre passkey</p>
                  <p>Une passkey remplace les mots de passe. Elle est liée à votre appareil.</p>
                </div>
                {error && <p className="text-danger text-sm text-center">{error}</p>}
                <button
                  onClick={handlePasskeyRegister}
                  disabled={passkeyLoading}
                  className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {passkeyLoading ? (
                    <span className="animate-pulse">Création…</span>
                  ) : <>🔑 Créer ma passkey</>}
                </button>
              </>
            )}

            {hasPairedIphone && (
              <button
                onClick={() => setMode('iphone')}
                className="w-full py-2 text-xs text-textSoft hover:text-text transition-colors border-t border-border pt-3"
              >
                📱 Utiliser mon iPhone à la place
              </button>
            )}
            {!hasPairedIphone && (
              <button
                onClick={() => navigate('/pairing')}
                className="w-full py-2 text-xs text-textSoft hover:text-text transition-colors border-t border-border pt-3"
              >
                📱 Ajouter un iPhone comme authentificateur
              </button>
            )}
          </div>
        )}

        {/* ── Bouton dev bypass ── */}
        {isDev && (
          <div className="pt-2 border-t border-border">
            <button
              onClick={handleDevBypass}
              disabled={passkeyLoading}
              className="w-full py-2 rounded-lg border border-yellow-500 text-yellow-500 text-xs font-medium hover:bg-yellow-500/10 disabled:opacity-50 transition-colors"
            >
              ⚠️ Connexion développeur (DEV uniquement)
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

function friendlyError(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError') return 'Opération annulée ou non autorisée.';
    if (e.name === 'AbortError') return 'Opération annulée.';
    if (e.name === 'NotSupportedError') {
      return 'Aucun authentificateur disponible. Connectez une clé de sécurité USB ou activez le Bluetooth.';
    }
  }
  if (
    e instanceof TypeError &&
    (e.message.includes('parseCreationOptionsFromJSON') ||
      e.message.includes('parseRequestOptionsFromJSON'))
  ) {
    return 'WebView2 trop ancienne. Mettez à jour via microsoft.com/edge/webview2.';
  }
  return e instanceof Error ? e.message : String(e);
}
