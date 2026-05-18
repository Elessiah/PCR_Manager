import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutoLogout } from '../useAutoLogout';

// Capture du callback onFocusChanged pour pouvoir le déclencher manuellement.
let focusCallback: ((event: { payload: boolean }) => Promise<void>) | null = null;
const mockUnlisten = vi.fn();
const mockIsMinimized = vi.fn();

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onFocusChanged: vi.fn().mockImplementation((cb: (e: { payload: boolean }) => Promise<void>) => {
      focusCallback = cb;
      return Promise.resolve(mockUnlisten);
    }),
    isMinimized: mockIsMinimized,
  }),
}));

vi.mock('sonner', () => ({
  toast: { info: vi.fn() },
}));

describe('useAutoLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    focusCallback = null;
    mockIsMinimized.mockResolvedValue(false);
    mockUnlisten.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ne fait rien quand non authentifié', () => {
    const logout = vi.fn();
    renderHook(() => useAutoLogout(logout, false));
    vi.advanceTimersByTime(35 * 60 * 1000);
    expect(logout).not.toHaveBeenCalled();
  });

  it("n'enregistre pas d'écouteur Tauri quand non authentifié", async () => {
    const windowMod = await import('@tauri-apps/api/window');
    const onFocusChanged = (windowMod.getCurrentWindow() as ReturnType<typeof windowMod.getCurrentWindow>).onFocusChanged as ReturnType<typeof vi.fn>;
    onFocusChanged.mockClear();

    const logout = vi.fn();
    renderHook(() => useAutoLogout(logout, false));
    expect(onFocusChanged).not.toHaveBeenCalled();
  });

  it('détecte la veille PC via drift du timer et logout après 10 min accumulées', () => {
    const logout = vi.fn();
    const base = 1_000_000;
    let callCount = 0;

    vi.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      // Premier appel : initialisation de lastTickRef dans useEffect
      if (callCount <= 2) return base;
      // Premier tick : simule 11 min de veille (drift énorme)
      return base + 11 * 60 * 1000;
    });

    renderHook(() => useAutoLogout(logout, true));
    vi.advanceTimersByTime(1_000); // déclenche un tick

    expect(logout).toHaveBeenCalledOnce();
  });

  it('ne logout pas si la veille est inférieure à 10 min', () => {
    const logout = vi.fn();
    const base = 1_000_000;
    let callCount = 0;

    vi.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      if (callCount <= 2) return base;
      // 5 min de drift : pas encore atteint le seuil
      return base + 5 * 60 * 1000;
    });

    renderHook(() => useAutoLogout(logout, true));
    vi.advanceTimersByTime(1_000);

    expect(logout).not.toHaveBeenCalled();
  });

  it('logout après 30 min de minimize au moment du restore', async () => {
    const logout = vi.fn();
    mockIsMinimized.mockResolvedValue(true);

    renderHook(() => useAutoLogout(logout, true));

    // Attendre que onFocusChange soit enregistré
    await act(async () => { await Promise.resolve(); });

    // Simulate blur + minimize
    await act(async () => { await focusCallback!({ payload: false }); });

    // Avancer 31 minutes
    vi.advanceTimersByTime(31 * 60 * 1000);

    // Simulate focus restore
    await act(async () => { await focusCallback!({ payload: true }); });

    expect(logout).toHaveBeenCalledOnce();
  });

  it('ne logout pas si restore avant 30 min', async () => {
    const logout = vi.fn();
    mockIsMinimized.mockResolvedValue(true);

    renderHook(() => useAutoLogout(logout, true));
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await focusCallback!({ payload: false }); });

    vi.advanceTimersByTime(15 * 60 * 1000); // seulement 15 min

    await act(async () => { await focusCallback!({ payload: true }); });

    expect(logout).not.toHaveBeenCalled();
  });

  it('ne démarre pas le minuteur minimize si la fenêtre est juste dé-focalisée (pas minimisée)', async () => {
    const logout = vi.fn();
    mockIsMinimized.mockResolvedValue(false); // pas minimisé, juste blur

    renderHook(() => useAutoLogout(logout, true));
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await focusCallback!({ payload: false }); });

    vi.advanceTimersByTime(31 * 60 * 1000);

    await act(async () => { await focusCallback!({ payload: true }); });

    expect(logout).not.toHaveBeenCalled();
  });

  it('réinitialise les compteurs au restore', async () => {
    const logout = vi.fn();
    mockIsMinimized.mockResolvedValue(true);

    renderHook(() => useAutoLogout(logout, true));
    await act(async () => { await Promise.resolve(); });

    // Premier cycle : 10 min minimisé puis restore
    await act(async () => { await focusCallback!({ payload: false }); });
    vi.advanceTimersByTime(10 * 60 * 1000);
    await act(async () => { await focusCallback!({ payload: true }); });
    expect(logout).not.toHaveBeenCalled();

    // Deuxième cycle : encore 10 min → pas de cumul avec le premier
    await act(async () => { await focusCallback!({ payload: false }); });
    vi.advanceTimersByTime(10 * 60 * 1000);
    await act(async () => { await focusCallback!({ payload: true }); });
    expect(logout).not.toHaveBeenCalled();
  });

  it('nettoie le listener Tauri au démontage', async () => {
    const logout = vi.fn();
    const { unmount } = renderHook(() => useAutoLogout(logout, true));
    await act(async () => { await Promise.resolve(); });

    unmount();

    expect(mockUnlisten).toHaveBeenCalledOnce();
  });
});
