import { CheckCircle, Printer, ShoppingBag, User, MapPin, Receipt, Clock } from 'lucide-react';

interface PaymentConfirmedProps {
  orderId: string;
  customerName: string;
  total: number;
  deliveryType: 'delivery' | 'pickup' | 'dine-in';
  onClose: () => void;
}

export function PaymentConfirmed({
  orderId,
  customerName,
  total,
  deliveryType,
  onClose
}: PaymentConfirmedProps) {
  const deliveryText = deliveryType === 'delivery' 
    ? 'Entrega' 
    : deliveryType === 'dine-in'
    ? 'Consumir no Local'
    : 'Retirada';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300 shadow-2xl border border-zinc-200 dark:border-zinc-800">
        {/* Header de Sucesso */}
        <div className="bg-emerald-600 dark:bg-emerald-700 p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white rounded-full blur-3xl"></div>
          </div>
          
          <div className="bg-white dark:bg-zinc-900 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6 shadow-xl relative z-10 animate-bounce-slow">
            <CheckCircle className="w-14 h-14 text-emerald-600 dark:text-emerald-500" />
          </div>
          <h2 className="text-3xl font-black text-white mb-2 relative z-10">
            Pedido Realizado!
          </h2>
          <p className="text-emerald-100 text-sm font-medium relative z-10 opacity-90">
            Agora é só relaxar que estamos cuidando de tudo.
          </p>
        </div>

        {/* Corpo */}
        <div className="p-8 space-y-8 bg-zinc-50 dark:bg-zinc-900/50">
          {/* Número do Pedido */}
          <div className="text-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm">
            <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-2">Protocolo do Pedido</p>
            <p className="text-4xl font-black text-amber-600 dark:text-amber-500 tracking-tighter">
              #{orderId}
            </p>
          </div>

          {/* Informações */}
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-100 dark:border-zinc-700/50 shadow-sm transition-all hover:border-amber-500/30">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">Cliente</span>
              </div>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{customerName}</span>
            </div>
            
            <div className="flex justify-between items-center bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-100 dark:border-zinc-700/50 shadow-sm transition-all hover:border-amber-500/30">
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">Entrega</span>
              </div>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{deliveryText}</span>
            </div>
            
            <div className="flex justify-between items-center bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-100 dark:border-zinc-700/50 shadow-sm transition-all hover:border-amber-500/30">
              <div className="flex items-center gap-3">
                <Receipt className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">Total</span>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-lg">
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-lg">
                  R$ {total.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>
          </div>

          {/* Próximos Passos */}
          <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-900/30 rounded-2xl p-5">
            <h3 className="text-xs font-black text-amber-800 dark:text-amber-500 mb-4 flex items-center gap-2 uppercase tracking-wider">
              <Clock className="w-4 h-4" /> Acompanhamento
            </h3>
            <ul className="space-y-4">
              <li className="flex items-center gap-4 group">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-500 font-black text-xs">1</div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Pedido enviado para a cozinha</span>
              </li>
              <li className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-500 font-black text-xs">2</div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Atualizações automáticas via WhatsApp</span>
              </li>
            </ul>
          </div>

          {/* Botão de Ação */}
          <div className="space-y-3 pt-2">
            <button
              onClick={onClose}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-amber-600/20 transition-all duration-300 active:scale-95 flex items-center justify-center gap-3 group"
            >
              <ShoppingBag className="w-6 h-6 group-hover:animate-bounce" />
              Meus Pedidos
            </button>
            
            <p className="text-center text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              Dica: Guarde o número #{orderId}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}