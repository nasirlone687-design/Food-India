import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, onSnapshot, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { SellerDocument, Seller } from '../models/types';
import {
  ChevronLeft,
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  Trash2,
  Zap,
  Loader2,
  Download,
  CreditCard,
  Copy,
  Check,
  Send,
} from 'lucide-react';
import {
  uploadSellerDocumentFast,
  deleteSellerDocumentFast,
  saveSellerKycNumbersToProfile,
  downloadSellerDocumentFile,
  createValidSamplePdfFile,
  getDocTypeLabel,
  SellerDocType,
} from '../utils/documentUpload';
import { reportGlobalButtonStatus } from '../context/ErrorLogContext';

const UPI_ID = '8825018335@axl';
const SUBSCRIPTION_AMOUNT_INR = 499;

export default function VerificationScreen() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<SellerDocument[]>([]);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingKyc, setSavingKyc] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [upiTransactionRefInput, setUpiTransactionRefInput] = useState('');
  const [uploadMessage, setUploadMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<SellerDocType>('id_proof');

  // KYC License Numbers State
  const [businessLicenseNumber, setBusinessLicenseNumber] = useState('');
  const [fssaiLicenseNumber, setFssaiLicenseNumber] = useState('');
  const [aadhaarOrPanNumber, setAadhaarOrPanNumber] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'sellerDocuments'), where('sellerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ documentId: d.id, ...d.data() } as SellerDocument));
      list.sort((a, b) => {
        const ta = a.uploadedAt?.toMillis ? a.uploadedAt.toMillis() : 0;
        const tb = b.uploadedAt?.toMillis ? b.uploadedAt.toMillis() : 0;
        return tb - ta;
      });
      setDocuments(list);
    });

    const unsubSeller = onSnapshot(doc(db, 'sellers', user.uid), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as Seller;
        setSeller(data);
        if (data.businessLicenseNumber) setBusinessLicenseNumber(data.businessLicenseNumber);
        if (data.fssaiLicenseNumber) setFssaiLicenseNumber(data.fssaiLicenseNumber);
        if (data.aadhaarOrPanNumber) setAadhaarOrPanNumber(data.aadhaarOrPanNumber);
        if (data.upiTransactionRef) {
          setUpiTransactionRefInput((prev) => prev || data.upiTransactionRef || '');
        }
      }
    });

    return () => {
      unsubscribe();
      unsubSeller();
    };
  }, [user]);

  useEffect(() => {
    if (profile?.upiTransactionRef && !upiTransactionRefInput) {
      setUpiTransactionRefInput(profile.upiTransactionRef);
    }
  }, [profile?.upiTransactionRef, upiTransactionRefInput]);

  const effectiveUpiRef = (
    upiTransactionRefInput ||
    seller?.upiTransactionRef ||
    profile?.upiTransactionRef ||
    ''
  ).trim();
  const hasPaid499WithRef = effectiveUpiRef.length >= 6;

  const handleSaveKycNumbers = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    setSavingKyc(true);
    setUploadMessage(null);
    try {
      await saveSellerKycNumbersToProfile({
        uid: user.uid,
        restaurantId: seller?.restaurantId,
        businessLicenseNumber,
        fssaiLicenseNumber,
        aadhaarOrPanNumber,
      });
      setUploadMessage({
        type: 'success',
        text: 'Business License, FSSAI License, and Aadhaar/PAN numbers permanently saved to your Seller Profile!',
      });
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: err?.message || 'Failed to save KYC numbers.',
      });
    } finally {
      setSavingKyc(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    setUploadMessage(null);
    try {
      const res = await uploadSellerDocumentFast({
        uid: user.uid,
        documentType: selectedDocType,
        file,
        businessLicenseNumber,
        fssaiLicenseNumber,
        aadhaarOrPanNumber,
        sellerName: seller?.ownerName || profile?.fullName || user.displayName || 'Seller Partner',
        sellerEmail: seller?.email || profile?.email || user.email || '',
        sellerPhone: seller?.phone || seller?.businessPhone || profile?.phone || '',
        restaurantId: seller?.restaurantId,
      });
      setUploadMessage({
        type: 'success',
        text: `${getDocTypeLabel(selectedDocType)} ("${res.fileName}") permanently saved to your profile & Admin Dashboard in ${res.durationMs}ms!`,
      });
    } catch (error: any) {
      setUploadMessage({
        type: 'error',
        text: error?.message || 'Failed to upload document.',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleQuickSampleUpload = async () => {
    if (!user) return;
    setUploading(true);
    setUploadMessage(null);
    try {
      const sampleFile = createValidSamplePdfFile({
        fileName: `${selectedDocType}_verified_${Date.now()}.pdf`,
        title: `Food India Verified KYC Document - ${getDocTypeLabel(selectedDocType)}`,
        sellerId: user.uid,
        restaurantName: seller?.ownerName || profile?.fullName || 'Seller Partner',
        licenseNumber:
          selectedDocType === 'id_proof'
            ? aadhaarOrPanNumber || 'ABCDE1234F'
            : selectedDocType === 'fssai_license'
            ? fssaiLicenseNumber || '11523001000456'
            : businessLicenseNumber || '27AABCU9603R1ZM',
      });
      const res = await uploadSellerDocumentFast({
        uid: user.uid,
        documentType: selectedDocType,
        file: sampleFile,
        businessLicenseNumber: businessLicenseNumber || '27AABCU9603R1ZM',
        fssaiLicenseNumber: fssaiLicenseNumber || '11523001000456',
        aadhaarOrPanNumber: aadhaarOrPanNumber || 'ABCDE1234F',
        sellerName: seller?.ownerName || profile?.fullName || 'Seller Partner',
        sellerEmail: seller?.email || profile?.email || user.email || '',
        sellerPhone: seller?.phone || profile?.phone || '',
        restaurantId: seller?.restaurantId,
      });
      setUploadMessage({
        type: 'success',
        text: `Instant ${getDocTypeLabel(selectedDocType)} PDF uploaded & linked to Admin Dashboard in ${res.durationMs}ms!`,
      });
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: err?.message || 'Failed to upload sample document.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitVerificationRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const cleanUtr = effectiveUpiRef;
    if (!cleanUtr || cleanUtr.length < 6) {
      setUploadMessage({
        type: 'error',
        text: 'Payment Required: You must pay exactly ₹499 to UPI 8825018335@axl and enter your UPI Transaction Reference Number (UTR) before submitting a request for Admin Verification.',
      });
      return;
    }

    setSubmittingRequest(true);
    setUploadMessage(null);
    try {
      const startDate = new Date();
      const expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const paymentId = `pay_upi_${user.uid}_${Date.now()}`;
      const restId = seller?.restaurantId || `rest_${user.uid}`;

      await saveSellerKycNumbersToProfile({
        uid: user.uid,
        restaurantId: restId,
        businessLicenseNumber,
        fssaiLicenseNumber,
        aadhaarOrPanNumber,
      });

      // Record / update ₹499 UPI payment & UTR
      await setDoc(
        doc(db, 'payments', paymentId),
        {
          paymentId,
          sellerId: user.uid,
          sellerName: seller?.ownerName || profile?.fullName || user.email || 'Seller',
          planId: 'plan_499_30days',
          planName: 'Monthly Seller Subscription (₹499 / 30 Days)',
          durationDays: 30,
          amount: SUBSCRIPTION_AMOUNT_INR,
          currency: 'INR',
          upiId: UPI_ID,
          upiTransactionRef: cleanUtr,
          paymentStatus: 'paid',
          webhookVerified: false,
          activatedByAdmin: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Update Seller profile with UTR & verification request
      await setDoc(
        doc(db, 'sellers', user.uid),
        {
          uid: user.uid,
          sellerId: user.uid,
          ownerName: seller?.ownerName || profile?.fullName || user.displayName || 'Seller Partner',
          email: seller?.email || profile?.email || user.email || '',
          phone: seller?.phone || seller?.businessPhone || profile?.phone || '+91 9876543210',
          businessPhone: seller?.businessPhone || seller?.phone || profile?.phone || '+91 9876543210',
          restaurantId: restId,
          upiTransactionRef: cleanUtr,
          upiAmountPaid: SUBSCRIPTION_AMOUNT_INR,
          upiPaymentSubmittedAt: serverTimestamp(),
          subscriptionStatus: 'active',
          accountPaused: false,
          subscriptionStartDate: startDate.toISOString(),
          subscriptionExpiryDate: expiryDate.toISOString(),
          verificationStatus: seller?.verificationStatus === 'verified' ? 'verified' : 'pending',
          verificationNotes: `Verification requested by seller with ₹499 UPI Ref (UTR: ${cleanUtr}).`,
          verificationRequestedAt: serverTimestamp(),
          businessLicenseNumber: businessLicenseNumber.trim(),
          fssaiLicenseNumber: fssaiLicenseNumber.trim(),
          aadhaarOrPanNumber: aadhaarOrPanNumber.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          role: 'seller',
          upiTransactionRef: cleanUtr,
          subscriptionStatus: 'active',
          subscriptionStartDate: startDate.toISOString(),
          subscriptionExpiryDate: expiryDate.toISOString(),
          businessLicenseNumber: businessLicenseNumber.trim(),
          fssaiLicenseNumber: fssaiLicenseNumber.trim(),
          aadhaarOrPanNumber: aadhaarOrPanNumber.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Notify Admin
      await addDoc(collection(db, 'notifications'), {
        recipientUid: 'admin',
        recipientRole: 'admin',
        title: 'New Seller Verification Request (₹499 UTR Submitted)',
        body: `Seller ${
          seller?.ownerName || profile?.fullName || user.email
        } submitted ₹499 UPI Ref (${cleanUtr}) and ${documents.length} document(s) for verification.`,
        channels: ['app', 'email', 'whatsapp'],
        createdAt: serverTimestamp(),
        readAt: null,
      }).catch(() => {});

      reportGlobalButtonStatus({
        buttonName: 'Submit Request for Admin Verification (₹499 UTR Verified)',
        backendPath: `Firestore: sellers/${user.uid}, payments/${paymentId} & users/${user.uid}`,
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `Verification request submitted with ₹499 UPI Transaction Ref (${cleanUtr}) and ${documents.length} uploaded document(s).`,
        suggestion: 'Admin can now view your seller profile, copy your UTR, download your exact documents, and approve your account.',
      });

      setUploadMessage({
        type: 'success',
        text: `Verification request sent to Admin with ₹499 UPI Ref (${cleanUtr})! Your profile and documents are now live in Admin Dashboard.`,
      });
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: err?.message || 'Failed to submit verification request.',
      });
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleDeleteDoc = async (docItem: SellerDocument) => {
    try {
      await deleteSellerDocumentFast(docItem.documentId, docItem.fileName);
      setUploadMessage({
        type: 'success',
        text: `Removed ${getDocTypeLabel(docItem.documentType)} from Firestore.`,
      });
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: err?.message || 'Could not delete document.',
      });
    }
  };

  const verStatus = seller?.verificationStatus || 'pending';

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white px-6 py-5 border-b border-slate-100 sticky top-0 z-30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-sm font-black text-slate-900 uppercase tracking-widest">
              Seller KYC, ₹499 Payment Ref & Document Upload
            </h1>
            <p className="text-[10px] font-mono text-slate-400">
              Permanently Linked: Firestore sellerDocuments & sellers/{user?.uid?.slice(0, 8)}
            </p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6 max-w-2xl mx-auto">
        {/* Status Card */}
        <div
          className={`p-6 rounded-[32px] border shadow-sm flex items-center gap-4 ${
            verStatus === 'verified'
              ? 'bg-green-50 border-green-100 text-green-700'
              : verStatus === 'rejected'
              ? 'bg-red-50 border-red-100 text-red-700'
              : 'bg-orange-50 border-orange-100 text-orange-700'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0">
            {verStatus === 'verified' ? (
              <CheckCircle2 size={24} />
            ) : verStatus === 'rejected' ? (
              <AlertCircle size={24} />
            ) : (
              <Clock size={24} />
            )}
          </div>
          <div>
            <h4 className="font-black uppercase text-xs tracking-widest">
              Current Admin Verification Status
            </h4>
            <p className="text-xl font-black">{verStatus.toUpperCase()}</p>
            {seller?.verificationNotes && (
              <p className="text-xs mt-1 font-bold opacity-80">{seller.verificationNotes}</p>
            )}
          </div>
        </div>

        {/* Mandatory Step 1: ₹499 UPI Payment & Transaction Reference Gate */}
        <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                Mandatory Requirement for Verification
              </span>
              <h3 className="text-base font-black mt-0.5">
                Step 1: Pay Exactly ₹499 via UPI & Enter Transaction Reference (UTR)
              </h3>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                hasPaid499WithRef
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {hasPaid499WithRef ? '✓ ₹499 UTR Entered' : '₹499 UTR Required'}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            A seller can only send a request for Admin Verification after paying{' '}
            <strong className="text-white">₹499 (30-Day Subscription)</strong> to UPI ID{' '}
            <strong className="text-orange-400">{UPI_ID}</strong> and entering the 12-digit UPI Transaction Reference Number below.
          </p>

          <div className="bg-white/10 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 border border-white/10">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                Official Merchant UPI ID (Pay ₹499)
              </span>
              <span className="text-base font-black font-mono text-orange-400">{UPI_ID}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(UPI_ID).catch(() => {});
                  setCopiedUpi(true);
                  setTimeout(() => setCopiedUpi(false), 2000);
                }}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
              >
                {copiedUpi ? <Check size={13} /> : <Copy size={13} />}
                {copiedUpi ? 'Copied' : 'Copy UPI ID'}
              </button>
              <a
                href={`upi://pay?pa=${UPI_ID}&pn=Food%20India&am=499.00&cu=INR&tn=FoodIndia_Seller_499`}
                className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider"
              >
                Pay ₹499 via UPI App
              </a>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-orange-300">
              UPI Transaction Reference Number (12-Digit UTR / Ref ID) *
            </label>
            <input
              type="text"
              required
              value={upiTransactionRefInput}
              onChange={(e) => setUpiTransactionRefInput(e.target.value)}
              placeholder="Enter 12-digit UPI Transaction Ref (e.g. 412389012345)"
              className="w-full h-12 px-4 bg-slate-950 border border-slate-700 focus:border-orange-500 rounded-2xl text-xs font-mono font-bold text-white outline-none"
            />
          </div>
        </div>

        {/* KYC License Numbers Form (Business License, FSSAI License, Aadhaar / PAN) */}
        <form
          onSubmit={handleSaveKycNumbers}
          className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <CreditCard size={16} className="text-orange-500" />
              Step 2: Official KYC License & Identity Numbers
            </h4>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg font-bold">
              Synced to Admin Dashboard
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                1. Business License / GST Registration Number
              </label>
              <input
                type="text"
                value={businessLicenseNumber}
                onChange={(e) => setBusinessLicenseNumber(e.target.value)}
                onBlur={() => handleSaveKycNumbers()}
                placeholder="e.g. 27AABCU9603R1ZM or Shop Act License No."
                className="w-full h-12 px-4 bg-slate-50 rounded-2xl text-xs font-bold border border-slate-200 focus:border-orange-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                2. FSSAI Food Safety License Number (14-Digit)
              </label>
              <input
                type="text"
                value={fssaiLicenseNumber}
                onChange={(e) => setFssaiLicenseNumber(e.target.value)}
                onBlur={() => handleSaveKycNumbers()}
                placeholder="e.g. 11523001000456"
                className="w-full h-12 px-4 bg-slate-50 rounded-2xl text-xs font-bold border border-slate-200 focus:border-orange-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                3. Aadhaar Card or PAN Card Number
              </label>
              <input
                type="text"
                value={aadhaarOrPanNumber}
                onChange={(e) => setAadhaarOrPanNumber(e.target.value)}
                onBlur={() => handleSaveKycNumbers()}
                placeholder="e.g. ABCDE1234F (PAN) or 1234 5678 9012 (Aadhaar)"
                className="w-full h-12 px-4 bg-slate-50 rounded-2xl text-xs font-bold border border-slate-200 focus:border-orange-500 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingKyc}
            className="w-full py-3.5 bg-slate-900 hover:bg-orange-600 disabled:opacity-60 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            {savingKyc ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Saving KYC Numbers to Profile...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={15} />
                <span>Save License & Aadhaar/PAN Numbers to Profile</span>
              </>
            )}
          </button>
        </form>

        {/* Fast Upload Section */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck size={16} className="text-orange-500" />
              Step 3: Exact Document File Upload (PDF / JPG / PNG)
            </h4>
            <button
              type="button"
              disabled={uploading}
              onClick={handleQuickSampleUpload}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
            >
              <Zap size={12} />
              Instant Test PDF ({getDocTypeLabel(selectedDocType).split(' ')[0]})
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              1. Select Document Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['id_proof', 'fssai_license', 'gst_certificate'] as const).map((type) => {
                const alreadyUploaded = documents.some((d) => d.documentType === type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedDocType(type)}
                    className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      selectedDocType === type
                        ? 'border-orange-500 bg-orange-50/70'
                        : 'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div>
                      <span
                        className={`text-xs font-bold block ${
                          selectedDocType === type ? 'text-orange-600' : 'text-slate-700'
                        }`}
                      >
                        {getDocTypeLabel(type)}
                      </span>
                      {alreadyUploaded && (
                        <span className="text-[10px] font-black text-emerald-600 uppercase">
                          ✓ Uploaded
                        </span>
                      )}
                    </div>
                    {selectedDocType === type && (
                      <div className="w-2.5 h-2.5 bg-orange-500 rounded-full shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              2. Choose File to Upload Immediately (Downloads as Exact Same File in Admin)
            </label>
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                disabled={uploading}
                accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
              />
              <div className="w-full py-7 px-4 border-2 border-dashed border-orange-200 rounded-[24px] flex flex-col items-center justify-center gap-2 bg-orange-50/30 hover:bg-orange-50/60 transition-colors">
                <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-md shadow-orange-200">
                  {uploading ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} />}
                </div>
                <p className="text-xs font-black text-slate-800 uppercase tracking-wider text-center">
                  {uploading
                    ? 'Uploading Exact File to Firestore...'
                    : `Tap Here to Upload ${getDocTypeLabel(selectedDocType)}`}
                </p>
                <p className="text-[11px] text-slate-500 font-medium text-center">
                  Supports PDF, JPG, JPEG, PNG • Preserves exact original file for Admin download
                </p>
              </div>
            </div>
          </div>

          {uploadMessage && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                uploadMessage.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-600 border border-red-200'
              }`}
            >
              {uploadMessage.type === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0" />
              ) : (
                <AlertCircle size={16} className="shrink-0" />
              )}
              <span>{uploadMessage.text}</span>
            </div>
          )}

          {/* Step 4: Submit Request for Admin Verification (Gated by ₹499 UTR) */}
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSubmitVerificationRequest}
              disabled={submittingRequest || !hasPaid499WithRef}
              className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all ${
                hasPaid499WithRef
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              {submittingRequest ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Sending Verification Request to Admin...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>
                    {hasPaid499WithRef
                      ? `Submit Request for Admin Verification (UTR: ${effectiveUpiRef})`
                      : 'Enter ₹499 UPI Transaction Ref Above to Request Verification'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Document List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
              Permanent Documents in Database ({documents.length})
            </h4>
            <span className="text-[10px] font-mono text-slate-400">Collection: sellerDocuments</span>
          </div>
          <div className="space-y-3">
            {documents.map((docItem) => (
              <div
                key={docItem.documentId}
                className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {docItem.fileDataUrl && docItem.fileDataUrl.startsWith('data:image/') ? (
                    <img
                      src={docItem.fileDataUrl}
                      alt={docItem.fileName || docItem.documentType}
                      className="w-12 h-12 rounded-2xl object-cover border border-slate-100 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 shrink-0">
                      <FileText size={24} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h5 className="text-xs font-black text-slate-900 truncate">
                      {getDocTypeLabel(docItem.documentType)}
                    </h5>
                    {docItem.documentNumber && (
                      <p className="text-[11px] font-mono font-bold text-orange-600">
                        License / ID No: {docItem.documentNumber}
                      </p>
                    )}
                    {docItem.fileName && (
                      <p className="text-[11px] text-slate-600 font-semibold truncate">
                        {docItem.fileName}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">
                      Uploaded{' '}
                      {docItem.uploadedAt?.toDate
                        ? docItem.uploadedAt.toDate().toLocaleString()
                        : 'Just now'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                      docItem.verificationStatus === 'verified'
                        ? 'bg-green-100 text-green-600'
                        : docItem.verificationStatus === 'rejected'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-orange-100 text-orange-600'
                    }`}
                  >
                    {docItem.verificationStatus}
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadSellerDocumentFile(docItem)}
                    className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    title="Download Exact Document"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDoc(docItem)}
                    className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                    title="Delete Document"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {documents.length === 0 && (
              <div className="text-center py-10 bg-white rounded-[32px] border border-slate-100 border-dashed space-y-2">
                <p className="text-xs text-slate-400 font-medium italic">
                  No documents uploaded yet.
                </p>
                <button
                  type="button"
                  onClick={handleQuickSampleUpload}
                  className="px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                >
                  Upload Instant Sample PDF Document
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

