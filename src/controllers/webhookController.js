import Stripe from "stripe"
import Property from "../models/property.js"
import Payment from "../models/payment.js"
import crypto from "crypto"
import property from "../models/property.js"

// Lazy initialization
let stripe
const getStripe = () => {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not defined in environment variables")
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



  // Payement Intent Success
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object
    const propertyId = paymentIntent?.metadata?.propertyId

    if (propertyId) {
      let property = await Property.findById(propertyId)

      if (property) {
        if (!property.uploadToken) {
          property.uploadToken = crypto.randomBytes(16).toString("hex")
        }
        property.status = "paid"
        await property.save()
      }

      await Payment.findOneAndUpdate({ propertyId },
        {
          propertyId,
          stripeSessionId: paymentIntent.id,
          amount: paymentIntent.amount,
          status: "paid",
        },
        { upsert: true, new: true }
      )
    }
  }

  res.json({ received: true })
}