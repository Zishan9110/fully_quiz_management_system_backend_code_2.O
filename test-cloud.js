require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// Your exact credentials
cloudinary.config({
  cloud_name: 'dnscgjjod',
  api_key: '938141718537411',
  api_secret: 'inyuAsIaJmYpYhrTSyfLnsC18rA'
});

console.log("Testing Cloudinary upload with your credentials...");

// Try to upload a small test image from URL
cloudinary.uploader.upload('https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png', {
  folder: 'test'
})
.then(result => {
  console.log("✅ SUCCESS! Cloudinary is working!");
  console.log("Uploaded URL:", result.secure_url);
})
.catch(err => {
  console.log("❌ FAILED!");
  console.log("Error message:", err.message);
  console.log("Error code:", err.code);
  console.log("HTTP status:", err.http_code);
  
  if (err.message.includes("Invalid Signature") || err.message.includes("api_key")) {
    console.log("\n🔴 PROBLEM: API credentials are invalid");
    console.log("Solution: Generate new credentials from Cloudinary Dashboard");
  } else if (err.message.includes("rate limit")) {
    console.log("\n🔴 PROBLEM: Rate limit exceeded");
  } else if (err.message.includes("Missing required parameter")) {
    console.log("\n🔴 PROBLEM: Cloud name might be wrong");
  } else if (err.message.includes("connect ETIMEDOUT") || err.message.includes("ECONNREFUSED")) {
    console.log("\n🔴 PROBLEM: Network issue - VPN or firewall blocking");
  }
});