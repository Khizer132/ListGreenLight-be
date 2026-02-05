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

/**
 * Extract JSON (object or array) from model output
 */
function extractJsonFromText(text) {
  if (!text || typeof text !== "string") return null
  let cleaned = text.trim()

  // Remove markdown code blocks
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  // Try to find JSON array first
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0])
      if (Array.isArray(parsed)) {
        return parsed
      }
    } catch (e) {
      console.log("Array parse failed, trying cleanup...")
      const fixed = arrayMatch[0].replace(/,\s*([}\]])/g, "$1")
      try {
        return JSON.parse(fixed)
      } catch (e2) {
        // Continue to object parsing
      }
    }
  }

  // Try to find JSON object
  let depth = 0
  let start = -1
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{" || cleaned[i] === "[") {
      if (depth === 0) start = i
      depth++
    } else if (cleaned[i] === "}" || cleaned[i] === "]") {
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
            continue
          }
        }
      }
    }
  }

  // Last resort: try parsing the whole cleaned string
  try {
    return JSON.parse(cleaned)
  } catch (e) {
    console.error("Failed to parse JSON:", cleaned.slice(0, 300))
    return null
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

    let property = await Property.findOne({ uploadToken: token })
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

    if (property.analysisStatus === "analyzing") {
      console.log("[BATCH] Analysis already in progress, skipping duplicate request")
      return res.json({
        analysisStatus: "analyzing",
        analysisResults: property.analysisResults || [],
        analysisCount: property.analysisCount || 0,
        analysisMode: property.analysisMode || "strict",
        message: "Analysis in progress",
      })
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

    
    const lockedProperty = await Property.findOneAndUpdate(
      {
        uploadToken: token,
        analysisStatus: { $ne: "analyzing" },
      },
      {
        analysisMode: analysisMode,
        analysisStatus: "analyzing",
      },
      { new: true }
    )

    if (!lockedProperty) {
      console.log("[BATCH] Another request already locked the property, skipping")
      return res.json({
        analysisStatus: "analyzing",
        analysisResults: property.analysisResults || [],
        analysisCount: property.analysisCount || 0,
        analysisMode: analysisMode,
        message: "Analysis in progress",
      })
    }

    const genAI = new GoogleGenerativeAI(apiKey)

    console.log(`[BATCH] Starting analysis for ${photosToAnalyze.length} rooms (mode: ${analysisMode})`)

    const imageParts = await Promise.all(
      photosToAnalyze.map(async (photo) => ({
        inlineData: {
          data: await fetchImageAsBase64(photo.url),
          mimeType: "image/jpeg",
        },
        roomType: photo.roomType,
      }))
    )

    console.log(`[BATCH] All ${imageParts.length} images loaded`)

    const roomsInfo = photosToAnalyze.map((p, idx) => `Image ${idx + 1}: ${p.roomType}`).join("\n")

    const batchSystemPrompt = `${SYSTEM_PROMPT}${
      analysisMode === "lenient" ? LENIENT_PROMPT : ""
    }

BATCH MODE - CRITICAL INSTRUCTIONS:
You are analyzing ${photosToAnalyze.length} room photos in ONE request.
${roomsInfo}

You MUST return a JSON array with exactly ${photosToAnalyze.length} objects (one per room).

Expected format:
[
  {
    "roomType": "kitchen",
    "roomName": "Kitchen",
    "status": "PASS",
    "verdict": "This room is perfectly staged..."
  },
  {
    "roomType": "living-room",
    "roomName": "Living Room", 
    "status": "NEEDS_WORK",
    "narrative": "...",
    "checklist": ["...", "..."]
  }
]

CRITICAL: 
- Return ONLY the JSON array
- NO markdown code blocks
- NO extra text before or after
- Each object must have "roomType" matching one of: ${photosToAnalyze.map((p) => p.roomType).join(", ")}`

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      systemInstruction: batchSystemPrompt,
    })

    let parsedResults = []

    try {
      const contentParts = [
        {
          text:
            analysisMode === "lenient"
              ? `SECOND PASS - Be lenient. Analyze all ${photosToAnalyze.length} rooms. Return JSON array only.`
              : `Analyze all ${photosToAnalyze.length} rooms. Return JSON array only.`,
        },
        ...imageParts.map((img) => ({ inlineData: img.inlineData })),
      ]

      console.log("[BATCH] Sending request to Gemini...")
      const result = await model.generateContent(contentParts)
      const response = result.response
      const text = response.text()

      console.log("[BATCH] Response received, length:", text.length)
      console.log("[BATCH] Response preview:", text.slice(0, 400))

      const parsed = extractJsonFromText(text)

      if (!parsed) {
        console.error("[BATCH] Failed to parse response")
        throw new Error("Failed to parse AI response")
      }

      if (Array.isArray(parsed)) {
        parsedResults = parsed
        console.log(`[BATCH] Successfully parsed array with ${parsedResults.length} items`)
      } else if (parsed && typeof parsed === "object") {
        console.log("[BATCH] Got single object, wrapping in array")
        parsedResults = [parsed]
      } else {
        console.error("[BATCH] Unexpected parsed type:", typeof parsed)
        throw new Error("Unexpected response format")
      }

      if (parsedResults.length !== photosToAnalyze.length) {
        console.warn(
          `[BATCH] Expected ${photosToAnalyze.length} results, got ${parsedResults.length}`
        )
      }
    } catch (err) {
      const is429 =
        err?.status === 429 ||
        (typeof err?.message === "string" &&
          (err.message.includes("429") || err.message.toLowerCase().includes("quota")))

      if (is429) {
        console.error("[BATCH] Gemini rate limit hit:", err)
        await Property.findByIdAndUpdate(lockedProperty._id, { analysisStatus: "failed" })
        return res.status(429).json({
          message:
            "AI analysis limit has been reached for now (Gemini free tier). Please wait a while and try again later.",
          code: "AI_RATE_LIMIT",
        })
      }

      console.error("[BATCH] Analysis error:", err)
      throw err
    }

    const newResults = [...lockedProperty.analysisResults]

    let processedCount = 0
    for (const parsed of parsedResults) {
      const roomType = parsed.roomType

      if (!roomType) {
        console.warn("[BATCH] Skipping result with no roomType:", parsed)
        continue
      }

      console.log(`[BATCH] Processing result for room: ${roomType}`)

      const finalResult =
        analysisMode === "lenient"
          ? applyLenientPolicy(parsed, roomType)
          : normalizeResult(parsed, roomType)

      const filteredResults = newResults.filter((r) => r.roomType !== roomType)
      filteredResults.push(finalResult)
      newResults.length = 0
      newResults.push(...filteredResults)
      processedCount++
    }

    console.log(`[BATCH] Processed ${processedCount} results successfully`)

    const updatedProperty = await Property.findByIdAndUpdate(
      lockedProperty._id,
      {
        analysisResults: newResults,
        analysisStatus: "completed",
        analysisCount: nextRun,
      },
      { new: true } 
    )

    console.log("[BATCH] Analysis complete, saved to database")

    return res.json({
      analysisStatus: "completed",
      analysisResults: updatedProperty.analysisResults,
      analysisCount: updatedProperty.analysisCount,
      analysisMode: analysisMode,
    })
  } catch (error) {
    console.error("Analyze photos error:", error)

    await Property.findOneAndUpdate(
      { uploadToken: req.body?.token },
      { analysisStatus: "failed" }
    ).catch((err) => console.error("Failed to update status to failed:", err))

    return res.status(500).json({ message: "Analysis failed", error: error.message })
  }
}

async function fetchImageAsBase64(url) {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const b64 = Buffer.from(buf).toString("base64")
  return b64
}