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
    analysisStatus: {
      type: String,
      enum: ["pending", "analyzing", "completed", "failed"],
      default: "pending",
    },
    analysisResults: [
      {
        roomType: { type: String, required: true },
        roomName: { type: String, required: true },
        status: { type: String, enum: ["PASS", "NEEDS_WORK"], required: true },
        verdict: { type: String },
        narrative: { type: String },
        checklist: [{ type: String }],
      },
    ],
    analysisCount: {
      type: Number,
      default: 0,
    },
    analysisMode:{
      type: String,
      enum: ["strict", "lenient"],
      default: "strict",
    }
  },
  { timestamps: true }
)

export default mongoose.model("Property", propertySchema)