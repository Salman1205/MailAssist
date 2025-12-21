# Critical Authentication System Flaws & Fixes

## Problem Overview
The current system supports TWO authentication methods but has several edge cases where they conflict:
1. **Business Registration** → Creates `businesses` table entry + `users` table entry
2. **Gmail OAuth** → Creates `tokens` table entry

## Critical Flaws Identified

### 🔴 FLAW #1: Duplicate Business Creation
**Scenario:** User registers business with `email@gmail.com` → Later signs in with Gmail OAuth

**Current Behavior:**
1. Business registration creates: `businesses` WHERE business_email = 'email@gmail.com'
2. Gmail OAuth creates: `tokens` WHERE user_email = 'email@gmail.com'
3. Migration script (lines 46-68) creates ANOTHER "legacy business" with same email
4. **Result:** TWO businesses with identical email addresses!

**Why Migration Has `ON CONFLICT DO NOTHING`:**
- Line 68 has `ON CONFLICT (business_email) DO NOTHING` which prevents insert errors
- But this means Gmail OAuth AFTER business registration silently fails to link data
- User has business account but Gmail OAuth doesn't connect to it

**Impact:**
- Data fragmentation: business data vs Gmail OAuth data separated
- User confusion: logged in via OAuth but can't see their business data
- RLS policies show different data depending on auth method used

---

### 🔴 FLAW #2: No Identity Linking
**Scenario:** User uses Gmail OAuth first → Later tries to register business with same email

**Current Behavior:**
1. Gmail OAuth creates: `tokens` + legacy business (via migration)
2. User tries business registration with same email
3. Registration API (line 58 of register/route.ts) checks: `existingBusiness.is_email_verified`
4. If legacy business has `is_email_verified = true`, returns **409 Conflict**
5. **Result:** User locked out of business registration!

**Why This Happens:**
- Migration script (line 61) sets `is_email_verified = true` for ALL legacy businesses
- Registration API treats verified legacy businesses same as real business accounts
- No way to "upgrade" from Gmail OAuth to business account

**Impact:**
- Users who OAuth'd first can NEVER create business accounts
- No migration path from personal to business tier
- Error message "already registered" confusing (they never registered a business!)

---

### 🔴 FLAW #3: Session Priority Ambiguity
**Scenario:** User has BOTH business session AND Gmail OAuth tokens active

**Current Behavior:**
- `isAuthenticated()` in session.ts returns `true` if EITHER exists
- But no clear priority: which identity should be used?
- `getCurrentUserEmail()` checks business session first, falls back to OAuth
- RLS policies check BOTH with OR condition

**Problems:**
1. User sees different data depending on which auth they used last
2. No way to explicitly "switch" between identities
3. Team members invited to business might also have personal Gmail OAuth
4. Logout from one doesn't log out of the other

**Impact:**
- Data visibility inconsistency
- Confusion about which "account" is active
- Potential security issue: access control based on wrong identity

---

### 🔴 FLAW #4: No Business_ID Link During OAuth
**Scenario:** User does Gmail OAuth after business exists

**Current Behavior:**
- `saveTokens()` in storage.ts (line 605-650) only checks user_email
- Line 618: `await supabase.from('tokens').delete().eq('user_email', userEmail)`
- Line 633: Inserts new token with user_email
- **Missing:** No check if business already exists, no business_id assignment

**Why It Matters:**
- Tokens table has `business_id` column (from migration)
- But OAuth flow NEVER populates it
- User's Gmail OAuth tokens not linked to their business account
- RLS policies fall back to legacy method (checking email match)

**Impact:**
- Can't scope OAuth data to specific business
- Multi-business scenarios broken (what if same email used in 2 businesses?)
- Business admins can't control OAuth users' access

---

### 🔴 FLAW #5: Data Scoping Conflicts
**Scenario:** Same email accessed via both methods sees different data

**Current RLS Policy (emails table, line 163):**
```sql
user_email IN (SELECT user_email FROM tokens)
OR
EXISTS (SELECT 1 FROM users u JOIN businesses b ON u.business_id = b.id 
        WHERE b.business_email = emails.user_email)
```

