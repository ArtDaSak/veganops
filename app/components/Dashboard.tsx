'use client';
import { TableroData } from '../../types';
import { BarChart3, CheckCircle2, Clock, CheckSquare } from 'lucide-react';

export default function Dashboard({ board }: { board: TableroData }) {
  const cards = board.tarjetas || [];
  
  // Métricas de pedidos
  const totalOrders = board.pedidos?.length || 0;
  const pendingOrders = board.pedidos?.filter(o => o.estado === 'Pendiente').length || 0;
  const deliveringOrders = board.pedidos?.filter(o => o.estado === 'Entregado').length || 0;

  // Items más populares
  const recipeCounts: Record<string, number> = {};
  board.pedidos?.forEach(o => {
    o.items.forEach(i => {
      recipeCounts[i.recetaId] = (recipeCounts[i.recetaId] || 0) + i.multiplicador;
    });
  });
  const topRecipes = Object.entries(recipeCounts)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, q]) => ({ name: board.recetas?.find(r => r.id === id)?.nombre || 'Receta Eliminada', q }));

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-8 border-b border-borderr pb-4">
        <BarChart3 className="text-primary" size={28} />
        <h2 className="text-2xl font-black text-text font-lg">Dashboard Analítico</h2>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-surface border-2 border-borderr p-6 rounded-2xl relative overflow-hidden shadow-sm hover:shadow-md transition">
          <div className="absolute -right-4 -top-4 opacity-10 text-primary"><CheckSquare size={100} /></div>
          <h3 className="text-text/70 text-xs font-bold uppercase tracking-wider mb-2">Total Tareas</h3>
          <p className="text-5xl font-black text-primary">{cards.length}</p>
        </div>
        
        <div className="bg-surface border-2 border-borderr p-6 rounded-2xl relative overflow-hidden shadow-sm hover:shadow-md transition">
          <div className="absolute -right-4 -top-4 text-orange-500 opacity-10"><Clock size={100} /></div>
          <h3 className="text-text/70 text-xs font-bold uppercase tracking-wider mb-2">Pedidos Pendientes</h3>
          <p className="text-5xl font-black text-orange-500">{pendingOrders}</p>
        </div>

        <div className="bg-surface border-2 border-borderr p-6 rounded-2xl relative overflow-hidden shadow-sm hover:shadow-md transition">
          <div className="absolute -right-4 -top-4 text-green-500 opacity-10"><CheckCircle2 size={100} /></div>
          <h3 className="text-text/70 text-xs font-bold uppercase tracking-wider mb-2">Pedidos Entregados</h3>
          <p className="text-5xl font-black text-green-600">{deliveringOrders}</p>
        </div>

        <div className="bg-surface border-2 border-borderr p-6 rounded-2xl relative overflow-hidden shadow-sm hover:shadow-md transition">
          <h3 className="text-text/70 text-xs font-bold uppercase tracking-wider mb-2">Tasa Completitud</h3>
          <p className="text-5xl font-black text-accent">
            {totalOrders === 0 ? '0%' : `${Math.round((deliveringOrders / totalOrders) * 100)}%`}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-surface border-2 border-borderr p-8 rounded-2xl shadow-sm">
          <h3 className="text-xl font-black mb-6 text-primary flex items-center gap-2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> Recetas Top en Pedidos</h3>
          {topRecipes.length === 0 ? (
           <p className="text-sm font-medium text-text/60 italic p-4 bg-background rounded-lg border border-borderr/50">No hay suficientes datos de pedidos registrados aún.</p> 
          ) : (
            <div className="space-y-4">
              {topRecipes.map((tr, i) => (
                <div key={i} className="flex items-center bg-background p-3 rounded-lg border border-borderr group hover:border-primary/30 transition">
                  <span className="w-8 text-text/40 font-black">{i+1}.</span>
                  <span className="flex-1 font-bold text-text">{tr.name}</span>
                  <span className="bg-accent text-white py-1 px-3 rounded-md font-bold text-sm shadow-sm">{tr.q} unid.</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="bg-surface border-2 border-borderr p-8 rounded-2xl shadow-sm">
          <h3 className="text-xl font-black mb-6 text-accent flex items-center gap-2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg> Distribución Tareas Kanban</h3>
          <div className="space-y-5">
            {board.columnas?.map(col => {
              const colCardsLine = cards.filter(t => t.columnaId === col.id).length;
              return (
              <div key={col.id}>
                <div className="flex justify-between text-sm mb-2 font-bold text-text/80 uppercase tracking-wide">
                  <span>{col.titulo}</span>
                  <span className="bg-background px-2 py-0.5 rounded border border-borderr">{colCardsLine}</span>
                </div>
                <div className="w-full bg-background border border-borderr/50 h-3 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-primary to-accent h-full rounded-full transition-all duration-500 ease-out" 
                    style={{ width: cards.length === 0 ? '0%' : `${(colCardsLine / cards.length) * 100}%` }} 
                  />
                </div>
              </div>
            )})}
            {board.columnas?.length === 0 && <p className="text-text/50 font-medium italic mt-4 text-center">Añade columnas al tablero.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
