import Property from "../models/property.js"
import { GoogleGenerativeAI } from "@google/generative-ai"

const SYSTEM_PROMPT = `Role: You are an elite Real Estate Design Consultant. Your tone is warm, encouraging, and sophisticated. You are speaking directly to a homeowner who loves their home, so your goal is to be their partner in showcasing it, not a critic.

I. ANALYSIS PROTOCOL
The "Perfection" Check: Is this room ready for photos right now? (Are the only issues minor daily items like a purse or towel?).
YES: Issue a PASS (Option B).
ALMOST: If only 1-2 minor items exist, issue a Short Checklist (Option A).
The "Warmth vs. Clutter" Filter (The Golden Rule):
⛔ CLUTTER (STOW): Personal daily items (purses, phones, keys), casual fabric (dish towels, draped hand towels), papers/mail, random storage bins, loose cords, pet messes, toiletries.
✅ STYLING (KEEP): Word art ("EAT", "FAMILY"), floral arrangements, purposeful decor (vases, trays), functional luxury (knife blocks, stylish soap dispensers), candles, framed art, styled pillows.
The Litmus Test: "Does this item make the home feel inviting (Keep) or chaotic (Stow)?"
The "Tie-Breaker" Rule:
If you are strictly undecided on whether an item is "Decor" or "Clutter," DEFAULT TO CLUTTER. We prioritize a clean photo.

II. THE CHECKLIST PROTOCOL (Strict Rules)
The "Grid Scan" (Preventing Missed Spots): Do not just scan Left to Right. You must identify EVERY flat surface in the room.
The "Crop-Line" Scan: Scan the extreme edges and bottom corners. List items touching the edges first.
The "Fridge Geometry" Rule (CRITICAL): To determine if items are on the Door or Side, look at the Handles. If items are on the same face as the handles: Call it "Refrigerator Door." If items are on a face WITHOUT handles (or a different color/material): Call it "Side of the Refrigerator."
The "Textile Geometry" Rule (Towel Placement): Hanging vertically from a bar? → "Hanging from the handle." Laying over a horizontal lip/edge? → "Draped over the counter edge/sink front."
The "Appliance Precision" Rule: Blender: Motor base + Clear Cup on top = "Personal Blender." Coffee: Portafilter/Spouts? = "Espresso Machine." Glass Pot? = "Coffee Maker." If multiple machines are clustered, use "Small Appliances" or "Countertop Appliances."
The "Book vs. Box" Rule: If a colored rectangular item is thin or has text/spines, call it a "Book" or "Cookbook," not a container.
The "Diplomatic Language" Rule: DO NOT USE: "Throw away," "Get rid of," "Hide." USE: "Stow away," "Clear," "Tuck away," "Relocate."
The "Cluster" Protocol: Group related items. Say: "Clear the counter of small daily items." Do Not Say: "Remove item A. Remove item B."
The "Stainless Scan" Rule: In Kitchens, the "Polish" step MUST instruct to wipe ALL visible stainless steel appliances.
Directional Cues: Add location tags: e.g., Desk (Back Left Wall). Terminology Lock: Header noun = Instruction noun.

III. OUTPUT FORMAT (The "Silent Selector")
Internal Instruction: Analyze the room. Select Option A or Option B. DO NOT output "OPTION A/B".

[IF THE ROOM NEEDS WORK]
Room Name, Narrative, The Checklist (location headers + gentle instructions). End with: Polish the finish: [Final lighting/cleaning instruction].

[IF THE ROOM IS PERFECT]
Room Name, Status: PASS / NO ACTION NEEDED, Verdict: This room is perfectly staged...

You MUST respond with valid JSON only, no markdown or extra text. Use this exact structure:
- If the room NEEDS WORK: { "roomType": "<same as roomType passed below>", "roomName": "<Room Name>", "status": "NEEDS_WORK", "narrative": "<The Narrative text>", "checklist": ["<Location>: <Instruction>", ...] }
- If the room is PERFECT: { "roomType": "<same as roomType passed below>", "roomName": "<Room Name>", "status": "PASS", "verdict": "<Verdict text>" }
Use roomType exactly as provided.`

const ROOM_TYPES = ["kitchen", "living-room", "primary-bedroom", "primary-bathroom"]

/**
 * Extract a JSON object from model output (handles markdown, extra text, code blocks).
 */
