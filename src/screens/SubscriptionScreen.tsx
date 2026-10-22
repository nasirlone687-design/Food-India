import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft,
  Check,
  Zap,
  ShieldCheck,
  Loader2,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Mail,
  MessageCircle,
  Clock,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { SubscriptionPlan, Seller, SellerSubscription } from '../models/types';
import { CopiableErrorAlert, copyToClipboardSafe, reportGlobalButtonStatus } from '../context/ErrorLogContext';

const OFFICIAL_UPI_ID = '8825018335@axl';
const EXACT_SUBSCRIPTION_PRICE = 499;
const PLAN_GST_RATE = 18;
const PLAN_GST_AMOUNT = 89.82;
const PLAN_TOTAL_WITH_GST = 588.82;
const OFFICIAL_GST_NUMBER = '01BMAPL3192D1CY';
const OFFICIAL_FSSAI_NUMBER = '11026999000072';
const OFFICIAL_UDYAM_NUMBER = 'UDYAM-JK-11-0018721';
const SUBSCRIPTION_DURATION_DAYS = 30;
const UPI_DEEP_LINK = `upi://pay?pa=${OFFICIAL_UPI_ID}&pn=Food%20India%20KulgamKart&am=${PLAN_TOTAL_WITH_GST.toFixed(
  2
)}&cu=INR&tn=Food%20India%20Seller%20Plan%20499%20Plus%20GST%20${OFFICIAL_GST_NUMBER}`;

const DEFAULT_499_PLAN: SubscriptionPlan = {
  planId: 'monthly_499',
  name: 'Seller 30-Day Partner Plan',
  price: 499,
  basePrice: 499,
  gstRate: PLAN_GST_RATE,
  gstAmount: PLAN_GST_AMOUNT,
  totalWithGst: PLAN_TOTAL_WITH_GST,
  gstNumber: OFFICIAL_GST_NUMBER,
  currency: 'INR',
  durationDays: 30,
  features: [
    'Plan ₹499 + 18% GST (₹89.82) = ₹588.82 for 30 Days (0% Commission)',
    `Official GST Invoice Included (GSTIN: ${OFFICIAL_GST_NUMBER})`,
    'Unlimited Menu Products & All 20 Indian Categories',
    '100% Direct Cash on Delivery (COD) Orders',
    'All-India Delivery Partner Integration',
    'Live GPS Distance Ranking & Verified Reviews',
  ],
  isActive: true,
};

const SubscriptionScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([DEFAULT_499_PLAN]);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [latestSub, setLatestSub] = useState<SellerSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingRef, setSubmittingRef] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [amountConfirmed, setAmountConfirmed] = useState(true);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'subscriptionPlans'), where('isActive', '==', true));
    const unsubPlans = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ ...d.data(), planId: d.id } as SubscriptionPlan));
      const has499 = list.some((p) => Number(p.price) === 499);
      const merged = has499 ? list : [DEFAULT_499_PLAN, ...list];
      merged.sort((a, b) => Number(a.price) - Number(b.price));
      setPlans(merged);
      setLoading(false);
    });

    const unsubSeller = onSnapshot(doc(db, 'sellers', user.uid), (d) => {
      if (d.exists()) {
        const sData = d.data() as Seller;
        setSeller(sData);
        if (sData.upiTransactionRef && !transactionRef) {
          setTransactionRef(sData.upiTransactionRef);
        }
      }
    });

    const subQ = query(collection(db, 'sellerSubscriptions'), where('sellerId', '==', user.uid));
    const unsubSub = onSnapshot(subQ, (snap) => {
      const subs = snap.docs.map((d) => ({ ...d.data(), subscriptionId: d.id } as SellerSubscription));
      subs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setLatestSub(subs[0] || null);
    });

    return () => {
      unsubPlans();
      unsubSeller();
      unsubSub();
    };
  }, [user]);

  const handleCopyUpi = async () => {
    await copyToClipboardSafe(OFFICIAL_UPI_ID);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleCopySubmittedRef = async (refText: string) => {
    await copyToClipboardSafe(refText);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  // Calculate remaining days in 30-day cycle
  const getSubscriptionTiming = () => {
    const expiryRaw = seller?.subscriptionExpiryDate || latestSub?.expiryDate;
    if (!expiryRaw) return { isExpired: false, daysLeft: 30, expiryFormatted: null };
    const expiryMs = expiryRaw?.toMillis
      ? expiryRaw.toMillis()
      : expiryRaw?.seconds
      ? expiryRaw.seconds * 1000
      : new Date(expiryRaw).getTime();
    if (!Number.isFinite(expiryMs)) return { isExpired: false, daysLeft: 30, expiryFormatted: null };
    const diffMs = expiryMs - Date.now();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return {
      isExpired: diffMs <= 0,
      daysLeft: Math.max(0, daysLeft),
      expiryFormatted: new Date(expiryMs).toLocaleDateString(),
    };
  };

  const timing = getSubscriptionTiming();

  const handleSubmitUpiReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanRef = transactionRef.trim();
    if (cleanRef.length < 6) {
      setErrorMessage(
        `Please enter your valid UPI Transaction Reference / UTR Number (minimum 6 characters) after paying Plan ₹499 + GST (₹${PLAN_TOTAL_WITH_GST}) to ${OFFICIAL_UPI_ID}.`
      );
      return;
    }
    if (!amountConfirmed) {
      setErrorMessage(
        `Please confirm that you paid Plan ₹499 + GST (GSTIN: ${OFFICIAL_GST_NUMBER}) to ${OFFICIAL_UPI_ID}.`
      );
      return;
    }

    setSubmittingRef(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const nowDate = new Date();
      const expiryDate = new Date(
        nowDate.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000
      );
      const paymentId = `pay_upi_${user.uid.slice(0, 8)}_${Date.now()}`;
      const subscriptionId = `sub_upi_${user.uid.slice(0, 8)}_${Date.now()}`;

      // 1. Save Payment record for Admin Dashboard (Sellers & Payments tabs) with GST details
      await setDoc(doc(db, 'payments', paymentId), {
        paymentId,
        sellerId: user.uid,
        sellerName: seller?.ownerName || profile?.fullName || 'Seller Partner',
        sellerPhone: seller?.phone || seller?.businessPhone || profile?.phone || '',
        sellerEmail: user.email || profile?.email || '',
        planId: 'monthly_499',
        planName: `Seller 30-Day Partner Plan (₹499 + 18% GST ₹${PLAN_GST_AMOUNT} = ₹${PLAN_TOTAL_WITH_GST})`,
        durationDays: SUBSCRIPTION_DURATION_DAYS,
        subscriptionId,
        paymentMethod: 'UPI',
        upiId: OFFICIAL_UPI_ID,
        upiTransactionRef: cleanRef,
        razorpayPaymentLinkId: `UPI-${cleanRef}`,
        razorpayPaymentId: cleanRef,
        amount: EXACT_SUBSCRIPTION_PRICE,
        baseAmount: EXACT_SUBSCRIPTION_PRICE,
        gstRate: PLAN_GST_RATE,
        gstAmount: PLAN_GST_AMOUNT,
        totalWithGst: PLAN_TOTAL_WITH_GST,
        gstNumber: OFFICIAL_GST_NUMBER,
        fssaiLicenseNumber: OFFICIAL_FSSAI_NUMBER,
        udyamRegistrationNumber: OFFICIAL_UDYAM_NUMBER,
        parentUnitName: 'KulgamKart (kulgamkart.in)',
        currency: 'INR',
        paymentStatus: 'paid',
        webhookVerified: true,
        activatedByAdmin: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Save SellerSubscription record with GST breakdown
      await setDoc(doc(db, 'sellerSubscriptions', subscriptionId), {
        subscriptionId,
        sellerId: user.uid,
        planId: 'monthly_499',
        planName: `Seller 30-Day Partner Plan (₹499 + 18% GST ₹${PLAN_GST_AMOUNT} = ₹${PLAN_TOTAL_WITH_GST})`,
        durationDays: SUBSCRIPTION_DURATION_DAYS,
        amount: EXACT_SUBSCRIPTION_PRICE,
        baseAmount: EXACT_SUBSCRIPTION_PRICE,
        gstRate: PLAN_GST_RATE,
        gstAmount: PLAN_GST_AMOUNT,
        totalWithGst: PLAN_TOTAL_WITH_GST,
        gstNumber: OFFICIAL_GST_NUMBER,
        currency: 'INR',
        paymentId,
        upiId: OFFICIAL_UPI_ID,
        upiTransactionRef: cleanRef,
        paymentStatus: 'paid',
        activationStatus: 'active',
        startDate: nowDate.toISOString(),
        expiryDate: expiryDate.toISOString(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. Update Seller Profile (sellers/{uid}) with 30-day active window, GST breakdown & transaction reference
      await setDoc(
        doc(db, 'sellers', user.uid),
        {
          sellerId: user.uid,
          uid: user.uid,
          planId: 'monthly_499',
          upiIdPaidTo: OFFICIAL_UPI_ID,
          upiTransactionRef: cleanRef,
          subscriptionAmountPaid: EXACT_SUBSCRIPTION_PRICE,
          subscriptionBaseAmount: EXACT_SUBSCRIPTION_PRICE,
          subscriptionGstRate: PLAN_GST_RATE,
          subscriptionGstAmount: PLAN_GST_AMOUNT,
          subscriptionTotalWithGst: PLAN_TOTAL_WITH_GST,
          platformGstNumber: OFFICIAL_GST_NUMBER,
          platformFssaiNumber: OFFICIAL_FSSAI_NUMBER,
          subscriptionStatus: 'active',
          accountPaused: false,
          subscriptionSubmittedAt: serverTimestamp(),
          subscriptionStartDate: nowDate.toISOString(),
          subscriptionExpiryDate: expiryDate.toISOString(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 4. Update User Profile (users/{uid})
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          upiTransactionRef: cleanRef,
          subscriptionStatus: 'active',
          subscriptionStartDate: nowDate.toISOString(),
          subscriptionExpiryDate: expiryDate.toISOString(),
          accountPaused: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 5. Re-open seller's restaurant if it was paused due to expiry
      const restId = seller?.restaurantId || `rest_${user.uid}`;
      await setDoc(
        doc(db, 'restaurants', restId),
        {
          isOpen: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});

      reportGlobalButtonStatus({
        buttonName: 'Submit ₹499 + GST UPI Transaction Reference',
        backendPath: `Firestore: sellers/${user.uid}, users/${user.uid}, payments/${paymentId}`,
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `UPI Transaction Ref "${cleanRef}" (Plan ₹499 + 18% GST ₹${PLAN_GST_AMOUNT} = ₹${PLAN_TOTAL_WITH_GST}, GSTIN: ${OFFICIAL_GST_NUMBER}) saved to Seller Profile & Admin Dashboard for 30 days.`,
      });

      setSuccessMessage(
        `Transaction Reference "${cleanRef}" submitted! Your 30-day subscription (Plan ₹499 + 18% GST ₹${PLAN_GST_AMOUNT} = ₹${PLAN_TOTAL_WITH_GST} • GSTIN: ${OFFICIAL_GST_NUMBER}, valid until ${expiryDate.toLocaleDateString()}) is now recorded on your Seller Profile and Admin Dashboard.`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit UPI transaction reference.');
    } finally {
      setSubmittingRef(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-orange-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 flex flex-col overflow-x-hidden max-w-[100vw]">
      <header className="flex items-center justify-between mb-6 max-w-2xl mx-auto w-full">
        <button
          type="button"
          onClick={() => navigate('/seller')}
          className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm"
        >
          <ChevronLeft className="text-slate-900" />
        </button>
        <h1 className="text-lg font-bold text-slate-900">Seller Plan ₹499 + GST (30 Days)</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full space-y-6 pb-16">
        {/* Official GST, FSSAI & KulgamKart Invoice Banner */}
        <div className="bg-white border-2 border-orange-200 rounded-3xl p-5 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">
                Food India (A Unit of KulgamKart • kulgamkart.in)
              </span>
              <h2 className="text-base font-black text-slate-900 mt-0.5">
                Plan ₹499 + 18% GST Tax Breakdown
              </h2>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-mono font-black">
              GSTIN: {OFFICIAL_GST_NUMBER}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <div>
              <span className="block text-[10px] font-black uppercase text-slate-400">Base Plan (30d)</span>
              <span className="text-base font-black text-slate-900">₹{EXACT_SUBSCRIPTION_PRICE}.00</span>
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase text-slate-400">GST ({PLAN_GST_RATE}%)</span>
              <span className="text-base font-black text-orange-600">+ ₹{PLAN_GST_AMOUNT.toFixed(2)}</span>
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase text-slate-400">Total Payable</span>
              <span className="text-base font-black text-emerald-700">₹{PLAN_TOTAL_WITH_GST.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 font-semibold pt-1">
            <div>
              <span className="font-black text-slate-900">GST Number:</span>{' '}
              <span className="font-mono font-bold text-slate-900">{OFFICIAL_GST_NUMBER}</span>
            </div>
            <div>
              <span className="font-black text-slate-900">FSSAI अनुज्ञिप्त संख्या / License No:</span>{' '}
              <span className="font-mono font-bold text-emerald-700">{OFFICIAL_FSSAI_NUMBER}</span>
            </div>
            <div>
              <span className="font-black text-slate-900">Udyam Registration No:</span>{' '}
              <span className="font-mono font-bold text-slate-900">{OFFICIAL_UDYAM_NUMBER}</span>
            </div>
            <div>
              <span className="font-black text-slate-900">Parent Unit:</span>{' '}
              <span>KulgamKart (kulgamkart.in)</span>
            </div>
          </div>
        </div>

        {/* Mandatory ₹499 + GST Warning & Refund Notice */}
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 space-y-2.5 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-sm font-black text-amber-950 uppercase tracking-tight">
                Important: Plan ₹499 + 18% GST (₹{PLAN_GST_AMOUNT}) = ₹{PLAN_TOTAL_WITH_GST} for 30-Day Activation
              </h2>
              <p className="text-xs text-amber-900 font-semibold leading-relaxed">
                Pay Plan <strong>₹499</strong> + 18% GST <strong>₹{PLAN_GST_AMOUNT}</strong> (Total{' '}
                <strong>₹{PLAN_TOTAL_WITH_GST}</strong>, GSTIN:{' '}
                <span className="font-mono font-black">{OFFICIAL_GST_NUMBER}</span>) to UPI ID{' '}
                <span className="font-mono font-black underline">{OFFICIAL_UPI_ID}</span> and submit
                your transaction reference number below for verification.
              </p>
              <p className="text-xs text-amber-900 font-medium">
                After 30 days, you can renew your subscription to keep your seller account active.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-amber-950">
            <span>For Refunds or Billing Help:</span>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="tel:+918825028335"
                className="inline-flex items-center gap-1 text-orange-700 hover:underline"
              >
                <Phone size={12} /> +91 8825028335
              </a>
              <a
                href="tel:+918825018335"
                className="inline-flex items-center gap-1 text-emerald-800 hover:underline"
              >
                <Phone size={12} /> +8825018335
              </a>
            </div>
          </div>
        </div>

        {/* Current Subscription & 30-Day Status Banner */}
        <div
          className={`p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            timing.isExpired || seller?.accountPaused
              ? 'bg-red-50 border-red-200 text-red-900'
              : seller?.subscriptionStatus === 'active'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-white border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-start gap-3">
            <ShieldCheck
              size={24}
              className={
                timing.isExpired || seller?.accountPaused
                  ? 'text-red-600 shrink-0 mt-0.5'
                  : seller?.subscriptionStatus === 'active'
                  ? 'text-emerald-600 shrink-0 mt-0.5'
                  : 'text-orange-500 shrink-0 mt-0.5'
              }
            />
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-75">
                Seller Subscription & 30-Day Status
              </p>
              <p className="text-sm font-black">
                {timing.isExpired || seller?.accountPaused
                  ? 'Account Paused — 30-Day Subscription Expired (Renew Plan ₹499 + GST)'
                  : seller?.subscriptionStatus === 'active'
                  ? `Active Partner Plan • ${timing.daysLeft} Days Remaining${
                      timing.expiryFormatted ? ` (Until ${timing.expiryFormatted})` : ''
                    }`
                  : 'Subscription Pending — Pay Plan ₹499 + GST via UPI & Submit Reference ID'}
              </p>
              {seller?.upiTransactionRef && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs font-mono font-bold bg-white/80 px-2.5 py-1 rounded-lg border border-black/10">
                    Submitted UTR / Ref: {seller.upiTransactionRef}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopySubmittedRef(seller.upiTransactionRef!)}
                    className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1"
                  >
                    {copiedRef ? <Check size={11} /> : <Copy size={11} />}
                    {copiedRef ? 'Copied!' : 'Copy Ref'}
                  </button>
                </div>
              )}
            </div>
          </div>
          {timing.expiryFormatted && (
            <div className="flex items-center gap-1.5 text-xs font-black uppercase bg-white/70 px-3 py-2 rounded-2xl shrink-0">
              <Clock size={14} className="text-orange-500" />
              <span>{timing.daysLeft}d left</span>
            </div>
          )}
        </div>

        <CopiableErrorAlert error={errorMessage} />

        {successMessage && (
          <div className="p-4 bg-emerald-600 text-white rounded-2xl flex items-start gap-3 shadow-lg">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs font-bold leading-relaxed">{successMessage}</div>
          </div>
        )}

        {/* Step 1: Pay Plan ₹499 + GST via UPI 8825018335@axl */}
        <div className="bg-slate-900 text-white rounded-[32px] p-6 shadow-xl space-y-5 relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="px-3 py-1 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                Step 1 • Official UPI Payment (GSTIN: {OFFICIAL_GST_NUMBER})
              </span>
              <h3 className="text-2xl font-black mt-2">
                Plan ₹499 + 18% GST (₹{PLAN_GST_AMOUNT})
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Total ₹{PLAN_TOTAL_WITH_GST} for 30 Days • 0% Order Commission • Unlimited Products
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-black text-orange-400">₹{PLAN_TOTAL_WITH_GST}</span>
              <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                ₹499 + ₹{PLAN_GST_AMOUNT} GST (18%)
              </span>
            </div>
          </div>

          {/* Copyable UPI ID Box */}
          <div className="bg-white/10 border border-white/15 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-300 block">
                Official Merchant UPI ID
              </span>
              <span className="text-lg sm:text-xl font-mono font-black text-white select-all">
                {OFFICIAL_UPI_ID}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyUpi}
              className="px-4 py-2.5 bg-white text-slate-900 hover:bg-orange-50 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all"
            >
              {copiedUpi ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copiedUpi ? 'UPI ID Copied!' : 'Copy UPI ID'}</span>
            </button>
          </div>

          {/* Direct UPI Deep Link Button */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href={UPI_DEEP_LINK}
              className="w-full py-4 px-5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-95 transition-all text-center"
            >
              <Zap size={16} />
              <span>Pay ₹{PLAN_TOTAL_WITH_GST} (₹499 + GST) via UPI</span>
              <ExternalLink size={14} />
            </a>
            <a
              href={`https://wa.me/918825018335?text=${encodeURIComponent(
                `Hello Food India Admin, I have paid Plan ₹499 + 18% GST (₹${PLAN_TOTAL_WITH_GST}, GSTIN: ${OFFICIAL_GST_NUMBER}) to UPI ${OFFICIAL_UPI_ID} for my Seller 30-Day Subscription. My Seller Email is ${
                  user?.email || ''
                } and Transaction Ref is ${transactionRef || '[Enter UTR]'}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all text-center"
            >
              <MessageCircle size={16} />
              <span>Send Payment on WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Step 2: Submit UPI Transaction Reference / UTR Number */}
        <form
          onSubmit={handleSubmitUpiReference}
          className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-sm space-y-4"
        >
          <div>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-full">
              Step 2 • Verification & Instant Activation
            </span>
            <h3 className="text-lg font-black text-slate-900 mt-2">
              Submit UPI Transaction Reference / UTR ID
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              After paying <strong>Plan ₹499 + 18% GST (₹{PLAN_GST_AMOUNT} = Total ₹{PLAN_TOTAL_WITH_GST})</strong> to{' '}
              <strong>{OFFICIAL_UPI_ID}</strong>, enter your 12-digit UPI Reference / UTR ID below.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider ml-1">
              UPI Transaction Reference / UTR ID *
            </label>
            <input
              type="text"
              required
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="e.g. 412345678901 or UPI Ref ID"
              className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-sm font-black text-slate-900 focus:outline-none focus:border-orange-500"
            />
          </div>

          <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={amountConfirmed}
              onChange={(e) => setAmountConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-orange-500 rounded shrink-0"
            />
            <span className="text-xs text-slate-700 font-semibold leading-relaxed">
              I confirm that I have paid Plan <strong>₹499 + 18% GST (₹{PLAN_GST_AMOUNT} = ₹{PLAN_TOTAL_WITH_GST})</strong>{' '}
              (GSTIN: <span className="font-mono font-black">{OFFICIAL_GST_NUMBER}</span>) to UPI{' '}
              <span className="font-mono font-black">{OFFICIAL_UPI_ID}</span> for a 30-day
              subscription.
            </span>
          </label>

          <button
            type="submit"
            disabled={submittingRef}
            className="w-full h-14 bg-slate-900 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            {submittingRef ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>SAVING TRANSACTION REF & ACTIVATING 30 DAYS...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>SUBMIT TRANSACTION REFERENCE & ACTIVATE 30 DAYS</span>
              </>
            )}
          </button>
        </form>

        {/* Plan Features Overview */}
        <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm space-y-4">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Included in Your ₹499 + GST / 30-Day Partner Plan
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(plans[0]?.features || DEFAULT_499_PLAN.features).map((feature, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check size={12} strokeWidth={3} />
                </div>
                <span>{feature}</span>
              </div>
            ))}
          </div>
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Food India (Unit of KulgamKart • kulgamkart.in • Udyam: {OFFICIAL_UDYAM_NUMBER})</span>
            <div className="flex items-center gap-3 font-bold text-slate-800">
              <Link to="/terms" className="text-orange-600 hover:underline">
                Terms & Refund Policy
              </Link>
              <span>•</span>
              <Link to="/privacy" className="text-orange-600 hover:underline">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionScreen;
