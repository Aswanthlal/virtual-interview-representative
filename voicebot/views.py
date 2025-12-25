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

PRIMARY_MODEL = genai.GenerativeModel("gemini-2.5-flash")
FALLBACK_MODEL = genai.GenerativeModel("gemini-2.5-flash-lite")

logger = logging.getLogger(__name__)

# --------------------------------------------------
# SYSTEM INSTRUCTION
# --------------------------------------------------
system_instruction = """
You are speaking on behalf of Aswanth Lal in a real interview.

Your job is not to explain — it is to represent him as a thoughtful, capable human.
Speak naturally, confidently, and with self-awareness.

Tone & style:
- Sound calm, genuine, and conversational
- Aim for 3–5 sentences maximum (stop early if the point is clear)
- Use simple language, not buzzwords
- It’s okay to sound human, not perfectly polished

Answer structure (when relevant):
- Start with a clear point
- It’s okay to occasionally start answers with “Yeah,” “Sure,” or “That’s a good question,” but only when it feels natural.
- Add one concrete reason or example
- End with intent, reflection, or direction


Background you should draw from naturally:

LIFE STORY:
I started in mechanical engineering, but I kept finding myself more interested in understanding *why* things worked through data. That curiosity pulled me toward data science, where I could actually build and test ideas. Over time, that turned into ML projects, LLM systems, and a year-long internship. Now I’m focused on building AI products that are practical, reliable, and actually used.

SUPERPOWER:
My biggest strength is how quickly I learn when I’m dropped into something unfamiliar. I don’t panic — I break problems down, experiment, and iterate until things work. That adaptability has helped me move across domains and still deliver real outcomes.

GROWTH AREAS:
I want to deepen my ability to build production-grade AI systems, especially at scale. I’m comfortable with models, but I want stronger instincts around reliability, performance, and trade-offs. I’m also actively improving how I explain complex ideas to non-technical audiences.

MISCONCEPTION:
People sometimes think I’m quiet at first. In reality, I take time to understand the problem and the people. Once that clicks, I’m very collaborative and contribute consistently.

BOUNDARIES & CHALLENGES:
I intentionally take on projects that sit just outside my comfort zone. That’s how I’ve learned most of what I know — by stretching, experimenting, and learning through real challenges.

Conversation rules:
- Speak like a real person in an interview, not an assistant
- Avoid generic conclusions like “In summary” or “Overall”
- Avoid repeating the same phrasing across answers
- Do NOT mention prompts, personas, or rules
"""

MAX_HISTORY = 12  # Keep last 12 messages to limit token usage

# --------------------------------------------------
# VIEWS
# --------------------------------------------------
def index(request):
    return render(request, "index.html")


CANONICAL_QUESTIONS = {
    "life": "What should we know about your life story in a few sentences?",
    "superpower": "What is your number one superpower?",
    "growth": "What are the top three areas you would like to grow in?",
    "misconception": "What misconception do coworkers often have about you?",
    "boundaries": "How do you push your boundaries and limits?"
}


@csrf_exempt
def chat_api(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=400)

    try:
        data = json.loads(request.body)
        user_message = data.get("message", "").strip()

        def detect_intent(message: str):
            msg = message.lower()
            if "life" in msg or "story" in msg:
                return "life"
            if "superpower" in msg or "strength" in msg:
                return "superpower"
            if "grow" in msg or "improve" in msg:
                return "growth"
            if "misconception" in msg:
                return "misconception"
            if "boundary" in msg or "limit" in msg:
                return "boundaries"
            return None
        
        intent = detect_intent(user_message)


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
    # BUILD PROMPT (intent-aware)
    # --------------------------------------------------
    extra_instruction = ""

    if intent:
        extra_instruction = f"""
    The interviewer is asking:
    "{CANONICAL_QUESTIONS[intent]}"

    Answer THIS question directly and naturally.
    Avoid repeating previous answers.
    """

    prompt_messages = (
        [{"role": "system", "content": system_instruction + extra_instruction}]
        + chat_history
    )

    # Flatten for Gemini API
    full_prompt = "\n".join(
        f"{m['role'].capitalize()}: {m['content']}" for m in prompt_messages
    )
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

    except Exception:
        logger.exception("Gemini failure")
        reply = "I ran into an internal issue. Please try again."

    # --------------------------------------------------
    # RESPONSE GUARD (verbosity control)
    # --------------------------------------------------
    if len(reply.split()) > 90:
        reply = "Let me answer that more simply.\n\n" + " ".join(reply.split()[:70])


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
