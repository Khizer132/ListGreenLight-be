import express from "express"
import { uploadSingle } from "../middlewares/upload.js"
import { createProperty, getDetails, getUploadLink, getPropertyByUploadToken, confirmPaymentAndGetUploadLink, uploadPhoto } from "../controllers/propertyController.js"
import { analyzePhotos } from "../controllers/photoAnalysisController.js"

const router = express.Router()

router.route("/create-property").post(createProperty);
router.route("/get-details").get(getDetails);
router.route("/:propertyId/upload-link").get(getUploadLink);
router.route("/by-upload-token/:token").get(getPropertyByUploadToken);
router.route("/confirm-payment-and-upload-link").post(confirmPaymentAndGetUploadLink);
router.route("/upload-photo").post(uploadSingle, uploadPhoto);
router.route("/analyze-photos").post(analyzePhotos);

export default router