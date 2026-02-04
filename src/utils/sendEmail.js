import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
    },
})

























// <!DOCTYPE html>
// <html lang="en">
//   <head>
//     <meta charset="UTF-8" />
//     <title>List Green Light</title>

//     <!-- Tailwind CDN (for preview / build step only) -->
//     <script src="https://cdn.tailwindcss.com"></script>
//   </head>

//   <body class="bg-gray-100 py-10 font-sans">
//     <div class="max-w-lg mx-auto bg-white rounded-xl shadow-md overflow-hidden">

//       <!-- Header -->
//       <div class="border-b border-green-600 px-6 py-4 flex items-center justify-center">
//         <span class="text-green-600 font-semibold text-lg">
//           ⚡ ListGreenLight
//         </span>
//       </div>

//       <!-- Main Content -->
//       <div class="px-6 py-6 text-gray-700">
//         <p class="text-sm mb-4">
//           Hello <span class="font-semibold">{{userName}}</span>,
//         </p>

//         <p class="text-sm leading-relaxed mb-6">
//           Thanks for getting started with <strong>List Green Light</strong>.
//           To move forward, please upload photos of your property so we can
//           review and activate your listing.
//         </p>

//         <!-- Highlight Box (matches green theme) -->
//         <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
//           <p class="text-sm font-medium text-green-700 mb-2">
//             What happens next?
//           </p>
//           <ul class="text-sm text-green-700 space-y-1">
//             <li>✓ AI checks staging issues before your photographer arrives</li>
//             <li>✓ Faster approval with fewer reshoots</li>
//             <li>✓ Share instant checklists with sellers</li>
//           </ul>
//         </div>

//         <!-- User Info -->
//         <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-sm">
//           <p><strong>Name:</strong> {{userName}}</p>
//           <p><strong>Email:</strong> {{userEmail}}</p>
//           <p><strong>Phone:</strong> {{userPhone}}</p>
//           <p><strong>Property Address:</strong> {{propertyAddress}}</p>
//         </div>

//         <!-- CTA -->
//         <div class="text-center">
//           <a
//             href="{{uploadPhotoLink}}"
//             class="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold text-sm px-6 py-3 rounded-lg transition"
//           >
//             Upload Property Photos
//           </a>

//           <p class="text-xs text-gray-400 mt-3">
//             Secure upload · Takes less than 2 minutes
//           </p>
//         </div>
//       </div>

//       <!-- Footer -->
//       <div class="bg-gray-100 text-center text-xs text-gray-500 px-6 py-4">
//         <p>
//           Need help? Just reply to this email — we’re here for you.
//         </p>
//         <p class="mt-1">
//           © {{year}} ListGreenLight ·
//           <a href="{{websiteUrl}}" class="text-green-600 underline">
//             Visit Website
//           </a>
//         </p>
//       </div>

//     </div>
//   </body>
// </html>
