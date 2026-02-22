'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import Image from 'next/image';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface p-8 rounded-lg shadow-2xl text-center max-w-sm border border-borderr">
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="VeganOps Logo" width={90} height={90} className="drop-shadow-xl opacity-60 grayscale" />
        </div>
        <h2 className="text-3xl font-black text-red-500 mb-2 drop-shadow-sm">Algo salió mal</h2>
        <p className="mb-8 text-text/80 font-medium">Hemos encontrado un error de módulo al renderizar esta página ({error.message}).</p>
        <button
          onClick={() => reset()}
          className="w-full bg-primary text-white font-bold px-6 py-3 rounded-md shadow-lg hover:bg-opacity-90 transition-transform active:scale-95"
        >
          Intentar Recuperar Conexión
        </button>
      </div>
    </div>
  );
}
