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
  },
  { timestamps: true }
)

export default mongoose.model("Property", propertySchema)