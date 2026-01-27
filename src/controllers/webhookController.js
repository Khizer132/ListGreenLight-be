import Stripe from "stripe"
import Property from "../models/property.js"
import Payment from "../models/payment.js"

// Lazy initialization - only create when function is called
let stripe

const getStripe = () => {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not defined in environment variables')
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return stripe
}

export const stripeWebhook = async (req, res) => {
  const stripeInstance = getStripe()
  const sig = req.headers["stripe-signature"]

  let event
  try {
    event = stripeInstance.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object
    const propertyId = session.metadata.propertyId

    await Property.findByIdAndUpdate(propertyId, {
      status: "paid"
    })

    await Payment.create({
      propertyId,
      stripeSessionId: session.id,
      amount: session.amount_total,
      status: "paid"
    })
  }

  res.json({ received: true })
}