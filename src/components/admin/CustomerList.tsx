import React, { useState, useEffect } from 'react';
import { User, Phone, MapPin, ShoppingBag, Calendar, Search, Users } from 'lucide-react';
import * as api from '../../utils/api';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrder: Date;
  createdAt: Date;
}

export function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      const response = await api.getFullOrderHistory();
      
      if (response.success && response.orders) {
        // Agrupar pedidos por cliente
        const customerMap = new Map<string, Customer>();
        
        response.orders.forEach((order: any) => {
          const phone = order.customerPhone?.replace(/\D/g, '');
          if (!phone) return;
          
          if (customerMap.has(phone)) {
            const customer = customerMap.get(phone)!;
            customer.totalOrders += 1;
            customer.totalSpent += order.total || 0;
            
            const orderDate = new Date(order.createdAt);
            if (orderDate > customer.lastOrder) {
              customer.lastOrder = orderDate;
            }
            if (orderDate < customer.createdAt) {
              customer.createdAt = orderDate;
            }
          } else {
            customerMap.set(phone, {
              id: phone,
              name: order.customerName,
              phone: order.customerPhone,
              address: order.deliveryType === 'delivery' ? order.address : undefined,
              totalOrders: 1,
              totalSpent: order.total || 0,
              lastOrder: new Date(order.createdAt),
              createdAt: new Date(order.createdAt),
            });
          }
        });
        
        const customersArray = Array.from(customerMap.values())
          .sort((a, b) => b.totalOrders - a.totalOrders);
        
        setCustomers(customersArray);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm)
  );

  const getTimeAgo = (date: Date) => {
    const days = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (days === 0) return 'Hoje';
    if (days === 1) return 'Ontem';
    if (days < 30) return `${days} dias atrás`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'} atrás`;
    return `${Math.floor(months / 12)} ${Math.floor(months / 12) === 1 ? 'ano' : 'anos'} atrás`;
  };

  const getCustomerBadge = (orders: number) => {
    if (orders >= 20) return { label: '🌟 VIP', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    if (orders >= 10) return { label: '💎 Premium', color: 'bg-purple-100 text-purple-800 border-purple-300' };
    if (orders >= 5) return { label: '⭐ Frequente', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    return { label: '👤 Novo', color: 'bg-gray-100 text-gray-800 border-gray-300' };
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Lista de Clientes</h1>
        <p className="text-gray-600">Visualize informações e histórico dos seus clientes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total de Clientes</p>
              <p className="text-2xl font-bold text-gray-800">{customers.length}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <User className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pedidos Totais</p>
              <p className="text-2xl font-bold text-gray-800">
                {customers.reduce((acc, c) => acc + c.totalOrders, 0)}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <ShoppingBag className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Clientes VIP</p>
              <p className="text-2xl font-bold text-gray-800">
                {customers.filter(c => c.totalOrders >= 20).length}
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <User className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          />
        </div>
      </div>

      {/* Customer List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredCustomers.map(customer => {
          const badge = getCustomerBadge(customer.totalOrders);
          
          return (
            <div
              key={customer.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer"
              onClick={() => setSelectedCustomer(customer)}
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-green-500 to-green-600 p-3 rounded-full">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">{customer.name}</h3>
                      <p className="text-sm text-gray-500">Cliente desde {getTimeAgo(customer.createdAt)}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <a href={`tel:${customer.phone}`} className="hover:text-green-600">
                      {customer.phone}
                    </a>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-gray-500">📧</span>
                      <a href={`mailto:${customer.email}`} className="hover:text-green-600">
                        {customer.email}
                      </a>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-start gap-2 text-sm text-gray-700">
                      <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <span className="flex-1">{customer.address}</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{customer.totalOrders}</p>
                    <p className="text-xs text-gray-600">Pedidos</p>
                  </div>
                  <div className="text-center border-l border-gray-200">
                    <p className="text-2xl font-bold text-green-600">
                      R$ {customer.totalSpent.toFixed(0)}
                    </p>
                    <p className="text-xs text-gray-600">Gasto Total</p>
                  </div>
                  <div className="text-center border-l border-gray-200">
                    <p className="text-sm font-semibold text-gray-700">{getTimeAgo(customer.lastOrder)}</p>
                    <p className="text-xs text-gray-600">Último Pedido</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCustomers.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Nenhum cliente encontrado</p>
        </div>
      )}

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedCustomer(null)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Detalhes do Cliente</h2>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Informações Pessoais</h3>
                <div className="space-y-2">
                  <p className="text-sm"><span className="font-medium">Nome:</span> {selectedCustomer.name}</p>
                  <p className="text-sm"><span className="font-medium">Telefone:</span> {selectedCustomer.phone}</p>
                  {selectedCustomer.email && (
                    <p className="text-sm"><span className="font-medium">E-mail:</span> {selectedCustomer.email}</p>
                  )}
                  {selectedCustomer.address && (
                    <p className="text-sm"><span className="font-medium">Endereço:</span> {selectedCustomer.address}</p>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Estatísticas</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total de Pedidos</p>
                    <p className="text-xl font-bold text-green-600">{selectedCustomer.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Gasto</p>
                    <p className="text-xl font-bold text-green-600">R$ {selectedCustomer.totalSpent.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Ticket Médio</p>
                    <p className="text-xl font-bold text-green-600">
                      R$ {(selectedCustomer.totalSpent / selectedCustomer.totalOrders).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Último Pedido</p>
                    <p className="text-sm font-semibold text-gray-700">{getTimeAgo(selectedCustomer.lastOrder)}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedCustomer(null)}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      )}

      {/* No Customers State */}
      {customers.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Nenhum cliente ainda</h2>
          <p className="text-gray-600">Os clientes aparecerão aqui quando fizerem pedidos</p>
        </div>
      )}
    </div>
  );
}