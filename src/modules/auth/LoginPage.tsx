import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

// ─── Types pour les API WebAuthn JSON (Safari 17.4+ / Chrome 128+) ───────────
// PublicKeyCredential.parseCreationOptionsFromJSON et .parseRequestOptionsFromJSON
// et PublicKeyCredential.prototype.toJSON sont des API récentes non encore dans
// @types/web. On les déclare ici localement.
// parseCreationOptionsFromJSON / parseRequestOptionsFromJSON prennent directement
// le JSON des options (PublicKeyCredentialCreationOptionsJSON), avec "challenge" à
// la racine — PAS wrappé dans { publicKey }. La fonction retourne elle-même
// CredentialCreationOptions / CredentialRequestOptions (avec le wrapper publicKey).
type ParseCreationFn = (opts: Record<string, unknown>) => CredentialCreationOptions;
type ParseRequestFn  = (opts: Record<string, unknown>) => CredentialRequestOptions;
type PKCStatic = typeof PublicKeyCredential & {
  parseCreationOptionsFromJSON: ParseCreationFn;
  parseRequestOptionsFromJSON:  ParseRequestFn;
};
type PKCWithJSON = PublicKeyCredential & { toJSON: () => Record<string, unknown> };
// ─────────────────────────────────────────────────────────────────────────────

const isDev = import.meta.env.DEV;

