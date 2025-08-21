# GitHub Actions Deployment Setup Guide

This guide will help you set up automated deployments from GitHub to AWS.

## 🎯 What You'll Get

- **Push to deploy**: Every push to main/master automatically deploys
- **Fast deployments**: ~2-3 minutes from push to live
- **Secure**: Credentials stored as GitHub secrets
- **Reliable**: Built-in error handling and rollback

## 📋 Step-by-Step Setup

### 1. Create GitHub Repository

```bash
# Initialize git in your project folder
git init

# Add all files
git add .

# Make initial commit
git commit -m "Initial commit - Rick's Portfolio"

# Create repository on GitHub and push
git remote add origin https://github.com/yourusername/rick-portfolio.git
git branch -M main
git push -u origin main
```

### 2. Set Up AWS IAM User for GitHub Actions

1. **Go to AWS IAM Console**
2. **Create new user**:
   - User name: `github-actions-rick-portfolio`
   - Access type: Programmatic access
3. **Attach policies**:
   - `AmazonS3FullAccess`
   - `AWSLambdaFullAccess`
   - `IAMReadOnlyAccess`
4. **Save credentials**: Access Key ID and Secret Access Key

### 3. Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

#### AWS Credentials
- **Name**: `AWS_ACCESS_KEY_ID`
- **Value**: Your AWS Access Key ID

- **Name**: `AWS_SECRET_ACCESS_KEY`
- **Value**: Your AWS Secret Access Key

#### Email Configuration
- **Name**: `GMAIL_APP_PASSWORD`
- **Value**: Your 16-character Gmail app password

#### reCAPTCHA Configuration
- **Name**: `RECAPTCHA_SITE_KEY`
- **Value**: Your reCAPTCHA site key

- **Name**: `RECAPTCHA_SECRET_KEY`
- **Value**: Your reCAPTCHA secret key

### 4. Test the Deployment

1. **Make a small change** to your `rickrothbart.html`
2. **Commit and push**:
   ```bash
   git add .
   git commit -m "Test automated deployment"
   git push
   ```
3. **Watch the deployment**:
   - Go to GitHub → Actions tab
   - Watch your deployment run
   - Should complete in 2-3 minutes

## 🔧 Customizing the Deployment

### Change AWS Settings

Edit `.github/workflows/deploy.yml`:

```yaml
env:
  AWS_REGION: us-west-2  # Change region
  S3_BUCKET: my-new-bucket-name  # Change bucket
  LAMBDA_FUNCTION_NAME: my-function  # Change function name
```

### Deploy on Different Branches

```yaml
on:
  push:
    branches: [ main, develop, staging ]  # Add more branches
```

### Add Environment-Specific Deployments

```yaml
jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    # Deploy to staging environment
    
  deploy-production:
    if: github.ref == 'refs/heads/main'
    # Deploy to production environment
```

## 🚀 Deployment Workflow

Here's what happens when you push code:

1. **Trigger**: Push to main/master branch
2. **Checkout**: GitHub Actions downloads your code
3. **AWS Setup**: Configures AWS credentials
4. **Static Files**: Uploads HTML, CSS, JS, images to S3
5. **Lambda**: Updates function code and environment variables
6. **HTML Update**: Injects Lambda URL into HTML
7. **Complete**: Your site is live!

## 📊 Monitoring Deployments

### GitHub Actions
- **View logs**: Repository → Actions → Click on workflow run
- **Re-run failed deployments**: Click "Re-run jobs"
- **Manual deployments**: Use "Run workflow" button

### AWS CloudWatch
- **Lambda logs**: Monitor function execution
- **Error tracking**: Set up alarms for failures

## 🔍 Troubleshooting

### Common Issues

1. **"AWS credentials not configured"**
   - Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY secrets
   - Verify IAM user has correct permissions

2. **"Bucket does not exist"**
   - Make sure S3 bucket name matches in workflow
   - Check if bucket was created in correct region

3. **"Lambda function not found"**
   - Verify LAMBDA_FUNCTION_NAME in workflow
   - Check if function exists in correct region

4. **"Environment variables not set"**
   - Verify all GitHub secrets are added correctly
   - Check secret names match exactly

### Debug Steps

1. **Check GitHub Actions logs**:
   - Go to Actions tab in your repository
   - Click on failed workflow
   - Expand failed steps to see error details

2. **Verify AWS resources**:
   - Check S3 bucket exists and has correct permissions
   - Verify Lambda function is in correct region
   - Confirm IAM user has necessary permissions

3. **Test locally**:
   - Run `.\deploy-simple.ps1` to test manual deployment
   - Compare with automated deployment

## 🎉 Benefits of GitHub Actions Deployment

### Speed
- **2-3 minutes** from push to live
- **Parallel processing** of static files and Lambda
- **Incremental updates** only change what's needed

### Reliability
- **Atomic deployments** - all or nothing
- **Rollback capability** - revert to previous commit
- **Error handling** - stops on first failure

### Security
- **No credentials in code** - stored as GitHub secrets
- **Audit trail** - every deployment is logged
- **Access control** - only authorized users can deploy

### Convenience
- **Zero-click deployments** - just push code
- **Branch-based deployments** - different environments
- **Manual triggers** - deploy on demand

## 🔄 Workflow Examples

### Feature Development
```bash
# Create feature branch
git checkout -b feature/new-section

# Make changes
# ... edit files ...

# Commit and push (no deployment yet)
git add .
git commit -m "Add new portfolio section"
git push origin feature/new-section

# Create pull request for review
# Merge to main triggers deployment
```

### Hotfix Deployment
```bash
# Make urgent fix
git checkout main
# ... fix critical issue ...
git add .
git commit -m "Fix contact form validation"
git push  # Automatically deploys in 2-3 minutes
```

### Rollback
```bash
# Revert to previous commit
git revert HEAD
git push  # Automatically deploys previous version
```

---

**Your portfolio now has professional-grade CI/CD! 🚀**