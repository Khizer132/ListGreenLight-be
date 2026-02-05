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
          review and approve for listing.
        </p>
        
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
          <a
            href="${uploadPhotoLink}"
            style="font-size:12px; color:#9ca3af; margin-top:12px; text-decoration:none;"
          >
            ${uploadPhotoLink}
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


function getApprovalEmailHtml(options) {
  const {
    userName,
    propertyAddress,
    year = new Date().getFullYear(),
    websiteUrl = process.env.CLIENT_URL || "http://localhost:5173",
  } = options

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Property Approved – ListGreenLight</title>
  </head>
  <body style="background:#f3f4f6; padding:40px 0; font-family: system-ui, sans-serif;">
    <div style="max-width:36rem; margin:0 auto; background:#fff; border-radius:12px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); overflow:hidden;">
      <div style="background:#059669; padding:24px; text-align:center; color:#fff;">
        <div style="font-size:32px; line-height:1; margin-bottom:8px;">⚡</div>
        <h1 style="font-size:22px; font-weight:700; margin:0;">Property Approved</h1>
      </div>

      <div style="padding:24px 24px 8px; color:#374151; font-size:14px; line-height:1.6;">
        <p style="margin:0 0 12px;">
          Hello <span style="font-weight:600;">${userName}</span>,
        </p>
        <p style="margin:0 0 16px;">
          Great news! Your property at
          <span style="font-weight:600; color:#16a34a;">${propertyAddress}</span>
          has been approved and is ready for listing.
        </p>

        <div style="background:#ecfdf5; border-left:4px solid #16a34a; border-radius:8px; padding:16px 16px 16px 18px; margin:0 0 20px;">
          <ul style="margin:0; padding-left:18px; color:#166534; font-size:14px;">
            <li style="margin-bottom:6px;">All photos meet our quality standards</li>
            <li style="margin-bottom:6px;">Property is ready for professional photography</li>
            <li>You can proceed with listing the property</li>
          </ul>
        </div>

        <p style="margin:0 0 16px; color:#4b5563;">
          If you have any questions or need assistance, please don't hesitate to reach out.
        </p>
      </div>

      <div style="background:#f3f4f6; text-align:center; font-size:12px; color:#6b7280; padding:16px 24px;">
        <p style="margin:0;">
          © ${year} ⚡ ListGreenLight. All rights reserved.
        </p>
        <p style="margin:4px 0 0;">
          <a href="${websiteUrl}" style="color:#16a34a; text-decoration:underline;">Visit Website</a>
        </p>
        <p style="margin:4px 0 0; color:#9ca3af;">
          This is an automated message. Please do not reply to this email.
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

export async function sendApprovalEmail(options) {
  const { to, userName, propertyAddress } = options
  if (!to) {
    throw new Error("sendApprovalEmail: 'to' is required")
  }

  const html = getApprovalEmailHtml({
    userName: userName || "Customer",
    propertyAddress: propertyAddress || "your property",
    year: new Date().getFullYear(),
    websiteUrl: process.env.CLIENT_URL || "http://localhost:5173",
  })

  await transporter.sendMail({
    from: process.env.EMAIL,
    to,
    subject: "Property Approved – ListGreenLight",
    html,
  })
}
