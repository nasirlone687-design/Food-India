import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Copy,
  Check,
  Trash2,
  X,
  Bug,
  ChevronUp,
  Terminal,
  Database,
  CheckCircle2,
  Clock,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

import { collection, addDoc, onSnapshot, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

export interface AppErrorEntry {
  id: string;
  timestamp: string;
  createdAtMs?: number;
  source: 'runtime' | 'promise' | 'console' | 'react' | 'gps' | 'app' | 'button' | 'backend';
  message: string;
  details?: string;
  buttonName?: string;
  backendPath?: string;
  dbUpdated?: 'UPDATED' | 'NOT_UPDATED' | 'PENDING';
  suggestion?: string;
  statusType?: 'error' | 'success' | 'warning' | 'pending';
  actorRole?: string;
  actorEmail?: string;
  screenPath?: string;
}

export interface ButtonStatusPayload {
  buttonName: string;
  backendPath: string;
  dbUpdated: 'UPDATED' | 'NOT_UPDATED' | 'PENDING' | boolean;
  statusType?: 'success' | 'error' | 'warning' | 'pending';
  status?: 'success' | 'error' | 'warning' | 'pending';
  screen?: string;
  message: string;
  suggestion?: string;
  details?: string;
}

interface ErrorLogContextType {
  errors: AppErrorEntry[];
  actionLogs: AppErrorEntry[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  logError: (
    message: string,
    details?: string,
    source?: AppErrorEntry['source'],
    meta?: Partial<ButtonStatusPayload>
  ) => void;
  logButtonStatus: (payload: ButtonStatusPayload) => void;
  clearErrors: () => void;
  copyText: (text: string) => Promise<boolean>;
}

const ErrorLogContext = createContext<ErrorLogContextType>({
  errors: [],
  actionLogs: [],
  isOpen: false,
  setIsOpen: () => {},
  logError: () => {},
  logButtonStatus: () => {},
  clearErrors: () => {},
  copyText: async () => false,
});

export const useErrorLog = () => useContext(ErrorLogContext);

// Global helper so non-React services can also push errors and button status logs
type Listener = (entry: AppErrorEntry) => void;
const globalErrorListeners = new Set<Listener>();
const initialErrorBuffer: AppErrorEntry[] = [];

export function isIgnoredEnvNoise(message?: string, details?: string): boolean {
  const combined = `${message || ''}\n${details || ''}`.toLowerCase();
  if (
    combined.includes('@vite/client') ||
    combined.includes('[vite]') ||
    combined.includes('websocket closed without opened') ||
    combined.includes('failed to connect to websocket') ||
    combined.includes('appErrorLogs')
  ) {
    return true;
  }
  return false;
}

function normalizeDbUpdated(val: any): 'UPDATED' | 'NOT_UPDATED' | 'PENDING' {
  if (val === true || val === 'UPDATED') return 'UPDATED';
  if (val === 'PENDING') return 'PENDING';
  return 'NOT_UPDATED';
}

function detectCurrentActorContext(explicitScreen?: string) {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const role = path.startsWith('/admin')
    ? 'admin'
    : path.startsWith('/seller')
    ? 'seller'
    : 'customer';
  const email = auth?.currentUser?.email || auth?.currentUser?.uid || 'guest';
  return {
    actorRole: role,
    actorEmail: email,
    screenPath: explicitScreen || path,
  };
}

function persistLogEntryToFirestore(entry: AppErrorEntry) {
  try {
    addDoc(collection(db, 'appErrorLogs'), {
      logId: entry.id,
      timestamp: entry.timestamp,
      createdAtMs: entry.createdAtMs || Date.now(),
      source: entry.source,
      message: entry.message.slice(0, 1500),
      details: entry.details ? entry.details.slice(0, 2000) : '',
      buttonName: entry.buttonName || '',
      backendPath: entry.backendPath || 'Firestore Database',
      dbUpdated: entry.dbUpdated || 'NOT_UPDATED',
      suggestion: entry.suggestion || '',
      statusType: entry.statusType || 'error',
      actorRole: entry.actorRole || 'customer',
      actorEmail: entry.actorEmail || 'guest',
      screenPath: entry.screenPath || '/',
    }).catch(() => {});
  } catch {
    // Ignore persistence error
  }
}

export function inferSuggestionForError(message: string, buttonName?: string): string {
  const lower = `${message} ${buttonName || ''}`.toLowerCase();
  if (
    lower.includes('auth/invalid-credential') ||
    lower.includes('auth/invalid-login-credentials') ||
    lower.includes('auth/wrong-password') ||
    lower.includes('auth/user-not-found')
  ) {
    return 'What to enter: Enter the registered email and password (minimum 6 characters), or click "Register Now" to create a new account.';
  }
  if (lower.includes('auth/email-already-in-use')) {
    return 'What to do: This email is already registered. Please sign in with your password or use Google Sign-In.';
  }
  if (lower.includes('auth/weak-password')) {
    return 'What to enter: Password must be at least 6 characters long.';
  }
  if (lower.includes('gps') || lower.includes('geolocation') || lower.includes('permission denied')) {
    return 'What to do: Browser blocked live GPS in iframe. Enter your 6-digit Indian PIN code (e.g., 110001, 400001, 560001) and click "Auto-Fill from PIN", or drag the map pin / type State, City, District manually.';
  }
  if (lower.includes('phone') || lower.includes('contact')) {
    return 'What to enter: Enter a valid 10-digit Indian mobile/landline number, e.g., +91 9876543210 or 9876543210.';
  }
  if (lower.includes('pin') || lower.includes('postal')) {
    return 'What to enter: Enter a valid 6-digit Indian PIN code, e.g., 110001 (New Delhi), 400001 (Mumbai), 560001 (Bengaluru), 190001 (Srinagar).';
  }
  if (lower.includes('state') || lower.includes('city') || lower.includes('district')) {
    return 'What to enter: State (e.g., Delhi, Maharashtra, Karnataka), City (e.g., New Delhi, Mumbai, Bengaluru), District (e.g., Central Delhi, Mumbai Suburban).';
  }
  if (lower.includes('slab') || lower.includes('range') || lower.includes('pricing')) {
    return 'What to enter: For Distance Slabs, enter Min km (e.g., 0), Max km (e.g., 5), and ₹ Fee (e.g., 30). For Base + Per Km, enter Base Fee (e.g., ₹25) and Per Km Rate (e.g., ₹8).';
  }
  if (lower.includes('document') || lower.includes('upload') || lower.includes('kyc') || lower.includes('fssai')) {
    return 'What to enter: Select Document Type (ID Proof, FSSAI License, or GST Certificate) and choose any PDF, JPG, or PNG file.';
  }
  if (lower.includes('permission') || lower.includes('insufficient')) {
    return 'What to do: Ensure you are signed in with your Seller/Admin account. Firestore security rules require matching sellerId/uid.';
  }
  return 'What to enter: Verify all required form fields and try again.';
}

export function reportGlobalError(
  message: string,
  details?: string,
  source: AppErrorEntry['source'] = 'app',
  meta?: Partial<ButtonStatusPayload>
) {
  if (isIgnoredEnvNoise(message, details)) {
    return;
  }

  const ctx = detectCurrentActorContext(meta?.screen);
  const normalizedDb = meta?.dbUpdated !== undefined ? normalizeDbUpdated(meta.dbUpdated) : 'NOT_UPDATED';
  const resolvedStatus = meta?.statusType || meta?.status || 'error';

  const entry: AppErrorEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    createdAtMs: Date.now(),
    source,
    message: String(message || 'Unknown Error'),
    details: details ? String(details) : undefined,
    buttonName: meta?.buttonName,
    backendPath: meta?.backendPath || (source === 'gps' ? 'Browser Geolocation API + Nominatim Reverse Geocode' : 'App Runtime / Firestore'),
    dbUpdated: normalizedDb,
    suggestion: meta?.suggestion || inferSuggestionForError(String(message || ''), meta?.buttonName),
    statusType: resolvedStatus,
    actorRole: ctx.actorRole,
    actorEmail: ctx.actorEmail,
    screenPath: ctx.screenPath,
  };

  persistLogEntryToFirestore(entry);

  if (globalErrorListeners.size === 0) {
    initialErrorBuffer.push(entry);
  } else {
    globalErrorListeners.forEach((fn) => fn(entry));
  }
}

export function reportGlobalButtonStatus(payload: ButtonStatusPayload) {
  const ctx = detectCurrentActorContext(payload.screen);
  const normalizedDb = normalizeDbUpdated(payload.dbUpdated);
  const resolvedStatus =
    payload.statusType || payload.status || (normalizedDb === 'UPDATED' ? 'success' : 'error');

  const entry: AppErrorEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    createdAtMs: Date.now(),
    source: 'button',
    message: payload.message,
    details: payload.details,
    buttonName: payload.buttonName,
    backendPath: payload.backendPath,
    dbUpdated: normalizedDb,
    suggestion: payload.suggestion || inferSuggestionForError(payload.message, payload.buttonName),
    statusType: resolvedStatus,
    actorRole: ctx.actorRole,
    actorEmail: ctx.actorEmail,
    screenPath: ctx.screenPath,
  };

  persistLogEntryToFirestore(entry);

  if (globalErrorListeners.size === 0) {
    initialErrorBuffer.push(entry);
  } else {
    globalErrorListeners.forEach((fn) => fn(entry));
  }
}

