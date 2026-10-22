import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, auth, handleFirestoreError, OperationType } from '../firebase/config';
import { storage } from '../firebase/config'; // I need to export storage in config.ts
import { Product, Seller } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

export const productService = {
  // Check if seller can publish
  async canPublish(uid: string): Promise<{ can: boolean; reason?: string; actionPath?: string }> {
    try {
      const [sellerDoc, userDoc] = await Promise.all([
        getDoc(doc(db, 'sellers', uid)),
        getDoc(doc(db, 'users', uid)),
      ]);
      const sellerData = sellerDoc.exists() ? (sellerDoc.data() as Seller) : null;
      const userData = userDoc.exists() ? (userDoc.data() as any) : null;

      if (!sellerData && !userData) {
        return { can: false, reason: 'Seller profile not found.', actionPath: '/seller' };
      }

      const verStatus = sellerData?.verificationStatus || userData?.verificationStatus || 'pending';
      if (verStatus !== 'verified') {
        return {
          can: false,
          reason: 'Your seller account & documents are pending admin verification. Please complete ₹499 payment & submit for verification.',
          actionPath: '/seller/verification',
        };
      }

      const subStatus = sellerData?.subscriptionStatus || userData?.subscriptionStatus || 'active';
      if (subStatus === 'paused' || subStatus === 'expired' || sellerData?.accountPaused) {
        return {
          can: false,
          reason: 'Your 30-day subscription is paused or expired. Please pay ₹499 via UPI (8825018335@axl) to reactivate.',
          actionPath: '/seller/subscription',
        };
      }

      const targetRestId = sellerData?.restaurantId || `rest_${uid}`;
      const resDoc = await getDoc(doc(db, 'restaurants', targetRestId));
      if (!resDoc.exists() || resDoc.data()?.approvalStatus !== 'approved') {
        // Since Admin approved the seller (verificationStatus === 'verified'), auto-approve/ensure the seller's restaurant doc
        await setDoc(
          doc(db, 'restaurants', targetRestId),
          {
            restaurantId: targetRestId,
            sellerId: uid,
            restaurantName: sellerData?.ownerName ? `${sellerData.ownerName}'s Kitchen` : 'Food India Kitchen',
            approvalStatus: 'approved',
            isOpen: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      if (!sellerData?.restaurantId) {
        await setDoc(
          doc(db, 'sellers', uid),
          {
            uid,
            sellerId: uid,
            restaurantId: targetRestId,
            subscriptionStatus: 'active',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      return { can: true };
    } catch (error) {
      console.error('Error checking publish status:', error);
      return { can: false, reason: 'Failed to verify account status.', actionPath: '/seller' };
    }
  },

  // Upload image to Storage (with automatic Data URL fallback if Storage bucket is not provisioned)
  async uploadProductImage(productId: string, file: File): Promise<string> {
    try {
      const storageRef = ref(storage, `products/${productId}/${uuidv4()}_${file.name}`);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } catch (storageErr) {
      console.warn('Storage bucket upload fallback to inline Data URL:', storageErr);
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
      });
    }
  },

  // Create Product
  async createProduct(product: Partial<Product>, imageFiles: File[]): Promise<void> {
    const productId = uuidv4();
    const path = `products/${productId}`;
    try {
      // 1. Upload up to 5 images
      const imageUrls: string[] = [];
      for (const file of imageFiles.slice(0, 5)) {
        const url = await this.uploadProductImage(productId, file);
        imageUrls.push(url);
      }
      if (imageUrls.length === 0 && product.imagePaths?.length) {
        imageUrls.push(...product.imagePaths.slice(0, 5));
      }

      // 2. Save to Firestore
      const now = serverTimestamp();
      const fullProduct = {
        ...product,
        productId,
        imagePaths: imageUrls,
        createdAt: now,
        updatedAt: now,
        isAvailable: true,
      };
      await setDoc(doc(db, 'products', productId), fullProduct);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Update Product
  async updateProduct(productId: string, updates: Partial<Product>, newImageFiles?: File[]): Promise<void> {
    const path = `products/${productId}`;
    try {
      let imageUrls = updates.imagePaths || [];
      
      if (newImageFiles && newImageFiles.length > 0) {
        for (const file of newImageFiles) {
          const url = await this.uploadProductImage(productId, file);
          imageUrls.push(url);
        }
      }

      const finalUpdates = {
        ...updates,
        imagePaths: imageUrls.slice(0, 5), // Keep only top 5
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, 'products', productId), finalUpdates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Get Seller Products
  async getSellerProducts(sellerId: string): Promise<Product[]> {
    const path = 'products';
    try {
      const q = query(
        collection(db, 'products'), 
        where('sellerId', '==', sellerId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Product);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  // Delete Product
  async deleteProduct(productId: string): Promise<void> {
    const path = `products/${productId}`;
    try {
      await deleteDoc(doc(db, 'products', productId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
};
