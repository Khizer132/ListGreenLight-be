import express from "express"
import { createProperty, getDetails } from "../controllers/propertyController.js"

const router = express.Router()

router.route("/create-property").post(createProperty);
router.route("/get-details").get(getDetails);

export default router