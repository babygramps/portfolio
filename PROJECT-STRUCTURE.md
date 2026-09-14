# Rick's Portfolio - Clean Project Structure

## 📁 Current Project Structure

```
rick-portfolio/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions deployment workflow
├── lambda/
│   ├── contact.js              # Lambda function for contact form
│   └── package.json            # Lambda dependencies
├── .env                        # Environment variables (not in git)
├── .gitignore                  # Git ignore rules
├── deploy-simple.ps1           # Manual deployment script (backup)
├── README.md                   # Main project documentation
├── setup-github-deployment.md # GitHub Actions setup guide
├── rickrothbart.html           # Main HTML file
├── styles.css                  # CSS styles
├── script.js                   # Frontend JavaScript
├── rick.jpg                    # Profile photo
├── laney.png                   # Laney College logo
├── Noya Logo Vertical.png      # Noya logo
└── orbital.svg                 # Orbital Industries logo
```

## 🗑️ Files Removed

### Removed (No Longer Needed):
- ❌ `server.js` - Original Express server (replaced by Lambda)
- ❌ `package.json` - Root package file (not needed for static site)
- ❌ `package-lock.json` - Root lock file
- ❌ `node_modules/` - Root dependencies
- ❌ `deploy.ps1` - Complex deployment script (replaced by simple version)
- ❌ `test-deployment.ps1` - Broken test script
- ❌ `README-deployment.md` - Old deployment docs (merged into README.md)
- ❌ `index.html` - Generated file (created automatically during deployment)
- ❌ `.vscode/` - IDE settings
- ❌ `lambda/node_modules/` - Will be installed during deployment
- ❌ `lambda/package-lock.json` - Will be regenerated

### Kept (Still Needed):
- ✅ `.github/workflows/deploy.yml` - Automated deployment
- ✅ `lambda/contact.js` - Contact form handler
- ✅ `lambda/package.json` - Lambda dependencies
- ✅ `.env` - Environment variables (local only)
- ✅ `.gitignore` - Git ignore rules
- ✅ `deploy-simple.ps1` - Manual deployment backup
- ✅ `README.md` - Project documentation
- ✅ `setup-github-deployment.md` - Setup guide
- ✅ `rickrothbart.html` - Main HTML file
- ✅ `styles.css` - Styles
- ✅ `script.js` - Frontend JavaScript
- ✅ All image files - Assets

## 🎯 Clean Architecture

### Frontend (Static Files)
- **HTML**: `rickrothbart.html` (source) → `index.html` (deployed)
- **CSS**: `styles.css`
- **JavaScript**: `script.js`
- **Images**: `*.jpg`, `*.png`, `*.svg`

### Backend (Serverless)
- **Lambda Function**: `lambda/contact.js`
- **Dependencies**: `lambda/package.json`

### Deployment
- **Automated**: GitHub Actions (`.github/workflows/deploy.yml`)
- **Manual Backup**: PowerShell script (`deploy-simple.ps1`)

### Documentation
- **Main**: `README.md`
- **Setup Guide**: `setup-github-deployment.md`
- **This File**: `PROJECT-STRUCTURE.md`

## 🚀 Deployment Flow

1. **Edit** `rickrothbart.html`, `styles.css`, or `script.js`
2. **Commit & Push** to GitHub
3. **GitHub Actions** automatically:
   - Copies `rickrothbart.html` → `index.html`
   - Uploads static files to S3
   - Updates Lambda function
   - Updates HTML with Lambda URL
4. **Site is live** in 2-3 minutes

## 📦 What Gets Deployed

### To S3 (Static Website):
- `index.html` (copy of `rickrothbart.html`)
- `styles.css`
- `script.js`
- All image files

### To Lambda (Contact Form):
- `lambda/contact.js`
- `lambda/package.json`
- `node_modules/` (installed during deployment)

## 🧹 Maintenance

### Regular Cleanup:
- Generated files are automatically cleaned up
- `node_modules/` folders are not committed to git
- Deployment artifacts are ignored by `.gitignore`

### File Management:
- **Source files**: Edit these directly
- **Generated files**: Created automatically during deployment
- **Dependencies**: Installed automatically when needed

---

**Clean, organized, and ready for professional development! ✨**