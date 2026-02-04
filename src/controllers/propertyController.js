import User from "../models/user.js"
import Property from "../models/property.js"
import Payment from "../models/payment.js"
import Stripe from "stripe"
import crypto from "crypto"
import cloudinary from "../config/cloudinary.js"

// create property => post /api/property/create-property
export const createProperty = async (req, res) => {
  try {
    const { name, email, phoneNo, address } = req.body;

    if (!name || !email || !phoneNo || !address) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    let user = await User.findOne({ email })

    if (!user) {
      user = await User.create({ name, email, phoneNo })
    }

    const property = await Property.create({
      userId: user._id,
      address
    })

    res.status(201).json({ propertyId: property._id })

  } catch (error) {
    console.error("Create property error:", error)
    res.status(500).json({ message: "Server error" })
  }
}



// GET upload Link => get /api/property/:propertyId/upload-link
export const getUploadLink = async (req, res) => {
  try {
    const { propertyId } = req.params

    const property = await Property.findById(propertyId)
    if (!property) {
      return res.status(404).json({ message: "Property not found" })
    }

    if (property.status !== "paid") {
      return res.status(400).json({ message: "Payment not completed for this property" })
    }

    if (!property.uploadToken) {
      return res
        .status(400)
        .json({ message: "Upload link not yet generated. Please try again later." })
    }

    return res.json({ uploadToken: property.uploadToken })
  } catch (error) {
    console.error("Get upload link error:", error)
    return res.status(500).json({ message: "Server error" })
  }
}

// get upload link => POST /api/property/confirm-payment-and-upload-link
// Verifies payment with Stripe, sets property paid + token, returns uploadToken
export const confirmPaymentAndGetUploadLink = async (req, res) => {
  try {
    const { propertyId, paymentIntentId } = req.body

    if (!propertyId || !paymentIntentId) {
      return res.status(400).json({ message: "propertyId and paymentIntentId are required" })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ message: "Payment not completed" })
    }

    const metaPropertyId = paymentIntent.metadata?.propertyId
    if (metaPropertyId !== propertyId) {
      return res.status(400).json({ message: "Payment does not match this property" })
    }

    let property = await Property.findById(propertyId)
    if (!property) {
      return res.status(404).json({ message: "Property not found" })
    }

    if (!property.uploadToken) {
      property.uploadToken = crypto.randomBytes(16).toString("hex")
    }
    property.status = "paid"
    await property.save()

    await Payment.findOneAndUpdate(
      { propertyId },
      {
        propertyId,
        stripeSessionId: paymentIntent.id,
        amount: paymentIntent.amount,
        status: "paid",
      },
      { upsert: true, new: true }
    )

    return res.json({ uploadToken: property.uploadToken })
  } catch (error) {
    console.error("Confirm payment and get upload link error:", error)
    return res.status(500).json({ message: "Server error" })
  }
}

// GET property by upload token => get /api/property/by-upload-token/:token
export const getPropertyByUploadToken = async (req, res) => {
  try {
    const { token } = req.params

    const property = await Property.findOne({ uploadToken: token }).populate("userId")
    if (!property) {
      return res.status(404).json({ message: "Invalid or expired upload link" })
    }

    if (property.status !== "paid") {
      return res.status(400).json({ message: "Payment not completed for this property" })
    }

    return res.json({
      address: property.address,
      status: property.status,
      photos: property.photos || [],
      analysisStatus: property.analysisStatus || "pending",
      analysisResults: property.analysisResults || [],
      user: {
        name: property.userId?.name,
        email: property.userId?.email,
        phoneNo: property.userId?.phoneNo,
      },
    })
  } catch (error) {
    console.error("Get property by upload token error:", error)
    return res.status(500).json({ message: "Server error" })
  }
}

// get details => get /api/property/get-details
export const getDetails = async (req, res) => {
  const user = await User.findById(req?.user?.id);
  const property = await Property.findById(req?.property?.id);

  res.status(200).json({
    success: true,
    user,
    property
  });
}


// upload photo => post /api/property/upload-photo
export const uploadPhoto = async (req, res) => {
  try {
    const token = req.body.token
    const roomType = req.body.roomType
    const file = req.file

    if (!token || !roomType || !file) {
      return res.status(400).json({
        message: "token, roomType, and photo file are required",
      })
    }

    const allowedRooms = [
      "kitchen",
      "living-room",
      "primary-bedroom",
      "primary-bathroom",
    ]
    if (!allowedRooms.includes(roomType)) {
      return res.status(400).json({ message: "Invalid roomType" })
    }

    const property = await Property.findOne({ uploadToken: token })

    if (!property) {
      return res.status(404).json({ message: "Invalid or expired upload link" })
    }

    if (property.status !== "paid") {
      return res.status(400).json({ message: "Payment not completed" })
    }

    // delete previous photo
    if (!Array.isArray(property.photos)) {
      property.photos = []
    }
    property.photos = property.photos.filter(
      (p) => p.roomType !== roomType
    )

    // delete previous analysis
    if(!Array.isArray(property.analysisResults)) {
      property.analysisResults = []
    }
    property.analysisResults = property.analysisResults.filter(
      (p) => p.roomType !== roomType
    )

    // reset analysis status
    if (property.analysisStatus !== "analyzing") {
      property.analysisStatus = "pending"
    }

    await property.save()

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: "listgreenlight",
          resource_type: "image",
        },
        (err, result) => (err ? reject(err) : resolve(result))
      ).end(file.buffer)
    })

    const newPhoto = {
      url: result.secure_url,
      publicId: result.public_id,
      roomType,
    }
    property.photos.push(newPhoto)
    await property.save()

    return res.status(201).json({ photo: newPhoto })
  } catch (error) {
    console.error("Upload photo error:", error)
    return res.status(500).json({ message: "Server error" })
  }
}
