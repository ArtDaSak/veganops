'use client';
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

export default function GlobalHub() {
  const { data: session, status } = useSession();
  const [config, setConfig] = useState<any>(null);
  const [temaActual, setTemaActual] = useState('corcho-vegano');

  useEffect(() => {
    const temaGuardado = localStorage.getItem('veganops_tema');
    if (temaGuardado) {
      setTemaActual(temaGuardado);
      document.documentElement.setAttribute('data-tema', temaGuardado);
    }
    
    if (session) {
      cargarPerfilConfig();
      // Timeout defensivo: Si pasados 6s Google Drive sigue atascado o hay error de red oculto, liberamos la interfaz del Loader.
      const tid = setTimeout(() => { setConfig((prev: any) => prev || { usuarios: [], franquicias: [], error: true }); }, 6000);
      return () => clearTimeout(tid);
    }
  }, [session]);

  const cargarPerfilConfig = async () => {
    try {
      const res = await fetch('/api/admin');
      if (res.ok) {
        const cfg = await res.json();
        setConfig(cfg);
      } else {
        if (res.status === 401 || res.status === 403) {
           signOut();
        } else {
           setConfig({ usuarios: [], franquicias: [], error: true });
        }
      }
    } catch(e) { 
      console.error(e);
      setConfig({ usuarios: [], franquicias: [], error: true });
    }
  };

  const alternarTema = () => {
    const nuevo = temaActual === 'corcho-vegano' ? 'noche-purpura' : 'corcho-vegano';
    setTemaActual(nuevo);
    localStorage.setItem('veganops_tema', nuevo);
    document.documentElement.setAttribute('data-tema', nuevo);
  };

  // Si estamos cargando la API de red, o la sesión existe pero la configuración aún no ha intentado resolverse
  if (status === "loading" || (session && config === null)) return (
    <div className="min-h-screen flex flex-col items-center justify-center font-bold text-primary">
       <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
       Iniciando Hub Global...
    </div>
  );
  if (!session) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface p-8 rounded-lg shadow-2xl text-center max-w-sm border border-borderr">
        <div className="flex justify-center mb-6">
          {config?.logoBase64 ? (
            <img src={config.logoBase64} alt="VeganOps Custom Logo" className="w-[90px] h-[90px] object-contain drop-shadow-xl" />
          ) : (
            <Image src="/logo.png" alt="VeganOps Logo" width={90} height={90} className="drop-shadow-xl" />
          )}
        </div>
        <h1 className="text-4xl font-black text-primary mb-2 drop-shadow-md">VeganOps</h1>
        <p className="mb-8 text-text/80 font-medium">Tu ecosistema organizativo plant-based.</p>
        <button onClick={() => signIn('google')} className="w-full bg-primary text-white font-bold px-6 py-4 rounded-xl shadow-lg shadow-primary/20 hover:bg-opacity-90 transition-all hover:scale-105 active:scale-95 flex justify-center items-center gap-3">
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
          Entrar con Google
        </button>
      </div>
    </div>
  );

  const miPerfil = config?.usuarios?.find((u: any) => u.email === session?.user?.email);
  const isSuperAdmin = miPerfil?.esAdminGlobal === true;
  const isDirectorLocal = miPerfil?.accesos?.some((acc: any) => acc.rol === 'Director');

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto min-h-screen flex flex-col relative w-full">
      <div className="w-full flex justify-end items-center gap-3 md:gap-4 mb-4 md:mb-8 pt-2">
        <button 
          onClick={alternarTema} 
          title="Cambiar textura y tema"
          className="p-2 md:p-3 border border-borderr rounded-full bg-surface text-text shadow-sm hover:scale-105 transition-transform"
        >
          {temaActual === 'corcho-vegano' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-6 md:h-6"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-6 md:h-6"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          )}
        </button>
        
        <div className="flex items-center gap-2 bg-surface border border-borderr pl-3 pr-1 py-1 md:py-2 rounded-full shadow cursor-default flex-1 justify-end md:flex-none">
          <span className="font-bold text-xs md:text-sm text-text max-w-[120px] truncate">{session.user?.name}</span>
          <button onClick={() => signOut()} className="text-[10px] md:text-xs bg-red-100 text-red-600 font-bold px-3 py-1.5 rounded-full hover:bg-red-500 hover:text-white transition-colors">
            Cerrar
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full pb-10">
        <div className="text-center mb-8 md:mb-12 transform transition-all duration-500">
          {config?.logoBase64 ? (
            <img src={config.logoBase64} alt="VeganOps Custom Logo" className="w-[100px] h-[100px] object-contain mx-auto drop-shadow-2xl mb-6 shadow-black/20" />
          ) : (
            <Image src="/logo.png" alt="VeganOps Logo" width={100} height={100} className="mx-auto drop-shadow-2xl mb-6 shadow-black/20" />
          )}
        <h1 className="text-5xl md:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-br from-primary to-accent drop-shadow-sm mb-4">Central VeganOps</h1>
        <p className="text-xl text-text/70 font-medium max-w-xl mx-auto">
          ¿A dónde deseas dirigirte hoy? Selecciona tu portal de acceso.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
        {/* Acceso a Operaciones (Para Todos) */}
        <Link href="/operaciones" className="group flex flex-col items-center bg-surface/90 dark:bg-surface/30 backdrop-blur-md dark:backdrop-blur-2xl border-2 border-borderr/50 dark:border-primary/20 p-6 md:p-10 rounded-[2rem] shadow-xl shadow-primary/5 dark:shadow-primary/20 hover:shadow-2xl hover:border-primary dark:hover:border-primary dark:hover:shadow-primary/40 transition-all hover:-translate-y-2 text-center">
           <div className="bg-primary/10 dark:bg-primary/20 p-5 rounded-2xl mb-6 group-hover:bg-primary group-hover:text-white group-hover:scale-110 text-primary transition-all duration-300 shadow-inner">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
           </div>
           <h2 className="text-2xl font-black text-text mb-2 tracking-tight">Mis Sucursales</h2>
           <p className="text-text/70 font-medium text-sm">Ingreso a los tableros Kanban operacionales y toma de pedidos rotativos.</p>
        </Link>

        {/* Acceso Global/Delegado */}
        {isSuperAdmin ? (
          <Link href="/admin" className="group flex flex-col items-center bg-surface/90 dark:bg-surface/30 backdrop-blur-md dark:backdrop-blur-2xl border-2 border-borderr/50 dark:border-accent/20 p-6 md:p-10 rounded-[2rem] shadow-xl shadow-accent/5 dark:shadow-accent/20 hover:shadow-2xl hover:border-accent dark:hover:border-accent dark:hover:shadow-accent/40 transition-all hover:-translate-y-2 text-center">
             <div className="bg-accent/10 dark:bg-accent/20 p-5 rounded-2xl mb-6 group-hover:bg-accent group-hover:text-white group-hover:scale-110 text-accent transition-all duration-300 shadow-inner">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
             </div>
             <h2 className="text-2xl font-black text-text mb-2 tracking-tight">Administración Global</h2>
             <p className="text-text/70 font-medium text-sm">Gestiona usuarios, sucursales y la auto-generación mensual masiva.</p>
          </Link>
        ) : isDirectorLocal ? (
          <Link href="/admin" className="group flex flex-col items-center bg-surface/90 dark:bg-surface/30 backdrop-blur-md dark:backdrop-blur-2xl border-2 border-borderr/50 dark:border-accent/20 p-6 md:p-10 rounded-[2rem] shadow-xl shadow-accent/5 dark:shadow-accent/20 hover:shadow-2xl hover:border-accent dark:hover:border-accent dark:hover:shadow-accent/40 transition-all hover:-translate-y-2 text-center">
             <div className="bg-accent/10 dark:bg-accent/20 p-5 rounded-2xl mb-6 group-hover:bg-accent group-hover:text-white group-hover:scale-110 text-accent transition-all duration-300 shadow-inner">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
             </div>
             <h2 className="text-2xl font-black text-text mb-2 tracking-tight">Administración de Tienda</h2>
             <p className="text-text/70 font-medium text-sm">Gestiona el personal y los roles de las sucursales que diriges.</p>
          </Link>
        ) : (
          <div className="flex flex-col items-center justify-center bg-surface/50 dark:bg-surface/10 border-2 border-dashed border-borderr/50 dark:border-borderr/20 p-6 md:p-10 rounded-[2rem] text-center opacity-60 grayscale select-none mt-0 backdrop-blur-sm">
             <div className="bg-text/10 p-5 rounded-2xl mb-6 text-text/50">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
             </div>
             <h2 className="text-2xl font-black text-text/50 mb-2 tracking-tight">Acceso Operativo</h2>
             <p className="text-text/40 font-medium text-sm">Eres un trabajador o coordinador. No posees derechos de directiva en esta plataforma.</p>
          </div>
        )}
      </div></div>
    </div>
  );
}
