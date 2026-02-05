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

const LENIENT_PROMPT = `
IV. SECOND-PASS MODE (IMPORTANT)
You are re-checking after the user already made adjustments. Be convenient and not strict.
- Prefer PASS whenever the room is clearly presentable.
- Only return NEEDS_WORK if there are obvious, high-impact issues that would noticeably hurt listing photos.
- Override the tie-breaker: if you are undecided, DEFAULT TO KEEP (assume it is styling).
- If you return NEEDS_WORK, provide a very short checklist (MAX 3 items) and keep instructions minimal.
- Do NOT nitpick tiny everyday items; 1-2 minor items are acceptable for PASS.
Still output JSON only using the exact schema.`


const MAX_ANALYSIS_RUNS_PER_PROPERTY = 2

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

function normalizeResult(parsed, roomType) {
  if (!parsed || typeof parsed !== "object") {
    return {
      roomType,
      roomName: roomType,
      status: "NEEDS_WORK",
      narrative: "Analysis could not be completed.",
      checklist: [],
    }
  }

  const out = { ...parsed }
  if (!out.roomType) out.roomType = roomType
  if (!out.roomName) out.roomName = roomType
  if (!out.status) out.status = "NEEDS_WORK"

  if (out.status === "NEEDS_WORK") {
    if (!Array.isArray(out.checklist)) out.checklist = []
    if (typeof out.narrative !== "string") out.narrative = ""
    delete out.verdict
  } else if (out.status === "PASS") {
    if (typeof out.verdict !== "string") out.verdict = "This room looks ready for listing photos."
    delete out.narrative
    delete out.checklist
  }

  return out
}

