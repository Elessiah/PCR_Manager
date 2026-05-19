import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QrCodeProps {
  data: string;
  size?: number;
  className?: string;
}

export function QrCode({ data, size = 240, className }: QrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    QRCode.toCanvas(canvasRef.current, data, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).catch(console.error);
  }, [data, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      aria-label="QR code"
    />
  );
}
