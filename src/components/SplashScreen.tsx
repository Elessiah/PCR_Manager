import React from 'react'

interface SplashScreenProps {
  fadingOut?: boolean
}

export default function SplashScreen({ fadingOut = false }: SplashScreenProps) {
  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center transition-opacity duration-300 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
      data-testid="splash-screen"
    >
      <img
        src="/logo.png"
        alt="PCR Manager Logo"
        className="h-32 w-32 object-contain mb-4"
        data-testid="splash-logo"
      />
      <h1 className="text-2xl font-bold text-white">PCR Manager</h1>
    </div>
  )
}
