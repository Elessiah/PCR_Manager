import React from 'react'

interface SplashScreenProps {
  fadingOut?: boolean
}

export default function SplashScreen({ fadingOut = false }: SplashScreenProps) {
  const styles = `
    @keyframes fadeInScale {
      from {
        opacity: 0;
        transform: scale(0.8);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    @keyframes pulseGlow {
      0%, 100% {
        filter: drop-shadow(0 0 0px rgba(59, 130, 246, 0.5));
      }
      50% {
        filter: drop-shadow(0 0 15px rgba(59, 130, 246, 0.7));
      }
    }
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @keyframes fillProgress {
      from {
        width: 0%;
      }
      to {
        width: 100%;
      }
    }
  `

  return (
    <>
      <style>{styles}</style>
      <div
        className={`fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center transition-opacity duration-300 ${
          fadingOut ? 'opacity-0' : 'opacity-100'
        }`}
        data-testid="splash-screen"
      >
        <img
          src="/logo.png"
          alt="PCR Manager Logo"
          className="h-32 w-32 object-contain mb-4 drop-shadow-2xl"
          style={{
            imageRendering: 'auto',
            animation: fadingOut ? 'none' : 'fadeInScale 0.4s ease-out, pulseGlow 2s infinite 0.4s',
          }}
          data-testid="splash-logo"
        />
        <h1
          className="text-2xl font-bold text-white"
          style={{
            animation: fadingOut ? 'none' : 'fadeIn 0.4s ease-out 0.2s both',
          }}
        >
          PCR Manager
        </h1>
        <p
          className="text-sm text-gray-400 mt-2"
          style={{
            animation: fadingOut ? 'none' : 'fadeIn 0.4s ease-out 0.4s both',
          }}
        >
          Chargement en cours…
        </p>

        {/* Progress bar at bottom */}
        <div
          className="fixed bottom-0 left-0 h-1 bg-blue-500"
          style={{
            animation: fadingOut ? 'none' : 'fillProgress 1s ease-out forwards',
          }}
        />
      </div>
    </>
  )
}
