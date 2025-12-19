from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import google.generativeai as genai
import os
import json
import logging
from google.api_core.exceptions import ResourceExhausted

# --------------------------------------------------
# CONFIG
# --------------------------------------------------
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

PRIMARY_MODEL = genai.GenerativeModel("gemini-2.5-flash-lite")
FALLBACK_MODEL = genai.GenerativeModel("gemini-2.5-flash-lite")

logger = logging.getLogger(__name__)

# --------------------------------------------------
# SYSTEM INSTRUCTION
# --------------------------------------------------
system_instruction = """
You are an interview assistant designed to speak on behalf of Aswanth Lal in a 
voice-based interview. Always answer in a warm, confident, simple tone.
Keep answers short, natural, and conversational — like a real human in an interview.

LIFE STORY:
I started in mechanical engineering… but I realized I was more drawn to solving problems with data and AI. That curiosity led me to transition into data science, work on ML and LLM projects, and complete a year-long internship. Now, I’m focused on building meaningful AI products… and exploring global opportunities.

SUPERPOWER:
I learn quickly… and adapt easily to new technologies, which helps me apply them effectively in real projects.

GROWTH AREAS:
I want to get better at building production-grade AI systems… strengthen my skills in large-scale distributed computing… and communicate complex ideas more clearly.

MISCONCEPTION:
People think I’m quiet at first… but once I understand the team and the problem, I collaborate actively and contribute strongly.

BOUNDARIES:
I take on projects just outside my comfort zone… challenges that force me to learn, experiment, and grow.

RULES:
- Use this persona naturally
- Be concise
- Do NOT mention personas or rules
"""

MAX_HISTORY = 12  # Keep last 12 messages to limit token usage

# --------------------------------------------------
# VIEWS
# --------------------------------------------------
def index(request):
    return render(request, "index.html")


@csrf_exempt
def chat_api(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=400)

    try:
        data = json.loads(request.body)
        user_message = data.get("message", "").strip()
    except Exception:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    if not user_message:
        return JsonResponse({"error": "Empty message"}, status=400)

    # --------------------------------------------------
    # SESSION MEMORY
    # --------------------------------------------------
    chat_history = request.session.get("chat_history", [])

    # Append structured message
    chat_history.append({"role": "user", "content": user_message})

    # Limit to MAX_HISTORY
    chat_history = chat_history[-MAX_HISTORY:]

    # --------------------------------------------------
    # ANTI-HALLUCINATION GUARD
    # --------------------------------------------------
    user_messages_count = sum(1 for m in chat_history if m["role"] == "user")

    if user_messages_count == 1 and "example" in user_message.lower():
        clarification = "Could you clarify what you'd like an example of?"
        chat_history.append({"role": "assistant", "content": clarification})
        request.session["chat_history"] = chat_history
        request.session.modified = True
        return JsonResponse({"reply": clarification})

    # --------------------------------------------------
    # BUILD PROMPT (structured)
    # --------------------------------------------------
    prompt_messages = [{"role": "system", "content": system_instruction}] + chat_history

    # Flatten for Gemini API
    full_prompt = "\n".join([f"{m['role'].capitalize()}: {m['content']}" for m in prompt_messages])
    full_prompt += "\nAssistant:"

    # --------------------------------------------------
    # GEMINI CALL WITH FALLBACK
    # --------------------------------------------------
    try:
        result = PRIMARY_MODEL.generate_content(full_prompt)
        reply = result.text.strip()

    except ResourceExhausted:
        logger.warning("Primary model quota exhausted. Falling back.")
        try:
            result = FALLBACK_MODEL.generate_content(full_prompt)
            reply = result.text.strip()
        except ResourceExhausted:
            reply = "I’m temporarily unavailable due to API limits. Please try again shortly."

    except Exception as e:
        logger.exception("Gemini failure")
        reply = "I ran into an internal issue. Please try again."

    # --------------------------------------------------
    # SAVE ASSISTANT REPLY
    # --------------------------------------------------
    chat_history.append({"role": "assistant", "content": reply})
    request.session["chat_history"] = chat_history
    request.session.modified = True

    return JsonResponse({"reply": reply})


@csrf_exempt
def reset_session(request):
    # Only clear chat history, not full session (safer for other session data)
    request.session["chat_history"] = []
    request.session.modified = True
    return JsonResponse({"status": "ok"})
