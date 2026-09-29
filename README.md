# CaptFood

De ton placard à ton assiette, en une photo — zéro gaspillage.

Photo(s) du frigo/placard → détection des ingrédients (Claude Vision) → 3 recettes générées (Claude), avec options halal, sans alcool, et adaptation Cookeo/Thermomix.

## Fonctionnalités actuelles

- Jusqu'à 5 photos analysées en une seule fois
- Détection des ingrédients avec liste "incertain" à valider, + ajout manuel d'un ingrédient
- Options cochables : Recettes halal uniquement, Sans alcool, Adapter pour Cookeo, Adapter pour Thermomix (cumulables)
- 3 recettes générées à chaque fois, affichées en accordéon, avec fourchette de calories estimée par portion
- Interface multilingue (français, anglais, arabe, espagnol, allemand) avec support RTL pour l'arabe — les recettes sont générées directement dans la langue choisie
- Bouton "Recommencer avec une autre photo"

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

Pour pointer vers un backend qui n'est pas en local, définis `VITE_API_URL` (fichier `.env` dans `frontend/`, ou variable d'environnement au déploiement) :

```
VITE_API_URL=https://ton-backend.onrender.com
```

## 3. Test manuel

1. Ouvre `http://localhost:5173`
2. Prends/choisis jusqu'à 5 photos de ton frigo ou placard
3. Clique "Analyser" → vérifie/corrige la liste d'ingrédients détectés (ou ajoute-en un manuellement)
4. Coche les options souhaitées (halal, sans alcool, Cookeo, Thermomix)
5. Clique "Générer des recettes" → 3 recettes s'affichent en accordéon

## Déploiement

- **Frontend** : Vercel (build statique, variable `VITE_API_URL` pointant vers le backend)
- **Backend** : Render (plan gratuit — l'instance se met en veille après 15 min d'inactivité, ce qui peut ralentir la première requête)

Le repo GitHub et le projet Vercel s'appellent `captfood`. Le service Render a gardé le nom `click-halal` car l'URL `onrender.com` ne peut pas être renommée après la création du service — cette URL n'est de toute façon jamais visible par les utilisateurs.

## Ce qui n'est PAS encore fait

- Pas de sauvegarde/historique des recettes
- Pas d'authentification utilisateur
- Pas encore en PWA (prévu), puis en APK Android une fois validé
- La table de substitution halal en dur n'est pas encore un garde-fou de code — elle est actuellement seulement dans le prompt envoyé à Claude

## Prochaine étape suggérée

1. Config PWA (manifest.json + service worker)
2. Garde-fou de code pour la table de substitution halal (double vérification en plus du prompt)
3. Empaquetage en APK Android une fois la PWA validée
