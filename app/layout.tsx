import "./globals.css";
import Providers from "./Providers";
import { Toaster } from 'react-hot-toast';
import { Inter, Outfit } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });

export const metadata = { title: "VeganOps - Operations Board" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-tema="corcho-vegano">
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased text-base selection:bg-primary/30`}>
        <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: 'hsl(var(--color-surface))', color: 'hsl(var(--color-text))', border: '1px solid hsl(var(--color-border))' } }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
