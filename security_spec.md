# Security Specification - FOOD INDIA

## Data Invariants
- A user document must have a UID matching the document ID.
- A user's role cannot be changed by the user themselves after registration.
- Customer profiles cannot have restaurant data fields.
- Seller profiles must include restaurant data.
- User data is private and only readable by the owner.

## The "Dirty Dozen" Payloads (Red Team Test Cases)
1. **Role Escalation**: Register as customer, then attempt to update `role` to 'seller'.
2. **Identity Spoofing**: Attempt to create a user document with a different UID than `request.auth.uid`.
3. **Ghost Field Injection**: Add `isAdmin: true` to a user profile update.
4. **Temporal Manipulation**: Attempt to set a manual `createdAt` date in the past.
5. **PII Leak**: Authenticated User A attempts to `get` User B's profile.
6. **Query Scraping**: Authenticated user attempts to `list` all users without a `where` clause on `uid`.
7. **Resource Poisoning**: Send a 1MB string as the `restaurantName`.
8. **Orphaned Write**: Create a seller profile without a valid UID.
9. **Terminal State Bypass**: Attempt to update `registrationDate` after it's set.
10. **Type Mismatch**: Send a boolean for `name`.
11. **Empty Registration**: Attempt to create a user without required fields (`role`, `name`).
12. **Unverified Auth**: Attempt to write data with an unverified email (if `email_verified` check is enforced).

## Test Runner Plan
- Use `firestore.rules.test.ts` to simulate these payloads using the Firestore emulator or local testing logic.
