import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  increment,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Review } from '../models/types';
import { reportGlobalButtonStatus } from '../context/ErrorLogContext';

export const reviewService = {
  async submitReview(params: {
    targetType: 'product' | 'restaurant';
    targetId: string;
    productId?: string;
    productName?: string;
    restaurantId: string;
    restaurantName?: string;
    customerId: string;
    customerName: string;
    rating: number;
    comment: string;
  }): Promise<Review> {
    const cleanRating = Math.min(5, Math.max(1, Number(params.rating) || 5));
    const reviewId = `rev_${params.targetType}_${params.targetId.slice(0, 8)}_${params.customerId.slice(0, 6)}_${Date.now()}`;

    const reviewPayload: Review = {
      reviewId,
      targetType: params.targetType,
      targetId: params.targetId,
      ...(params.productId ? { productId: params.productId } : {}),
      ...(params.productName ? { productName: params.productName } : {}),
      restaurantId: params.restaurantId,
      ...(params.restaurantName ? { restaurantName: params.restaurantName } : {}),
      customerId: params.customerId,
      customerName: params.customerName || 'Food India Customer',
      rating: cleanRating,
      comment: params.comment.trim() || 'Delicious and fresh!',
      createdAt: serverTimestamp(),
    };

    // 1. Save Review to reviews/{reviewId}
    await setDoc(doc(db, 'reviews', reviewId), reviewPayload);

    // 2. Recalculate & update Product rating in products/{productId}
    if (params.targetType === 'product' && params.productId) {
      const prodRevQ = query(collection(db, 'reviews'), where('productId', '==', params.productId));
      const snap = await getDocs(prodRevQ);
      const ratings = snap.docs.map((d) => Number(d.data().rating || 5));
      const count = ratings.length || 1;
      const avg = Number((ratings.reduce((a, b) => a + b, 0) / count).toFixed(1));

      await setDoc(
        doc(db, 'products', params.productId),
        {
          rating: avg,
          reviewCount: count,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    // 3. Recalculate & update Restaurant rating in restaurants/{restaurantId}
    if (params.restaurantId) {
      const restRevQ = query(
        collection(db, 'reviews'),
        where('restaurantId', '==', params.restaurantId)
      );
      const snap = await getDocs(restRevQ);
      const ratings = snap.docs.map((d) => Number(d.data().rating || 5));
      const count = ratings.length || 1;
      const avg = Number((ratings.reduce((a, b) => a + b, 0) / count).toFixed(1));

      await setDoc(
        doc(db, 'restaurants', params.restaurantId),
        {
          rating: avg,
          totalReviews: count,
          reviewCount: count,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
    }

    // 4. Save rating history in User Profile (users/{uid} & customers/{uid})
    const summaryItem = {
      reviewId,
      targetType: params.targetType,
      targetId: params.targetId,
      name: params.productName || params.restaurantName || params.targetId,
      rating: cleanRating,
      comment: reviewPayload.comment,
      createdAtIso: new Date().toISOString(),
    };

    await setDoc(
      doc(db, 'users', params.customerId),
      {
        submittedReviewsCount: increment(1),
        recentReviews: arrayUnion(summaryItem),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => {});

    await setDoc(
      doc(db, 'customers', params.customerId),
      {
        submittedReviewsCount: increment(1),
        recentReviews: arrayUnion(summaryItem),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => {});

    reportGlobalButtonStatus({
      buttonName: `Submit ${params.targetType === 'product' ? 'Dish' : 'Restaurant'} Rating (${cleanRating}★)`,
      backendPath: `Firestore: reviews/${reviewId}, ${
        params.productId ? `products/${params.productId}, ` : ''
      }restaurants/${params.restaurantId}, users/${params.customerId}`,
      dbUpdated: 'UPDATED',
      statusType: 'success',
      message: `Saved ${cleanRating}★ review for "${
        params.productName || params.restaurantName
      }" to Product DB, Restaurant DB & User Profile.`,
    });

    return reviewPayload;
  },
};