**Problems:**
1. First condition: matches ANY email in tokens (legacy)
2. Second condition: matches business_email from businesses table
3. If user has OAuth + business account, sees data from BOTH
4. No isolation between personal vs business data
5. Team members with personal Gmail see personal + business data mixed

**Impact:**
- Privacy violation: personal emails visible in business context
- Data pollution: business analytics include personal email stats
- Compliance issue: business data mixed with personal data

---

### 🔴 FLAW #6: Invitation System Doesn't Check OAuth
**Scenario:** Invite agent with email that already has Gmail OAuth

**Current Behavior:**
- Invitation API doesn't check if user has existing OAuth tokens
- Agent accepts invite → creates NEW user in users table
- But they might already have Gmail OAuth data (emails, drafts, etc.)
- **Result:** TWO identities for same person!

**Impact:**
- Data duplication: same person, two user records
- Historical data lost: OAuth emails not visible in business context
- Confusion: "why can't I see my old emails?"

---

## Proposed Solutions

### ✅ Solution 1: Unified Identity System

**Create New Table: `unified_identities`**
```sql
CREATE TABLE public.unified_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_email TEXT UNIQUE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  has_oauth BOOLEAN DEFAULT false,
  has_business_auth BOOLEAN DEFAULT false,
  preferred_auth_method TEXT CHECK (preferred_auth_method IN ('oauth', 'business')) DEFAULT 'business',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:**
- Single source of truth for "who is this person?"
- Tracks ALL auth methods for one email
- Clear preference for which method to use
- Links to business if applicable

---

### ✅ Solution 2: Smart OAuth Handler

**Update `saveTokens()` in storage.ts:**
```typescript
export async function saveTokens(tokens: StoredTokens): Promise<string | null> {
  // ... existing code to get userEmail ...
  
  // NEW: Check if business account exists for this email
  const { data: existingBusiness } = await supabase
    .from('businesses')
    .select('id, is_legacy')
    .eq('business_email', userEmail)
    .single();
  
  let businessId: string | null = null;
  
  if (existingBusiness && !existingBusiness.is_legacy) {
    // Real business exists - link OAuth to it
    businessId = existingBusiness.id;
    
    // Update unified_identities
    await supabase.from('unified_identities').upsert({
      primary_email: userEmail,
      business_id: businessId,
      has_oauth: true,
      preferred_auth_method: 'business' // Business takes priority
    });
  } else if (existingBusiness && existingBusiness.is_legacy) {
    // Legacy business - keep OAuth separate
    businessId = existingBusiness.id;
    
    await supabase.from('unified_identities').upsert({
      primary_email: userEmail,
      business_id: businessId,
      has_oauth: true,
      preferred_auth_method: 'oauth' // OAuth is primary for legacy
    });
  } else {
    // No business - create new legacy business
    const { data: newBusiness } = await supabase.from('businesses')
      .insert({
        business_name: `Personal Account - ${userEmail}`,
        business_email: userEmail,
        owner_name: 'Gmail User',
        password_hash: 'OAUTH_NO_PASSWORD',
        is_email_verified: true,
        is_legacy: true
      })
      .select('id')
      .single();
    
    businessId = newBusiness?.id || null;
    
    await supabase.from('unified_identities').upsert({
      primary_email: userEmail,
      business_id: businessId,
      has_oauth: true,
      preferred_auth_method: 'oauth'
    });
  }
  
  // Save tokens with business_id link
  const insertPayload = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expiry_date: tokens.expiry_date ?? null,
    token_type: tokens.token_type ?? null,
    scope: tokens.scope ?? null,
    user_email: userEmail,
    business_id: businessId // LINK TO BUSINESS!
  };
  
  await supabase.from('tokens').delete().eq('user_email', userEmail);
  await supabase.from('tokens').insert(insertPayload);
  
  return userEmail;
}
```

---

### ✅ Solution 3: Smart Business Registration

**Update `POST /api/auth/register`:**
```typescript
// After line 58 - checking existingBusiness
if (existingBusiness) {
  if (existingBusiness.is_legacy) {
    // UPGRADE PATH: User has Gmail OAuth, wants to add business account
    
    // Check unified identity
    const { data: identity } = await supabase
      .from('unified_identities')
      .select('*')
      .eq('primary_email', businessEmail)
      .single();
    
    if (identity?.has_oauth) {
      // Allow upgrade: update legacy business to real business
      await supabase.from('businesses')
        .update({
          business_name: businessName,
          owner_name: ownerName,
          password_hash: passwordHash,
          business_phone: businessPhone,
          is_legacy: false, // No longer legacy!
          is_email_verified: false // Must verify again
        })
        .eq('id', existingBusiness.id);
      
      // Update unified identity
      await supabase.from('unified_identities')
        .update({
          has_business_auth: true,
          preferred_auth_method: 'business' // Business now primary
        })
        .eq('primary_email', businessEmail);
      
      // Create OTP for verification
      // ... proceed with OTP flow ...
      
      return NextResponse.json({
        message: 'Upgrading to business account. Please verify email.',
        businessId: existingBusiness.id
      });
    }
  }
  
  if (existingBusiness.is_email_verified && !existingBusiness.is_legacy) {
    // Real verified business - reject
    return NextResponse.json(
      { error: 'This email is already registered. Please login instead.' },
      { status: 409 }
    );
  }
  
  // Unverified non-legacy business - allow re-registration
  // ... existing code ...
}
```

---

### ✅ Solution 4: Clear Session Priority

**Update `lib/session.ts` - add priority logic:**
```typescript
export async function getCurrentAuthContext(): Promise<{
  method: 'business' | 'oauth' | 'none';
  userEmail: string | null;
  businessId: string | null;
  userId: string | null;
}> {
  const cookies = await getCookies();
  const sessionToken = cookies.get('session_token')?.value;
  const currentUserId = cookies.get('current_user_id')?.value;
  
  // Check unified identity preference
  let preferredMethod = 'business'; // default
  
  if (currentUserId) {
    const userEmail = await getCurrentUserEmail();
    if (userEmail) {
      const { data: identity } = await supabase
        .from('unified_identities')
        .select('preferred_auth_method, business_id')
        .eq('primary_email', userEmail)
        .single();
      
      if (identity) {
        preferredMethod = identity.preferred_auth_method;
      }
    }
  }
  
  // Priority 1: Business session (if preferred or only option)
  if (sessionToken && (preferredMethod === 'business' || !currentUserId)) {
    const session = await validateBusinessSession();
    if (session) {
      return {
        method: 'business',
        userEmail: session.email,
        businessId: session.businessId,
        userId: session.id
      };
    }
  }
  
  // Priority 2: OAuth (if preferred or business session failed)
  if (currentUserId && preferredMethod === 'oauth') {
    const userEmail = await getCurrentUserEmail();
    if (userEmail) {
      const tokens = await loadTokens(userEmail);
      if (tokens) {
        return {
          method: 'oauth',
          userEmail: userEmail,
          businessId: null, // or get from unified_identities
          userId: currentUserId
        };
      }
    }
  }
  
  return { method: 'none', userEmail: null, businessId: null, userId: null };
}
```

---

### ✅ Solution 5: Invitation Conflict Detection

**Update `POST /api/agents/invite`:**
```typescript
// After validating email, before creating invitation
const { data: existingOAuth } = await supabase
  .from('tokens')
  .select('user_email, business_id')
  .eq('user_email', email)
  .single();

