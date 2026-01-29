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
    },
    phoneNo: {
        type: String,
        required: [true, "Please enter your phone number"],
    },  

}, {timestamps: true}
);

export default mongoose.model("User", userSchema);
