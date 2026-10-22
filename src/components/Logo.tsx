import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Utensils, Flame, Sparkles } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showText = true, className = '' }) => {
  const navigate = useNavigate();
  const [holdProgress, setHoldProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const startHold = () => {
    const startTime = Date.now();
    const duration = 10000; // 10 seconds to unlock Admin Portal

    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setHoldProgress(progress);

      if (elapsed >= duration) {
        clearTimers();
        navigate('/admin-auth');
      }
    }, 100);
  };

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setHoldProgress(0);
  };

  const sizes = {
    sm: { box: 'w-9 h-9', icon: 18, text: 'text-lg', ring: 42 },
    md: { box: 'w-12 h-12', icon: 24, text: 'text-2xl', ring: 56 },
    lg: { box: 'w-20 h-20', icon: 38, text: 'text-4xl', ring: 92 },
    xl: { box: 'w-28 h-28', icon: 52, text: 'text-5xl', ring: 124 },
  };

  const currentSize = sizes[size];

  return (
    <div
      className={`relative flex flex-col items-center select-none cursor-pointer group ${className}`}
      onMouseDown={startHold}
      onMouseUp={clearTimers}
      onMouseLeave={clearTimers}
      onTouchStart={startHold}
      onTouchEnd={clearTimers}
      onTouchCancel={clearTimers}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative flex items-center justify-center">
        {/* Live Animated Tricolor Aura */}
        <motion.div
          animate={{
            scale: [1, 1.14, 1],
            rotate: [0, 180, 360],
            opacity: [0.35, 0.65, 0.35],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          className={`absolute -inset-1.5 rounded-3xl bg-gradient-to-tr from-orange-500 via-amber-400 to-emerald-500 blur-md pointer-events-none`}
        />

        {/* Animated Emblem Box */}
        <motion.div
          animate={{
            y: [0, -3, 0],
          }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          className={`${currentSize.box} relative bg-gradient-to-br from-orange-500 via-red-600 to-amber-600 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-600/30 border border-white/25 overflow-hidden`}
        >
          {/* Shimmer sweep */}
          <motion.div
            animate={{ x: ['-140%', '220%'] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
            className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 pointer-events-none"
          />

          <motion.div
            animate={{ rotate: [-6, 6, -6] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="relative z-10 flex items-center justify-center"
          >
            <Utensils className="text-white drop-shadow" size={currentSize.icon} />
          </motion.div>

          <motion.div
            animate={{ scale: [0.85, 1.2, 0.85], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="absolute top-1 right-1 text-yellow-200"
          >
            <Sparkles size={Math.max(10, Math.round(currentSize.icon * 0.35))} />
          </motion.div>

          <motion.div
            animate={{ y: [1, -2, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="absolute bottom-1 left-1 text-orange-200"
          >
            <Flame size={Math.max(10, Math.round(currentSize.icon * 0.35))} />
          </motion.div>
        </motion.div>

        {/* 10-Second Admin Long-Press Progress Ring */}
        {holdProgress > 0 && (
          <svg
            className="absolute pointer-events-none -rotate-90"
            width={currentSize.ring}
            height={currentSize.ring}
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="6"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#EA580C"
              strokeWidth="6"
              strokeDasharray="283"
              strokeDashoffset={283 - (283 * holdProgress) / 100}
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      {holdProgress > 5 && (
        <span className="mt-1.5 px-2 py-0.5 rounded-full bg-slate-900 text-orange-400 text-[9px] font-black uppercase tracking-widest shadow">
          Admin Unlock {Math.ceil((100 - holdProgress) / 10)}s...
        </span>
      )}

      {showText && (
        <div className="mt-2.5 text-center">
          <h1 className={`${currentSize.text} font-black tracking-tighter text-slate-900 leading-none`}>
            FOOD <span className="text-red-600">INDIA</span>
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black mt-1">
            Fresh • Local • Instant COD
          </p>
        </div>
      )}
    </div>
  );
};