if (existingOAuth) {
  if (existingOAuth.business_id) {
    // OAuth user already linked to a business
    return NextResponse.json({
      error: 'This user is already part of another business account.'
    }, { status: 409 });
  } else {
    // OAuth user exists but not linked - create invitation with note
    // They can accept and link their OAuth data
    const invitation = await supabase.from('agent_invitations')
      .insert({
        business_id: session.businessId,
        email: email,
        name: name,
        role: role,
        has_existing_oauth: true, // NEW FLAG
        invitation_token: token,
        expires_at: expiresAt
      })
      .select()
      .single();
    
    // Send email with special message about linking accounts
    await sendInvitationEmailWithOAuthNote(invitation);
  }
}
```

---

### ✅ Solution 6: Data Scope Isolation

**Update RLS Policies to respect unified identity:**
```sql
-- EXAMPLE: emails table with proper scoping
CREATE POLICY "Users can access emails via unified identity" 
  ON public.emails FOR ALL TO authenticated
  USING (
    user_email IN (
      SELECT ui.primary_email 
      FROM public.unified_identities ui
      WHERE ui.id = get_current_unified_identity_id() -- NEW function
      AND (
        -- If business auth preferred, only show business-scoped data
        (ui.preferred_auth_method = 'business' AND emails.business_id = ui.business_id)
        OR
        -- If OAuth preferred, show all data for this email
        (ui.preferred_auth_method = 'oauth' AND emails.user_email = ui.primary_email)
      )
    )
  );