async function checkPasskeySupport(): Promise<{ platform: boolean; conditional: boolean }> {
  if (typeof PublicKeyCredential === 'undefined') return { platform: false, conditional: false };
  const platform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
  const conditional = typeof (PublicKeyCredential as { isConditionalMediationAvailable?: () => Promise<boolean> })
    .isConditionalMediationAvailable === 'function'
    ? await (PublicKeyCredential as { isConditionalMediationAvailable: () => Promise<boolean> })
        .isConditionalMediationAvailable().catch(() => false)
    : false;
  return { platform, conditional };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { confirmAuth } = useAuth();

  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [loading, setLoading]               = useState(false);
  const [platformAuth, setPlatformAuth]     = useState<boolean | null>(null);
  const [btStatus, setBtStatus]             = useState<{ available: boolean; enabled: boolean } | null>(null);

  useEffect(() => {
    api.passkey.hasCredentials()
      .then(setHasCredentials)
      .catch(() => setHasCredentials(false));
    checkPasskeySupport().then(({ platform }) => setPlatformAuth(platform));
  }, []);

  // Vérification Bluetooth uniquement quand Windows Hello est absent
  useEffect(() => {
    if (platformAuth !== false) return;
    const checkBt = () =>
      api.bluetooth.check()
        .then(setBtStatus)
        .catch(() => setBtStatus({ available: false, enabled: false }));
    checkBt();
    // Re-vérifie automatiquement quand l'utilisateur revient dans l'app
    // (ex : après avoir ouvert les paramètres Bluetooth)
    const onVisibility = () => { if (!document.hidden) checkBt(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [platformAuth]);

  // ── Enregistrement d'une nouvelle passkey (premier lancement) ──────────────
  const handleRegister = async () => {
    setError(null);
    setLoading(true);
    try {
      const { regId, publicKey } = await api.passkey.registerStart();

      const PKC = PublicKeyCredential as unknown as PKCStatic;
      const creationOpts = PKC.parseCreationOptionsFromJSON(publicKey);
      const credential   = await navigator.credentials.create(creationOpts) as PKCWithJSON;

      await api.passkey.registerFinish({ regId, response: credential.toJSON() });

      setHasCredentials(true);
      // Authentification immédiate après création de la passkey
      await performLogin();
    } catch (e) {
      setError(friendlyError(e));
      setLoading(false);
    }
  };

  // ── Authentification avec une passkey existante ────────────────────────────
  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await performLogin();
    } catch (e) {
      setError(friendlyError(e));
      setLoading(false);
    }
  };

  // ── Bypass dev (debug only) ────────────────────────────────────────────────
  const handleDevBypass = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.passkey.devAuthBypass();
      const ok = await confirmAuth();
      if (ok) navigate('/', { replace: true });
    } catch (e) {
      setError(friendlyError(e));
      setLoading(false);
    }
  };

  const performLogin = async () => {
    const { authId, publicKey } = await api.passkey.authStart();

    const PKC = PublicKeyCredential as unknown as PKCStatic;
    const requestOpts = PKC.parseRequestOptionsFromJSON(publicKey);
    const credential  = await navigator.credentials.get(requestOpts) as PKCWithJSON;

    await api.passkey.authFinish({ authId, response: credential.toJSON() });

    const ok = await confirmAuth();
    if (ok) navigate('/', { replace: true });
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (hasCredentials === null) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-textSoft text-sm">Chargement…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-sm p-8 space-y-6">

        {/* En-tête */}
        <div className="text-center space-y-1">
          <div className="text-2xl font-bold text-text">PCR Manager</div>
          <div className="text-textSoft text-sm">
            {hasCredentials ? 'Connexion sécurisée' : 'Première connexion'}
          </div>
        </div>

        {hasCredentials ? (
          /* ── Connexion ── */
          <div className="space-y-4">
            <p className="text-sm text-textSoft text-center">
              Utilisez votre passkey pour accéder à l'application.
            </p>
            <BluetoothHint platformAuth={platformAuth} btStatus={btStatus} />
            {error && <p className="text-danger text-sm text-center">{error}</p>}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="animate-pulse">Vérification…</span>
              ) : (
                <>🔑 Se connecter avec ma passkey</>
              )}
            </button>
          </div>
        ) : (
          /* ── Création passkey (premier lancement) ── */
          <div className="space-y-4">
            <div className="bg-surface2 border border-border rounded-lg p-4 text-sm text-textSoft space-y-2">
              <p className="font-semibold text-text">Créez votre passkey</p>
              <p>Une passkey remplace les mots de passe. Elle est liée à votre appareil.</p>
            </div>
            <BluetoothHint platformAuth={platformAuth} btStatus={btStatus} />
            {error && <p className="text-danger text-sm text-center">{error}</p>}
            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="animate-pulse">Création…</span>
              ) : (
                <>🔑 Créer ma passkey</>
              )}
            </button>
          </div>
        )}

        {/* ── Bouton dev bypass ── */}
        {isDev && (
          <div className="pt-2 border-t border-border">
            <button
              onClick={handleDevBypass}
              disabled={loading}
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

// ── Indicateur Bluetooth contextuel ───────────────────────────────────────
interface BluetoothHintProps {
  platformAuth: boolean | null;
  btStatus: { available: boolean; enabled: boolean } | null;
}

function BluetoothHint({ platformAuth, btStatus }: BluetoothHintProps) {
  if (platformAuth !== false) return null;

  // Encore en train de vérifier
  if (btStatus === null) {
    return (
      <div className="bg-surface2 border border-border rounded-lg p-3 text-xs text-textSoft">
        Vérification du Bluetooth…
      </div>
    );
  }

  // Pas d'adaptateur Bluetooth sur ce PC
  if (!btStatus.available) {
    return (
      <div className="bg-surface2 border border-border rounded-lg p-3 text-xs text-textSoft space-y-1">
        <p className="font-semibold text-text">Windows Hello non disponible</p>
        <p>
          Votre PC n'a pas de module Bluetooth. Connectez une{' '}
          <strong>clé de sécurité USB</strong> (YubiKey…) pour créer votre passkey.
        </p>
      </div>
    );
  }

  // Bluetooth présent mais désactivé → demander activation
  if (!btStatus.enabled) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-textSoft space-y-2">
        <p className="font-semibold text-text">Activez le Bluetooth pour continuer</p>
        <p>
          Windows Hello n'est pas disponible sur cet appareil. Vous pouvez utiliser votre{' '}
          <strong>téléphone</strong> (Android ou iPhone) comme authentificateur via QR code —
          le Bluetooth doit être activé sur ce PC et sur votre téléphone.
        </p>
        <button
          onClick={() => api.bluetooth.openSettings()}
          className="mt-1 w-full py-1.5 rounded bg-amber-500 text-white font-medium hover:bg-amber-400 transition-colors"
        >
          Ouvrir les paramètres Bluetooth
        </button>
        <p className="text-center opacity-60">
          Cette fenêtre se met à jour automatiquement après activation.
        </p>
      </div>
    );
  }

  // Bluetooth activé, mais pas de Windows Hello → guider vers l'option téléphone
  return (
    <div className="bg-surface2 border border-border rounded-lg p-3 text-xs text-textSoft space-y-1">
      <p className="font-semibold text-text">Utilisez votre téléphone</p>
      <p>
        Dans la fenêtre qui s'ouvre, choisissez{' '}
        <em>« Utiliser un téléphone ou une tablette »</em> et scannez le QR code
        avec votre téléphone (Android ou iPhone).
      </p>
    </div>
  );
}

// ── Utilitaire : message d'erreur lisible ──────────────────────────────────
function friendlyError(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError') return 'Opération annulée ou non autorisée.';
    if (e.name === 'AbortError')      return 'Opération annulée.';
    if (e.name === 'NotSupportedError') {
      return (
        'Aucun authentificateur disponible sur ce PC. ' +
        'Activez le Bluetooth et choisissez « Utiliser un téléphone ou une tablette » ' +
        'dans la fenêtre Windows, ou connectez une clé de sécurité USB.'
      );
    }
  }
  if (e instanceof TypeError && (e.message.includes('parseCreationOptionsFromJSON') || e.message.includes('parseRequestOptionsFromJSON'))) {
    return 'La version de WebView2 installée est trop ancienne. Mettez à jour WebView2 via microsoft.com/edge/webview2.';
  }
  return e instanceof Error ? e.message : String(e);
}
