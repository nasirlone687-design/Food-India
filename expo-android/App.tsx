import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import * as Location from 'expo-location';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://10.0.2.2:3000';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Auth inputs
  const [authMode, setAuthMode] = useState<'login' | 'register_customer' | 'register_seller' | 'admin'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live Firestore collections
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        onSnapshot(userRef, (snap) => {
          if (snap.exists()) setProfile(snap.data());
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const unsubRes = onSnapshot(collection(db, 'restaurants'), (snap) => {
      setRestaurants(snap.docs.map((d) => ({ restaurantId: d.id, ...d.data() })));
    });
    const unsubProd = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map((d) => ({ productId: d.id, ...d.data() })));
    });
    const unsubPlans = onSnapshot(collection(db, 'subscriptionPlans'), (snap) => {
      setPlans(snap.docs.map((d) => ({ planId: d.id, ...d.data() })));
    });
    return () => {
      unsubRes();
      unsubProd();
      unsubPlans();
    };
  }, []);

  useEffect(() => {
    if (!user || !profile) return;
    const field = profile.role === 'seller' ? 'sellerId' : 'customerId';
    const q =
      profile.role === 'admin'
        ? query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
        : query(collection(db, 'orders'), where(field, '==', user.uid));
    const unsubOrders = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ orderId: d.id, ...d.data() })));
    });
    return () => unsubOrders();
  }, [user, profile]);

  const requestGps = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({});
      setGpsCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    }
  };

  const handleAuth = async () => {
    setErrorMsg(null);
    try {
      if (authMode === 'login' || authMode === 'admin') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const role = authMode === 'register_seller' ? 'seller' : 'customer';
        const now = serverTimestamp();
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          role,
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          registrationDate: now,
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
          isActive: true,
          isVerified: role === 'customer',
          accountStatus: role === 'customer' ? 'active' : 'pending_verification',
        });

        if (role === 'customer') {
          await setDoc(doc(db, 'customers', cred.user.uid), {
            customerId: cred.user.uid,
            uid: cred.user.uid,
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            savedAddresses: [],
            totalOrders: 0,
            registrationDate: now,
            createdAt: now,
            updatedAt: now,
          });
        } else {
          await setDoc(doc(db, 'sellers', cred.user.uid), {
            sellerId: cred.user.uid,
            uid: cred.user.uid,
            ownerName: fullName.trim(),
            email: email.trim(),
            businessPhone: phone.trim(),
            restaurantId: cred.user.uid,
            verificationStatus: 'pending',
            subscriptionStatus: 'none',
            registrationDate: now,
            createdAt: now,
            updatedAt: now,
          });
          await setDoc(doc(db, 'restaurants', cred.user.uid), {
            restaurantId: cred.user.uid,
            sellerId: cred.user.uid,
            restaurantName: restaurantName.trim() || `${fullName.trim()}'s Kitchen`,
            description: 'Authentic Indian Kitchen',
            cuisineTypes: ['North Indian'],
            phone: phone.trim(),
            address: 'India',
            city: 'New Delhi',
            pincode: '110001',
            latitude: 28.6139,
            longitude: 77.209,
            isOpen: false,
            approvalStatus: 'pending',
            baseDeliveryCharge: 20,
            perKmDeliveryCharge: 10,
            maximumDeliveryDistanceKm: 10,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Authentication failed');
    }
  };

  const placeCodOrder = async (item: any) => {
    if (!user || !profile) return;
    const deliveryCharge = 30;
    const totalAmount = Number(item.basePrice) + deliveryCharge;
    const orderNumber = `FI-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    await addDoc(collection(db, 'orders'), {
      orderNumber,
      customerId: user.uid,
      customerName: profile.fullName || 'Customer',
      customerPhone: profile.phone || '',
      restaurantId: item.restaurantId,
      restaurantName: 'Restaurant Partner',
      sellerId: item.sellerId,
      items: [
        {
          productId: item.productId,
          productName: item.name,
          quantity: 1,
          basePrice: item.basePrice,
          selectedAddOns: [],
          itemTotal: item.basePrice,
        },
      ],
      deliveryAddress: {
        id: 'gps',
        label: 'Current Location',
        fullAddress: 'Customer Delivery Address',
        city: 'New Delhi',
        pincode: '110001',
        latitude: gpsCoords?.latitude || 28.6139,
        longitude: gpsCoords?.longitude || 77.209,
      },
      restaurantLocation: { latitude: 28.6139, longitude: 77.209, address: 'Restaurant' },
      distanceKm: 2.5,
      subtotal: item.basePrice,
      deliveryCharge,
      totalAmount,
      paymentMethod: 'COD',
      paymentStatus: 'pending_cod',
      orderStatus: 'pending',
      statusHistory: [{ status: 'pending', timestamp: new Date().toISOString(), updatedBy: user.uid }],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const paySellerSubscription = async (plan: any) => {
    if (!user) return;
    const res = await fetch(`${API_BASE_URL}/api/create-payment-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sellerId: user.uid, planId: plan.planId }),
    });
    const data = await res.json();
    if (data.shortUrl) {
      Linking.openURL(data.shortUrl);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#F97316" />
      </SafeAreaView>
    );
  }

  if (!user || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.pad}>
          {/* Hidden long-press on logo opens Admin login */}
          <Pressable onLongPress={() => setAuthMode('admin')} delayLongPress={2000} style={styles.logoBox}>
            <Text style={styles.logoText}>FI</Text>
          </Pressable>
          <Text style={styles.title}>Food India ({authMode.toUpperCase()})</Text>
          {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

          {(authMode === 'register_customer' || authMode === 'register_seller') && (
            <>
              <TextInput style={styles.input} placeholder="Full Name" value={fullName} onChangeText={setFullName} />
              <TextInput style={styles.input} placeholder="Phone Number" value={phone} onChangeText={setPhone} />
            </>
          )}
          {authMode === 'register_seller' && (
            <TextInput
              style={styles.input}
              placeholder="Restaurant Name"
              value={restaurantName}
              onChangeText={setRestaurantName}
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.primaryBtn} onPress={handleAuth}>
            <Text style={styles.primaryBtnText}>Continue</Text>
          </TouchableOpacity>

          <View style={styles.row}>
            <TouchableOpacity onPress={() => setAuthMode('login')}>
              <Text style={styles.link}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAuthMode('register_customer')}>
              <Text style={styles.link}>Customer Signup</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAuthMode('register_seller')}>
              <Text style={styles.link}>Seller Signup</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{profile.fullName}</Text>
            <Text style={styles.subtitle}>Role: {profile.role.toUpperCase()} • 100% COD Food Orders</Text>
          </View>
          <TouchableOpacity onPress={() => signOut(auth)} style={styles.outBtn}>
            <Text style={styles.outBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={requestGps} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>
            {gpsCoords
              ? `GPS Locked: ${gpsCoords.latitude.toFixed(4)}, ${gpsCoords.longitude.toFixed(4)}`
              : 'Enable Native Android GPS'}
          </Text>
        </TouchableOpacity>

        {profile.role === 'seller' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Seller Subscription Plans (Razorpay Payment Links)</Text>
            {plans.map((p) => (
              <View key={p.planId} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {p.name} - ₹{p.price} ({p.durationDays} Days)
                </Text>
                <TouchableOpacity onPress={() => paySellerSubscription(p)} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Pay Now via Razorpay Link</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {profile.role === 'customer' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Dishes (COD Checkout)</Text>
            {products.map((prod) => (
              <View key={prod.productId} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {prod.name} - ₹{prod.basePrice}
                </Text>
                <Text style={styles.subtitle}>{prod.description}</Text>
                <TouchableOpacity onPress={() => placeCodOrder(prod)} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Order Now (Cash on Delivery)</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live Firestore Orders ({orders.length})</Text>
          {orders.map((o) => (
            <View key={o.orderId} style={styles.card}>
              <Text style={styles.cardTitle}>
                #{o.orderNumber} • ₹{o.totalAmount} (COD)
              </Text>
              <Text style={styles.subtitle}>Status: {o.orderStatus}</Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps/dir/?api=1&destination=${o.deliveryAddress?.latitude || 28.6139},${
                      o.deliveryAddress?.longitude || 77.209
                    }`
                  )
                }
              >
                <Text style={styles.link}>Open Google Maps Directions</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pad: { padding: 20 },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  title: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 4 },
  error: { color: '#DC2626', marginVertical: 8, fontWeight: '700' },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  primaryBtn: {
    backgroundColor: '#F97316',
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  primaryBtnText: { color: '#FFF', fontWeight: '900', textTransform: 'uppercase', fontSize: 12 },
  secondaryBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginVertical: 12,
  },
  secondaryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: '#F97316', fontWeight: '800', fontSize: 12, marginTop: 8 },
  outBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  outBtnText: { color: '#DC2626', fontWeight: '800', fontSize: 12 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 10 },
  card: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
});
