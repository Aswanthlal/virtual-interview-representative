from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import logging
import os

logger = logging.getLogger(__name__)

def index(request):
    return render(request, "index.html")


@csrf_exempt
def chat_api(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=400)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        logger.error("Invalid JSON received")
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    user_message = data.get("message", "")
    if not user_message.strip():
        return JsonResponse({"error": "Message cannot be empty"}, status=400)

    system_instruction = """
You are an interview assistant designed to speak on behalf of Aswanth Lal in a 
voice-based interview. Always answer in a warm, confident, simple tone. 
Keep answers short, natural, and conversational — like a real human in an interview.

Below is Aswanth’s personal interview profile. Use it to answer any relevant questions.

LIFE STORY (SHORT):
"I started in mechanical engineering… but I realized I was more drawn to solving problems with data and AI. That curiosity led me to transition into data science, work on ML and LLM projects, and complete a year-long internship. Now, I’m focused on building meaningful AI products… and exploring global opportunities."

SUPERPOWER:
"I learn quickly… and adapt easily to new technologies, which helps me apply them effectively in real projects."

TOP 3 GROWTH AREAS:
"I want to get better at building production-grade AI systems… strengthen my skills in large-scale distributed computing… and communicate complex ideas more clearly."

COMMON MISCONCEPTION:
"People think I’m quiet at first… but once I understand the team and the problem, I collaborate actively and contribute strongly."

HOW I PUSH MY LIMITS:
"I take on projects just outside my comfort zone… challenges that force me to learn, experiment, and grow."

RULES:
- Use this persona naturally.
- Do NOT repeat phrases like “based on your persona”.
- Answer with confidence and clarity.
"""

    try:
        # ✅ IMPORT AND INIT INSIDE REQUEST
        import google.generativeai as genai

        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        model = genai.GenerativeModel("gemini-2.5-flash-lite")

        result = model.generate_content(
            system_instruction + "\nUser: " + user_message
        )

        reply = getattr(result, "text", "I’m sorry, I couldn’t process that.")
        return JsonResponse({"reply": reply})

    except Exception:
        logger.exception("Error in chat_api")
        return JsonResponse(
            {"error": "Internal server error. Please try again later."},
            status=500,
        )