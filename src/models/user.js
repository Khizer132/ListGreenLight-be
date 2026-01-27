import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please enter your name"],
        maxlength: [30, "Name cannot exceed 30 characters"],
    },
    email: {        
        type: String,
        required: [true, "Please enter your email"],
        unique: true,
    },
    phoneNo: {
        type: String,
        required: [true, "Please enter your phone number"],
        unique: true,
    },  

}, {timestamps: true}
);

export default mongoose.model("User", userSchema);
