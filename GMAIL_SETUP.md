# 📧 How to Set Up Gmail for Password Reset

## Step 1 — Enable 2-Step Verification on your Gmail
1. Go to: https://myaccount.google.com/security
2. Click "2-Step Verification"
3. Follow the steps to turn it ON
   (Required before you can create an App Password)

## Step 2 — Create a Gmail App Password
1. Go to: https://myaccount.google.com/apppasswords
2. Under "App name" type:  Discord App
3. Click "Create"
4. Google will show you a 16-character password like:
   xxxx xxxx xxxx xxxx
5. COPY THIS PASSWORD — you only see it once!

## Step 3 — Update your .env file
Open your .env file and fill in:

GMAIL_USER=yourgmail@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

Example:
GMAIL_USER=johndoe@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop

## Step 4 — Restart the server
In your cmd:
  npm start

## Step 5 — Test it
1. Go to http://localhost:3000
2. Click "Forgot your password?"
3. Enter the email of a registered user
4. Click "Send Reset Link"
5. Check that Gmail inbox for the email!

---

## How it works:
1. User clicks "Forgot Password" and enters email
2. Server generates a secure random token
3. Token is saved in the database with 1 hour expiry
4. A beautiful reset email is sent to the user's Gmail
5. User clicks the link → goes to /reset-password page
6. User enters new password → saved to database
7. Token is deleted so link can't be used again
