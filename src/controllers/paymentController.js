import Stripe from "stripe"

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

// POST /api/payment/create-intent
// body: { propertyId }
export const createPaymentIntent = async (req, res) => {
  try {
    const stripeInstance = getStripe()
    const { propertyId } = req.body

    if (!propertyId) {
      return res.status(400).json({ message: "Property ID is required" })
    }

    const paymentIntent = await stripeInstance.paymentIntents.create({
      amount: 1999, // $19.99 in cents
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: { propertyId },
    })

    return res.json({ clientSecret: paymentIntent.client_secret })
  } catch (error) {
    console.error("Stripe PaymentIntent error:", error)
    return res.status(500).json({ message: "Payment intent creation failed" })
  }
}