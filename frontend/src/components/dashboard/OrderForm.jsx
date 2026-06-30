// pages/Orders.jsx
import React, { useState } from 'react';
import { Plus, X, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useTradeStore } from '../../store/useTradeStore'; 

const Orders = () => {
  const buyStock = useTradeStore((state) => state.buyStock);
  const sellStock = useTradeStore((state) => state.sellStock);
  const isTrading = useTradeStore((state) => state.isLoading);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orders, setOrders] = useState([
    { id: 1, symbol: 'NICA', type: 'BUY', qty: 100, status: 'Filled', date: '2026-06-30' },
  ]);

  const [form, setForm] = useState({
    symbol: '',
    type: 'BUY', // BUY or SELL
    qty: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!form.symbol || !form.qty) return;

    const tradeAction = form.type === 'BUY' ? buyStock : sellStock;

    // Call store action with only symbol and quantity parameters
    const result = await tradeAction(form.symbol, form.qty);

    if (result.success) {
      const placedOrder = {
        id: Date.now(),
        symbol: form.symbol.toUpperCase(),
        type: form.type,
        qty: parseInt(form.qty, 10),
        status: 'Filled', 
        date: new Date().toISOString().split('T')[0]
      };

      setOrders([placedOrder, ...orders]);
      setIsModalOpen(false);

      // Reset Form
      setForm({
        symbol: '',
        type: 'BUY',
        qty: '',
      });
      
      alert(`${form.type} order executed successfully!`);
    } else {
      alert(`Transaction Rejected: ${result.error}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Area */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Order Book</h1>
          <p className="text-sm text-slate-500">Track and manage your paper trade orders</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg shadow-sm transition duration-150"
        >
          <Plus size={18} />
          <span>New Order</span>
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-4">Symbol</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-bold text-slate-800">{order.symbol}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center font-bold text-xs px-2 py-0.5 rounded ${
                      order.type === 'BUY' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {order.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{order.qty}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <CheckCircle size={12} />
                      <span>{order.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{order.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simplified Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Place Trade Ticket</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handlePlaceOrder} className="p-6 space-y-4">
              {/* Buy / Sell Switch */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, type: 'BUY' }))}
                  className={`py-2 rounded-md text-xs font-bold transition duration-150 ${
                    form.type === 'BUY'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, type: 'SELL' }))}
                  className={`py-2 rounded-md text-xs font-bold transition duration-150 ${
                    form.type === 'SELL'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  SELL
                </button>
              </div>

              {/* Symbol Input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Stock Symbol
                </label>
                <input
                  type="text"
                  name="symbol"
                  value={form.symbol}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., NABIL, NICA, GBIME"
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder:text-slate-400"
                />
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Quantity (Kitta)
                </label>
                <input
                  type="number"
                  name="qty"
                  value={form.qty}
                  onChange={handleInputChange}
                  required
                  min="1"
                  placeholder="e.g., 10, 50, 100"
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Order Submission Button */}
              <button
                type="submit"
                disabled={isTrading}
                className={`w-full py-3 rounded-lg text-white font-bold text-sm shadow-sm transition duration-150 mt-2 disabled:opacity-50 ${
                  form.type === 'BUY'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isTrading ? 'Processing...' : `Place ${form.type === 'BUY' ? 'Buy' : 'Sell'} Order`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;