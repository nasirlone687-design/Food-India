import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '../components/Logo';

const SplashScreen: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/welcome');
    }, 2800);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full max-w-[100vw] bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 text-white overflow-hidden px-4">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: 'spring',
          stiffness: 240,
          damping: 18,
          duration: 1.2,
        }}
        className="w-40 h-40 sm:w-48 sm:h-48 mb-6 flex items-center justify-center"
      >
        <Logo className="w-full h-full" size="xl" />
      </motion.div>

      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.7 }}
        className="text-4xl sm:text-5xl font-black tracking-tighter mb-2 text-center"
      >
        FOOD INDIA
      </motion.h1>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.7 }}
        className="text-sm sm:text-base font-bold opacity-90 text-center"
      >
        Closest Restaurants • Nearest Dishes • 100% COD
      </motion.p>

      <div className="absolute bottom-12 w-56 sm:w-64 h-1.5 bg-white/20 rounded-full overflow-hidden">
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '0%' }}
          transition={{ duration: 2.4, ease: 'easeInOut' }}
          className="h-full bg-white rounded-full"
        />
      </div>
    </div>
  );
};

export default SplashScreen;
