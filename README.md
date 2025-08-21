# Rick Rothbart Portfolio

A modern portfolio website showcasing prototyping and build leadership expertise, deployed on AWS with automated CI/CD.

## 🚀 Live Site
**Website**: http://rick-portfolio-2025.s3-website-us-west-1.amazonaws.com

## 🏗️ Architecture

- **Frontend**: Static HTML/CSS/JS hosted on S3
- **Backend**: AWS Lambda function for contact form
- **Email**: Gmail integration with nodemailer
- **Security**: reCAPTCHA spam protection
- **Region**: us-west-1 (Northern California)
- **CI/CD**: GitHub Actions for automated deployments

## 📁 Project Structure

```
rick-portfolio/
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions deployment
├── lambda/
│   ├── contact.js          # Lambda function for contact form
│   └── package.json        # Lambda dependencies
├── rickrothbart.html       # Main HTML file
├── index.html              # Deployment copy (auto-generated)
├── styles.css              # Styles
├── script.js               # Frontend JavaScript
├── *.jpg, *.png, *.svg    # Images and logos
├── deploy-simple.ps1       # Manual deployment script
└── .env                    # Environment variables (not in git)
```

## 🔧 Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd rick-portfolio
   ```

2. **Set up environment variables**
   Create a `.env` file:
   ```env
   GMAIL_APP_PASSWORD=your-16-character-app-password
   RECAPTCHA_SITE_KEY=your-site-key
   RECAPTCHA_SECRET_KEY=your-secret-key
   ```

3. **Test locally** (optional)
   ```bash
   npm install
   npm start
   ```

## 🚀 Deployment

### Automated Deployment (Recommended)

1. **Push to GitHub** - Deployment happens automatically on push to main/master
2. **Manual trigger** - Use GitHub Actions "Run workflow" button

### Manual Deployment

```powershell
.\deploy-simple.ps1
```

## ⚙️ GitHub Actions Setup

### Required Secrets

Add these secrets in your GitHub repository settings:

1. **AWS Credentials**:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

2. **Email & reCAPTCHA**:
   - `GMAIL_APP_PASSWORD`
   - `RECAPTCHA_SITE_KEY`
   - `RECAPTCHA_SECRET_KEY`

### How to Add Secrets

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with the exact names above

## 🔑 Getting Credentials

### AWS Credentials
1. Go to AWS IAM Console
2. Create a new user with programmatic access
3. Attach policies: `AmazonS3FullAccess`, `AWSLambdaFullAccess`, `IAMFullAccess`
4. Save the Access Key ID and Secret Access Key

### Gmail App Password
1. Enable 2-factor authentication on your Google account
2. Go to Google Account → Security → 2-Step Verification → App passwords
3. Generate an app password for "Mail"
4. Use the 16-character password

### reCAPTCHA Keys
1. Go to https://www.google.com/recaptcha/admin
2. Register your domain
3. Get both site key and secret key

## 🔄 Workflow

1. **Make changes** to your code locally
2. **Commit and push** to GitHub
3. **GitHub Actions automatically**:
   - Builds and deploys static files to S3
   - Updates Lambda function code
   - Configures environment variables
   - Updates HTML with Lambda endpoint
4. **Your site is live** in ~2-3 minutes

## 📊 Monitoring

- **AWS CloudWatch**: Lambda function logs and metrics
- **GitHub Actions**: Deployment status and logs
- **AWS S3**: Website access logs (if enabled)

## 💰 Cost

Estimated monthly cost for typical portfolio traffic:
- **S3**: ~$0.50 (storage + requests)
- **Lambda**: ~$0-2 (first 1M requests free)
- **Total**: **~$0.50-2.50/month**

## 🛠️ Customization

### Update Content
- Edit `rickrothbart.html` for content changes
- Modify `styles.css` for styling
- Update `script.js` for functionality

### Change AWS Settings
- Edit `.github/workflows/deploy.yml`
- Update environment variables at the top

### Add New Features
- Modify `lambda/contact.js` for backend changes
- Add new static files and update deployment workflow

## 🔧 Troubleshooting

### Deployment Fails
1. Check GitHub Actions logs
2. Verify all secrets are set correctly
3. Ensure AWS permissions are sufficient

### Contact Form Not Working
1. Check Lambda function logs in CloudWatch
2. Verify environment variables are set
3. Test Gmail app password

### Website Not Loading
1. Check S3 bucket policy allows public read
2. Verify files were uploaded correctly
3. Check S3 website hosting configuration

## 📞 Support

For issues with this deployment setup, check:
1. GitHub Actions logs
2. AWS CloudWatch logs
3. AWS Console for resource status

---

**Built with ❤️ and deployed to AWS us-west-1**