function serializeArg(arg: any): string {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`;
  }
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

// Install global interceptors once at module load
let interceptorsInstalled = false;
function installGlobalErrorInterceptors() {
  if (interceptorsInstalled || typeof window === 'undefined') return;
  interceptorsInstalled = true;

  window.addEventListener('error', (event) => {
    const msg = event.message || 'Uncaught Window Error';
    const stack = event.error?.stack || `${event.filename || ''}:${event.lineno || ''}:${event.colno || ''}`;
    if (isIgnoredEnvNoise(msg, stack)) return;
    reportGlobalError(msg, stack, 'runtime');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg =
      reason instanceof Error
        ? `${reason.name}: ${reason.message}`
        : typeof reason === 'string'
        ? reason
        : 'Unhandled Promise Rejection';
    const details = reason instanceof Error ? reason.stack : serializeArg(reason);
    if (isIgnoredEnvNoise(msg, details)) return;
    reportGlobalError(msg, details, 'promise');
  });

  const origConsoleError = console.error.bind(console);
  console.error = (...args: any[]) => {
    origConsoleError(...args);
    try {
      const joined = args.map(serializeArg).join(' ');
      if (!joined) return;
      const lines = joined.split('\n');
      const head = lines[0] || 'Console Error';
      const rest = lines.slice(1).join('\n') || undefined;
      if (isIgnoredEnvNoise(head, rest)) return;
      const src: AppErrorEntry['source'] =
        head.toLowerCase().includes('gps') || head.toLowerCase().includes('geolocation')
          ? 'gps'
          : 'console';
      reportGlobalError(head, rest, src);
    } catch {
      // Never break console.error
    }
  };
}

installGlobalErrorInterceptors();

export async function copyToClipboardSafe(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback to textarea copy for iframe environments
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export const CopiableErrorAlert: React.FC<{
  error: string | null | undefined;
  className?: string;
  dark?: boolean;
}> = ({ error, className = '', dark = false }) => {
  const { setIsOpen } = useErrorLog();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (error) {
      reportGlobalError(error, undefined, 'app');
    }
  }, [error]);

  if (!error) return null;

  const suggestion = inferSuggestionForError(error);
  const isOnAdminPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  if (!isOnAdminPage) {
    return (
      <div
        className={`p-3.5 rounded-2xl border flex items-center gap-2.5 text-xs font-semibold ${
          dark
            ? 'bg-red-500/15 border-red-500/30 text-red-300'
            : 'bg-red-50 border-red-200 text-red-700'
        } ${className}`}
      >
        <AlertTriangle className="shrink-0 w-4 h-4 text-red-500" />
        <p className="break-words">{error}</p>
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-2xl border flex flex-col gap-2 text-sm ${
        dark
          ? 'bg-red-500/15 border-red-500/30 text-red-300'
          : 'bg-red-50 border-red-200 text-red-700'
      } ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-[180px]">
          <AlertTriangle className="shrink-0 w-5 h-5 mt-0.5 text-red-500" />
          <p className="font-semibold break-words select-all">{error}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={async () => {
              await copyToClipboardSafe(`${error}\n${suggestion}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1 border ${
              dark
                ? 'bg-red-950 border-red-700 text-red-200 hover:bg-red-900'
                : 'bg-white border-red-200 text-red-600 hover:bg-red-100'
            }`}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="px-2.5 py-1 rounded-lg text-xs font-black bg-red-600 hover:bg-red-700 text-white flex items-center gap-1"
          >
            <Bug size={13} />
            Log Window
          </button>
        </div>
      </div>
      <div className="text-xs bg-white/70 text-slate-700 px-3 py-1.5 rounded-xl font-medium border border-red-100">
        💡 {suggestion}
      </div>
    </div>
  );
};

const FIELD_SUGGESTIONS_GUIDE = [
  {
    buttonOrField: 'CONTACT PHONE',
    backendLinked: 'Firestore: restaurants/{restaurantId}.phone & sellers/{uid}.phone',
    whatToEnter: 'Enter 10-digit Indian mobile/landline number (e.g., +91 9876543210 or 9876543210). Auto-saves on blur or when clicking Save.',
  },
  {
    buttonOrField: 'STATE / CITY / DISTRICT / PIN CODE',
    backendLinked: 'Firestore: restaurants/{restaurantId} (state, city, locality, district, postalCode, pincode) & sellers/{uid}',
    whatToEnter: 'Enter State (e.g., Delhi), City (e.g., New Delhi), District (e.g., Central Delhi), and 6-digit PIN Code (e.g., 110001). Click "Auto-Fill from PIN" to populate automatically.',
  },
  {
    buttonOrField: "Allow Restaurant's Own Delivery Staff (ENABLED / DISABLED)",
    backendLinked: 'Firestore: restaurants/{restaurantId}.allowOwnDeliveryStaff & sellers/{uid}.allowOwnDeliveryStaff',
    whatToEnter: 'Click button to toggle ENABLED or DISABLED. Updates Firestore database immediately on click.',
  },
  {
    buttonOrField: 'DELIVERY PRICING MODE (BASE + PER KM / DISTANCE SLABS)',
    backendLinked: 'Firestore: restaurants/{restaurantId}.deliveryPricingMode ("base_km" | "range")',
    whatToEnter: 'Select "Base + Per Km" (enter Base Fee ₹20-₹40 & Per Km ₹5-₹12) OR "Distance Slabs" (configure km ranges). Updates database immediately on click.',
  },
  {
    buttonOrField: 'DISTANCE SLABS (KM → ₹) & "+ Add Slab"',
    backendLinked: 'Firestore: restaurants/{restaurantId}.deliveryRanges (Array of { minKm, maxKm, price })',
    whatToEnter: 'Click "+ Add Slab" and enter Min Km (e.g., 0), Max Km (e.g., 5), and ₹ Fee (e.g., 30). Add more slabs like 5 to 10 km → ₹50.',
  },
  {
    buttonOrField: 'SAVE KITCHEN, DELIVERY & HOURS',
    backendLinked: 'Firestore: restaurants/{restaurantId} & sellers/{uid} & users/{uid}',
    whatToEnter: 'Saves Restaurant Name, Contact Phone, Description, Prep Time, GPS Coordinates, State, City, District, PIN Code, Own Delivery Staff toggle, Pricing Mode, Distance Slabs, and Opening Hours to Firestore.',
  },
  {
    buttonOrField: 'UPLOAD DOCUMENT (KYC / FSSAI / GST)',
    backendLinked: 'Firestore: sellerDocuments/{docId} & sellers/{uid}.lastDocumentUploadedAt',
    whatToEnter: 'Choose ID Proof (Aadhar/PAN), FSSAI License, or GST Certificate and select a PDF/JPG/PNG file.',
  },
];

export const ErrorLogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [localEntries, setLocalEntries] = useState<AppErrorEntry[]>(() => [...initialErrorBuffer]);
  const [remoteEntries, setRemoteEntries] = useState<AppErrorEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'all' | 'buttons' | 'errors' | 'guide'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedToast, setExpandedToast] = useState(true);
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncPath = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', syncPath);
    const interval = window.setInterval(syncPath, 500);
    return () => {
      window.removeEventListener('popstate', syncPath);
      window.clearInterval(interval);
    };
  }, []);

  const isAdminSection = pathname === '/admin' || pathname.startsWith('/admin/');

  useEffect(() => {
    const handler: Listener = (entry) => {
      setLocalEntries((prev) => {
        if (
          prev.length > 0 &&
          prev[0].message === entry.message &&
          prev[0].timestamp === entry.timestamp &&
          prev[0].buttonName === entry.buttonName
        ) {
          return prev;
        }
        return [entry, ...prev].slice(0, 150);
      });
      if (entry.statusType === 'error' || entry.source !== 'button') {
        setExpandedToast(true);
      }
    };
    globalErrorListeners.add(handler);
    return () => {
      globalErrorListeners.delete(handler);
    };
  }, []);

  // When in Admin Section, subscribe to appErrorLogs in Firestore so Admin sees ALL customer, seller & admin logs across the whole app
  useEffect(() => {
    if (!isAdminSection) return;
    const unsub = onSnapshot(
      collection(db, 'appErrorLogs'),
      (snap) => {
        const list: AppErrorEntry[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: data.logId || d.id,
            timestamp: data.timestamp || '',
            createdAtMs: Number(data.createdAtMs || 0),
            source: data.source || 'app',
            message: data.message || '',
            details: data.details || undefined,
            buttonName: data.buttonName || undefined,
            backendPath: data.backendPath || 'Firestore Database',
            dbUpdated: normalizeDbUpdated(data.dbUpdated),
            suggestion: data.suggestion || undefined,
            statusType: data.statusType || 'error',
            actorRole: data.actorRole || 'customer',
            actorEmail: data.actorEmail || '',
            screenPath: data.screenPath || '/',
          };
        });
        list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        setRemoteEntries(list.slice(0, 200));
      },
      () => {}
    );
    return () => unsub();
  }, [isAdminSection]);

  const entries = React.useMemo(() => {
    const map = new Map<string, AppErrorEntry>();
    for (const item of [...remoteEntries, ...localEntries]) {
      const key = `${item.timestamp}_${item.buttonName || ''}_${item.message}`;
      if (!map.has(key)) {
        map.set(key, item);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
      .slice(0, 200);
  }, [remoteEntries, localEntries]);

  const logError = useCallback(
    (
      message: string,
      details?: string,
      source: AppErrorEntry['source'] = 'app',
      meta?: Partial<ButtonStatusPayload>
    ) => {
      reportGlobalError(message, details, source, meta);
    },
    []
  );

  const logButtonStatus = useCallback((payload: ButtonStatusPayload) => {
    reportGlobalButtonStatus(payload);
  }, []);

  const clearErrors = useCallback(async () => {
    setLocalEntries([]);
    setRemoteEntries([]);
    try {
      const snap = await getDocs(collection(db, 'appErrorLogs'));
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'appErrorLogs', d.id)).catch(() => {});
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleCopy = async (id: string, text: string) => {
    await copyToClipboardSafe(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
  };

  const errors = entries.filter((e) => e.statusType === 'error' || (e.source !== 'button' && e.statusType !== 'success'));
  const actionLogs = entries.filter((e) => e.source === 'button' || e.buttonName);

  const formatSingleEntry = (e: AppErrorEntry) => {
    const roleTag = e.actorRole ? ` [${e.actorRole.toUpperCase()}${e.screenPath ? ` ${e.screenPath}` : ''}]` : '';
    const lines = [
      `[${e.timestamp}] [${(e.statusType || e.source).toUpperCase()}]${roleTag} ${e.buttonName ? `BUTTON: "${e.buttonName}" — ` : ''}${e.message}`,
      `Backend Linked: ${e.backendPath || 'Firestore Database'}`,
      `Database Status: ${
        e.dbUpdated === 'UPDATED'
          ? 'DB UPDATED ✅'
          : e.dbUpdated === 'PENDING'
          ? 'UPDATING DB ⏳'
          : 'DB NOT UPDATED ❌'
      }`,
    ];
    if (e.suggestion) {
      lines.push(`Suggestion (What to Enter): ${e.suggestion}`);
    }
    if (e.details) {
      lines.push(`Details:\n${e.details}`);
    }
    return lines.join('\n');
  };

  const filteredEntries =
    activeModalTab === 'errors'
      ? errors
      : activeModalTab === 'buttons'
      ? actionLogs
      : entries;

  const allEntriesText = (filteredEntries.length > 0 ? filteredEntries : entries)
    .map(formatSingleEntry)
    .join('\n\n----------------------------------------\n\n');

  const latestEntry = entries[0] || null;

  return (
    <ErrorLogContext.Provider
      value={{
        errors,
        actionLogs,
        isOpen,
        setIsOpen,
        logError,
        logButtonStatus,
        clearErrors,
        copyText: copyToClipboardSafe,
      }}
    >
      {children}

      {/* Floating In-App Status & Error Pill — Shown ONLY in Admin Section */}
      {isAdminSection && (
      <div className="fixed bottom-20 right-3 z-[90] flex flex-col items-end gap-2 max-w-[calc(100vw-24px)] sm:max-w-md pointer-events-none">
        {latestEntry && expandedToast && !isOpen && (
          <div
            className={`pointer-events-auto w-full rounded-2xl p-3 shadow-2xl backdrop-blur-md border animate-in fade-in slide-in-from-bottom-2 ${
              latestEntry.statusType === 'success'
                ? 'bg-emerald-950/95 text-white border-emerald-500/40'
                : latestEntry.statusType === 'warning'
                ? 'bg-amber-950/95 text-white border-amber-500/40'
                : 'bg-red-950/95 text-white border-red-500/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                {latestEntry.statusType === 'success' ? (
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                )}
                <span>
                  {latestEntry.buttonName ? `Button: ${latestEntry.buttonName}` : `Log (${latestEntry.source})`} •{' '}
                  {latestEntry.dbUpdated === 'UPDATED'
                    ? 'DB UPDATED ✅'
                    : latestEntry.dbUpdated === 'PENDING'
                    ? 'UPDATING ⏳'
                    : 'DB NOT UPDATED ❌'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleCopy(latestEntry.id, formatSingleEntry(latestEntry))}
                  className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-bold flex items-center gap-1"
                >
                  {copiedId === latestEntry.id ? <Check size={11} /> : <Copy size={11} />}
                  {copiedId === latestEntry.id ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(true)}
                  className="px-2 py-0.5 bg-orange-500 hover:bg-orange-600 text-white rounded text-[10px] font-bold"
                >
                  Console
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedToast(false)}
                  className="p-0.5 text-white/70 hover:text-white"
                  title="Dismiss toast"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
            <p className="text-xs font-mono text-white/95 mt-1 line-clamp-2 break-words">
              {latestEntry.message}
            </p>
            {latestEntry.backendPath && (
              <p className="text-[10px] font-mono text-orange-300 mt-1 truncate">
                Backend: {latestEntry.backendPath}
              </p>
            )}
            {latestEntry.suggestion && (
              <p className="text-[10px] text-amber-200 mt-1 line-clamp-2">
                💡 {latestEntry.suggestion}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`pointer-events-auto flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-black shadow-lg border transition-all active:scale-95 ${
            errors.length > 0
              ? 'bg-red-600 hover:bg-red-700 text-white border-red-400 shadow-red-600/30'
              : actionLogs.length > 0
              ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-500'
              : 'bg-slate-900/90 hover:bg-slate-900 text-slate-200 border-slate-700'
          }`}
          title="Open Button Status, Backend DB & Error Console"
        >
          <Bug size={14} className={errors.length > 0 ? 'animate-bounce' : 'text-orange-400'} />
          <span>
            Status & Errors ({entries.length})
          </span>
          {entries.length > 0 && expandedToast === false && <ChevronUp size={12} />}
        </button>
      </div>
      )}

      {/* Copiable Button Status, Database Sync & Error Console Modal — Shown ONLY in Admin Section */}
      {isAdminSection && isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
          <div className="bg-slate-900 text-slate-100 border border-slate-700 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <Terminal size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">
                    Button Status, Backend DB Link & Error Console ({entries.length})
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Shows every button click, linked Firestore backend path, DB update status & what to enter
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Tabs & Action Toolbar */}
            <div className="px-5 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveModalTab('all')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider ${
                    activeModalTab === 'all' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  All Logs ({entries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('buttons')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider ${
                    activeModalTab === 'buttons' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  Button & DB Status ({actionLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('errors')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider ${
                    activeModalTab === 'errors' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  Errors ({errors.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('guide')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1 ${
                    activeModalTab === 'guide' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <HelpCircle size={12} />
                  What to Enter Guide
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={entries.length === 0}
                  onClick={() => handleCopy('all', allEntriesText)}
                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                >
                  {copiedId === 'all' ? <Check size={13} /> : <Copy size={13} />}
                  {copiedId === 'all' ? 'Copied All!' : 'Copy All Logs'}
                </button>
                <button
                  type="button"
                  disabled={entries.length === 0}
                  onClick={clearErrors}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Trash2 size={13} />
                  Clear
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeModalTab === 'guide' ? (
                <div className="space-y-3">
                  <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-start gap-2.5">
                    <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                        Seller Dashboard Buttons, Linked Firestore Collections & What to Enter
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Every button and input in the Seller Profile & Verification screen is directly linked to Firebase Firestore. Here is what each button updates and recommended values to enter:
                      </p>
                    </div>
                  </div>
                  {FIELD_SUGGESTIONS_GUIDE.map((item, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-black text-orange-400 uppercase tracking-wider">
                          {item.buttonOrField}
                        </span>
                        <span className="text-[10px] font-mono bg-slate-900 text-emerald-300 px-2 py-0.5 rounded-lg border border-slate-800">
                          {item.backendLinked}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        <strong className="text-white">What to enter:</strong> {item.whatToEnter}
                      </p>
                    </div>
                  ))}
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <Database size={24} />
                  </div>
                  <p className="text-sm font-bold text-slate-200">No logs recorded in this view yet</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Click any button in Seller Profile (e.g., Allow Own Delivery Staff, Delivery Pricing Mode, Add Slab, Upload Document, or Save Kitchen, Delivery & Hours) to see live database update confirmation and suggestions here.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveModalTab('guide')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                  >
                    View What to Enter Guide
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5">
                    {filteredEntries.map((err) => {
                      const formatted = formatSingleEntry(err);
                      const isCopied = copiedId === err.id;
                      const isSuccess = err.statusType === 'success' || err.dbUpdated === 'UPDATED';
                      const isPending = err.statusType === 'pending' || err.dbUpdated === 'PENDING';

                      return (
                        <div
                          key={err.id}
                          className={`bg-slate-950 border rounded-2xl p-3.5 space-y-2 ${
                            isSuccess
                              ? 'border-emerald-500/30'
                              : isPending
                              ? 'border-amber-500/30'
                              : 'border-red-500/30'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                                  isSuccess
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                    : isPending
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    : 'bg-red-500/20 text-red-300 border-red-500/30'
                                }`}
                              >
                                {err.buttonName ? `BUTTON: ${err.buttonName}` : err.source}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase flex items-center gap-1 ${
                                  err.dbUpdated === 'UPDATED'
                                    ? 'bg-emerald-900/60 text-emerald-200'
                                    : err.dbUpdated === 'PENDING'
                                    ? 'bg-amber-900/60 text-amber-200'
                                    : 'bg-red-900/60 text-red-200'
                                }`}
                              >
                                {err.dbUpdated === 'UPDATED' ? (
                                  <CheckCircle2 size={11} />
                                ) : err.dbUpdated === 'PENDING' ? (
                                  <Clock size={11} />
                                ) : (
                                  <AlertTriangle size={11} />
                                )}
                                {err.dbUpdated === 'UPDATED'
                                  ? 'DB UPDATED'
                                  : err.dbUpdated === 'PENDING'
                                  ? 'UPDATING DB...'
                                  : 'DB NOT UPDATED'}
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                {err.timestamp}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopy(err.id, formatted)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
                                isCopied
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                              }`}
                            >
                              {isCopied ? <Check size={12} /> : <Copy size={12} />}
                              {isCopied ? 'Copied!' : 'Copy'}
                            </button>
                          </div>

                          {err.backendPath && (
                            <div className="text-[11px] font-mono text-orange-300 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
                              <strong className="text-slate-400">Linked Backend:</strong> {err.backendPath}
                            </div>
                          )}

                          <pre
                            className={`text-xs font-mono whitespace-pre-wrap break-words select-all bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 ${
                              isSuccess ? 'text-emerald-200' : isPending ? 'text-amber-200' : 'text-red-200'
                            }`}
                          >
                            {err.message}
                          </pre>

                          {err.suggestion && (
                            <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
                              <strong>Suggestion / What to Enter:</strong> {err.suggestion}
                            </div>
                          )}

                          {err.details && (
                            <details className="group">
                              <summary className="text-[11px] font-bold text-slate-400 cursor-pointer hover:text-slate-200 select-none">
                                Show Payload / Technical Details
                              </summary>
                              <pre className="mt-1.5 text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-words select-all bg-black/50 p-2.5 rounded-xl border border-slate-800 max-h-48 overflow-y-auto">
                                {err.details}
                              </pre>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Full Selectable & Copiable Raw Log Box */}
                  <div className="pt-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Raw Copiable Status & Error Log (Tap & Copy)
                    </label>
                    <textarea
                      readOnly
                      value={allEntriesText}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full h-32 bg-slate-950 text-slate-200 font-mono text-[11px] p-3 rounded-2xl border border-slate-800 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </ErrorLogContext.Provider>
  );
};

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  copied: boolean;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    reportGlobalError(
      `${error.name}: ${error.message}`,
      `${error.stack || ''}\n${errorInfo.componentStack || ''}`,
      'react'
    );
  }

  handleCopyCrash = async () => {
    const { error, errorInfo } = this.state;
    const text = `${error?.name || 'Error'}: ${error?.message || ''}\n\nStack:\n${error?.stack || ''}\n\nComponent Stack:\n${errorInfo?.componentStack || ''}`;
    await copyToClipboardSafe(text);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      const fullCrashText = `${this.state.error?.name || 'Error'}: ${this.state.error?.message || ''}\n${this.state.error?.stack || ''}\n${this.state.errorInfo?.componentStack || ''}`;
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-slate-900 border border-red-500/40 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400 font-black text-sm uppercase tracking-wider">
                <AlertTriangle size={20} />
                <span>Application Render Error</span>
              </div>
              <button
                type="button"
                onClick={this.handleCopyCrash}
                className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5"
              >
                {this.state.copied ? <Check size={14} /> : <Copy size={14} />}
                {this.state.copied ? 'Copied!' : 'Copy Error'}
              </button>
            </div>
            <textarea
              readOnly
              value={fullCrashText}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full h-56 bg-slate-950 text-red-200 font-mono text-xs p-3 rounded-2xl border border-slate-800 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-white text-slate-900 font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-100"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
