import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.auth.isRegistered().then(setIsRegistered);
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pin.length < 4) { setError('Le PIN doit contenir au moins 4 caractères.'); return; }
    if (pin !== confirm) { setError('Les deux PIN ne correspondent pas.'); return; }
    setLoading(true);
    try {
      await api.auth.register(pin);
      const ok = await login(pin);
      if (ok) navigate('/', { replace: true });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const ok = await login(pin);
      if (ok) {
        navigate('/', { replace: true });
      } else {
        setError('PIN incorrect.');
        setPin('');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  if (isRegistered === null) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-textSoft text-sm">Chargement…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-sm p-8 space-y-6">
        {/* Logo / titre */}
        <div className="text-center space-y-1">
          <div className="text-2xl font-bold text-text">PCR Manager</div>
          <div className="text-textSoft text-sm">
            {isRegistered ? 'Connexion' : 'Première connexion — créez votre PIN'}
          </div>
        </div>

        <form onSubmit={isRegistered ? handleLogin : handleRegister} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-textSoft" htmlFor="pin">
              PIN
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={e => setPin(e.target.value)}
              autoFocus
              required
              minLength={4}
              placeholder="••••"
              className="w-full px-3 py-2 rounded border border-border bg-surface2 text-text text-center text-xl tracking-[0.4em] focus:outline-none focus:border-accent"
            />
          </div>

          {!isRegistered && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-textSoft" htmlFor="confirm">
                Confirmer le PIN
              </label>
              <input
                id="confirm"
                type="password"
                inputMode="numeric"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                minLength={4}
                placeholder="••••"
                className="w-full px-3 py-2 rounded border border-border bg-surface2 text-text text-center text-xl tracking-[0.4em] focus:outline-none focus:border-accent"
              />
            </div>
          )}

          {error && (
            <p className="text-danger text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full py-2.5 rounded bg-accent text-white font-semibold text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Vérification…' : isRegistered ? 'Se connecter' : 'Créer le PIN et accéder'}
          </button>
        </form>
      </div>
    </div>
  );
}
