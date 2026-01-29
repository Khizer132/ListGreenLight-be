import User from "../models/user.js"
import Property from "../models/property.js"

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

