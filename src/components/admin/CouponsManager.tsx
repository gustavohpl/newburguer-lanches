import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Percent, DollarSign, Infinity, Tag, Copy, Check } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { formatBrasiliaDate, isCouponExpired } from '../../utils/dateUtils';
import { useConfig } from '../../ConfigContext';
import * as api from '../../utils/api';

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed'; // porcentagem ou valor fixo
  value: number; // valor do desconto (10 para 10% ou 10 para R$10)
  maxUses: number; // -1 para ilimitado
  currentUses: number;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string | null;
}

export function CouponsManager() {
  const { config } = useConfig();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  
  if (config.features?.coupons === false) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="bg-gray-100 p-4 rounded-full mb-4">
          <Tag className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800">Funcionalidade Indisponível</h3>
        <p className="text-gray-500 max-w-md mt-2">
          O módulo de Cupons de Desconto não está ativado no seu plano atual. Entre em contato com o suporte para fazer upgrade.
        </p>
      </div>
    );
  }

  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form fields
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [isUnlimited, setIsUnlimited] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');
  const [hasExpiration, setHasExpiration] = useState(false);

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
      setIsLoading(true);
      console.log('🎫 [CouponsManager] Buscando cupons...');
      const response = await api.getCoupons();
      console.log('🎫 [CouponsManager] Resposta:', response);
      
      if (response.success && response.coupons) {
        console.log('🎫 [CouponsManager] Total encontrado:', response.coupons.length);
        setCoupons(response.coupons);
      } else {
        console.warn('⚠️ [CouponsManager] Resposta sem sucesso ou sem cupons');
      }
    } catch (error) {
      console.error('Erro ao carregar cupons:', error);
      toast.error('Erro ao carregar cupons');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setCode('');
    setType('percentage');
    setValue('');
    setMaxUses('');
    setIsUnlimited(true);
    setExpiresAt('');
    setHasExpiration(false);
    setEditingCoupon(null);
    setShowForm(false);
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCode(coupon.code);
    setType(coupon.type);
    setValue(coupon.value.toString());
    setMaxUses(coupon.maxUses === -1 ? '' : coupon.maxUses.toString());
    setIsUnlimited(coupon.maxUses === -1);
    
    if (coupon.expiresAt) {
      setHasExpiration(true);
      // Format YYYY-MM-DD
      const date = new Date(coupon.expiresAt);
      setExpiresAt(date.toISOString().split('T')[0]);
    } else {
      setHasExpiration(false);
      setExpiresAt('');
    }
    
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      toast.error('Digite o código do cupom');
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      toast.error('Digite um valor válido');
      return;
    }

    if (type === 'percentage' && numValue > 100) {
      toast.error('Porcentagem não pode ser maior que 100%');
      return;
    }

    const numMaxUses = isUnlimited ? -1 : parseInt(maxUses);
    if (!isUnlimited && (isNaN(numMaxUses) || numMaxUses < 1)) {
      toast.error('Digite uma quantidade válida');
      return;
    }

    try {
      const couponData = {
        code: code.toUpperCase().trim(),
        type,
        value: numValue,
        maxUses: numMaxUses,
        isActive: true,
        expiresAt: hasExpiration && expiresAt ? new Date(expiresAt).toISOString() : null,
      };

      let response;
      if (editingCoupon) {
        response = await api.updateCoupon(editingCoupon.id, couponData);
      } else {
        response = await api.createCoupon(couponData);
      }

      if (response.success) {
        toast.success(editingCoupon ? 'Cupom atualizado!' : 'Cupom criado!');
        loadCoupons();
        resetForm();
      } else {
        console.error('Erro na resposta:', response);
        toast.error(response.error || 'Erro desconhecido ao salvar cupom');
      }
    } catch (error) {
      console.error('Erro ao salvar cupom:', error);
      toast.error('Erro de conexão ao salvar cupom');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este cupom?')) {
      return;
    }

    try {
      const response = await api.deleteCoupon(id);
      if (response.success) {
        toast.success('Cupom excluído!');
        loadCoupons();
      } else {
        toast.error('Erro ao excluir cupom');
      }
    } catch (error) {
      console.error('Erro ao excluir cupom:', error);
      toast.error('Erro ao excluir cupom');
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      const response = await api.updateCoupon(coupon.id, {
        ...coupon,
        isActive: !coupon.isActive,
      });

      if (response.success) {
        toast.success(coupon.isActive ? 'Cupom desativado' : 'Cupom ativado');
        loadCoupons();
      } else {
        toast.error('Erro ao atualizar cupom');
      }
    } catch (error) {
      console.error('Erro ao atualizar cupom:', error);
      toast.error('Erro ao atualizar cupom');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('⚠️ ATENÇÃO: Isso excluirá TODOS os cupons cadastrados. Tem certeza?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await api.clearAllCoupons();
      if (response.success) {
        toast.success('Todos os cupons foram excluídos!');
        loadCoupons();
      } else {
        toast.error('Erro ao excluir cupons');
      }
    } catch (error) {
      console.error('Erro ao excluir cupons:', error);
      toast.error('Erro ao excluir cupons');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Código copiado!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatDiscount = (coupon: Coupon) => {
    return coupon.type === 'percentage' 
      ? `${coupon.value}%` 
      : `R$ ${coupon.value.toFixed(2)}`;
  };

  const getUsageText = (coupon: Coupon) => {
    if (coupon.maxUses === -1) {
      return `${coupon.currentUses} usos (ilimitado)`;
    }
    return `${coupon.currentUses}/${coupon.maxUses} usos`;
  };

  const isExpired = (coupon: Coupon) => {
    if (coupon.maxUses !== -1 && coupon.currentUses >= coupon.maxUses) return true;
    return isCouponExpired(coupon.expiresAt);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando cupons...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cupons de Desconto (Gerenciador)</h2>
          <p className="text-sm text-gray-600 mt-1">
            Gerencie cupons de desconto para seus clientes
          </p>
        </div>
        <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClearAll}
              title="Deletar Todos"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              onClick={loadCoupons}
              title="Recarregar lista"
            >
              ↻
            </Button>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Cupom
            </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingCoupon ? 'Editar Cupom' : 'Novo Cupom'}
              </h3>
              <Button
                type="button"
                variant="ghost"
                onClick={resetForm}
                className="text-gray-500"
              >
                Cancelar
              </Button>
            </div>

            {/* Código do cupom */}
            <div>
              <Label htmlFor="code">Código do Cupom*</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ex: VERAO2025"
                className="mt-1"
                maxLength={20}
              />
            </div>

            {/* Tipo de desconto */}
            <div>
              <Label>Tipo de Desconto*</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setType('percentage')}
                  className={`p-4 border-2 rounded-lg transition-colors flex items-center gap-3 ${
                    type === 'percentage'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Percent className="w-5 h-5 text-orange-500" />
                  <div className="text-left">
                    <div className="font-semibold">Porcentagem</div>
                    <div className="text-xs text-gray-500">Ex: 10% de desconto</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setType('fixed')}
                  className={`p-4 border-2 rounded-lg transition-colors flex items-center gap-3 ${
                    type === 'fixed'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <DollarSign className="w-5 h-5 text-orange-500" />
                  <div className="text-left">
                    <div className="font-semibold">Valor Fixo</div>
                    <div className="text-xs text-gray-500">Ex: R$ 10 de desconto</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Valor do desconto */}
            <div>
              <Label htmlFor="value">
                Valor do Desconto* {type === 'percentage' ? '(%)' : '(R$)'}
              </Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                min="0"
                max={type === 'percentage' ? '100' : undefined}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === 'percentage' ? 'Ex: 10' : 'Ex: 10.00'}
                className="mt-1"
              />
            </div>

            {/* Quantidade de usos */}
            <div>
              <Label>Quantidade de Usos*</Label>
              <div className="space-y-3 mt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="unlimited"
                    checked={isUnlimited}
                    onChange={(e) => setIsUnlimited(e.target.checked)}
                    className="w-4 h-4 text-orange-500 rounded"
                  />
                  <label htmlFor="unlimited" className="text-sm font-medium cursor-pointer">
                    Cupons ilimitados
                  </label>
                  <Infinity className="w-4 h-4 text-gray-400" />
                </div>

                {!isUnlimited && (
                  <Input
                    type="number"
                    min="1"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="Ex: 50"
                  />
                )}
              </div>
            </div>

            {/* Validade */}
            <div>
              <Label>Validade do Cupom</Label>
              <div className="space-y-3 mt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasExpiration"
                    checked={hasExpiration}
                    onChange={(e) => setHasExpiration(e.target.checked)}
                    className="w-4 h-4 text-orange-500 rounded"
                  />
                  <label htmlFor="hasExpiration" className="text-sm font-medium cursor-pointer">
                    Definir data de validade
                  </label>
                </div>

                {hasExpiration && (
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full"
                    min={new Date().toISOString().split('T')[0]}
                  />
                )}
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                {editingCoupon ? 'Atualizar Cupom' : 'Criar Cupom'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Lista de cupons */}
      {coupons.length === 0 ? (
        <Card className="p-12 text-center">
          <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Nenhum cupom cadastrado
          </h3>
          <p className="text-gray-600 mb-4">
            Crie seu primeiro cupom de desconto para seus clientes
          </p>
          <div className="flex gap-2 justify-center">
            <Button
                onClick={() => loadCoupons()}
                variant="outline"
                className="border-gray-300 text-gray-600"
            >
                ↻ Recarregar
            </Button>
            <Button
                onClick={() => setShowForm(true)}
                className="bg-orange-500 hover:bg-orange-600"
            >
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Cupom
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {coupons.map((coupon) => (
            <Card
              key={coupon.id}
              className={`p-6 ${
                !coupon.isActive || isExpired(coupon)
                  ? 'opacity-50 border-gray-200'
                  : 'border-orange-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Tag className="w-5 h-5 text-orange-500" />
                      <code className="text-xl font-bold text-gray-900">
                        {coupon.code}
                      </code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(coupon.code)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title="Copiar código"
                    >
                      {copiedCode === coupon.code ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      {coupon.type === 'percentage' ? (
                        <Percent className="w-4 h-4 text-gray-400" />
                      ) : (
                        <DollarSign className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="font-semibold text-orange-600">
                        {formatDiscount(coupon)}
                      </span>
                      <span className="text-gray-600">de desconto</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600">
                      {coupon.maxUses === -1 ? (
                        <Infinity className="w-4 h-4" />
                      ) : null}
                      <span>{getUsageText(coupon)}</span>
                    </div>

                    {coupon.expiresAt && (
                      <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                        Expira em: {formatBrasiliaDate(coupon.expiresAt, false)}
                      </div>
                    )}

                    {isExpired(coupon) && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                        Esgotado
                      </span>
                    )}

                    {!coupon.isActive && !isExpired(coupon) && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                        Desativado
                      </span>
                    )}

                    {coupon.isActive && !isExpired(coupon) && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                        Ativo
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(coupon)}
                    disabled={isExpired(coupon)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(coupon)}
                    disabled={isExpired(coupon)}
                    className={
                      coupon.isActive ? 'text-orange-600' : 'text-gray-600'
                    }
                  >
                    {coupon.isActive ? 'Desativar' : 'Ativar'}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(coupon.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}