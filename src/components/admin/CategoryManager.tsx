import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X, Smile } from 'lucide-react';
import * as api from '../../utils/api';
import { toast } from 'sonner@2.0.3';

interface Category {
  id: string;
  label: string;
  color?: string;
  emoji?: string;
}

interface CategoryManagerProps {
  onChange?: () => void;
}

// Emojis organizados por grupo alimentar
const EMOJI_GROUPS = [
  {
    label: 'Lanches & Fast Food',
    emojis: ['🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥓', '🥐', '🫓']
  },
  {
    label: 'Pizzas & Massas',
    emojis: ['🍕', '🍝', '🧀', '🫕', '🥖', '🥨']
  },
  {
    label: 'Pratos & Refeicoes',
    emojis: ['🍖', '🍗', '🥩', '🥘', '🍛', '🍜', '🍲', '🫒', '🥗', '🥚', '🍳', '🥞']
  },
  {
    label: 'Sushi & Oriental',
    emojis: ['🍣', '🍱', '🥟', '🍤', '🍥', '🥠', '🥡', '🍙', '🍘', '🍚']
  },
  {
    label: 'Doces & Sobremesas',
    emojis: ['🍰', '🎂', '🧁', '🍩', '🍪', '🍫', '🍬', '🍭', '🍮', '🍦', '🍧', '🍨', '🥧', '🫘']
  },
  {
    label: 'Bebidas',
    emojis: ['🥤', '🧃', '🍺', '🍻', '🥂', '🍷', '☕', '🫖', '🧋', '🍹', '🍸', '🥛', '💧', '🧊']
  },
  {
    label: 'Frutas & Natural',
    emojis: ['🍎', '🍌', '🍇', '🍓', '🍊', '🍋', '🍉', '🥑', '🥕', '🌽', '🥦', '🍍', '🥭', '🫐']
  },
  {
    label: 'Outros',
    emojis: ['🛒', '📦', '🎁', '⭐', '🔥', '💎', '🏷️', '✨', '🎉', '❤️', '👑', '🏆']
  }
];

