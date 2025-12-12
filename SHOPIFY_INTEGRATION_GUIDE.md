# Shopify Integration Guide for MailAssist

This guide explains how to set up and use Shopify integration in MailAssist to view customer information, order history, and purchase data directly from your email support interface.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Creating a Shopify Test Store](#creating-a-shopify-test-store)
3. [Creating a Shopify App and Access Token](#creating-a-shopify-app-and-access-token)
4. [Configuring Shopify in MailAssist](#configuring-shopify-in-mailassist)
5. [Using Shopify Customer Information](#using-shopify-customer-information)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Active MailAssist installation running locally or in production
- Shopify Partner account (free to create at https://partners.shopify.com)
- Admin access to MailAssist (to save Shopify credentials)
- Gmail or email account connected to MailAssist

---

## Creating a Shopify Test Store

If you don't already have a Shopify store, you can create a free development store for testing.

### Steps:

1. **Go to Shopify Partners** (https://partners.shopify.com)
2. **Sign in** with your Shopify Partner account (or create one if needed)
3. **Click "Stores"** in the left sidebar
4. **Click "Create a store"** button
5. **Choose "Development store"** (free for testing)
6. **Enter store details:**
   - Store name: e.g., "mailassist-test-store"
   - Store purpose: Testing or development
   - Country/region: Select your location
7. **Click "Create store"**

Your development store is now ready! You'll see it listed with a `.myshopify.com` domain (e.g., `your-store.myshopify.com`).

---

## Creating a Shopify App and Access Token

The access token is required for MailAssist to authenticate with your Shopify store and fetch customer/order data.

### Steps:

1. **Open your dev store admin** (click the store name from the Partners dashboard)
2. **Go to Apps** (left sidebar)
3. **Click "Develop apps"** (top-right area)
   - If you don't see this option, go to **Settings** → **Apps and sales channels** → **Develop apps** → Enable "Allow custom app development"
4. **Click "Create an app"**
5. **Enter app name** (e.g., "MailAssist Dev App")
6. **Click "Create app"**

### Configure Admin API Scopes

7. **Click "Configuration"** tab (or "API credentials")
8. **Click "Configure"** next to "Admin API scopes"
9. **Add the following scopes** (required):
   - ✅ `read_customers` (to fetch customer data)
   - ✅ `read_orders` (to fetch order history)
10. **Optional scopes** (for additional features):
    - `read_products` (if you want product details)
    - `read_fulfillments` (if you track shipping)
11. **Click "Save"**

### Generate Admin API Access Token

12. **Click "Install app"** (if Shopify prompts you)
13. **Go to "API credentials"** tab
14. **Look for "Admin API access token"** section
15. **Click "Generate access token"**
16. **⚠️ IMPORTANT: Copy the token immediately** — Shopify only shows it once. If you lose it, you must regenerate a new one.
    - Token format: Looks like `shpat_1234567890abcdef...`
17. **Save the token somewhere safe** (you'll need it in the next step)

---

## Configuring Shopify in MailAssist

Now you'll connect your Shopify store to MailAssist using the access token.

### Prerequisites:
- MailAssist is running locally (`http://localhost:3000`) or at your deployed URL
- You are signed in to MailAssist as an **admin user**
- If you're not an admin, contact your administrator or use the one-time promote endpoint

### Steps:

1. **Sign in to MailAssist** (if not already signed in)
2. **Open Settings** (usually in the top navigation or left sidebar)
3. **Look for "Shopify Integration"** section
4. **Click "Save Configuration"** or similar button to enter edit mode
5. **Enter the following information:**
   - **Shop Domain**: Your Shopify store domain (e.g., `your-store.myshopify.com`)
     - This is shown in your Shopify admin URL: `https://your-store.myshopify.com/admin`
   - **Access Token**: The Admin API access token you generated (paste the full token)
6. **Click "Save Configuration"**
7. **You should see:** "Shopify integration is configured" ✅

If you see an error:
- **"Invalid shop domain format"**: Make sure it's in the format `your-store.myshopify.com`
- **"Invalid API key or access token"**: Check that you copied the token correctly and that the app has `read_customers` and `read_orders` scopes
- **"Admin access required"**: Only admins can configure Shopify. Ask your admin or promote yourself.

---

## Using Shopify Customer Information

Once configured, MailAssist will automatically display Shopify customer information in your support interface.

### Where to Find Customer Info:

#### Option 1: Ticket/Email View (Automatic)
- Open any ticket or email from a customer
- Look for the **"Shopify Customer Info"** panel on the right side
- This appears automatically if the customer's email matches a Shopify customer

#### Option 2: Shopify Sidebar Button
- In ticket view, click the **"Shopify"** button in the toolbar
- A sidebar opens showing detailed customer and order information

### What Information is Displayed:

**Customer Summary:**
- **Total Spent**: Total amount customer has spent (in store currency, e.g., Rs for PKR)
- **Orders Count**: Number of orders placed
- **Name**: First and last name
- **Email Status**: Verified/unverified
- **Address**: Default shipping address
- **Tags**: Customer tags from Shopify (e.g., "VIP", "wholesale")
- **Phone**: Contact number (if available)

**Recent Orders** (up to 5 most recent):
- **Order Number**: e.g., "#1001"
- **Total Amount**: Order total in store currency with proper symbol (Rs, $, €, etc.)
- **Date**: Order creation date
- **Financial Status**: paid, pending, refunded, etc. (color-coded)
- **Fulfillment Status**: fulfilled, partial, unfulfilled, etc. (color-coded)
- **Line Items**: Products in the order with quantities and SKU
- **Order Notes**: Any notes added to the order in Shopify admin
- **View in Shopify**: Direct link to open the customer profile in Shopify admin

### Currency Handling:

- MailAssist automatically detects your store's currency from orders
- Amounts are displayed with the correct currency symbol:
  - `$` for USD, CAD, AUD
  - `€` for EUR
  - `£` for GBP
  - `¥` for JPY, CNY
  - `Rs` for PKR (Pakistani Rupees)
  - `₹` for INR (Indian Rupees)
- Examples: `Rs5,800.00`, `€1,234.56`, `$99.99`

---

## Troubleshooting

### "Shopify integration not configured"

**Cause**: Either the integration wasn't saved in Settings, or no Shopify config exists for your account.

**Solution**:
1. Go to Settings → Shopify Integration
2. Re-enter your Shop Domain and Access Token
3. Click "Save Configuration"
4. Refresh the page

---

### "No customer found in Shopify"

**Cause**: The customer's email doesn't match any customer in your Shopify store.

**Solution**:
1. Check that the email in the ticket/contact exactly matches a Shopify customer email
2. Go to your Shopify admin → Customers and verify the email exists
3. If the customer doesn't exist, create them:
   - Click "Add customer"
   - Enter email and name
   - Click "Save"
4. Refresh MailAssist and try again

---

### "Invalid API key or access token"

**Cause**: The access token is invalid, expired, or has incorrect scopes.

**Solution**:
1. Go to your Shopify dev store admin → Apps → Develop apps → Your App
2. Check that these scopes are enabled:
   - `read_customers` ✅
   - `read_orders` ✅
3. If missing, click "Configure", add the scopes, and save
4. **Regenerate the access token**:
   - Click "Regenerate access token" (this invalidates the old one)
   - Copy the new token
5. Go back to MailAssist Settings → Shopify Integration
6. Paste the **new** token
7. Click "Save Configuration"

---

### "Invalid shop domain format"

**Cause**: The shop domain doesn't match the required format.

**Required format**: `your-store.myshopify.com`

**Common mistakes**:
- ❌ `https://your-store.myshopify.com` (don't include https://)
- ❌ `your-store.com` (must have .myshopify.com)
- ❌ `your-store` (must include .myshopify.com)

**Solution**: Enter the domain exactly as: `your-store.myshopify.com`

---

### Currency Shows as Dollar ($) Instead of PKR (Rs)

**Cause**: The store's orders may not have the correct currency set in Shopify, or the currency detection is using a fallback.

**Solution**:
1. Check your Shopify store settings:
   - Go to Shopify admin → Settings → General
   - Verify "Store currency" is set to PKR (or your currency)
2. Check order currency:
   - Go to Orders and open a recent order
   - Verify the currency shown in the order
3. If orders show USD:
   - This might be a Shopify data issue; contact Shopify support
   - Or recreate an order to ensure it uses the correct store currency
4. Refresh MailAssist and check again

---

### Orders Not Showing

**Cause**: The customer exists in Shopify but has no orders, or the access token doesn't have `read_orders` scope.

**Solution**:
1. Verify the customer has orders in Shopify:
   - Go to Shopify admin → Customers → click the customer
   - Look for "Orders" section
2. If no orders exist, create a test order:
   - Go to Orders → Create order
   - Select the customer
   - Add a product and set as paid
   - Click "Create order"
3. If orders exist, verify token scopes:
   - Go to Apps → Develop apps → Your app → Configuration
   - Confirm `read_orders` scope is enabled
   - Regenerate token if needed

---

### Admin Access Required

**Cause**: Only users with admin role can configure Shopify integration.

**Solution**:
1. Ask your admin to configure Shopify
2. Or, if you're the first user, use the one-time admin promotion:
   - Go to: `http://localhost:3000/api/users/promote-first-admin` (while signed in)
   - This promotes the first user to admin
   - Then configure Shopify

---

## Tips & Best Practices

1. **Keep your access token secret**: Never share it publicly or commit it to version control
2. **Regenerate tokens regularly**: For security, regenerate tokens every 6-12 months
3. **Use development store for testing**: Always test with a dev store first before using production
4. **Check Shopify admin regularly**: Verify customers and orders are created correctly in Shopify
5. **Monitor currency**: If you change store currency, refresh MailAssist to detect the new currency
6. **Backup your token**: Store a copy in a secure password manager in case you need to restore it

---

## API Reference

### Endpoints

**Get Shopify Configuration:**
- `GET /api/shopify/config`
- Requires: Admin authentication
- Returns: Current shop domain and configuration status

**Get Customer Information:**
- `GET /api/shopify/customer?email=customer@example.com`
- Requires: User authentication
- Returns: Customer data, orders, total spent, recent orders, and detected currency

---

## Support

For issues not covered in this guide:

1. Check the **browser console** (F12 → Console tab) for error messages
2. Check the **server logs** (where MailAssist is running) for backend errors
3. Verify your **Shopify Admin** → **Apps** that your custom app is installed and active
4. Contact your administrator if you need help with access permissions

---

## Summary

✅ **Setup Checklist:**
- [ ] Created Shopify dev store
- [ ] Created custom app in Shopify admin
- [ ] Added `read_customers` and `read_orders` scopes
- [ ] Generated Admin API access token
- [ ] Copied token (saved securely)
- [ ] Configured Shopify in MailAssist Settings
- [ ] Created test customer in Shopify
- [ ] Created test order for the customer
- [ ] Verified customer info displays in MailAssist
- [ ] Checked currency displays correctly (Rs for PKR, $ for USD, etc.)

Once all steps are complete, you're ready to use Shopify integration in MailAssist! 🎉
