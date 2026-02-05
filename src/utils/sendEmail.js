import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
})

function getUploadLinkEmailHtml(options) {
  const {
    userName,
    userEmail,
    userPhone,
    propertyAddress,
    uploadPhotoLink,
    year = new Date().getFullYear(),
    websiteUrl = process.env.CLIENT_URL || "http://localhost:5173",
  } = options

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>List Green Light</title>
  </head>
  <body style="background:#f3f4f6; padding:40px 0; font-family: system-ui, sans-serif;">
    <div style="max-width:32rem; margin:0 auto; background:#fff; border-radius:12px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); overflow:hidden;">
      <div style="border-bottom:2px solid #16a34a; padding:16px 24px; text-align:center;">
        <span style="color:#16a34a; font-weight:600; font-size:18px;">
          ⚡ ListGreenLight
        </span>
      </div>
      <div style="padding:24px; color:#374151;">
        <p style="font-size:14px; margin-bottom:16px;">
          Hello <span style="font-weight:600;">${userName}</span>,
        </p>
        <p style="font-size:14px; line-height:1.5; margin-bottom:24px;">
          Thanks for getting started with <strong>List Green Light</strong>.
          To move forward, please upload photos of your property so we can
          review and activate your listing.
        </p>
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:16px; margin-bottom:24px;">
          <p style="font-size:14px; font-weight:500; color:#15803d; margin-bottom:8px;">
            What happens next?
          </p>
          <ul style="font-size:14px; color:#15803d; margin:0; padding-left:20px;">
            <li>✓ AI checks staging issues before your photographer arrives</li>
            <li>✓ Faster approval with fewer reshoots</li>
            <li>✓ Share instant checklists with sellers</li>
          </ul>
        </div>
        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px; margin-bottom:24px; font-size:14px;">
          <p style="margin:0 0 4px;"><strong>Name:</strong> ${userName}</p>
          <p style="margin:0 0 4px;"><strong>Email:</strong> ${userEmail}</p>
          <p style="margin:0 0 4px;"><strong>Phone:</strong> ${userPhone}</p>
          <p style="margin:0;"><strong>Property Address:</strong> ${propertyAddress}</p>
        </div>
        <div style="text-align:center;">
          <a
            href="${uploadPhotoLink}"
            style="display:inline-block; background:#16a34a; color:#fff; font-weight:600; font-size:14px; padding:12px 24px; border-radius:8px; text-decoration:none;"
          >
            Upload Property Photos
          </a>
          <p style="font-size:12px; color:#9ca3af; margin-top:12px;">
            Secure upload · Takes less than 2 minutes
          </p>
        </div>
      </div>
      <div style="background:#f3f4f6; text-align:center; font-size:12px; color:#6b7280; padding:16px 24px;">
        <p style="margin:0;">
          Need help? Just reply to this email — we're here for you.
        </p>
        <p style="margin:4px 0 0;">
          © ${year} ListGreenLight ·
          <a href="${websiteUrl}" style="color:#16a34a; text-decoration:underline;">
            Visit Website
          </a>
        </p>
      </div>
    </div>
  </body>
</html>
  `.trim()
}

export async function sendUploadLinkEmail(options) {
  const { to, userName, userEmail, userPhone, propertyAddress, uploadPhotoLink } = options
  if (!to || !uploadPhotoLink) {
    throw new Error("sendUploadLinkEmail: to and uploadPhotoLink are required")
  }
  const html = getUploadLinkEmailHtml({
    userName: userName || "User",
    userEmail: userEmail || to,
    userPhone: userPhone || "—",
    propertyAddress: propertyAddress || "—",
    uploadPhotoLink,
  })
  await transporter.sendMail({
    from: process.env.EMAIL,
    to,
    subject: "ListGreenLight – Upload your property photos",
    html,
  })
}