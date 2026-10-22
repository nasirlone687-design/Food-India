# Food India 🇮🇳 — Automated AI Testing Bot Report

**Generated At:** 2026-10-22T04:35:13.053Z
**Target Environment:** Live Express + Vite Server (`http://localhost:3000`) & Cloud Firestore (`ai-studio-foodindia-4b909c06-284f-49c2-817a-3df90d00baa0`)

## Summary
- **Passed:** 24
- **Fixed & Verified:** 7
- **Failed:** 0
- **Not Tested (Requires External Live Credentials / Interactive OAuth):** 3

---

## 1. Passed Features (24)
- **[UI-01] Live Web Server & SPA Entry Point (/)** (*Screens & Navigation*): HTTP 200 OK from http://localhost:3000/ with valid HTML root container and metadata.
- **[UI-02] All 20 App Screens & Dialog Compliance** (*Screens & Navigation*): All 20 screens verified present with working routes and zero blocking window.alert() calls.
- **[CUST-01] Customer Registration & Firestore Profile Creation** (*Customer Flow*): Registered test customer (bot.customer.688194@foodindia-test.in, UID: KBIR8yBtpjZRi0jttVfGVHJsMAj2) and saved users/{uid} & customers/{uid} in Firestore.
- **[CUST-02] Customer Login & Profile Persistence After Reload** (*Customer Flow*): Signed out, signed back in, and verified users/{uid} and registrationDate persist in Firestore.
- **[CUST-03] Customer Saved Delivery Address & Google Maps Link** (*Customer Flow*): Saved customer delivery address with GPS coordinates (28.6315, 77.2167), PIN 110001, and Google Maps link.
- **[SELL-01] Seller Registration & Restaurant Profile Creation** (*Seller Flow*): Registered seller (bot.seller.688194@foodindia-test.in) and created restaurant (test_res_688194) with approvalStatus='pending' and GPS coordinates.
- **[SELL-02] Restaurant Profile, Delivery Pricing & Opening Hours Update** (*Seller Flow*): Verified seller can update restaurant delivery charges, opening hours, and GPS settings while approvalStatus remains protected.
- **[SELL-03] Seller Verification Document Submission (sellerDocuments)** (*Seller Flow*): Saved private seller verification document (DNJzcqf8HupPYMB5ImqT) in Firestore.
- **[SELL-04] Publish Guard: Unverified/Unsubscribed Seller Cannot Publish Products** (*Seller Flow & Security Rules*): Firestore security rules enforced isVerifiedSeller() and rejected product creation when restaurant is pending or subscription is inactive.
- **[SUB-01] Razorpay Server Configuration (/api/payment-config)** (*Subscriptions & Razorpay*): Environment=test, Commission=0%, Food Orders=COD, Secret keys kept server-side.
- **[SUB-02] Create Razorpay Payment Link (/api/create-payment-link)** (*Subscriptions & Razorpay*): Created Payment Link (plink_test_ca9489a6d4, URL: https://rzp.io/i/test_ca9489a6d4) -> paymentId=payrec_1792643696333_PjdQ8NqX, amount=₹499 INR.
- **[SUB-03] Razorpay Webhook Signature Verification Guard** (*Subscriptions & Razorpay*): Rejected forged Razorpay webhook with HTTP 400 Invalid signature.
- **[SUB-04] Signed Razorpay Webhook Verification & Non-Frontend Activation Rule** (*Subscriptions & Razorpay*): Verified HMAC-SHA256 webhook updated payment to webhookVerified=true and subscription to pending_admin_review without prematurely activating seller.
- **[SUB-05] Razorpay Webhook Duplicate Event Idempotency** (*Subscriptions & Razorpay*): Duplicate webhook event (evt_bot_688194) safely ignored (duplicate_event_ignored).
- **[CART-01] Cart Calculation with Variants, Required & Optional Add-ons** (*Cart & Add-ons*): Verified 2x (Base ₹240 + Variant ₹60 + Required Add-on ₹20 + Optional Add-on ₹30) = Subtotal ₹700 + Delivery ₹35 = Total ₹735 saved in Firestore.
- **[DELIV-01] Automatic Local Provider Discovery (Multi-State/City/PIN/GPS)** (*3P Delivery & Maps*): Discovered 3 eligible providers (Restaurant Staff, Food India Fleet, Sandbox Provider) for New Delhi PIN 110001 (4.54 km) and reported 4 unconfigured 3P providers transparently.
- **[ORD-01] COD Order Placement & Cart Clearing Transaction** (*COD Checkout & Orders*): Placed COD order #FI-BOT-688194 (test_order_688194), incremented customer totalOrders, and cleared active cart.
- **[ORD-02] Permanent Order History Persistence (Customer & Seller)** (*COD Checkout & Orders*): Verified order loads in both Customer Order History and Seller Live Orders after refresh.
- **[DELIV-02] Post-Acceptance Booking Guard (Blocks Booking While Order is Pending)** (*3P Delivery & Maps*): Backend rejected delivery booking before restaurant acceptance with HTTP 400.
- **[DELIV-03] Delivery Provider Failure Handling & Fallback Trigger** (*3P Delivery & Maps*): Simulated rider shortage failure (dbook_1792643701933_test_o); bookingStatus='failed' with refundStatus='reassigned_no_extra_charge'.
- **[DELIV-04] Delivery Booking & Idempotency (Zero Duplicate Bookings / Charges)** (*3P Delivery & Maps*): Booked delivery (Tracking: TRK-FI-966701) and verified repeat request returned idempotentReplay=true for bookingId=dbook_1792643702754_test_o.
- **[DELIV-05] HMAC-SHA256 Verified Delivery Webhooks & Live Order Sync** (*3P Delivery & Maps*): Progressed order through rider_assigned -> picked_up -> in_transit -> delivered via HMAC-SHA256 verified webhooks.
- **[ADMIN-01] Server-Controlled Admin Permissions & Firestore Rule Enforcement** (*Admin Security & RBAC*): Verified non-admin accounts (Customer & Seller) are strictly blocked from reading auditLogs or self-approving seller verificationStatus.
- **[ADMIN-02] Admin Provider Connection & Quote Tester (/api/delivery/test-provider)** (*Admin Dashboard & Integrations*): Sandbox provider passed connection test (active_sandbox); unconfigured Porter B2B provider accurately reported unsupported_unconfigured.

---

## 2. Automatically Fixed & Retested Bugs (7)
- **[FIX-01] RestaurantProfile Menu Search Button & Filter** (*Bug Fixes Verified*): Fixed previously unimplemented Search button in RestaurantProfile.tsx to toggle live dish search input and filter menu items.
- **[FIX-02] DashboardHeader Location & Notification Buttons** (*Bug Fixes Verified*): Wired onAddressClick and onNotificationsClick in CustomerDashboard.tsx so clicking Deliver To or Bell navigates properly.
- **[FIX-03] ProductCard Veg / Non-Veg Indicator Accuracy** (*Bug Fixes Verified*): Fixed ProductCard.tsx to inspect product.isVeg and product.foodType instead of checking categoryId substring.
- **[FIX-04] EditProduct Form Persistence & Alert Removal** (*Bug Fixes Verified*): Fixed EditProduct.tsx to update isVeg and preparationTimeMinutes on save and replaced blocking window.alert() with inline error banner.
- **[FIX-05] Customer ProfileTab Privacy & Terms Sync with AdminSettings** (*Bug Fixes Verified*): Synced ProfileTab.tsx to listen to adminSettings/global and read privacyPolicyURL & termsAndConditionsURL configured by Admin.
- **[FIX-06] AdminDashboard Exit Admin Logout Flow** (*Bug Fixes Verified*): Fixed Exit Admin button in AdminDashboard.tsx to call authService.logout() before navigating to /welcome so ProtectedRoute does not bounce back.
- **[FIX-07] LocationPicker Fallback & Manual Address Confirmation** (*Bug Fixes Verified*): Enhanced LocationPicker.tsx with automatic fallback coordinates when geolocation is denied and a Set Address button for manual address input.

---

## 3. Failed Features (0)
- *None — all tested features passed.*

---

## 4. Not Tested Features (3)
- **[EXT-01] Google OAuth Popup Sign-In (Customer / Seller / Admin)** (*External Integrations*): Requires interactive browser Google account consent popup; email/password registration & login were tested end-to-end against live Firebase Auth.
- **[EXT-02] Live Production Third-Party Logistics APIs (Porter, Shadowfax, Shiprocket, Dunzo)** (*External Integrations*): Requires live partner API tokens in server .env; verified unconfigured guard and tested full booking/webhook flow via Sandbox Logistics Provider.
- **[EXT-03] Interactive Admin Approval via Bootstrapped Google Admin Account (lonen5408@gmail.com)** (*External Integrations*): Requires interactive sign-in as lonen5408@gmail.com; verified Firestore RBAC rules protect all admin collections against non-admin tokens.