-- NEW FUNCTION: Get current user's unified identity
CREATE OR REPLACE FUNCTION get_current_unified_identity_id()
RETURNS UUID AS $$
DECLARE
  user_email TEXT;
  identity_id UUID;
BEGIN
  -- Get email from session or tokens
  user_email := get_session_user_email(); -- implement this
  
  -- Get unified identity
  SELECT id INTO identity_id
  FROM public.unified_identities
  WHERE primary_email = user_email
  LIMIT 1;
  
  RETURN identity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Implementation Priority

### Phase 1: Prevent Immediate Breakage (URGENT)
1. ✅ Update migration script to NOT create duplicate businesses
2. ✅ Add business_id linking in saveTokens()
3. ✅ Add upgrade path in registration API

### Phase 2: Add Unified Identity (HIGH)
4. ✅ Create unified_identities table
5. ✅ Migrate existing data to unified_identities
6. ✅ Update session validation to use unified identity

### Phase 3: Polish & Testing (MEDIUM)
7. ✅ Add invitation conflict detection
8. ✅ Update RLS policies for proper scoping
9. ✅ Add UI for "switch account" if user has both
10. ✅ Comprehensive testing of all edge cases

---

## Immediate Fixes Needed in Current Migration

**File: `FIX_SCHEMA_CONFLICTS.sql`**

**Problem 1:** Line 46-68 blindly creates legacy businesses without checking if real business exists

**Fix:**
```sql
-- CHANGE: Line 46-68
INSERT INTO public.businesses (
  business_name,
  business_email,
  owner_name,
  password_hash,
  is_email_verified,
  is_legacy,
  created_at
)
SELECT DISTINCT
  'Legacy Account - ' || COALESCE(t.user_email, 'Unknown') as business_name,
  t.user_email as business_email,
  'Legacy Owner' as owner_name,
  'LEGACY_NO_PASSWORD_REQUIRED' as password_hash,
  true as is_email_verified,
  true as is_legacy,
  NOW() as created_at
FROM public.tokens t
WHERE t.user_email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.businesses b 
    WHERE b.business_email = t.user_email
    AND b.is_legacy = false  -- ADD THIS: Don't create if REAL business exists!
  )
ON CONFLICT (business_email) DO NOTHING;
```

**Problem 2:** No business_id assignment in tokens during migration

**Fix:** Add after line 88:
```sql
-- Link tokens to businesses (including existing business_id if already set)
UPDATE public.tokens t
SET business_id = COALESCE(t.business_id, b.id)
FROM public.businesses b
WHERE t.user_email = b.business_email
  AND t.user_email IS NOT NULL;
```

---

## Testing Checklist

- [ ] User registers business → OTPs → Logs out → Gmail OAuth with same email → Should link to business
- [ ] User Gmail OAuths → Tries to register business with same email → Should upgrade legacy to business
- [ ] User has business session + Gmail OAuth tokens → Check which data shows in dashboard
- [ ] Invite agent with email that has Gmail OAuth → Should detect and handle gracefully
- [ ] User logs in via business → Logs out → Logs in via Gmail OAuth → Data should be consistent
- [ ] Two users with different emails → Gmail OAuth → Should NOT see each other's data
- [ ] User with business account → Team member invitation → Accepts → Should join business, not create duplicate

