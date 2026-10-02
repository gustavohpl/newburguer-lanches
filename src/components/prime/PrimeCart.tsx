import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Minus, Plus, Trash2, ShoppingBag, ChevronRight } from 'lucide-react';
import type { CartItem } from '../../App';
import { getCategoryEmoji } from '../../utils/api';
import { useConfig } from '../../ConfigContext';
import { dinheiro, leve, legivelSobre, original, semMovimento } from './primeArte';
import './prime.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  totalPrice: number;
  onCheckout: () => void;
}

const mola = { type: 'spring' as const, stiffness: 380, damping: 34, mass: 0.9 };

export function PrimeCart({ isOpen, onClose, items, onUpdateQuantity, onRemove, totalPrice, onCheckout }: Props) {
  const reduzido = semMovimento();
  const { config } = useConfig();
  const cor = config.themeColor || '#04af06';
  const desktop = typeof window !== 'undefined' && window.innerWidth >= 860;

  useEffect(() => {
    if (!isOpen) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [isOpen, onClose]);

  const entrada = desktop
    ? { initial: { opacity: 0, scale: 0.94, x: '-50%', y: '-46%' }, animate: { opacity: 1, scale: 1, x: '-50%', y: '-50%' }, exit: { opacity: 0, scale: 0.96, x: '-50%', y: '-48%' } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="prime-mod" style={{ ['--ac' as string]: cor, ['--ac-ink' as string]: legivelSobre(cor) } as React.CSSProperties}>
          <motion.div className="pr-veu" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
          <motion.div className="pr-folha pc" role="dialog" aria-modal="true" aria-label="Sua sacola" data-lenis-prevent
            {...entrada} transition={reduzido ? { duration: 0 } : mola}
            drag={desktop || reduzido ? false : 'y'} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.05, bottom: 0.7 }}
            onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 650) onClose(); }}
          >
            {!desktop && <span className="pegador" aria-hidden />}
            <div className="pc-cab">
              <ShoppingBag size={20} />
              <b>Sua sacola</b>
              <button className="pc-x" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
            </div>

            <div className="rola pc-lista" data-lenis-prevent>
              {items.length === 0 ? (
                <div className="pc-vazia">
                  <ShoppingBag size={40} />
                  <p>Sua sacola está vazia</p>
                  <span>Adicione itens do cardápio para continuar</span>
                </div>
              ) : (
                items.map((item) => (
                  <motion.div key={item.id} className="pc-item" layout
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={mola}>
                    <div className="pc-foto">
                      {item.imageUrl ? <img src={leve(item.imageUrl, 256)} onError={original(item.imageUrl)} alt="" /> : <span>{getCategoryEmoji(item.category) || '🍔'}</span>}
                    </div>
                    <div className="pc-info">
                      <h3>{item.name}</h3>
                      {item.selectedAddons && item.selectedAddons.length > 0 && (
                        <p className="pc-adic">{item.selectedAddons.map((a) => `+ ${a.name}${a.price ? ` (${dinheiro(a.price)})` : ''}`).join(' · ')}</p>
                      )}
                      {item.notes && <p className="pc-obs"><span>Obs:</span> {item.notes}</p>}
                      <div className="pc-baixo">
                        <span className="pc-preco">{dinheiro((item.price + (item.selectedAddons || []).reduce((s, a) => s + a.price, 0)) * item.quantity)}</span>
                        <div className="pr-qtd">
                          <button onClick={() => (item.quantity <= 1 ? onRemove(item.id) : onUpdateQuantity(item.id, item.quantity - 1))} aria-label="Diminuir">
                            {item.quantity <= 1 ? <Trash2 size={16} /> : <Minus size={18} />}
                          </button>
                          <span className="n">{item.quantity}</span>
                          <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} aria-label="Aumentar"><Plus size={18} /></button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="rodape pc-rodape">
                <div className="pc-total"><span>Total</span><b>{dinheiro(totalPrice)}</b></div>
                <button className="pr-add" onClick={onCheckout}>
                  <span>Finalizar pedido</span>
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
