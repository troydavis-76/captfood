import { useState } from 'react'

const API_URL = 'http://localhost:8000'

export default function App() {
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [ingredients, setIngredients] = useState(null)
  const [incertain, setIncertain] = useState([])
  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setIngredients(null)
    setRecipe(null)
    setError(null)
  }

  async function detectIngredients() {
    if (!photo) return
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', photo)
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
      setLoading(false)
    }
  }

  async function generateRecipe() {
    if (!ingredients || ingredients.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/generate-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients }),
      })
      if (!res.ok) throw new Error(`Erreur serveur (${res.status})`)
      const data = await res.json()
      console.log('Recette générée :', data) // vérification étape 2
      setRecipe(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
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
        <h1>Clic Halal</h1>
        <p className="subtitle">Photo de ton frigo → recette halal</p>
      </header>

      <section className="step">
        <h2>1. Prends une photo</h2>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
        />
        {photoPreview && (
          <img src={photoPreview} alt="aperçu" className="preview" />
        )}
        {photo && !ingredients && (
          <button onClick={detectIngredients} disabled={loading}>
            {loading ? 'Analyse en cours...' : 'Analyser la photo'}
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
          {!recipe && (
            <button onClick={generateRecipe} disabled={loading || ingredients.length === 0}>
              {loading ? 'Génération...' : 'Générer une recette'}
            </button>
          )}
        </section>
      )}

      {recipe && (
        <section className="step recipe">
          <h2>{recipe.titre}</h2>
          <p className="time">⏱ {recipe.temps_preparation}</p>

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
          <ol>
            {recipe.etapes?.map((step, i) => <li key={i}>{step}</li>)}
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
      )}

      {error && <p className="error">Erreur : {error}</p>}
    </div>
  )
}
