'use client';
import { TableroData } from '../../types';
import { useState } from 'react';
import { Plus, Trash2, ChefHat, Scale } from 'lucide-react';
import Modal from './Modal';
import Swal from 'sweetalert2';

interface Props {
  board: TableroData;
  syncState: (newState: TableroData) => void;
  usuario: string;
  isReadonly?: boolean;
}

export default function RecipesList({ board, syncState, usuario, isReadonly }: Props) {
  const [scaling, setScaling] = useState<{ [recipeId: string]: number }>({});
  const [newRecipeName, setNewRecipeName] = useState('');
  
  const [modalIngAbierto, setModalIngAbierto] = useState<{recipeId: string} | null>(null);
  const [ingSeleccionado, setIngSeleccionado] = useState('');
  const [ingQty, setIngQty] = useState('100');

  const addRecipe = () => {
    if(!newRecipeName.trim()) return;
    const nueva = { 
      id: Date.now().toString(), 
      nombre: newRecipeName, 
      ingredientes: [], 
      pasos: [], 
      notas: '',
      creadoPor: usuario
    };
    syncState({ ...board, recetas: [...(board.recetas || []), nueva], version: board.version + 1 });
    setNewRecipeName('');
  };

  const confirmAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if(!modalIngAbierto || !ingSeleccionado || !ingQty) return;
    const recipeId = modalIngAbierto.recipeId;

    const nuevasRecetas = board.recetas.map(r => r.id === recipeId ? {
      ...r,
      ingredientes: [...(r.ingredientes || []), { insumoId: ingSeleccionado, cantidad: Number(ingQty) }]
    } : r);
    
    syncState({ ...board, recetas: nuevasRecetas, version: board.version + 1 });
    setModalIngAbierto(null);
    setIngSeleccionado('');
    setIngQty('100');
  };

  const deleteRecipe = async (id: string) => {
    const alert = await Swal.fire({ title: '¿Eliminar receta definitivamente?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Eliminar' });
    if(!alert.isConfirmed) return;
    syncState({ ...board, recetas: board.recetas.filter(r => r.id !== id), version: board.version + 1 });
  };

  const deleteIngredient = (recipeId: string, insumoId: string) => {
    const nuevas = board.recetas.map(r => r.id === recipeId ? {
      ...r,
      ingredientes: r.ingredientes.filter(i => i.insumoId !== insumoId)
    } : r);
    syncState({ ...board, recetas: nuevas, version: board.version + 1 });
  };

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-surface/50 p-6 rounded-2xl border border-borderr shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-primary flex items-center gap-3">
            <ChefHat size={32} /> Central de Recetas
          </h2>
          <p className="text-text/60 font-medium mt-1">Crea, modifica y escala porciones automáticamente.</p>
        </div>
        {!isReadonly && (
          <div className="flex gap-2 w-full md:w-auto">
            <input 
              type="text"
              placeholder="Ej. Tofu Marinado..."
              value={newRecipeName}
              onChange={e => setNewRecipeName(e.target.value)}
              className="flex-1 md:w-64 px-4 py-2 border-2 border-borderr bg-background rounded-lg font-bold text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            />
            <button onClick={addRecipe} disabled={!newRecipeName.trim()} className="bg-primary text-white font-bold px-5 py-2 rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50 transition active:scale-95">Crear</button>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {board.recetas?.map(recipe => {
          const mult = scaling[recipe.id] || 1;
          
          return (
            <div key={recipe.id} className="bg-surface border-2 border-borderr rounded-2xl p-6 flex flex-col shadow-sm hover:shadow-md transition group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 mr-4">
                  <h3 className="font-black text-xl text-text border-b-2 border-accent/20 pb-2 break-words leading-tight">{recipe.nombre}</h3>
                  {recipe.creadoPor && <span className="text-[10px] text-text/40 font-bold uppercase mt-1 block">Creado por: {recipe.creadoPor}</span>}
                </div>
                {!isReadonly && (
                  <button onClick={() => deleteRecipe(recipe.id)} className="text-text/30 hover:text-red-500 hover:bg-red-50 p-2 rounded-md transition opacity-0 group-hover:opacity-100 focus:opacity-100">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              <div className="mb-5 bg-background border border-borderr/60 p-3 rounded-xl flex items-center gap-3 shadow-inner">
                <Scale size={18} className="text-accent" />
                <span className="text-sm font-bold text-text/80 uppercase tracking-wide">Multiplicador:</span>
                <input 
                  type="number" 
                  min="1" step="1" 
                  value={mult}
                  onChange={e => setScaling({ ...scaling, [recipe.id]: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                  className="w-20 px-2 py-1 bg-surface border-2 border-borderr focus:border-accent rounded-lg font-black text-center ml-auto outline-none transition"
                />
                <span className="text-sm font-black text-accent w-4 text-center">x</span>
              </div>

              <div className="flex-1 min-h-[150px] flex flex-col">
                <h4 className="text-xs font-bold text-text/50 mb-3 uppercase tracking-widest flex items-center gap-2 pt-1 border-t border-borderr/30">
                  Lista de Insumos
                </h4>
                {(!recipe.ingredientes || recipe.ingredientes.length === 0) ? (
                  <p className="text-sm font-medium text-text/40 italic flex-1 flex items-center justify-center border-2 border-dashed border-borderr/50 rounded-lg">Agrega ingredientes a la receta.</p>
                ) : (
                  <ul className="space-y-2 mb-4 flex-1">
                    {recipe.ingredientes.map((ing) => {
                      const refInsumo = board.insumos?.find(x => x.id === ing.insumoId);
                      return (
                        <li key={ing.insumoId} className="flex justify-between items-center text-sm p-2 bg-background border border-borderr/50 rounded-lg group/ing hover:border-primary/30 transition">
                          <span className="font-bold text-text flex-1 truncate">{refInsumo?.nombre || 'Insumo Borrado'}</span>
                          <div className="flex gap-3 items-center ml-2">
                            <span className="font-black text-primary bg-primary/10 px-2 py-0.5 rounded text-right min-w-[60px]">
                              {(ing.cantidad * mult).toFixed(1).replace(/\.0$/, '')} {refInsumo?.unidad || ''}
                            </span>
                            <button onClick={() => deleteIngredient(recipe.id, ing.insumoId)} className="opacity-0 group-hover/ing:opacity-100 text-text/40 hover:text-red-500 font-bold w-5 h-5 flex items-center justify-center rounded transition">✕</button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                
                <button onClick={() => setModalIngAbierto({recipeId: recipe.id})} className="w-full mt-2 py-2 border-2 border-dashed border-primary/30 text-primary font-bold rounded-lg hover:border-primary hover:bg-primary/5 transition flex items-center justify-center gap-2">
                  <Plus size={16} strokeWidth={3} /> Añadir Ingrediente
                </button>
              </div>
            </div>
          );
        })}
        {(!board.recetas || board.recetas.length === 0) && (
          <div className="col-span-full py-16 bg-surface border-2 border-dashed border-borderr rounded-2xl flex flex-col items-center justify-center text-text/40">
            <ChefHat size={48} className="mb-4 opacity-50" />
            <h3 className="text-xl font-bold">Sin recetas por ahora</h3>
            <p className="font-medium">Agrega tu primera receta en el campo superior.</p>
          </div>
        )}
      </div>

      <Modal isOpen={!!modalIngAbierto} onClose={() => setModalIngAbierto(null)} title="Nuevo Ingrediente">
        <form onSubmit={confirmAddIngredient} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-text/60 mb-1 uppercase tracking-wider">Insumo Base</label>
            <select value={ingSeleccionado} onChange={e=>setIngSeleccionado(e.target.value)} className="w-full p-3 border-2 border-borderr bg-background rounded-lg font-bold outline-none focus:border-primary">
              <option value="">-- Seleccionar Insumo --</option>
              {board.insumos?.map(ins => (
                <option key={ins.id} value={ins.id}>{ins.nombre} ({ins.unidad})</option>
              ))}
            </select>
            {(!board.insumos || board.insumos.length === 0) && <p className="text-red-500 text-xs mt-1 font-bold">⚠️ Debes crear Insumos primero en la pestaña "Ingredientes".</p>}
          </div>
          <div>
            <label className="block text-xs font-bold text-text/60 mb-1 uppercase tracking-wider">Cantidad para la Receta (Escala x1)</label>
            <input type="number" step="0.1" value={ingQty} onChange={e=>setIngQty(e.target.value)} className="w-full p-3 border-2 border-borderr bg-background rounded-lg font-bold outline-none focus:border-primary text-center" />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModalIngAbierto(null)} className="font-bold px-4 py-2 hover:bg-border/50 rounded-lg text-text/60">Cancelar</button>
            <button type="submit" disabled={!ingSeleccionado || !ingQty} className="font-bold px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50 shadow-md">Añadir a Receta</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
