import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SplashScreen from '@/screens/SplashScreen';
import WelcomeScreen from '@/screens/WelcomeScreen';
import CustomerAuthScreen from '@/screens/CustomerAuthScreen';
import SellerAuthScreen from '@/screens/SellerAuthScreen';
import CustomerRegistrationScreen from '@/screens/CustomerRegistrationScreen';
import SellerRegistrationScreen from '@/screens/SellerRegistrationScreen';
import CustomerDashboard from '@/screens/CustomerDashboard';
import SellerDashboard from '@/screens/SellerDashboard';
import AddProduct from '@/screens/AddProduct';
import EditProduct from '@/screens/EditProduct';
import RestaurantProfile from '@/screens/RestaurantProfile';
import ProductDetails from '@/screens/ProductDetails';
import CartScreen from '@/screens/Cart';
import OrdersScreen from '@/screens/Orders';
import TrackOrderScreen from '@/screens/TrackOrder';
import OrderSuccessScreen from '@/screens/OrderSuccess';
import AdminDashboard from '@/screens/AdminDashboard';
import VerificationScreen from '@/screens/VerificationScreen';
import SubscriptionScreen from '@/screens/SubscriptionScreen';
import AdminAuthScreen from '@/screens/AdminAuthScreen';
import TermsPrivacyScreen from '@/screens/TermsPrivacyScreen';
import { RestaurantMapWindow } from '@/plugins/restaurantMap/screens/RestaurantMapWindow';
import { StorefrontScreen } from '@/plugins/restaurantMap/screens/StorefrontScreen';
import { PluginSellerDashboard } from '@/plugins/restaurantMap/screens/PluginSellerDashboard';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/models/types';

const getRoleHomePath = (role?: UserRole) => {
  if (role === 'admin') return '/admin';
  if (role === 'seller') return '/seller';
  return '/customer';
};

const ProtectedRoute = ({
  children,
  role,
}: {
  children: React.ReactNode;
  role: 'customer' | 'seller' | 'admin';
}) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }
  if (!user || !profile) return <Navigate to="/welcome" replace />;
  if (profile.role !== role) return <Navigate to={getRoleHomePath(profile.role)} replace />;

  return <>{children}</>;
};

export const AppRoutes = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          user && profile ? (
            <Navigate to={getRoleHomePath(profile.role)} replace />
          ) : (
            <SplashScreen />
          )
        }
      />
      <Route
        path="/welcome"
        element={
          user && profile ? (
            <Navigate to={getRoleHomePath(profile.role)} replace />
          ) : (
            <WelcomeScreen />
          )
        }
      />

      {/* Public Legal & Policy Routes */}
      <Route path="/terms" element={<TermsPrivacyScreen />} />
      <Route path="/privacy" element={<TermsPrivacyScreen />} />
      <Route path="/refund" element={<TermsPrivacyScreen />} />
      <Route path="/refund-policy" element={<TermsPrivacyScreen />} />
      <Route path="/delete-account" element={<TermsPrivacyScreen />} />
      <Route path="/account-deletion" element={<TermsPrivacyScreen />} />
      <Route path="/about" element={<TermsPrivacyScreen />} />

      {/* Restaurant Map Plugin Dedicated Isolated Routes */}
      <Route path="/restaurant-map" element={<RestaurantMapWindow />} />
      <Route path="/r/:restaurantSlug" element={<StorefrontScreen />} />
      <Route path="/plugin-seller-dashboard" element={<PluginSellerDashboard />} />

      {/* Auth Routes */}
      <Route path="/customer-auth" element={<CustomerAuthScreen />} />
      <Route path="/customer-register" element={<CustomerRegistrationScreen />} />
      <Route path="/seller-auth" element={<SellerAuthScreen />} />
      <Route path="/seller-register" element={<SellerRegistrationScreen />} />
      <Route path="/admin-auth" element={<AdminAuthScreen />} />

      {/* Protected Customer Routes */}
      <Route
        path="/customer"
        element={
          <ProtectedRoute role="customer">
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/restaurant/:restaurantId"
        element={
          <ProtectedRoute role="customer">
            <RestaurantProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/product/:productId"
        element={
          <ProtectedRoute role="customer">
            <ProductDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cart"
        element={
          <ProtectedRoute role="customer">
            <CartScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute role="customer">
            <OrdersScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/order-success/:orderId"
        element={
          <ProtectedRoute role="customer">
            <OrderSuccessScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/track-order/:orderId"
        element={
          <ProtectedRoute role="customer">
            <TrackOrderScreen />
          </ProtectedRoute>
        }
      />

      {/* Protected Seller Routes */}
      <Route
        path="/seller"
        element={
          <ProtectedRoute role="seller">
            <SellerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/add-product"
        element={
          <ProtectedRoute role="seller">
            <AddProduct />
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/edit-product/:productId"
        element={
          <ProtectedRoute role="seller">
            <EditProduct />
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/verification"
        element={
          <ProtectedRoute role="seller">
            <VerificationScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/subscription"
        element={
          <ProtectedRoute role="seller">
            <SubscriptionScreen />
          </ProtectedRoute>
        }
      />

      {/* Protected Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

