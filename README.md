# Clic Halal — Prototype

Photo du frigo/placard → détection ingrédients → recette halal générée.

## 1. Backend (FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # sous Windows : venv\Scripts\activate
pip install -r requirements.txt
```

Copie `.env.example` en `.env` et mets ta vraie clé API Anthropic dedans :

```bash
cp .env.example .env
```

Puis édite `.env` avec ta clé. Lance le serveur :

```bash
export $(cat .env | xargs)        # sous Windows : voir note plus bas
uvicorn main:app --reload --port 8000
```

Sous Windows (PowerShell), pour charger la variable d'environnement :

```powershell
$env:ANTHROPIC_API_KEY = "ta_clé_ici"
uvicorn main:app --reload --port 8000
```

Le backend tourne sur `http://localhost:8000`. Teste avec `http://localhost:8000/health`.

## 2. Frontend (React + Vite)

Dans un autre terminal :

```bash
cd frontend
npm install
npm run dev
```

Le frontend tourne sur `http://localhost:5173`.

## 3. Test

1. Ouvre `http://localhost:5173`
2. Prends/choisis une photo de ton frigo ou placard
3. Clique "Analyser la photo" → regarde la console du navigateur (F12) et le terminal backend pour voir les ingrédients détectés (logging)
4. Vérifie/corrige la liste, retire ce qui est faux
5. Clique "Générer une recette"

## Ce qui n'est PAS encore fait (volontairement, pour rester minimal)

- Pas de sauvegarde/historique des recettes
- Pas d'authentification utilisateur
- Pas de déploiement (Vercel) — à faire une fois que le flow fonctionne en local
- Pas encore en PWA — à ajouter après validation du mécanisme de base
- La table de substitution halal en dur n'est pas encore en garde-fou de code — elle est actuellement seulement dans le prompt (étape 2 du plan à faire plus tard)

## Prochaine étape suggérée

Une fois que ça marche en local sur plusieurs photos différentes, on ajoute :
1. Le déploiement (backend sur Railway/Render, frontend sur Vercel, comme dernier-km)
2. La config PWA (manifest.json + service worker)
3. Le garde-fou de code pour la table de substitution halal (double vérification en plus du prompt)
