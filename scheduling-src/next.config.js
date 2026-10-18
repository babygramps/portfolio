/** @type {import('next').NextConfig} */
module.exports = {
  // Static export served from S3 at rickrothbart.com/scheduling/ (see
  // .github/workflows/deploy.yml). trailingSlash makes every page an
  // index.html under its own folder, which is what the S3 origin serves.
  output: 'export',
  basePath: '/scheduling',
  trailingSlash: true,
  images: { unoptimized: true },
}