function applyLenientPolicy(result, roomType) {
  const r = normalizeResult(result, roomType)

  if (r.status !== "NEEDS_WORK") return r

  const checklist = Array.isArray(r.checklist) ? r.checklist.filter(Boolean) : []
  const count = checklist.length

  // If it's only 0–2 minor items, fast-pass to PASS
  if (count <= 2) {
    return {
      roomType: r.roomType,
      roomName: r.roomName,
      status: "PASS",
      verdict:
        count === 0
          ? "PASS / NO ACTION NEEDED. This room looks presentable and ready for listing photos."
          : `PASS / READY. This room is in great shape for listing photos. Optional quick tidy: ${checklist.join("; ")}.`,
    }
  }

  return {
    roomType: r.roomType,
    roomName: r.roomName,
    status: "NEEDS_WORK",
    narrative:
      typeof r.narrative === "string" && r.narrative.trim()
        ? r.narrative
        : "A couple quick tweaks will make this photo-ready.",
    checklist: checklist.slice(0, 3),
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

    const previousRuns = property.analysisCount || 0
    if (previousRuns >= MAX_ANALYSIS_RUNS_PER_PROPERTY) {
      return res.status(429).json({
        message:
          "Free analysis limit reached for this property. To stay within the free Gemini tier, we only run the AI up to 2 times per property.",
        analysisStatus: property.analysisStatus || "completed",
        analysisResults: property.analysisResults || [],
        analysisCount: previousRuns,
        analysisMode: property.analysisMode || "lenient",
      })
    }

    // const nextRun = previousRuns + 1
    // const analysisMode = nextRun >= 2 ? "lenient" : "strict"
    // property.analysisCount = nextRun
    // property.analysisMode = analysisMode

    // property.analysisStatus = "analyzing"
    // property.analysisResults = []
    // await property.save()


    const existingResults = Array.isArray(property.analysisResults) ? property.analysisResults : []
    const existingRoomTypes = new Set(existingResults.map((r) => r.roomType))

    const photosToAnalyze =
      previousRuns === 0
        ? photos
        : photos.filter((p) => !existingRoomTypes.has(p.roomType))

    
    if (previousRuns > 0 && photosToAnalyze.length === 0) {
      return res.json({
        analysisStatus: property.analysisStatus || "completed",
        analysisResults: existingResults,
        analysisCount: property.analysisCount || previousRuns,
        analysisMode: property.analysisMode || (previousRuns >= 2 ? "lenient" : "strict"),
        message: "No changed rooms to reanalyze.",
      })
    }

    const nextRun = previousRuns + 1
    const analysisMode = nextRun >= 2 ? "lenient" : "strict"

    property.analysisCount = nextRun
    property.analysisMode = analysisMode
    property.analysisStatus = "analyzing"

    await property.save()

    const genAI = new GoogleGenerativeAI(apiKey)

    const delayMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    for (let i = 0; i < photosToAnalyze.length; i++) {
      // small spacing between rooms so we don't burst too fast
      if (i > 0) {
        await delayMs(3000)
      }

      const photo = photosToAnalyze[i]
      const roomType = photo.roomType
      const imageUrl = photo.url

      const systemInstruction =
        SYSTEM_PROMPT +
        (analysisMode === "lenient" ? LENIENT_PROMPT : "") +
        `\n\nCurrent room being analyzed: roomType = "${roomType}". Respond with JSON only.`

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        systemInstruction,
      })

      const imagePart = {
        inlineData: {
          data: await fetchImageAsBase64(imageUrl),
          mimeType: "image/jpeg",
        },
      }

      let parsed = null

      try {
        const result = await model.generateContent([
          {
            text:
              analysisMode === "lenient"
                ? "This is a SECOND PASS after the user adjusted the room. Be lenient and convenient. Respond with the JSON object only (no markdown, no code block)."
                : "Analyze this room photo and respond with the JSON object only (no markdown, no code block).",
          },
          { inlineData: imagePart.inlineData },
        ])
        const response = result.response
        const text = response.text()
        parsed = extractJsonFromText(text)

        if (!parsed) {
          console.warn(`[${roomType}] Raw response (parse failed):`, text?.slice(0, 500))
          parsed = {
            roomType,
            roomName: roomType,
            status: "NEEDS_WORK",
            narrative: "Analysis could not be parsed.",
            checklist: [],
          }
        }
      } catch (err) {
        const is429 =
          err?.status === 429 ||
          (typeof err?.message === "string" &&
            (err.message.includes("429") || err.message.toLowerCase().includes("quota")))

        if (is429) {
          console.error(`Gemini rate limit/quota hit on room ${roomType}:`, err)
          property.analysisStatus = "failed"
          await property.save()
          return res.status(429).json({
            message:
              "AI analysis limit has been reached for now (Gemini free tier). Please wait a while and try again later.",
            code: "AI_RATE_LIMIT",
          })
        }

        // Other unexpected errors still go to the outer catch
        throw err
      }

      if (!parsed) {
        parsed = {
          roomType,
          roomName: roomType,
          status: "NEEDS_WORK",
          narrative: "Analysis could not be completed.",
          checklist: [],
        }
      }

      const finalResult =
        analysisMode === "lenient"
          ? applyLenientPolicy(parsed, roomType)
          : normalizeResult(parsed, roomType)

      // ensure only one result per roomType
      property.analysisResults = property.analysisResults.filter(
        (r) => r.roomType !== roomType
      )
      property.analysisResults.push(finalResult)
      await property.save()
    }

    property.analysisStatus = "completed"
    await property.save()

    return res.json({
      analysisStatus: "completed",
      analysisResults: property.analysisResults,
      analysisCount: property.analysisCount,
      analysisMode: property.analysisMode,
    })
  } catch (error) {
    console.error("Analyze photos error:", error)
    const property = await Property.findOne({ uploadToken: req.body?.token }).catch(() => null)
    if (property) {
      property.analysisStatus = "failed"
      await property.save()
    }

    // If this wasn't handled as a 429 above, return generic 500
    return res.status(500).json({ message: "Analysis failed", error: error.message })
  }
}

// fetch image as base64
async function fetchImageAsBase64(url) {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const b64 = Buffer.from(buf).toString("base64")
  return b64
}


// const totalRooms = photos.length

// // If we're before any analysis or after a failure, show 0/total
// const analyzedCount =
//   analysisStatus === "pending" || analysisStatus === "failed"
//     ? 0
//     : analysisResults.length