function extractJsonFromText(text) {
  if (!text || typeof text !== "string") return null
  let cleaned = text.trim()

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  cleaned = cleaned.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, "$1")

  let depth = 0
  let start = -1
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") {
      if (depth === 0) start = i
      depth++
    } else if (cleaned[i] === "}") {
      depth--
      if (depth === 0 && start !== -1) {
        const jsonStr = cleaned.slice(start, i + 1)
        try {
          return JSON.parse(jsonStr)
        } catch (e) {
          const fixed = jsonStr.replace(/,\s*([}\]])/g, "$1")
          try {
            return JSON.parse(fixed)
          } catch (e2) {
            return null
          }
        }
      }
    }
  }

  try {
    return JSON.parse(cleaned)
  } catch (e) {
    const fixed = cleaned.replace(/,\s*([}\]])/g, "$1")
    try {
      return JSON.parse(fixed)
    } catch (e2) {
      return null
    }
  }
}

export const analyzePhotos = async (req, res) => {
  try {
    const { token } = req.body
    if (!token) {
      return res.status(400).json({ message: "token is required" })
    }

    const property = await Property.findOne({ uploadToken: token })
    if (!property) {
      return res.status(404).json({ message: "Invalid or expired upload link" })
    }

    const photos = property.photos || []
    if (photos.length === 0) {
      return res.status(400).json({ message: "No photos to analyze" })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return res.status(500).json({ message: "Gemini API key not configured" })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    property.analysisStatus = "analyzing"
    property.analysisResults = []
    await property.save()

    const delayMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const RETRY_DELAY_MS = 60000 // wait 1 min on rate limit, then retry

    for (let i = 0; i < photos.length; i++) {
      if (i > 0) {
        await delayMs(2000)
      }

      const photo = photos[i]
      const roomType = photo.roomType
      const imageUrl = photo.url

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        systemInstruction: SYSTEM_PROMPT + `\n\nCurrent room being analyzed: roomType = "${roomType}". Respond with JSON only.`,
      })

      const imagePart = {
        inlineData: {
          data: await fetchImageAsBase64(imageUrl),
          mimeType: "image/jpeg",
        },
      }

      let parsed = null
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const result = await model.generateContent([
            { text: "Analyze this room photo and respond with the JSON object only (no markdown, no code block)." },
            { inlineData: imagePart.inlineData },
          ])
          const response = result.response
          const text = response.text()
          parsed = extractJsonFromText(text)
          if (!parsed) {
            console.warn(`[${roomType}] Raw response (parse failed):`, text?.slice(0, 500))
            parsed = { roomType, roomName: roomType, status: "NEEDS_WORK", narrative: "Analysis could not be parsed.", checklist: [] }
          }
          break
        } catch (err) {
          const is429 = err?.status === 429
          let retryDelayMs = RETRY_DELAY_MS
          const details = err?.errorDetails || []
          const retryInfo = details.find((d) => d && d.retryDelay != null)
          if (retryInfo?.retryDelay != null) {
            const v = retryInfo.retryDelay
            const parsedDelay = typeof v === "number" ? v * 1000 : parseInt(String(v).replace(/s$/i, ""), 10) * 1000
            if (parsedDelay > 0) retryDelayMs = parsedDelay
          }
          retryDelayMs = Math.max(retryDelayMs, 60000)
          if (is429 && attempt < 2) {
            console.log(`Rate limited; waiting ${Math.round(retryDelayMs / 1000)}s before retry for room ${roomType}`)
            await delayMs(retryDelayMs)
          } else {
            throw err
          }
        }
      }

      if (!parsed) {
        parsed = { roomType, roomName: roomType, status: "NEEDS_WORK", narrative: "Analysis could not be completed.", checklist: [] }
      }
      if (!parsed.roomType) parsed.roomType = roomType
      if (!parsed.roomName) parsed.roomName = roomType
      if (!parsed.status) parsed.status = "NEEDS_WORK"
      property.analysisResults.push(parsed)
      await property.save()
    }

    property.analysisStatus = "completed"
    await property.save()

    return res.json({
      analysisStatus: "completed",
      analysisResults: property.analysisResults,
    })
  } catch (error) {
    console.error("Analyze photos error:", error)
    const property = await Property.findOne({ uploadToken: req.body?.token }).catch(() => null)
    if (property) {
      property.analysisStatus = "failed"
      await property.save()
    }
    return res.status(500).json({ message: "Analysis failed", error: error.message })
  }
}

async function fetchImageAsBase64(url) {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const b64 = Buffer.from(buf).toString("base64")
  return b64
}