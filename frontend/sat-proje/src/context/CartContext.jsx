import { createContext, useContext, useState, useCallback } from 'react';
import { fetchCart, addItemToCart, updateCartItem, clearCartOnBackend } from '../api/userApi';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  /** Backend'den sepeti çeker ve state'i günceller */
  const refreshCart = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchCart();
      setCartItems(data.items || []);
      setCartTotal(data.total_price || 0);
    } catch {
      // Oturum yoksa veya hata olursa sessizce boş bırak
      setCartItems([]);
      setCartTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Sepete ürün ekler (backend'e POST) */
  const addToCart = async (productId, quantity = 1) => {
    await addItemToCart(productId, quantity);
    await refreshCart();
  };

  /** Sepet öğesini günceller veya siler (quantity=0 → sil) */
  const updateItem = async (itemId, quantity) => {
    await updateCartItem(itemId, quantity);
    await refreshCart();
  };

  /** Sepetteki bir öğeyi kaldırır */
  const removeFromCart = async (itemId) => {
    await updateCartItem(itemId, 0);
    await refreshCart();
  };

  /** Sepeti tamamen temizler */
  const clearCart = async () => {
    await clearCartOnBackend();
    setCartItems([]);
    setCartTotal(0);
  };

  const cartItemCount = cartItems.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartTotal,
        cartItemCount,
        loading,
        addToCart,
        updateItem,
        removeFromCart,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
