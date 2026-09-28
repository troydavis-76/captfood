import { useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function PotLoader() {
  return (
    <div className="pot-loader" role="status" aria-live="polite">
      <svg viewBox="0 0 100 100" width="72" height="72">
        <g className="pot-steam">
          <path className="steam steam-1" d="M35 30 Q30 20 35 10" />
          <path className="steam steam-2" d="M50 30 Q45 18 50 6" />
          <path className="steam steam-3" d="M65 30 Q60 20 65 10" />
        </g>
        <ellipse cx="50" cy="68" rx="30" ry="8" className="pot-shadow" />
        <path
          d="M20 55 Q20 78 50 78 Q80 78 80 55 Z"
          className="pot-body"
        />
        <rect x="14" y="50" width="72" height="8" rx="4" className="pot-rim" />
        <rect x="4" y="51" width="12" height="6" rx="3" className="pot-handle" />
        <rect x="84" y="51" width="12" height="6" rx="3" className="pot-handle" />
        <g className="pot-spoon">
          <line x1="50" y1="60" x2="50" y2="30" className="spoon-stick" />
          <ellipse cx="50" cy="27" rx="5" ry="7" className="spoon-head" />
        </g>
      </svg>
      <p className="pot-loader-text">Le chef prépare tes recettes...</p>
    </div>
  )
}

const MAX_PHOTOS = 5

export default function App() {
  const [photos, setPhotos] = useState([])
  const [photoPreviews, setPhotoPreviews] = useState([])
  const [ingredients, setIngredients] = useState(null)
  const [incertain, setIncertain] = useState([])
  const [halal, setHalal] = useState(true)
  const [sansAlcool, setSansAlcool] = useState(true)
  const [recipes, setRecipes] = useState(null)
  const [loadingIngredients, setLoadingIngredients] = useState(false)
  const [loadingRecipe, setLoadingRecipe] = useState(false)
  const [error, setError] = useState(null)

  function handlePhotoChange(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    if (files.length > MAX_PHOTOS) {
      setError(`Maximum ${MAX_PHOTOS} photos à la fois`)
      return
    }
    setPhotos(files)
    setPhotoPreviews(files.map((f) => URL.createObjectURL(f)))
    setIngredients(null)
    setRecipes(null)
    setError(null)
  }

  async function detectIngredients() {
    if (photos.length === 0) return
    setLoadingIngredients(true)
    setError(null)
    try {
      const formData = new FormData()
      photos.forEach((photo) => formData.append('files', photo))
      const res = await fetch(`${API_URL}/detect-ingredients`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error(`Erreur serveur (${res.status})`)
      const data = await res.json()
      console.log('Ingrédients détectés :', data) // vérification étape 1
      setIngredients(data.ingredients || [])
      setIncertain(data.incertain || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingIngredients(false)
    }
  }

  async function generateRecipe() {
    if (!ingredients || ingredients.length === 0) return
    setLoadingRecipe(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/generate-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients, halal, sans_alcool: sansAlcool }),
      })
      if (!res.ok) throw new Error(`Erreur serveur (${res.status})`)
      const data = await res.json()
      console.log('Recettes générées :', data) // vérification étape 2
      setRecipes(data.recettes || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingRecipe(false)
    }
  }

  function removeIngredient(idx) {
    setIngredients(ingredients.filter((_, i) => i !== idx))
  }

  function addUncertainIngredient(idx) {
    const ing = incertain[idx]
    setIngredients([...ingredients, ing])
    setIncertain(incertain.filter((_, i) => i !== idx))
  }

  return (
    <div className="container">
      <header>
        <h1>CaptFood</h1>
        <p className="subtitle">Fais voir ton placard/frigo, je te sors une recette</p>
        <div className="benefits">
          <div className="benefit">
            <span className="benefit-icon">🌱</span>
            <span>Anti-gaspi</span>
          </div>
          <div className="benefit">
            <span className="benefit-icon">☪️</span>
            <span>100% halal</span>
          </div>
          <div className="benefit">
            <span className="benefit-icon">⚡</span>
            <span>Rapide</span>
          </div>
          <div className="benefit">
            <span className="benefit-icon">🍽️</span>
            <span>3 recettes</span>
          </div>
        </div>
      </header>

      <section className="step canvas">
        <h2>1. Prends jusqu'à {MAX_PHOTOS} photos</h2>
        <label className="canvas-dropzone">
          <span className="canvas-icon">📷</span>
          <span className="canvas-text">
            {photos.length > 0
              ? `${photos.length} photo${photos.length > 1 ? 's' : ''} sélectionnée${photos.length > 1 ? 's' : ''}`
              : 'Choisis tes photos'}
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoChange}
          />
        </label>
        <p className="hint">Choisis "Photos"/"Galerie" pour en sélectionner plusieurs d'un coup, ou "Appareil photo" pour une seule.</p>
        {photoPreviews.length > 0 && (
          <div className="preview-row">
            {photoPreviews.map((src, i) => (
              <img key={i} src={src} alt={`aperçu ${i + 1}`} className="preview preview-thumb" />
            ))}
          </div>
        )}
        {photos.length > 0 && !ingredients && (
          <button onClick={detectIngredients} disabled={loadingIngredients}>
            {loadingIngredients
              ? 'Analyse en cours...'
              : `Analyser ${photos.length > 1 ? `les ${photos.length} photos` : 'la photo'}`}
          </button>
        )}
      </section>

      {ingredients && (
        <section className="step">
          <h2>2. Ingrédients détectés</h2>
          <p className="hint">Vérifie et retire ce qui est faux avant de continuer.</p>
          <ul className="ingredient-list">
            {ingredients.map((ing, idx) => (
              <li key={idx}>
                {ing}
                <button className="remove" onClick={() => removeIngredient(idx)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
          {incertain.length > 0 && (
            <>
              <p className="hint uncertain-title">Incertain — ajoute si c'est correct</p>
              <ul className="ingredient-list uncertain-list">
                {incertain.map((ing, idx) => (
                  <li key={idx}>
                    {ing}
                    <button
                      className="add"
                      onClick={() => addUncertainIngredient(idx)}
                    >
                      +
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <label className="halal-checkbox">
            <input
              type="checkbox"
              checked={halal}
              onChange={(e) => setHalal(e.target.checked)}
            />
            Recettes halal uniquement
          </label>
          <label className="halal-checkbox">
            <input
              type="checkbox"
              checked={sansAlcool}
              onChange={(e) => setSansAlcool(e.target.checked)}
            />
            Sans alcool
          </label>

          {!recipes && !loadingRecipe && (
            <button onClick={generateRecipe} disabled={ingredients.length === 0}>
              Générer des recettes
            </button>
          )}

          {loadingRecipe && <PotLoader />}
        </section>
      )}

      {recipes && recipes.length > 0 && (
        <div className="recipes-grid">
          {recipes.map((recipe, ri) => (
            <section className="recipe-card" key={ri}>
              <h2>{recipe.titre}</h2>
              <p className="time">
                ⏱ {recipe.temps_preparation}
                {recipe.difficulte && ` · ${recipe.difficulte}`}
              </p>

              <h3>Ingrédients utilisés</h3>
              <ul>
                {recipe.ingredients_utilises?.map((ing, i) => <li key={i}>{ing}</li>)}
              </ul>

              {recipe.ingredients_a_ajouter?.length > 0 && (
                <>
                  <h3>À ajouter</h3>
                  <ul>
                    {recipe.ingredients_a_ajouter.map((ing, i) => <li key={i}>{ing}</li>)}
                  </ul>
                </>
              )}

              <h3>Étapes</h3>
              <ol className="steps-list">
                {recipe.etapes?.map((step, i) => (
                  <li key={i}>
                    <span className="step-title">
                      {step.titre}
                      {step.duree && <span className="step-duree"> · {step.duree}</span>}
                    </span>
                    <p className="step-detail">{step.detail}</p>
                  </li>
                ))}
              </ol>

              {recipe.notes_halal?.length > 0 && (
                <div className="halal-notes">
                  <h3>Notes halal</h3>
                  <ul>
                    {recipe.notes_halal.map((note, i) => <li key={i}>{note}</li>)}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {error && <p className="error">Erreur : {error}</p>}
    </div>
  )
}
