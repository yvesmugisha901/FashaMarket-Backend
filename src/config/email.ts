// Email service — temporarily disabled until email provider is configured
// All functions are no-ops so the rest of the system works normally

export const sendWelcomeEmail = async (to: string, name: string, role: string) => {
  console.log(`[EMAIL] Welcome email to ${to} (${name}) — ${role}`)
}

export const sendOrderConfirmationEmail = async (
  to: string, buyerName: string, orderId: string,
  productTitle: string, price: number, paymentMethod: string
) => {
  console.log(`[EMAIL] Order confirmation to ${to} — Order ${orderId.slice(0, 8)}`)
}

export const sendOrderStatusEmail = async (
  to: string, buyerName: string, orderId: string,
  productTitle: string, status: string
) => {
  console.log(`[EMAIL] Status update to ${to} — ${status}`)
}

export const sendSellerNotificationEmail = async (
  to: string, sellerName: string, productTitle: string,
  buyerName: string, orderId: string
) => {
  console.log(`[EMAIL] Seller notification to ${to} — ${productTitle}`)
}

export const sendProductApprovedEmail = async (
  to: string, sellerName: string, productTitle: string
) => {
  console.log(`[EMAIL] Product approved to ${to} — ${productTitle}`)
}

export const sendProductRejectedEmail = async (
  to: string, sellerName: string, productTitle: string
) => {
  console.log(`[EMAIL] Product rejected to ${to} — ${productTitle}`)
}