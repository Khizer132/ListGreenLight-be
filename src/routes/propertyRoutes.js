import express from "express"
import { createProperty, getDetails, getUploadLink, getPropertyByUploadToken } from "../controllers/propertyController.js"

const router = express.Router()

router.route("/create-property").post(createProperty);
router.route("/get-details").get(getDetails);

router.route("/:propertyId/upload-link").get(getUploadLink);

router.route("/by-upload-token/:token").get(getPropertyByUploadToken);

export default router