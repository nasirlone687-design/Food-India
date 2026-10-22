import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export const logAdminAction = async (adminId: string, action: string, targetType: string, targetId: string, details?: string) => {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      adminId,
      action,
      targetType,
      targetId,
      details: details || '',
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Error logging audit:', error);
  }
};
