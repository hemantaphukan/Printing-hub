# 🖨️ Mobile QR Scan-to-Print Station (Netlify & GitHub Ready)

A zero-install, zero-login web application designed for copy shops, print centers, cyber cafes, libraries, and businesses.

**Workflow:**
1. **Shop Owner (Admin)** runs this web application on their PC connected to a printer (or via Netlify URL).
2. **Customer** scans the counter QR code with their mobile phone camera (no login, no app installation required).
3. **Customer** uploads any Image (JPG, PNG) or PDF document, configures copies/color, and taps **Send to Shop Printer**.
4. **Admin PC** rings a sound chime, automatically receives the document in real-time, displays the file preview, and sends the print command to the connected printer.

---

## 🚀 Instant Deployment to Netlify (Free)

This application is built as a self-contained Single-Page Application (SPA) with **WebRTC Peer-to-Peer direct transmission**. It requires **no paid server or external database** to operate on Netlify!

### Step 1: Push to GitHub
1. Create a new repository on [GitHub](https://github.com/new).
2. Push your project code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Mobile QR Print Station"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
   git push -u origin main
   ```

### Step 2: Deploy on Netlify
1. Log in to [Netlify](https://app.netlify.com/).
2. Click **"Add new site"** ➔ **"Import an existing project"**.
3. Choose **GitHub** and authorize access to your repository.
4. The build settings are auto-configured from `netlify.toml`:
   - **Build Command:** `npm run build`
   - **Publish directory:** `dist`
5. Click **"Deploy site"**. Your app will be live with an HTTPS URL (e.g. `https://your-shop-print.netlify.app`).

---

## 🖥️ How to Use at the Shop Counter

### 1. Admin Station (PC with Connected Printer)
1. Open your Netlify URL on the shop counter PC (e.g. `https://your-shop-print.netlify.app`).
2. Make sure your desktop/laptop is connected to your printer via USB or Wi-Fi.
3. Click **"Print Counter Placard / QR"** to print or display the high-resolution counter sign for customers.
4. Keep this browser tab open. The station listens continuously for incoming customer files via secure P2P WebRTC data channels and local sync.

### 2. Customer Experience (Mobile Phone)
1. Customer points their phone's native camera at the QR code.
2. The customer portal opens instantly — **no account creation or login required**.
3. Customer selects a PDF or photo from their files or snaps a physical document with their phone camera.
4. Customer chooses Copies, B&W or Color, and taps **"Send to Shop Printer 🖨️"**.

### 3. Giving the Print Command
- When the order arrives, the Admin PC plays a chime alert.
- The Admin can click **"Inspect / View File"** to review the customer's PDF or image.
- The Admin clicks **"Print Now"** to issue the print command to the connected printer.
- *(Optional)* Enable **"Auto-Print"** in Station Settings to have documents automatically sent to the printer upon arrival.

---

## ⚡ Pro-Tip: Zero-Click Silent Printing (Chrome / Edge Kiosk Mode)

To skip the print preview dialogue and print directly to the default printer:
1. Create a shortcut to Google Chrome or Microsoft Edge on your shop PC desktop.
2. In the shortcut properties, add `--kiosk-printing` to the Target:
   ```text
   chrome.exe --kiosk-printing https://your-shop-print.netlify.app
   ```
3. When you or the auto-printer triggers a print command, Windows/Mac prints immediately without popping up any confirmation prompt!

---

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build production bundle
npm run build
```
