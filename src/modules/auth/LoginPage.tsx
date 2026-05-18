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

export default function LoginPage() {
  const navigate = useNavigate();
  const { confirmAuth } = useAuth();

  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [loading, setLoading]               = useState(false);

  useEffect(() => {
    api.passkey.hasCredentials()
      .then(setHasCredentials)
      .catch(() => setHasCredentials(false));
  }, []);

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
              Utilisez votre passkey pour accéder à l'application — Touch ID,
              Face ID ou votre téléphone via QR code.
            </p>
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
              <p>
                Une passkey remplace les mots de passe. Elle est stockée de façon sécurisée
                sur votre appareil et synchronisée avec votre iPhone via iCloud Keychain —
                vous pourrez vous connecter avec Face ID ou votre téléphone.
              </p>
            </div>
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

// ── Utilitaire : message d'erreur lisible ──────────────────────────────────
function friendlyError(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError') return 'Opération annulée ou non autorisée.';
    if (e.name === 'AbortError')      return 'Opération annulée.';
    if (e.name === 'NotSupportedError') return 'Les passkeys ne sont pas supportées dans ce contexte.';
  }
  return e instanceof Error ? e.message : String(e);
}
