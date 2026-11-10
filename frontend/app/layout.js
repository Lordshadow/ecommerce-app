import './globals.css';
import { CartProvider } from '../context/CartContext';
import { WishlistProvider } from '../context/WishlistContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import CartDrawer from '../components/CartDrawer';
import Toast from '../components/Toast';
import NovaRetailWidget from '../components/NovaRetailWidget';

export const metadata = {
  title: 'ApexStore | Curated Online Store',
  description: 'Browse products across technology, audio, apparel, kitchenware, health, and outdoor categories.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-sky-500 selection:text-white">
        <CartProvider>
          <WishlistProvider>
            <Navbar />
            <CartDrawer />
            <Toast />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </WishlistProvider>
        </CartProvider>
        <NovaRetailWidget />
      </body>
    </html>
  );
}
