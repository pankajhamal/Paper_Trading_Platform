// pages/Orders.jsx
import React, { useState, useEffect, useRef } from "react";
import { Plus, X, Clock, CheckCircle, XCircle, Ban } from "lucide-react";
import { useOrderStore } from "../../store/useOrderStore";

const Orders = () => {
  const {
    orders,
    fetchOrders,
    placeBuyOrder,
    placeSellOrder,
    cancelOrder,
    isLoading: isTrading,
  } = useOrderStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeStock, setActiveStock] = useState(null);

  // Cancellation State
  const [cancelTarget, setCancelTarget] = useState(null); // the pending order awaiting confirmation
  const [isCancelling, setIsCancelling] = useState(false);

  // Notification State
  // Notification States
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const timeoutRef = useRef(null);
  const [notification, setNotification] = useState(null); // { message: string, type: 'success' | 'error' }

  const [form, setForm] = useState({
    symbol: "",
    type: "BUY",
    order_type: "MARKET",
    qty: "",
    limit_price: "",
  });

  // Helper to trigger the smooth right-to-left toast notification
  const triggerNotification = (message, type = "success") => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setToastMessage(message);
    setToastType(type);
    setShowToast(true); // Slide in from right to left

    // Automatically slide out after 4 seconds
    timeoutRef.current = setTimeout(() => {
      setShowToast(false); // Slide back out to the right
    }, 4000);
  };

  // Clean up the timer when the component unmounts to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Lock body scrolling when the Modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    // Clean up on unmount to ensure the page is never locked permanently
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isModalOpen]);

  // Fetch complete trade history from DB and poll every 15s
  useEffect(() => {
    fetchOrders();

    const interval = setInterval(() => {
      fetchOrders();
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Fetch stock details dynamically as the user types the symbol
  useEffect(() => {
    const fetchActiveStock = async () => {
      const sym = form.symbol.trim().toUpperCase();
      if (sym.length >= 3) {
        try {
          const token = localStorage.getItem("token");
          const response = await fetch(`http://localhost:8000/stocks/${sym}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            setActiveStock(data);
          } else {
            setActiveStock(null);
          }
        } catch (err) {
          setActiveStock(null);
        }
      } else {
        setActiveStock(null);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchActiveStock();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [form.symbol]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!form.symbol || !form.qty) return;
    if (form.order_type === "LIMIT" && !form.limit_price) {
      triggerNotification(
        "Please enter a Limit Price for Limit Orders.",
        "error",
      );
      return;
    }

    const tradeAction = form.type === "BUY" ? placeBuyOrder : placeSellOrder;
    const parsedQty = parseInt(form.qty, 10);
    const parsedLimitPrice =
      form.order_type === "LIMIT" ? parseFloat(form.limit_price) : null;

    const result = await tradeAction(
      form.symbol,
      parsedQty,
      form.order_type,
      parsedLimitPrice,
    );

    if (result.success) {
      setIsModalOpen(false);
      setActiveStock(null);

      setForm({
        symbol: "",
        type: "BUY",
        order_type: "MARKET",
        qty: "",
        limit_price: "",
      });

      triggerNotification(
        `${form.type} ${form.order_type} order placed successfully!`,
        "success",
      );
    } else {
      triggerNotification(`Rejected: ${result.error}`, "error");
    }
  };

  // Confirm and cancel a resting pending order
  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;

    setIsCancelling(true);
    const result = await cancelOrder(cancelTarget.id);
    setIsCancelling(false);
    setCancelTarget(null);

    if (result.success) {
      triggerNotification(
        `Order #${cancelTarget.id} (${cancelTarget.symbol}) cancelled. Escrow refunded.`,
        "success",
      );
    } else {
      triggerNotification(`Cancel failed: ${result.error}`, "error");
    }
  };

  return (
    <div className="space-y-6 relative pb-16">
      {/* Header Area */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Order Book</h1>
          <p className="text-sm text-slate-500">
            Track and manage your paper trade orders
          </p>
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
          {isTrading && orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm font-medium">
                Loading orders from database...
              </p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-sm font-medium">
                No orders found in your history.
              </p>
              <p className="text-xs text-slate-400">
                Click "New Order" to place your first paper trade.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4">Symbol</th>
                  <th className="px-6 py-4">Direction</th>
                  <th className="px-6 py-4">Order Type</th>
                  <th className="px-6 py-4">Quantity</th>
                  <th className="px-6 py-4">Execution Price</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {order.symbol}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center font-bold text-xs px-2 py-0.5 rounded ${
                          order.type === "BUY"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-rose-50 text-rose-600"
                        }`}
                      >
                        {order.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-semibold">
                      {order.orderType}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {order.qty}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-600">
                      {order.limit_price
                        ? `Rs. ${order.limit_price}`
                        : "Market"}
                    </td>
                    <td className="px-6 py-4">
                      {order.status === "COMPLETED" ||
                      order.status === "Filled" ||
                      order.status === "filled" ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <CheckCircle size={12} />
                          <span>Completed</span>
                        </span>
                      ) : order.status === "EXPIRED" ||
                        order.status === "Expired" ||
                        order.status === "expired" ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <XCircle size={12} />
                          <span>Expired</span>
                        </span>
                      ) : order.status === "CANCELLED" ||
                        order.status === "Cancelled" ||
                        order.status === "cancelled" ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-100">
                          <Ban size={12} />
                          <span>Cancelled</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100 animate-pulse">
                          <Clock size={12} />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{order.date}</td>
                    <td className="px-6 py-4 text-right">
                      {order.status === "Pending" ? (
                        <button
                          onClick={() => setCancelTarget(order)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 transition duration-150"
                        >
                          <Ban size={13} />
                          <span>Cancel</span>
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Order Ticket Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 w-screen h-screen bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[9999]">

          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">
                Place Trade Ticket
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setActiveStock(null);
                }}
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
                  onClick={() => setForm((prev) => ({ ...prev, type: "BUY" }))}
                  className={`py-2 rounded-md text-xs font-bold transition duration-150 ${
                    form.type === "BUY"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, type: "SELL" }))}
                  className={`py-2 rounded-md text-xs font-bold transition duration-150 ${
                    form.type === "SELL"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  SELL
                </button>
              </div>

              {/* Order Type Switch (Market vs Limit) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Order Type
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        order_type: "MARKET",
                        limit_price: "",
                      }))
                    }
                    className={`py-1.5 rounded-md text-xs font-bold transition duration-150 ${
                      form.order_type === "MARKET"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    MARKET
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, order_type: "LIMIT" }))
                    }
                    className={`py-1.5 rounded-md text-xs font-bold transition duration-150 ${
                      form.order_type === "LIMIT"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    LIMIT
                  </button>
                </div>
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

              {/* Dynamic Live Price Info Block */}
              {activeStock && (
                <div className="bg-slate-50 border border-slate-200/60 rounded-lg p-3 text-xs space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>Last Traded Price:</span>
                    <span className="text-blue-600 font-bold">
                      Rs. {activeStock.current_price}
                    </span>
                  </div>
                  {form.order_type === "LIMIT" && (
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span>Allowed Limit Range (±10%):</span>
                      <span className="text-slate-700 font-bold bg-slate-100 px-1 rounded">
                        Rs. {(activeStock.current_price * 0.9).toFixed(1)} - Rs.{" "}
                        {(activeStock.current_price * 1.1).toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              )}

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

              {/* Conditional Limit Price Input */}
              {form.order_type === "LIMIT" && (
                <div className="animate-in slide-in-from-top-2 duration-150">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Limit Price (Rs.)
                  </label>
                  <input
                    type="number"
                    name="limit_price"
                    value={form.limit_price}
                    onChange={handleInputChange}
                    required
                    min="0.1"
                    step="0.1"
                    placeholder="e.g., 890.0"
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                  />
                </div>
              )}

              {/* Order Submission Button */}
              <button
                type="submit"
                disabled={isTrading}
                className={`w-full py-3 rounded-lg text-white font-bold text-sm shadow-sm transition duration-150 mt-2 disabled:opacity-50 ${
                  form.type === "BUY"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {isTrading
                  ? "Processing..."
                  : `Place ${form.type === "BUY" ? "Buy" : "Sell"} ${form.order_type}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 w-screen h-screen bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Cancel Order</h2>
              <button
                onClick={() => setCancelTarget(null)}
                disabled={isCancelling}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-lg transition disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Are you sure you want to cancel this pending{" "}
                <span className="font-bold">{cancelTarget.type}</span> order? The
                escrowed{" "}
                {cancelTarget.type === "BUY" ? "cash" : "shares"} will be
                refunded to your account.
              </p>

              <div className="bg-slate-50 border border-slate-200/60 rounded-lg p-3 text-xs space-y-1.5">
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>Symbol:</span>
                  <span className="font-bold text-slate-800">
                    {cancelTarget.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Quantity:</span>
                  <span className="font-bold">{cancelTarget.qty}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Limit Price:</span>
                  <span className="font-bold">
                    {cancelTarget.limit_price
                      ? `Rs. ${cancelTarget.limit_price}`
                      : "Market"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  disabled={isCancelling}
                  className="py-2.5 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition duration-150 disabled:opacity-50"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={isCancelling}
                  className="py-2.5 rounded-lg text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition duration-150 disabled:opacity-50"
                >
                  {isCancelling ? "Cancelling..." : "Cancel Order"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern, Floating Toast Notification (Always mounted, slides smoothly right-to-left) */}
      <div
        className={`fixed bottom-6 right-6 z-[10000] transition-all duration-500 ease-in-out transform ${
          showToast
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "translate-x-[120%] opacity-0 pointer-events-none"
        }`}
      >
        <div
          className={`flex items-center space-x-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold max-w-sm ${
            toastType === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-100/50"
              : "bg-rose-50 text-rose-800 border-rose-200 shadow-rose-100/50"
          }`}
        >
          {toastType === "success" ? (
            <CheckCircle size={18} className="text-emerald-600 shrink-0" />
          ) : (
            <XCircle size={18} className="text-rose-600 shrink-0" />
          )}
          <span className="">{toastMessage}</span>
        </div>
      </div>
    </div>
  );
};

export default Orders;
