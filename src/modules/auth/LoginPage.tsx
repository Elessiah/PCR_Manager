import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { QrCode } from '../../components/ui/QrCode';

type IphoneAuthStep = 'idle' | 'loading' | 'scanning' | 'done' | 'failed';

export default function LoginPage() {
  const navigate = useNavigate();
  const { confirmAuth } = useAuth();

  const [hasPairedIphone, setHasPairedIphone] = useState<boolean | null>(null);
  const [networkOk, setNetworkOk]             = useState<boolean | null>(null);
  const [pairedDevices, setPairedDevices]     = useState<Array<{ pairingId: string; iphoneDeviceName: string }>>([]);
  const [activePairingId, setActivePairingId] = useState<string | null>(null);

  const [iphoneStep, setIphoneStep] = useState<IphoneAuthStep>('idle');
  const [iphoneQr, setIphoneQr]     = useState<string>('');
  const [countdown, setCountdown]   = useState(60);
  const [error, setError]           = useState<string | null>(null);

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (pollRef.current)  clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    pollRef.current = null;
    timerRef.current = null;
  }, []);

  useEffect(() => {
    const detect = async () => {
      const [iphone, net] = await Promise.all([
        api.iphoneAuth.hasPairedDevice().catch(() => false),
        api.iphoneAuth.networkAvailable().catch(() => false),
      ]);
      setHasPairedIphone(iphone);
      setNetworkOk(net);
      if (iphone) {
        const devices = await api.iphoneAuth.pairingList().catch(() => []);
        setPairedDevices(devices.map(d => ({ pairingId: d.pairingId, iphoneDeviceName: d.iphoneDeviceName })));
        if (devices.length > 0) setActivePairingId(devices[0].pairingId);
      }
    };
    detect();
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

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

  if (hasPairedIphone === null || networkOk === null) {
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
            {hasPairedIphone ? 'Connexion via iPhone' : 'Aucun iPhone configuré'}
          </div>
        </div>

        {/* iPhone appairé */}
        {hasPairedIphone && (
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
                    disabled={!networkOk}
                    className="w-full px-3 py-2 rounded-lg bg-surface2 border border-border text-text text-sm disabled:opacity-50"
                  >
                    {pairedDevices.map(d => (
                      <option key={d.pairingId} value={d.pairingId}>
                        {d.iphoneDeviceName}
                      </option>
                    ))}
                  </select>
                )}
                {!networkOk && (
                  <div className="bg-warning/10 border border-warning/30 rounded-lg px-3 py-2 text-xs text-warning text-center">
                    Aucun réseau local détecté. Connectez-vous au même Wi-Fi que votre iPhone.
                  </div>
                )}
                {error && <p className="text-danger text-sm text-center">{error}</p>}
                <button
                  onClick={startIphoneAuth}
                  disabled={!networkOk}
                  className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
                {error && <p className="text-danger text-sm text-center">{error}</p>}
                <button
                  onClick={resetIphone}
                  className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 transition-colors"
                >
                  Réessayer
                </button>
              </div>
            )}

            <div className="border-t border-border pt-3">
              <button
                onClick={() => navigate('/pairing')}
                className="w-full py-2 text-xs text-textSoft hover:text-text transition-colors"
              >
                + Ajouter un autre iPhone
              </button>
            </div>
          </div>
        )}

        {/* Aucun iPhone — invitation à apparier */}
        {!hasPairedIphone && (
          <div className="space-y-4">
            <div className="bg-surface2 border border-border rounded-lg p-4 text-sm text-textSoft space-y-2">
              <p className="font-semibold text-text">Appairage requis</p>
              <p>Associez votre iPhone pour vous connecter sans mot de passe, grâce à Face ID ou Touch ID.</p>
            </div>
            <button
              onClick={() => navigate('/pairing')}
              className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 transition-colors"
            >
              Configurer mon iPhone
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
