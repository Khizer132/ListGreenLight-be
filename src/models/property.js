import mongoose from "mongoose"

const propertySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    address: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    uploadToken: {
      type: String,
      unique: true,
      sparse: true,
    },
    photos: [
      {
        url: { 
          type: String, 
          required: true 
        },
        publicId: { 
          type: String,
          required: true
        },
        roomType: {
          type: String,
          enum: ["kitchen", "living-room", "primary-bedroom", "primary-bathroom"],
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
)

export default mongoose.model("Property", propertySchema)