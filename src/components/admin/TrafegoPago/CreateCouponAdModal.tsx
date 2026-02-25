import React, { useState, useEffect } from "react";
import { toast } from "sonner@2.0.3";
import * as api from "../../../utils/api";

interface CreateCouponAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (campaign: any) => void;
}

export function CreateCouponAdModal({ isOpen, onClose, onSuccess }: CreateCouponAdModalProps) {
  const [step, setStep] = useState(1);
  const [selectedCoupon, setSelectedCoupon] = useState<any>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [isLoadingCoupons, setIsLoadingCoupons] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      loadCoupons();
    }
  }, [isOpen]);

  const loadCoupons = async () => {
    setIsLoadingCoupons(true);
    try {
      const response = await api.getCoupons();
      
      if (response.success && response.coupons) {
        const mappedCoupons = response.coupons.map((c: any) => ({
          id: c.id,
          code: c.code,
          discount: c.type === "percentage" ? `${c.value}%` : `R$ ${c.value.toFixed(2)}`,
          type: c.type,
          available: c.maxUses === -1 ? "Ilimitado" : ((c.maxUses || 0) - (c.currentUses || 0)),
          total: c.maxUses,
          expiresAt: c.expiresAt,
          used: c.currentUses || 0,
          isActive: c.isActive !== false
        }));
        
        mappedCoupons.sort((a: any, b: any) => {
          if (a.isActive === b.isActive) return 0;
          return a.isActive ? -1 : 1;
        });
        
        setCoupons(mappedCoupons);
        if (mappedCoupons.length > 0) {
          const firstActive = mappedCoupons.find((c: any) => c.isActive);
          setSelectedCoupon(firstActive || mappedCoupons[0]);
        }
      }
    } catch (error) {
      console.error("Error loading coupons:", error);
      toast.error("Erro ao carregar cupons");
    } finally {
      setIsLoadingCoupons(false);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cupom permanentemente?")) return;
    try {
      const response = await api.deleteCoupon(id);
      if (response.success) {
        toast.success("Cupom excluído com sucesso!");
        loadCoupons();
        if (selectedCoupon?.id === id) setSelectedCoupon(null);
      } else {
        toast.error("Erro ao excluir cupom");
      }
    } catch (e) {
      console.error("Erro ao excluir cupom:", e);
      toast.error("Erro ao excluir cupom");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200"
      >
        <div className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-lg text-2xl">
              🎁
            </div>
            <div>
              <h2 className="font-bold text-gray-800">Criar Anúncio de Cupom</h2>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span className={step >= 1 ? "text-orange-600 font-medium" : ""}>1. Cupom</span>
                <span>→</span>
                <span className={step >= 2 ? "text-orange-600 font-medium" : ""}>2. Criativo</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-2xl">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">Selecione o Cupom da Campanha</h3>
              <div className="flex gap-4">
                <button 
                  onClick={async () => {
                    if(confirm("Tem certeza? Isso apagará TODOS os cupons permanentemente!")) {
                      setIsLoadingCoupons(true);
                      await api.clearAllCoupons();
                      toast.success("Banco de dados de cupons limpo!");
                      loadCoupons();
                    }
                  }}
                  className="text-sm text-red-500 font-medium hover:text-red-700 flex items-center gap-1"
                >
                  🗑️ Limpar Tudo
                </button>
                <button 
                  onClick={loadCoupons}
                  className="text-sm text-gray-500 font-medium hover:text-gray-700"
                >
                  🔄 Atualizar
                </button>
              </div>
            </div>

            {isLoadingCoupons ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-gray-500 text-sm">Buscando cupons ativos...</p>
              </div>
            ) : coupons.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <div className="text-6xl mb-3">🎁</div>
                <h4 className="text-gray-600 font-medium">Nenhum cupom ativo encontrado</h4>
                <p className="text-gray-400 text-sm mt-1">Crie cupons na aba de Marketing primeiro.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {coupons.map((coupon) => (
                  <div 
                    key={coupon.id}
                    onClick={() => setSelectedCoupon(coupon)}
                    className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md flex items-center justify-between group ${
                      selectedCoupon?.id === coupon.id 
                        ? "border-orange-500 bg-orange-50" 
                        : "border-white bg-white hover:border-orange-200"
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCoupon(coupon.id);
                      }}
                      className="absolute top-2 right-2 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10 opacity-0 group-hover:opacity-100"
                      title="Excluir cupom"
                    >
                      🗑️
                    </button>

                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                        selectedCoupon?.id === coupon.id ? "bg-orange-200" : "bg-gray-100"
                      }`}>
                        🎁
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-gray-800">{coupon.code}</span>
                          {coupon.isActive ? (
                            <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">Ativo</span>
                          ) : (
                            <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full font-medium">Inativo</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          💰 Desconto: <strong>{coupon.discount}</strong> • {coupon.available} disponíveis
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Válido até: {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : "Indeterminado"}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {selectedCoupon?.id === coupon.id && (
                        <div className="bg-orange-500 text-white p-1 rounded-full mb-2 inline-flex text-xl">
                          ✓
                        </div>
                      )}
                      <div className="text-xs text-gray-400">Usado {coupon.used} vezes</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 items-start">
              <span className="text-2xl">✨</span>
              <div>
                <h4 className="font-medium text-blue-800">Dica Pro</h4>
                <p className="text-sm text-blue-600 mt-1">Cupons com quantidade limitada geram 3x mais conversão por gatilho de urgência.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border-t border-gray-100 flex justify-between items-center">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          <button 
            onClick={() => toast.info("Modal simplificado - funcionalidade completa em breve")}
            className="px-6 py-2.5 bg-gray-900 text-white font-medium hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-gray-200"
          >
            Próximo →
          </button>
        </div>
      </div>
    </div>
  );
}