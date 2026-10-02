import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { Minus, Plus, X, Check } from 'lucide-react';
import type { Product } from '../../App';
import { getVisibleIngredients } from '../../utils/ingredientUtils';
import { dinheiro, leve, original, semMovimento } from './primeArte';

type Adicional = { id: string; name: string; price: number };

interface Props {
  product: Product;
  ilustracao: string | null;
  lojaAberta: boolean;
  onClose: () => void;
  /** origem = a foto da folha, para a animação de "voar até a sacola" */
  onAdd: (product: Product, notes: string, quantity: number, addons: Adicional[] | undefined, origem: HTMLElement | null) => void;
}

const mola = { type: 'spring' as const, stiffness: 380, damping: 34, mass: 0.9 };

export function PrimeSheet({ product, ilustracao, lojaAberta, onClose, onAdd }: Props) {
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState('');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [desktop, setDesktop] = useState(() => window.innerWidth >= 860);
  const rola = useRef<HTMLDivElement>(null);
  const foto = useRef<HTMLDivElement>(null);
  const rolagem = useMotionValue(0);
  const fotoY = useTransform(rolagem, [0, 300], [0, 110]);
  const fotoEscala = useTransform(rolagem, [-120, 0], [1.25, 1]);

  const adicionais: Adicional[] = ((product as any).addons || []) as Adicional[];
  const ingredientes = getVisibleIngredients(product);
  const somaAdicionais = adicionais.filter((a) => marcados.has(a.id)).reduce((s, a) => s + a.price, 0);
  const total = (product.price + somaAdicionais) * qtd;
  const imagem = product.imageUrl || product.image || null;
  const reduzido = semMovimento();

  useEffect(() => {
    const r = () => setDesktop(window.innerWidth >= 860);
    window.addEventListener('resize', r);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('resize', r);
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const alternar = (id: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const adicionar = () => {
    const escolhidos = adicionais.filter((a) => marcados.has(a.id));
    onAdd(product, obs.trim(), qtd, escolhidos.length ? escolhidos : undefined, foto.current);
  };

  const entrada = desktop
    ? { initial: { opacity: 0, scale: 0.94, x: '-50%', y: '-46%' }, animate: { opacity: 1, scale: 1, x: '-50%', y: '-50%' },
        exit: { opacity: 0, scale: 0.96, x: '-50%', y: '-48%' } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };

  return (
    <>
      <motion.div className="pr-veu" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
      <motion.div
        className="pr-folha" role="dialog" aria-modal="true" aria-label={product.name} data-lenis-prevent
        {...entrada}
        transition={reduzido ? { duration: 0 } : mola}
        drag={desktop || reduzido ? false : 'y'}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.7 }}
        onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 650) onClose(); }}
      >
        {!desktop && <span className="pegador" aria-hidden />}
        <button className="fechar" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        <div className="rola" ref={rola} onScroll={(e) => rolagem.set((e.target as HTMLDivElement).scrollTop)}>
          <div className="imagem" ref={foto}>
            <motion.img
              src={imagem ? leve(imagem, 1080) : ilustracao || ''} onError={original(imagem)} alt="" className={imagem ? '' : 'ilustra'}
              style={reduzido ? undefined : { y: fotoY, scale: fotoEscala }}
              initial={{ scale: 1.12, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className="miolo">
            <motion.h2 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, ...mola }}>
              {product.name}
            </motion.h2>
            {product.description && (
              <motion.p className="desc" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, ...mola }}>
                {product.description}
              </motion.p>
            )}
            {ingredientes.length > 0 && (
              <motion.div className="ingr" initial="a" animate="b" variants={{ b: { transition: { staggerChildren: 0.03, delayChildren: 0.2 } } }}>
                {ingredientes.map((i) => (
                  <motion.span key={i} variants={{ a: { opacity: 0, scale: 0.8 }, b: { opacity: 1, scale: 1 } }}>{i}</motion.span>
                ))}
              </motion.div>
            )}

            {adicionais.length > 0 && (
              <div className="pr-grupo">
                <div className="pr-grupo-cab"><b>Turbine seu pedido</b><small>OPCIONAL</small></div>
                {adicionais.map((a) => {
                  const on = marcados.has(a.id);
                  return (
                    <button key={a.id} className={`pr-opcao ${on ? 'on' : ''}`} onClick={() => alternar(a.id)} aria-pressed={on}>
                      <span className="nome">{a.name}</span>
                      <span className="valor">+ {dinheiro(a.price)}</span>
                      <span className="pr-check"><Check size={15} strokeWidth={3.5} /></span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="pr-grupo">
              <div className="pr-grupo-cab"><b>Alguma observação?</b><small>{obs.length}/140</small></div>
              <textarea className="pr-obs" maxLength={140} value={obs} onChange={(e) => setObs(e.target.value)}
                placeholder="Ex.: tirar a cebola, maionese à parte…" />
            </div>
          </div>
        </div>
        <div className="rodape">
          <div className="pr-qtd">
            <button onClick={() => setQtd((q) => Math.max(1, q - 1))} disabled={qtd <= 1} aria-label="Diminuir"><Minus size={18} /></button>
            <span className="n" aria-live="polite">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={qtd} style={{ position: 'absolute', inset: 0 }}
                  initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -18, opacity: 0 }} transition={mola}>
                  {qtd}
                </motion.span>
              </AnimatePresence>
            </span>
            <button onClick={() => setQtd((q) => q + 1)} aria-label="Aumentar"><Plus size={18} /></button>
          </div>
          <button className="pr-add" onClick={adicionar} disabled={!lojaAberta || product.available === false}>
            <span>{!lojaAberta ? 'Loja fechada' : product.available === false ? 'Indisponível' : 'Adicionar'}</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={total.toFixed(2)} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={mola}>
                {dinheiro(total)}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </motion.div>
    </>
  );
}
