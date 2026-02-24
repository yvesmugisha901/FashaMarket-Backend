import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    },
})

const FROM = `FashaMarket <${process.env.GMAIL_USER}>`

const baseTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #f4f4f5; color: #18181b; }
    .wrapper { max-width: 580px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: #18181b; padding: 28px 40px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .header span { color: #4ade80; }
    .body { padding: 40px; }
    .body p { font-size: 15px; line-height: 1.6; color: #52525b; margin-bottom: 16px; }
    .body h2 { font-size: 20px; font-weight: 700; color: #18181b; margin-bottom: 8px; }
    .btn { display: inline-block; background: #18181b; color: #ffffff !important; font-weight: 600; font-size: 14px; padding: 14px 28px; border-radius: 10px; text-decoration: none; margin: 16px 0; }
    .info-box { background: #f4f4f5; border-radius: 12px; padding: 20px 24px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e4e4e7; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #71717a; }
    .info-value { font-weight: 600; color: #18181b; }
    .footer { background: #f4f4f5; padding: 24px 40px; text-align: center; font-size: 12px; color: #a1a1aa; }
    .divider { height: 1px; background: #f4f4f5; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Fasha<span>Market</span></h1>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} FashaMarket · Kigali, Rwanda</p>
    </div>
  </div>
</body>
</html>
`

const send = async (to: string, subject: string, html: string) => {
    await transporter.sendMail({ from: FROM, to, subject, html })
}

export const sendWelcomeEmail = async (to: string, name: string, role: string) => {
    const html = baseTemplate(`
    <h2>Welcome to FashaMarket, ${name}! 🎉</h2>
    <p>Your account has been created successfully as a <strong>${role.toLowerCase()}</strong>.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Email</span><span class="info-value">${to}</span></div>
      <div class="info-row"><span class="info-label">Account Type</span><span class="info-value">${role}</span></div>
    </div>
    ${role === 'SELLER'
            ? `<p>You can start listing your items right away. Our admin team will review your listings within 24 hours.</p>`
            : `<p>Browse hundreds of verified second-hand products and buy with confidence.</p>`
        }
    <a href="http://localhost:5173" class="btn">Go to FashaMarket →</a>
    <div class="divider"></div>
    <p style="font-size:13px;color:#a1a1aa">If you didn't create this account, please ignore this email.</p>
  `)
    await send(to, `Welcome to FashaMarket, ${name}!`, html)
}

export const sendOrderConfirmationEmail = async (
    to: string, buyerName: string, orderId: string,
    productTitle: string, price: number, paymentMethod: string
) => {
    const html = baseTemplate(`
    <h2>Order Confirmed ✅</h2>
    <p>Hi ${buyerName}, your order has been placed successfully.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Order ID</span><span class="info-value">#${orderId.slice(0, 8).toUpperCase()}</span></div>
      <div class="info-row"><span class="info-label">Product</span><span class="info-value">${productTitle}</span></div>
      <div class="info-row"><span class="info-label">Amount</span><span class="info-value">${Number(price).toLocaleString()} RWF</span></div>
      <div class="info-row"><span class="info-label">Payment</span><span class="info-value">${paymentMethod === 'MOBILE_MONEY' ? '📱 Mobile Money' : '💵 Cash on Delivery'}</span></div>
      <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="color:#16a34a">● Pending</span></div>
    </div>
    <p>Estimated delivery: <strong>1-3 business days</strong>.</p>
    <a href="http://localhost:5173/dashboard" class="btn">Track Your Order →</a>
  `)
    await send(to, `Order Confirmed — ${productTitle}`, html)
}

export const sendOrderStatusEmail = async (
    to: string, buyerName: string, orderId: string,
    productTitle: string, status: string
) => {
    const INFO: Record<string, { emoji: string; title: string; message: string; color: string }> = {
        PAID: { emoji: '💳', title: 'Payment Received', message: 'Your payment has been confirmed. The seller is preparing your item.', color: '#2563eb' },
        SHIPPED: { emoji: '🚚', title: 'Your Order is on the Way!', message: 'Your item has been shipped. Estimated arrival: 1-2 business days.', color: '#7c3aed' },
        DELIVERED: { emoji: '📦', title: 'Order Delivered!', message: 'Your order has been delivered. We hope you love your purchase! Please leave a review.', color: '#16a34a' },
        CANCELLED: { emoji: '❌', title: 'Order Cancelled', message: 'Your order has been cancelled. Contact support if you have questions.', color: '#dc2626' },
    }
    const info = INFO[status] || { emoji: '📋', title: 'Order Update', message: `Your order status: ${status}`, color: '#18181b' }

    const html = baseTemplate(`
    <h2>${info.emoji} ${info.title}</h2>
    <p>Hi ${buyerName}, here's an update on your order.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Order ID</span><span class="info-value">#${orderId.slice(0, 8).toUpperCase()}</span></div>
      <div class="info-row"><span class="info-label">Product</span><span class="info-value">${productTitle}</span></div>
      <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="color:${info.color}">● ${status}</span></div>
    </div>
    <p>${info.message}</p>
    <a href="http://localhost:5173/dashboard" class="btn">View Order →</a>
  `)
    await send(to, `${info.emoji} Order Update — ${productTitle}`, html)
}

export const sendSellerNotificationEmail = async (
    to: string, sellerName: string, productTitle: string,
    buyerName: string, orderId: string
) => {
    const html = baseTemplate(`
    <h2>New Order Received! 🛍️</h2>
    <p>Hi ${sellerName}, someone just placed an order for your listing.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Order ID</span><span class="info-value">#${orderId.slice(0, 8).toUpperCase()}</span></div>
      <div class="info-row"><span class="info-label">Product</span><span class="info-value">${productTitle}</span></div>
      <div class="info-row"><span class="info-label">Buyer</span><span class="info-value">${buyerName}</span></div>
    </div>
    <p>Please prepare the item for delivery.</p>
    <a href="http://localhost:5173/dashboard" class="btn">View Dashboard →</a>
  `)
    await send(to, `New Order — ${productTitle}`, html)
}

export const sendProductApprovedEmail = async (to: string, sellerName: string, productTitle: string) => {
    const html = baseTemplate(`
    <h2>Your Listing is Live! 🎉</h2>
    <p>Hi ${sellerName}, your product has been approved and is now visible to buyers.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Product</span><span class="info-value">${productTitle}</span></div>
      <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="color:#16a34a">● Approved & Live</span></div>
    </div>
    <p>You'll be notified as soon as someone places an order.</p>
    <a href="http://localhost:5173/products" class="btn">View Listing →</a>
  `)
    await send(to, `✅ Your listing "${productTitle}" is now live`, html)
}

export const sendProductRejectedEmail = async (to: string, sellerName: string, productTitle: string) => {
    const html = baseTemplate(`
    <h2>Listing Not Approved</h2>
    <p>Hi ${sellerName}, your listing did not meet our guidelines.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Product</span><span class="info-value">${productTitle}</span></div>
      <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="color:#dc2626">● Rejected</span></div>
    </div>
    <p>Common reasons: unclear images, inaccurate description, or prohibited items. You're welcome to create a new listing.</p>
    <a href="http://localhost:5173/sell" class="btn">Create New Listing →</a>
  `)
    await send(to, `Listing Update — ${productTitle}`, html)
}