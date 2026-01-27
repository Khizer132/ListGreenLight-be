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