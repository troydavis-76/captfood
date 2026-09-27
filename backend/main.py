import base64
import json
import os

from anthropic import Anthropic
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Clic Halal API")

# CORS ouvert pour le dev local (à restreindre en prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

VISION_PROMPT = """Tu es un assistant qui identifie les ingrédients alimentaires visibles sur une photo de frigo, placard ou plan de travail.

Analyse l'image et liste UNIQUEMENT les ingrédients que tu peux identifier avec certitude raisonnable.

Réponds STRICTEMENT en JSON, sans texte avant ou après, format :
{
  "ingredients": ["ingrédient1", "ingrédient2"],
  "incertain": ["ingrédient possible mais pas sûr"]
}

Règles :
- Nomme les ingrédients en français, au singulier, sans marque commerciale (ex: "yaourt nature" pas "Yaourt Danone")
- Si tu vois un emballage sans pouvoir identifier le contenu précis, mets-le dans "incertain"
- Ignore les ustensiles, contenants vides, produits non alimentaires
- Ne devine jamais la quantité, juste la présence"""

RECIPE_PROMPT_TEMPLATE = """Tu es un assistant culinaire qui génère des recettes 100% halal à partir d'ingrédients disponibles.

Ingrédients disponibles : {ingredients}

Génère UNE recette respectant STRICTEMENT ces règles :
1. Aucun alcool en ingrédient ou cuisson (vin, bière, rhum, extraits alcoolisés)
2. Aucun porc ni dérivé (lardons, jambon, saindoux, gélatine non précisée)
3. Si la recette nécessite de la viande ou volaille : ajoute une note explicite "Vérifiez que votre viande est certifiée halal/zabiha avant de cuisiner"
4. Si un ingrédient classique non-halal serait normalement utilisé, remplace-le et signale le remplacement avec la mention "(substitué pour respecter le halal)"
5. Utilise en priorité les ingrédients de la liste fournie ; tu peux ajouter 2-3 ingrédients de base courants (sel, huile, épices) si nécessaire

Réponds STRICTEMENT en JSON, sans texte avant ou après, format :
{{
  "titre": "...",
  "temps_preparation": "...",
  "ingredients_utilises": ["..."],
  "ingredients_a_ajouter": ["..."],
  "etapes": ["...", "..."],
  "notes_halal": ["substitutions ou avertissements appliqués"]
}}"""


def parse_json_response(text: str) -> dict:
    """Extrait le JSON de la réponse, même si Claude ajoute du texte autour."""
    text = text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"Pas de JSON trouvé dans la réponse : {text[:200]}")
    return json.loads(text[start : end + 1])


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/detect-ingredients")
async def detect_ingredients(file: UploadFile = File(...)):
    image_bytes = await file.read()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    media_type = file.content_type or "image/jpeg"

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": VISION_PROMPT},
                    ],
                }
            ],
        )
        raw_text = response.content[0].text
        result = parse_json_response(raw_text)
        print("[LOG] Ingrédients détectés :", result)  # logging demandé
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class RecipeRequest(BaseModel):
    ingredients: list[str]


@app.post("/generate-recipe")
async def generate_recipe(request: RecipeRequest):
    if not request.ingredients:
        raise HTTPException(status_code=400, detail="Liste d'ingrédients vide")

    prompt = RECIPE_PROMPT_TEMPLATE.format(ingredients=", ".join(request.ingredients))

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_text = response.content[0].text
        result = parse_json_response(raw_text)
        print("[LOG] Recette générée :", result.get("titre"))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