function EmojiPicker({ 
  currentEmoji, 
  onSelect, 
  onClose,
  triggerRef,
}: { 
  currentEmoji?: string; 
  onSelect: (emoji: string) => void; 
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const pickerWidth = 320;
      const pickerHeight = 400;
      let top = rect.bottom + 8;
      let left = rect.left;

      // If picker would overflow right edge, align to right of trigger
      if (left + pickerWidth > window.innerWidth - 16) {
        left = rect.right - pickerWidth;
      }
      // If still overflows left, clamp to 16px
      if (left < 16) left = 16;

      // If picker would overflow bottom, open upward
      if (top + pickerHeight > window.innerHeight - 16) {
        top = rect.top - pickerHeight - 8;
      }
      // If still overflows top, clamp
      if (top < 16) top = 16;

      setPosition({ top, left });
    }
  }, [triggerRef]);

  useEffect(() => {
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [updatePosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, triggerRef]);

  return createPortal(
    <div 
      ref={pickerRef}
      className="bg-white border-2 border-gray-200 rounded-xl shadow-2xl w-80 max-h-96 overflow-y-auto"
      style={{ 
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
        scrollbarWidth: 'thin',
      }}
    >
      <div className="sticky top-0 bg-white border-b px-3 py-2 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-700">Escolha um Emoji</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Botao para remover emoji */}
      <div className="px-3 pt-2">
        <button
          onClick={() => { onSelect(''); onClose(); }}
          className="text-xs text-red-500 hover:text-red-700 hover:underline"
        >
          Remover emoji
        </button>
      </div>

      {EMOJI_GROUPS.map((group) => (
        <div key={group.label} className="px-3 py-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            {group.label}
          </p>
          <div className="grid grid-cols-8 gap-1">
            {group.emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => { onSelect(emoji); onClose(); }}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-amber-100 hover:scale-125 transition-all ${
                  currentEmoji === emoji ? 'bg-amber-200 ring-2 ring-amber-500 scale-110' : ''
                }`}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
}

// Helper: mapear classes Tailwind para hex (para exibição no color picker nativo)
const classToHex: Record<string, string> = {
  'bg-amber-600 hover:bg-amber-700': '#d97706',
  'bg-red-600 hover:bg-red-700': '#dc2626',
  'bg-blue-600 hover:bg-blue-700': '#2563eb',
  'bg-green-600 hover:bg-green-700': '#16a34a',
  'bg-purple-600 hover:bg-purple-700': '#9333ea',
  'bg-pink-600 hover:bg-pink-700': '#db2777',
  'bg-gray-600 hover:bg-gray-700': '#4b5563',
  'bg-black hover:bg-gray-900': '#000000',
};

// Obter hex de qualquer formato de cor (classe ou hex)
function getHexFromColor(color?: string): string {
  if (!color) return '#d97706';
  if (color.startsWith('#')) return color;
  return classToHex[color] || '#d97706';
}

// Verificar se a cor é hex customizada
function isHexColor(color?: string): boolean {
  return !!color && color.startsWith('#');
}

function ColorPickerPopup({
  currentColor,
  onSelect,
  onClose,
  triggerRef,
  colors,
}: {
  currentColor?: string;
  onSelect: (color: string) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  colors: Array<{ label: string; class: string }>;
}) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  // Estado local para preview da cor enquanto o usuário arrasta (sem salvar a cada pixel)
  const [localHex, setLocalHex] = useState(getHexFromColor(currentColor));
  // Track se o usuário alterou a cor customizada (precisa salvar ao fechar)
  const [customColorChanged, setCustomColorChanged] = useState(false);
  const initialHexRef = useRef(getHexFromColor(currentColor));

  // Função que fecha o popup e salva cor customizada pendente (se houver)
  const handleClose = useCallback(() => {
    if (customColorChanged && localHex !== initialHexRef.current) {
      onSelect(localHex);
    }
    onClose();
  }, [localHex, customColorChanged, onSelect, onClose]);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popupWidth = 240;
      const popupHeight = 200;
      let top = rect.bottom + 8;
      let left = rect.left;

      if (left + popupWidth > window.innerWidth - 16) {
        left = rect.right - popupWidth;
      }
      if (left < 16) left = 16;
      if (top + popupHeight > window.innerHeight - 16) {
        top = rect.top - popupHeight - 8;
      }
      if (top < 16) top = 16;

      setPosition({ top, left });
    }
  }, [triggerRef]);

  useEffect(() => {
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [updatePosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClose, triggerRef]);

  const currentHex = getHexFromColor(currentColor);

  return createPortal(
    <div
      ref={pickerRef}
      className="bg-white border-2 border-gray-200 rounded-xl shadow-2xl w-60 overflow-hidden"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
      }}
    >
      <div className="border-b px-3 py-2 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-700">Escolha uma Cor</span>
        <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Cores predefinidas */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Cores Rápidas</p>
        <div className="grid grid-cols-4 gap-2">
          {colors.map((c) => {
            const hex = classToHex[c.class] || '#d97706';
            const isSelected = currentColor === c.class || currentHex === hex;
            return (
              <button
                key={c.class}
                className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                  isSelected ? 'border-gray-800 ring-2 ring-offset-1 ring-gray-400 scale-105' : 'border-gray-200'
                }`}
                style={{ backgroundColor: hex }}
                title={c.label}
                onClick={() => { onSelect(c.class); onClose(); }}
              />
            );
          })}
        </div>
      </div>

      {/* Seletor nativo de cor */}
      <div className="px-3 pb-3 pt-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Cor Personalizada</p>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={localHex}
            onChange={(e) => {
              // Apenas preview local — NÃO salva no servidor enquanto arrasta
              setLocalHex(e.target.value);
              setCustomColorChanged(true);
            }}
            className="w-12 h-12 rounded-lg border-2 border-gray-200 cursor-pointer p-1 shadow-sm hover:border-gray-400 transition-colors"
          />
          <div className="flex-1">
            <p className="text-xs text-gray-600 font-medium">{localHex.toUpperCase()}</p>
            {customColorChanged ? (
              <button 
                onClick={() => { onSelect(localHex); setCustomColorChanged(false); initialHexRef.current = localHex; onClose(); }}
                className="text-[11px] font-semibold text-green-600 hover:text-green-700 hover:underline"
              >
                ✓ Aplicar esta cor
              </button>
            ) : (
              <p className="text-[10px] text-gray-400">Clique para escolher</p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function CategoryManager({ onChange }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState<string | null>(null);
  const [newCatEmojiPickerOpen, setNewCatEmojiPickerOpen] = useState(false);
  const [newCatEmoji, setNewCatEmoji] = useState('');
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);

  // Refs for emoji picker positioning
  const newCatBtnRef = useRef<HTMLButtonElement>(null);
  const catBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const colorBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const setCatBtnRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) {
      catBtnRefs.current.set(id, el);
    } else {
      catBtnRefs.current.delete(id);
    }
  }, []);

  const setColorBtnRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) {
      colorBtnRefs.current.set(id, el);
    } else {
      colorBtnRefs.current.delete(id);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const response = await api.getCategories();
      if (response.success) {
        // Filter out system categories 'promocoes' and 'mais-pedidos' from the editable list
        const filtered = response.categories.filter((cat: any) => {
           const id = (cat.id || '').toLowerCase();
           const label = (cat.label || '').toLowerCase();
           const isSystem = 
             id === 'promocoes' || 
             id === 'mais-pedidos' || 
             id.includes('promo') || 
             label.includes('mais pedidos') ||
             label.includes('mais vendidos');
           return !isSystem;
        });
        setCategories(filtered);
      }
    } catch (error) {
      toast.error('Erro ao carregar categorias');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newCategory.trim()) return;

    const id = newCategory.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[^a-z0-9]/g, "-"); // replace non-alphanum with hyphen

    if (categories.some(c => c.id === id)) {
      toast.error('Categoria ja existe');
      return;
    }

    const newCat: Category = {
      id,
      label: newCategory.trim(),
      color: 'bg-amber-600 hover:bg-amber-700', // Default color
      emoji: newCatEmoji || '',
    };

    const updated = [...categories, newCat];
    setCategories(updated);
    setNewCategory('');
    setNewCatEmoji('');
    
    await saveCategories(updated);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza? Isso pode afetar produtos que usam esta categoria.')) return;
    const updated = categories.filter(c => c.id !== id);
    setCategories(updated);
    await saveCategories(updated);
  };

  const saveCategories = async (updated: Category[]) => {
    try {
      const response = await api.saveCategories(updated);
      if (response.success) {
        toast.success('Categorias atualizadas');
        if (onChange) onChange();
      } else {
        toast.error('Erro ao salvar');
      }
    } catch (error) {
      toast.error('Erro ao salvar');
    }
  };

  const updateColor = async (id: string, colorClass: string) => {
    const updated = categories.map(c => c.id === id ? { ...c, color: colorClass } : c);
    setCategories(updated);
    await saveCategories(updated);
  };

  const updateEmoji = async (id: string, emoji: string) => {
    const updated = categories.map(c => c.id === id ? { ...c, emoji } : c);
    setCategories(updated);
    await saveCategories(updated);
  };

  const colors = [
    { label: 'Amber', class: 'bg-amber-600 hover:bg-amber-700' },
    { label: 'Vermelho', class: 'bg-red-600 hover:bg-red-700' },
    { label: 'Azul', class: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'Verde', class: 'bg-green-600 hover:bg-green-700' },
    { label: 'Roxo', class: 'bg-purple-600 hover:bg-purple-700' },
    { label: 'Rosa', class: 'bg-pink-600 hover:bg-pink-700' },
    { label: 'Cinza', class: 'bg-gray-600 hover:bg-gray-700' },
    { label: 'Preto', class: 'bg-black hover:bg-gray-900' },
  ];

  if (isLoading) return <div className="p-4 text-center">Carregando categorias...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="text-lg font-bold text-gray-800">Gerenciar Categorias</h3>
        <p className="text-sm text-gray-500">
          Nota: "Mais Pedidos" e "Promocoes" sao fixos e automaticos.
        </p>
      </div>

      {/* Adicionar nova categoria */}
      <div className="flex gap-2">
        {/* Emoji selector for new category */}
        <div className="relative">
          <button
            ref={newCatBtnRef}
            type="button"
            onClick={() => setNewCatEmojiPickerOpen(!newCatEmojiPickerOpen)}
            className="w-11 h-11 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-xl hover:border-amber-500 hover:bg-amber-50 transition-all"
            title="Escolher emoji"
          >
            {newCatEmoji || <Smile className="w-5 h-5 text-gray-400" />}
          </button>
          {newCatEmojiPickerOpen && (
            <EmojiPicker
              currentEmoji={newCatEmoji}
              onSelect={(emoji) => setNewCatEmoji(emoji)}
              onClose={() => setNewCatEmojiPickerOpen(false)}
              triggerRef={newCatBtnRef}
            />
          )}
        </div>

        <input
          type="text"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="Nova categoria (ex: Hamburgueres)"
          className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-gray-900 placeholder-gray-500"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={!newCategory.trim()}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="grid gap-3">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border group hover:border-amber-300 transition-colors">
            {/* Emoji da categoria */}
            <div className="relative">
              <button
                ref={(el) => setCatBtnRef(cat.id, el)}
                onClick={() => setEmojiPickerOpen(emojiPickerOpen === cat.id ? null : cat.id)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all border-2 ${
                  cat.emoji 
                    ? 'bg-amber-50 border-amber-300 hover:border-amber-500 hover:bg-amber-100' 
                    : 'bg-gray-100 border-dashed border-gray-300 hover:border-amber-400 hover:bg-gray-50'
                }`}
                title={cat.emoji ? `Emoji: ${cat.emoji} (clique para alterar)` : 'Definir emoji'}
              >
                {cat.emoji || <Smile className="w-4 h-4 text-gray-400" />}
              </button>

              {emojiPickerOpen === cat.id && (
                <EmojiPicker
                  currentEmoji={cat.emoji}
                  onSelect={(emoji) => updateEmoji(cat.id, emoji)}
                  onClose={() => setEmojiPickerOpen(null)}
                  triggerRef={{ current: catBtnRefs.current.get(cat.id) || null }}
                />
              )}
            </div>

            {/* Cor + info */}
            <div className="relative">
              <button
                ref={(el) => setColorBtnRef(cat.id, el)}
                onClick={() => setColorPickerOpen(colorPickerOpen === cat.id ? null : cat.id)}
                className={`w-3 h-8 rounded-full flex-shrink-0 transition-all ${
                  !isHexColor(cat.color) ? cat.color : ''
                } ${
                  colorPickerOpen === cat.id ? 'ring-2 ring-offset-1 ring-gray-400' : ''
                }`}
                style={isHexColor(cat.color) ? { backgroundColor: cat.color } : undefined}
                title="Clique para alterar a cor"
              />
              
              {colorPickerOpen === cat.id && (
                <ColorPickerPopup
                  currentColor={cat.color}
                  onSelect={(color) => updateColor(cat.id, color)}
                  onClose={() => setColorPickerOpen(null)}
                  triggerRef={{ current: colorBtnRefs.current.get(cat.id) || null }}
                  colors={colors}
                />
              )}
            </div>
            
            <div className="flex-1">
              <span className="font-medium text-gray-800">{cat.label}</span>
              <p className="text-xs text-gray-400">ID: {cat.id}</p>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleDelete(cat.id)}
                className="p-2 hover:bg-red-100 rounded text-red-600"
                title="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {categories.length === 0 && (
          <p className="text-center text-gray-500 py-4">Nenhuma categoria cadastrada</p>
        )}
      </div>
    </div>
  );
}