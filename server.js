// server.js — Discord App Backend with MySQL + Gmail Password Reset
require('dotenv').config();
const express    = require('express');
const bcrypt     = require('bcryptjs');
const cors       = require('cors');
const path       = require('path');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const { initPool, getConnection } = require('./db');

const app  = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ══════════════════════════════════════
// Gmail Transporter
// ══════════════════════════════════════
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// ══════════════════════════════════════
// POST /api/register
// ══════════════════════════════════════
app.post('/api/register', async (req, res) => {
  const { email, username, displayName, password, dobMonth, dobDay, dobYear, emailOptIn } = req.body;

  if (!email || !username || !password || !dobMonth || !dobDay || !dobYear) {
    return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  let conn;
  try {
    conn = await getConnection();

    const [emailCheck] = await conn.execute(
      'SELECT user_id FROM discord_users WHERE email = ?', [email]
    );
    if (emailCheck.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const [userCheck] = await conn.execute(
      'SELECT user_id FROM discord_users WHERE username = ?', [username]
    );
    if (userCheck.length > 0) {
      return res.status(409).json({ success: false, message: 'This username is already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await conn.execute(
      `INSERT INTO discord_users 
        (email, username, display_name, password_hash, dob_month, dob_day, dob_year, email_opt_in)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, username, displayName || username, passwordHash,
       parseInt(dobMonth), parseInt(dobDay), parseInt(dobYear), emailOptIn ? 1 : 0]
    );

    const name = displayName || username;
    console.log(`✅ Registered: ${username} (${email})`);
    res.json({ success: true, message: `Welcome to Discord, ${name}!`, username: name });

  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  } finally {
    if (conn) conn.release();
  }
});

// ══════════════════════════════════════
// POST /api/login
// ══════════════════════════════════════
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  let conn;
  try {
    conn = await getConnection();

    const [rows] = await conn.execute(
      'SELECT user_id, username, display_name, password_hash FROM discord_users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user  = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    await conn.execute('UPDATE discord_users SET last_login = NOW() WHERE user_id = ?', [user.user_id]);
    await conn.execute('INSERT INTO discord_login_logs (user_id, status) VALUES (?, ?)', [user.user_id, 'SUCCESS']);

    const name = user.display_name || user.username;
    console.log(`✅ Logged in: ${user.username}`);
    res.json({ success: true, message: `Welcome back, ${name}!`, username: name });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  } finally {
    if (conn) conn.release();
  }
});

// ══════════════════════════════════════
// POST /api/forgot-password
// Sends real reset email via Gmail
// ══════════════════════════════════════
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  let conn;
  try {
    conn = await getConnection();

    // Check if email exists
    const [rows] = await conn.execute(
      'SELECT user_id, display_name, username FROM discord_users WHERE email = ?', [email]
    );

    // Always say success (security — don't reveal if email exists)
    if (rows.length === 0) {
      return res.json({ success: true, message: 'If this email exists, a reset link has been sent.' });
    }

    const user = rows[0];
    const name = user.display_name || user.username;

    // Generate secure reset token
    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to database
    await conn.execute(
      'UPDATE discord_users SET reset_token = ?, reset_token_expires = ? WHERE user_id = ?',
      [token, expiresAt, user.user_id]
    );

    // Build reset link
    const resetLink = `${process.env.APP_URL}/reset-password?token=${token}`;

    // Send email via Gmail
    await transporter.sendMail({
      from:    `"Discord" <${process.env.GMAIL_USER}>`,
      to:      email,
      subject: 'Reset your Discord password',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#313338;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#313338;padding:40px 0;">
            <tr><td align="center">
              <table width="480" cellpadding="0" cellspacing="0" style="background:#2b2d31;border-radius:8px;overflow:hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background:#5865F2;padding:32px;text-align:center;">
                    <img src="https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png" 
                         width="48" height="48" alt="Discord" style="display:block;margin:0 auto 12px;">
                    <h1 style="color:#fff;font-size:22px;margin:0;font-weight:700;">Password Reset Request</h1>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:32px;">
                    <p style="color:#dbdee1;font-size:16px;margin:0 0 16px;">Hey <strong>${name}</strong>,</p>
                    <p style="color:#b5bac1;font-size:15px;line-height:1.6;margin:0 0 24px;">
                      We received a request to reset the password for your Discord account associated with this email address.
                    </p>
                    <p style="color:#b5bac1;font-size:15px;line-height:1.6;margin:0 0 28px;">
                      Click the button below to reset your password. This link will expire in <strong style="color:#fff;">1 hour</strong>.
                    </p>
                    
                    <!-- Button -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td align="center" style="padding:0 0 28px;">
                        <a href="${resetLink}" 
                           style="display:inline-block;background:#5865F2;color:#fff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 36px;border-radius:4px;">
                          Reset Password
                        </a>
                      </td></tr>
                    </table>

                    <p style="color:#80848e;font-size:13px;line-height:1.6;margin:0 0 8px;">
                      Or copy and paste this link into your browser:
                    </p>
                    <p style="color:#00a8fc;font-size:12px;word-break:break-all;margin:0 0 24px;">
                      ${resetLink}
                    </p>

                    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:0 0 24px;">
                    <p style="color:#80848e;font-size:13px;line-height:1.6;margin:0;">
                      If you did not request a password reset, you can safely ignore this email. 
                      Your password will not be changed.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#1e1f22;padding:20px 32px;text-align:center;">
                    <p style="color:#80848e;font-size:12px;margin:0;">
                      © 2024 Discord, Inc. · 444 De Haro Street, San Francisco, CA 94107
                    </p>
                  </td>
                </tr>

              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log(`📧 Password reset email sent to: ${email}`);
    res.json({ success: true, message: 'Password reset link sent! Check your inbox.' });

  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to send email. Check your Gmail settings in .env' });
  } finally {
    if (conn) conn.release();
  }
});

// ══════════════════════════════════════
// GET /reset-password
// Shows the reset password page
// ══════════════════════════════════════
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

// ══════════════════════════════════════
// POST /api/reset-password
// Actually resets the password
// ══════════════════════════════════════
app.post('/api/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ success: false, message: 'Token and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  let conn;
  try {
    conn = await getConnection();

    const [rows] = await conn.execute(
      'SELECT user_id FROM discord_users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'This reset link has expired or is invalid. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await conn.execute(
      'UPDATE discord_users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE user_id = ?',
      [passwordHash, rows[0].user_id]
    );

    console.log(`✅ Password reset for user_id: ${rows[0].user_id}`);
    res.json({ success: true, message: 'Password reset successfully! You can now log in.' });

  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  } finally {
    if (conn) conn.release();
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function start() {
  await initPool();
  app.listen(PORT,'0.0.0.0', () => {
    console.log(`\n🚀 Discord App running at http://localhost:${PORT}\n`);
  });
}
start();


// ══════════════════════════════════════
// POST /api/check-email
// Step 1 — verify email exists
// ══════════════════════════════════════
app.post('/api/check-email', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ exists: false });

  let conn;
  try {
    conn = await getConnection();
    const [rows] = await conn.execute(
      'SELECT user_id FROM discord_users WHERE email = ?', [email]
    );
    res.json({ exists: rows.length > 0 });
  } catch (err) {
    console.error('Check email error:', err.message);
    res.status(500).json({ exists: false });
  } finally {
    if (conn) conn.release();
  }
});

// ══════════════════════════════════════
// POST /api/change-password
// Step 2 — verify current pw, save new pw
// ══════════════════════════════════════
app.post('/api/change-password', async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  if (!email || !currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
  }

  let conn;
  try {
    conn = await getConnection();

    // Get user
    const [rows] = await conn.execute(
      'SELECT user_id, password_hash FROM discord_users WHERE email = ?', [email]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    const user = rows[0];

    // Verify current password
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    // Check new password is different
    const same = await bcrypt.compare(newPassword, user.password_hash);
    if (same) {
      return res.status(400).json({ success: false, message: 'New password must be different from current password.' });
    }

    // Save new password
    const newHash = await bcrypt.hash(newPassword, 12);
    await conn.execute(
      'UPDATE discord_users SET password_hash = ? WHERE user_id = ?',
      [newHash, user.user_id]
    );

    console.log(`✅ Password changed for: ${email}`);
    res.json({ success: true, message: 'Password changed successfully!' });

  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  } finally {
    if (conn) conn.release();
  }
});

// ══════════════════════════════════════
// QR LOGIN ENDPOINTS
// ══════════════════════════════════════

// In-memory QR sessions (token → {status, userId, username})
const qrSessions = new Map();

// Generate a new QR token
app.get('/api/qr/generate', (req, res) => {
  const token = crypto.randomBytes(20).toString('hex');
  qrSessions.set(token, { status: 'pending', userId: null, username: null });

  // Auto-delete after 5 minutes
  setTimeout(() => qrSessions.delete(token), 5 * 60 * 1000);

  res.json({ success: true, token });
});

// Poll — desktop browser checks if QR was scanned
app.get('/api/qr/poll/:token', (req, res) => {
  const session = qrSessions.get(req.params.token);
  if (!session) return res.json({ status: 'expired' });
  res.json({ status: session.status, username: session.username });
});

// Mobile scan page — shown when phone scans QR
app.get('/qr-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'qr-login.html'));
});

// Mobile confirms login with their credentials
app.post('/api/qr/confirm', async (req, res) => {
  const { token, email, password } = req.body;
  const session = qrSessions.get(token);
  if (!session) return res.status(400).json({ success: false, message: 'QR code expired.' });

  let conn;
  try {
    conn = await getConnection();
    const [rows] = await conn.execute(
      'SELECT user_id, username, display_name, password_hash FROM discord_users WHERE email = ?', [email]
    );
    if (rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const name = user.display_name || user.username;
    session.status   = 'confirmed';
    session.username = name;

    await conn.execute('UPDATE discord_users SET last_login = NOW() WHERE user_id = ?', [user.user_id]);
    console.log(`✅ QR login confirmed: ${user.username}`);
    res.json({ success: true, message: `Welcome back, ${name}!` });
  } catch (err) {
    console.error('QR confirm error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    if (conn) conn.release();
  }
});
