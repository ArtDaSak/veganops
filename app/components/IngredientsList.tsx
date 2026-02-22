'use client';
import { TableroData, Insumo } from '../../types';
import { useState } from 'react';
import { Plus, Trash2, Database, Box } from 'lucide-react';
import Modal from './Modal';
import Swal from 'sweetalert2';

interface Props {
  board: TableroData;
  syncState: (newState: TableroData) => void;
  usuario: string;
  isReadonly?: boolean;
}

export default function IngredientsList({ board, syncState, usuario, isReadonly }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);
  
  // States of the form
  const [nombre, setNombre] = useState('');
  const [unidad, setUnidad] = useState('g');
  const [esCompuesto, setEsCompuesto] = useState(false);

  // States for sub-ingredients if esCompuesto = true
  const [subInsumosSel, setSubInsumosSel] = useState<{insumoId: string, cantidad: number}[]>([]);
  const [tempSubId, setTempSubId] = useState('');
  const [tempSubCant, setTempSubCant] = useState('100');

  const addIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if(!nombre.trim()) return;

    const nuevo: Insumo = {
      id: Date.now().toString(),
      nombre,
      unidad,
      esCompuesto,
      subInsumos: esCompuesto ? subInsumosSel : undefined,
      creadoPor: usuario
    };

    syncState({ ...board, insumos: [...(board.insumos || []), nuevo], version: board.version + 1 });
    
    setModalAbierto(false);
    setNombre('');
    setUnidad('g');
    setEsCompuesto(false);
    setSubInsumosSel([]);
  };

  const deleteIngredient = async (id: string) => {
    // Basic protection: if it's used in recipes or other ingredients we should ideally warn, but for now just confirm deletion
    const alert = await Swal.fire({ title: '¿Eliminar ingrediente?', text: 'Cuidado: Podría romper recetas que lo utilicen.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Eliminar' });
    if(!alert.isConfirmed) return;
    syncState({ ...board, insumos: board.insumos.filter(i => i.id !== id), version: board.version + 1 });
  };

  const addTempSub = () => {
    if(!tempSubId || !tempSubCant) return;
    setSubInsumosSel([...subInsumosSel, { insumoId: tempSubId, cantidad: Number(tempSubCant) }]);
    setTempSubId('');
  };

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-surface/50 p-6 rounded-2xl border border-borderr shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-emerald-600 flex items-center gap-3">
            <Database size={32} /> Insumos Universales
          </h2>
          <p className="text-text/60 font-medium mt-1">Base de datos de materia prima y sub-preparaciones (compuestos).</p>
        </div>
        {!isReadonly && (
          <button onClick={() => setModalAbierto(true)} className="bg-emerald-600 text-white px-5 py-3 rounded-xl hover:bg-emerald-700 flex items-center gap-2 font-bold shadow-md hover:scale-105 transition-all">
            <Plus size={20} strokeWidth={3} /> Añadir Insumo
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {(board.insumos || []).map(ins => (
          <div key={ins.id} className="bg-surface border-2 border-borderr p-5 rounded-2xl shadow-sm hover:border-emerald-500/50 transition group flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                {ins.esCompuesto ? <Box size={18} className="text-emerald-500" /> : <Database size={18} className="text-text/40" />}
                <h3 className="font-bold text-lg text-text leading-tight">{ins.nombre}</h3>
              </div>
              {!isReadonly && (
                <button onClick={() => deleteIngredient(ins.id)} className="text-text/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-red-50">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            
            <div className="mt-1 mb-3">
               <span className="bg-background border border-borderr px-2 py-0.5 rounded text-xs font-bold text-text/60">Medida en: {ins.unidad}</span>
            </div>

            {ins.esCompuesto && ins.subInsumos && ins.subInsumos.length > 0 && (
              <div className="bg-background/50 border border-borderr/50 rounded-lg p-3 mt-auto flex-1">
                <h4 className="text-[10px] font-bold text-text/40 uppercase tracking-widest mb-2 border-b border-borderr pb-1">Ingredientes Base:</h4>
                <ul className="text-xs space-y-1 font-medium text-text/70">
                  {ins.subInsumos.map((si, i) => {
                    const subRef = board.insumos.find(x => x.id === si.insumoId);
                    return <li key={i} className="flex justify-between"><span>{subRef?.nombre || 'Desconocido'}</span> <b>{si.cantidad} {subRef?.unidad||''}</b></li>
                  })}
                </ul>
              </div>
            )}
            
            {ins.creadoPor && <div className="text-[10px] text-text/30 font-bold uppercase mt-3 pt-3 border-t border-borderr/30">Por: {ins.creadoPor}</div>}
          </div>
        ))}
        {(!board.insumos || board.insumos.length === 0) && (
           <div className="col-span-full py-16 bg-surface border-2 border-dashed border-borderr rounded-2xl flex flex-col items-center justify-center text-text/40">
             <Database size={48} className="mb-4 opacity-30" />
             <h3 className="text-xl font-bold">Base de datos vacía</h3>
             <p className="font-medium">Crea los insumos base para poder asignarlos a recetas.</p>
           </div>
        )}
      </div>

      <Modal isOpen={modalAbierto} onClose={() => setModalAbierto(false)} title="Crear Insumo / Preparación">
        <form onSubmit={addIngredient} className="flex flex-col gap-5">
           <div>
            <label className="block text-xs font-bold text-text/60 mb-2 uppercase tracking-wide">Nombre del Insumo</label>
            <input type="text" value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Ej. Avena, Sal, o Hamburguesa Vegana" className="w-full p-3 border-2 border-borderr bg-background rounded-lg font-bold outline-none focus:border-emerald-500" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text/60 mb-2 uppercase tracking-wide">Unidad de Medida</label>
              <input type="text" value={unidad} onChange={e=>setUnidad(e.target.value)} placeholder="g, kg, L, un..." className="w-full p-3 border-2 border-borderr bg-background rounded-lg font-bold outline-none focus:border-emerald-500 text-center" />
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-3 cursor-pointer p-3 border-2 border-borderr rounded-lg hover:bg-background transition">
                <input type="checkbox" checked={esCompuesto} onChange={e=>setEsCompuesto(e.target.checked)} className="w-5 h-5 accent-emerald-600" />
                <span className="font-bold text-sm">Es Compuesto<br/><span className="text-[10px] text-text/50 font-medium">Contiene otros ingredientes</span></span>
              </label>
            </div>
          </div>

          {esCompuesto && (
            <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border-2 border-emerald-500/20 p-4 rounded-xl mt-2">
              <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-3 uppercase tracking-wide">Ingredientes que lo componen (Sub-receta)</h4>
              
              <ul className="space-y-2 mb-3">
                {subInsumosSel.map((sz, i) => {
                  const ri = board.insumos.find(x => x.id === sz.insumoId);
                  return (
                    <li key={i} className="flex justify-between items-center text-sm p-2 bg-background border border-borderr/50 rounded-lg">
                      <span className="font-bold">{ri?.nombre || '?'}</span>
                      <span className="text-emerald-600 font-black">{sz.cantidad} {ri?.unidad||''}</span>
                    </li>
                  );
                })}
              </ul>

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <select value={tempSubId} onChange={e=>setTempSubId(e.target.value)} className="w-full p-2 border-2 border-borderr bg-background rounded-lg text-sm font-bold">
                    <option value="">-- Insumo Base --</option>
                    {board.insumos?.filter(x => !subInsumosSel.find(y => y.insumoId === x.id)).map(x => (
                       <option key={x.id} value={x.id}>{x.nombre} ({x.unidad})</option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <input type="number" step="0.1" value={tempSubCant} onChange={e=>setTempSubCant(e.target.value)} placeholder="Cant" className="w-full p-2 border-2 border-borderr bg-background rounded-lg text-sm text-center font-bold" />
                </div>
                <button type="button" onClick={addTempSub} disabled={!tempSubId} className="bg-emerald-600 text-white p-2.5 rounded-lg disabled:opacity-50"><Plus size={16} strokeWidth={3}/></button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-2 border-t border-borderr pt-4">
            <button type="button" onClick={() => setModalAbierto(false)} className="font-bold px-5 py-2 hover:bg-border/50 rounded-lg text-text/60">Cancelar</button>
            <button type="submit" disabled={!nombre} className="font-bold px-5 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50 shadow-md">Guardar Insumo</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
