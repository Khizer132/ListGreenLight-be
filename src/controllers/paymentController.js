import Stripe from "stripe"

// Lazy initialization
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

export const createCheckoutSession = async (req, res) => {
  try {
    const stripeInstance = getStripe()
    const { propertyId } = req.body

    if (!propertyId) {
      return res.status(400).json({ message: "Property ID is required" })
    }

    const session = await stripeInstance.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "ListGreenLight – Property Listing"
            },
            unit_amount: 1999 
          },
          quantity: 1
        }
      ],
      metadata: {
        propertyId
      },
      success_url: "http://localhost:5173/upload-link-sent",
      cancel_url: "http://localhost:5173/payment"
    })

    res.json({ url: session.url })
  } catch (error) {
    console.error("Stripe error:", error)
    res.status(500).json({ message: "Payment failed" })
  }
}