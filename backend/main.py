import base64
import json
import os

from anthropic import Anthropic
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="CaptFood API")

# CORS ouvert pour le dev local (à restreindre en prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

VISION_PROMPT = """Tu es un assistant qui identifie les ingrédients alimentaires visibles sur une ou plusieurs photos de frigo, placard ou plan de travail (les photos peuvent montrer des zones différentes du même foyer).

Analyse TOUTES les images fournies et liste UNIQUEMENT les ingrédients que tu peux identifier avec certitude raisonnable, en combinant les résultats de toutes les photos SANS DOUBLON.

Réponds STRICTEMENT en JSON, sans texte avant ou après, format :
{
  "ingredients": ["ingrédient1", "ingrédient2"],
  "incertain": ["ingrédient possible mais pas sûr"]
}

Règles :
- Nomme les ingrédients en français, au singulier, sans marque commerciale (ex: "yaourt nature" pas "Yaourt Danone")
- Si tu vois un emballage sans pouvoir identifier le contenu précis, mets-le dans "incertain"
- Ignore les ustensiles, contenants vides, produits non alimentaires
- Ne devine jamais la quantité, juste la présence
- Si un même ingrédient apparaît sur plusieurs photos, ne le liste qu'une seule fois"""

RULE_PORK = 'Aucun porc ni dérivé (lardons, jambon, saindoux, gélatine non précisée)'
RULE_MEAT_CERT = (
    'Si une recette nécessite de la viande ou volaille : ajoute une note explicite '
    '"Vérifiez que votre viande est certifiée halal/zabiha avant de cuisiner"'
)
RULE_ALCOHOL = 'Aucun alcool en ingrédient ou cuisson (vin, bière, rhum, extraits alcoolisés, y compris pour déglacer)'
RULE_SUBSTITUTE = (
    'Si un ingrédient classique incompatible avec les règles ci-dessus serait normalement utilisé, '
    'remplace-le et signale le remplacement avec la mention "(substitué)" dans "notes_halal"'
)
RULE_BASE = (
    'Utilise en priorité les ingrédients de la liste fournie ; '
    'tu peux ajouter quelques ingrédients de base courants (sel, huile, épices) si nécessaire'
)
RULE_NO_NOTES = 'Laisse le champ "notes_halal" vide ([]) pour chaque recette : aucune contrainte alimentaire particulière n\'est demandée ici'

RECIPE_PROMPT_TEMPLATE = """Tu es un chef cuisinier qui génère des recettes détaillées et réalistes à partir d'ingrédients disponibles.

Ingrédients disponibles : {ingredients}

Génère EXACTEMENT 3 recettes DIFFÉRENTES (varie les styles/cuisines quand c'est possible) en respectant STRICTEMENT ces règles :
{rules}

Pour chaque étape de préparation, sois PRÉCIS et DÉTAILLÉ comme un vrai chef qui explique à un débutant :
- Indique une durée quand c'est pertinent (ex: "faire revenir 5 minutes")
- Donne des repères sensoriels (couleur, texture, odeur) pour savoir quand passer à l'étape suivante
- Précise les techniques (feu doux/vif, à couvert, en remuant régulièrement...)
- Ne te contente jamais d'une phrase vague du type "faire cuire les légumes"

Réponds STRICTEMENT en JSON, sans texte avant ou après, format :
{{
  "recettes": [
    {{
      "titre": "...",
      "temps_preparation": "...",
      "difficulte": "Facile" | "Moyen" | "Difficile",
      "ingredients_utilises": ["..."],
      "ingredients_a_ajouter": ["..."],
      "etapes": [
        {{"titre": "court résumé de l'étape", "detail": "explication complète et précise", "duree": "ex: 5 min ou null"}}
      ],
      "notes_halal": ["substitutions ou avertissements appliqués"]
    }}
  ]
}}"""


def build_recipe_prompt(ingredients: list[str], halal: bool, sans_alcool: bool) -> str:
    rules = []
    if halal:
        rules.append(RULE_PORK)
        rules.append(RULE_MEAT_CERT)
    if sans_alcool:
        rules.append(RULE_ALCOHOL)
    if halal or sans_alcool:
        rules.append(RULE_SUBSTITUTE)
    rules.append(RULE_BASE)
    if not halal and not sans_alcool:
        rules.append(RULE_NO_NOTES)

    numbered_rules = "\n".join(f"{i + 1}. {rule}" for i, rule in enumerate(rules))
    return RECIPE_PROMPT_TEMPLATE.format(
        ingredients=", ".join(ingredients), rules=numbered_rules
    )


def parse_json_response(text: str) -> dict:
    """Extrait le JSON de la réponse, même si Claude ajoute du texte autour."""
    text = text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"Pas de JSON trouvé dans la réponse : {text[:200]}")
    return json.loads(text[start : end + 1])


def extract_text(response) -> str:
    """Va chercher le premier bloc de texte dans la réponse, en ignorant
    les blocs de réflexion (thinking) que le modèle peut renvoyer avant."""
    for block in response.content:
        if getattr(block, "type", None) == "text":
            return block.text
    raise ValueError("Aucun bloc de texte trouvé dans la réponse du modèle")


@app.get("/health")
def health():
    return {"status": "ok"}


MAX_PHOTOS = 5


@app.post("/detect-ingredients")
async def detect_ingredients(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="Aucune photo envoyée")
    if len(files) > MAX_PHOTOS:
        raise HTTPException(
            status_code=400, detail=f"Maximum {MAX_PHOTOS} photos à la fois"
        )

    image_blocks = []
    for file in files:
        image_bytes = await file.read()
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        media_type = file.content_type or "image/jpeg"
        image_blocks.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": image_b64,
                },
            }
        )

    try:
        response = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": [*image_blocks, {"type": "text", "text": VISION_PROMPT}],
                }
            ],
        )
        raw_text = extract_text(response)
        result = parse_json_response(raw_text)
        print("[LOG] Ingrédients détectés :", result)  # logging demandé
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class RecipeRequest(BaseModel):
    ingredients: list[str]
    halal: bool = True
    sans_alcool: bool = True


@app.post("/generate-recipe")
async def generate_recipe(request: RecipeRequest):
    if not request.ingredients:
        raise HTTPException(status_code=400, detail="Liste d'ingrédients vide")

    prompt = build_recipe_prompt(request.ingredients, request.halal, request.sans_alcool)

    try:
        response = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_text = extract_text(response)
        result = parse_json_response(raw_text)
        titres = [r.get("titre") for r in result.get("recettes", [])]
        print(f"[LOG] {len(titres)} recette(s) générée(s) :", titres)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
