param(
    [string]$BucketName = "rick-portfolio-2025",
    [string]$Region = "us-west-1"
)

Write-Host "Deploying Rick's Portfolio to AWS..." -ForegroundColor Green
Write-Host "Bucket: $BucketName" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan

# Configure bucket for static website hosting
Write-Host "Configuring static website hosting..." -ForegroundColor Yellow
aws s3 website s3://$BucketName --index-document index.html --error-document index.html

# Set bucket policy for public read access
Write-Host "Setting bucket policy..." -ForegroundColor Yellow
$policy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BucketName/*"
    }
  ]
}
"@

$policy | Out-File -FilePath "policy.json" -Encoding ASCII
aws s3api put-bucket-policy --bucket $BucketName --policy file://policy.json
Remove-Item "policy.json"

# Prepare and upload files
Write-Host "Preparing files..." -ForegroundColor Yellow
Copy-Item "rickrothbart.html" "index.html" -Force

Write-Host "Uploading files to S3..." -ForegroundColor Yellow
aws s3 cp index.html s3://$BucketName/index.html --content-type "text/html"
aws s3 cp styles.css s3://$BucketName/styles.css --content-type "text/css"
aws s3 cp script.js s3://$BucketName/script.js --content-type "application/javascript"
aws s3 cp rick.jpg s3://$BucketName/rick.jpg --content-type "image/jpeg"
aws s3 cp laney.png s3://$BucketName/laney.png --content-type "image/png"
aws s3 cp "Noya Logo Vertical.png" s3://$BucketName/"Noya Logo Vertical.png" --content-type "image/png"
aws s3 cp orbital.svg s3://$BucketName/orbital.svg --content-type "image/svg+xml"

# Upload favicon files
aws s3 cp favicon.ico s3://$BucketName/favicon.ico --content-type "image/x-icon"
aws s3 cp favicon.svg s3://$BucketName/favicon.svg --content-type "image/svg+xml"
aws s3 cp apple-touch-icon.svg s3://$BucketName/apple-touch-icon.svg --content-type "image/svg+xml"
aws s3 cp site.webmanifest s3://$BucketName/site.webmanifest --content-type "application/manifest+json"

Write-Host "Files uploaded successfully!" -ForegroundColor Green

# Deploy Lambda function
Write-Host "Deploying Lambda function..." -ForegroundColor Yellow

# Go to lambda directory and install dependencies
Push-Location lambda
npm install --production --silent

# Create deployment package
if (Test-Path "deployment.zip") { Remove-Item "deployment.zip" }
Compress-Archive -Path "contact.js", "package.json", "node_modules" -DestinationPath "deployment.zip" -Force
Pop-Location

# Create IAM role for Lambda
Write-Host "Creating IAM role..." -ForegroundColor Cyan
$trustPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
"@

$trustPolicy | Out-File -FilePath "trust.json" -Encoding ASCII

try {
    aws iam create-role --role-name rick-portfolio-lambda-role --assume-role-policy-document file://trust.json
    aws iam attach-role-policy --role-name rick-portfolio-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    Write-Host "IAM role created" -ForegroundColor Green
    Start-Sleep 15  # Wait for role to propagate
} catch {
    Write-Host "IAM role might already exist" -ForegroundColor Yellow
}

Remove-Item "trust.json"

# Get account ID and create role ARN
$accountId = aws sts get-caller-identity --query Account --output text
$roleArn = "arn:aws:iam::${accountId}:role/rick-portfolio-lambda-role"

# Create Lambda function
Write-Host "Creating Lambda function..." -ForegroundColor Cyan
try {
    aws lambda create-function --function-name rick-portfolio-contact --runtime nodejs18.x --role $roleArn --handler contact.handler --zip-file fileb://lambda/deployment.zip --timeout 30 --region $Region
    Write-Host "Lambda function created" -ForegroundColor Green
} catch {
    Write-Host "Updating existing Lambda function..." -ForegroundColor Yellow
    aws lambda update-function-code --function-name rick-portfolio-contact --zip-file fileb://lambda/deployment.zip --region $Region
}

# Set environment variables
Write-Host "Setting environment variables..." -ForegroundColor Cyan
if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    $gmailPassword = ($envContent | Where-Object { $_ -match "GMAIL_APP_PASSWORD=(.+)" }) -replace "GMAIL_APP_PASSWORD=", ""
    $recaptchaSite = ($envContent | Where-Object { $_ -match "RECAPTCHA_SITE_KEY=(.+)" }) -replace "RECAPTCHA_SITE_KEY=", ""
    $recaptchaSecret = ($envContent | Where-Object { $_ -match "RECAPTCHA_SECRET_KEY=(.+)" }) -replace "RECAPTCHA_SECRET_KEY=", ""
    
    aws lambda update-function-configuration --function-name rick-portfolio-contact --environment "Variables={GMAIL_APP_PASSWORD=$gmailPassword,RECAPTCHA_SITE_KEY=$recaptchaSite,RECAPTCHA_SECRET_KEY=$recaptchaSecret}" --region $Region
    Write-Host "Environment variables set" -ForegroundColor Green
}

# Create Function URL
Write-Host "Creating Function URL..." -ForegroundColor Cyan
try {
    $functionUrl = aws lambda create-function-url-config --function-name rick-portfolio-contact --auth-type NONE --cors AllowCredentials=false,AllowHeaders=content-type,AllowMethods=POST,AllowOrigins=* --region $Region --query 'FunctionUrl' --output text
    Write-Host "Function URL created: $functionUrl" -ForegroundColor Green
} catch {
    $functionUrl = aws lambda get-function-url-config --function-name rick-portfolio-contact --region $Region --query 'FunctionUrl' --output text
    Write-Host "Using existing Function URL: $functionUrl" -ForegroundColor Green
}

# Update HTML with Lambda URL and re-upload
Write-Host "Updating HTML with Lambda endpoint..." -ForegroundColor Cyan
$htmlContent = Get-Content "index.html" -Raw
$htmlContent = $htmlContent -replace 'action="/contact"', "action=`"$functionUrl`""
$htmlContent | Out-File -FilePath "index.html" -Encoding UTF8
aws s3 cp index.html s3://$BucketName/index.html --content-type "text/html"

# Clean up
Remove-Item "lambda/deployment.zip" -ErrorAction SilentlyContinue

# Summary
$websiteUrl = "http://$BucketName.s3-website-$Region.amazonaws.com"

Write-Host ""
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "======================" -ForegroundColor Green
Write-Host "Website URL: $websiteUrl" -ForegroundColor Cyan
Write-Host "Lambda Function URL: $functionUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Your portfolio is now live!" -ForegroundColor Green
Write-Host "✅ Contact form is working with Lambda" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Test your website: $websiteUrl" -ForegroundColor White
Write-Host "2. Test the contact form" -ForegroundColor White
Write-Host "3. Consider setting up CloudFront for HTTPS and global CDN" -ForegroundColor White