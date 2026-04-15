# 🚀 Complete Deployment Guide

## 📋 Pre-Deployment Checklist

- [ ] All dependencies installed (`npm install`)
- [ ] Project builds successfully (`npm run build`)
- [ ] Optional: `sample.glb` placed in `/public` folder
- [ ] Git repository created (if using GitHub integration)

## 🔥 Firebase Hosting (Recommended)

### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase
```bash
firebase login
```

### Step 3: Initialize Firebase
```bash
firebase init hosting
```

**Select:**
- Public directory: `dist`
- Single-page app: `yes`
- GitHub auto-deploy: `no` (optional)

### Step 4: Build & Deploy
```bash
npm run build
firebase deploy
```

**Your app will be live at:** `https://your-project.web.app`

---

## ▲ Vercel

### Option 1: CLI
```bash
npm install -g vercel
npm run build
vercel --prod
```

### Option 2: GitHub Integration

1. Push code to GitHub
2. Go to https://vercel.com
3. Import repository
4. Vercel auto-detects Vite
5. Deploy!

---

## 🎨 Render

1. Go to https://render.com
2. Create "New Static Site"
3. Connect GitHub repository
4. Configure:
   - **Build Command:** `npm run build`
   - **Publish Directory:** `dist`
5. Click "Create Static Site"

---

## 🌐 Netlify

### Option 1: CLI
```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

### Option 2: Drag & Drop

1. Build locally: `npm run build`
2. Go to https://app.netlify.com/drop
3. Drag `dist` folder to browser
4. Done!

---

## ⚙️ Configuration Files

### firebase.json (Auto-generated)
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### vercel.json (Optional)
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

---

## 🐛 Troubleshooting

### Build Fails
```bash
rm -rf node_modules dist
npm install
npm run build
```

### 3D Model Not Loading

- Ensure `sample.glb` is in `/public` folder
- App auto-falls back to stencil mode if missing

### Gestures Not Working

- Check camera permissions in browser
- Try Chrome/Edge for best compatibility
- MediaPipe loads from CDN on gesture enable

---

## 📊 Performance Tips

1. **Enable compression** in hosting provider
2. **Use CDN** for static assets
3. **Enable HTTP/2** for faster loading
4. **Lazy load** Three.js and MediaPipe (already implemented)

---

## 🔒 Security Notes

- No backend = No API keys needed
- All assets from CDN
- Client-side only
- Camera access requires user permission

---

## 📱 Mobile Optimization

- Responsive design included
- Touch events supported
- Gesture controls work on mobile browsers with camera

---

**Questions? Issues?** Check inline code comments or create a GitHub issue.