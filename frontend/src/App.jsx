import { useState, useEffect } from 'react'
import { LANGUAGES, RTL_LANGS, LANG_NAMES_FOR_API, getT } from './i18n'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function readErrorDetail(res, fallback) {
  try {
    const data = await res.json()
    if (data && typeof data.detail === 'string' && data.detail.trim()) {
      return `${fallback} — ${data.detail}`
    }
  } catch {
    // le corps n'était pas du JSON exploitable, on garde le fallback
  }
  return fallback
}

function getDeviceId() {
  try {
    let id = localStorage.getItem('captfood_device_id')
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem('captfood_device_id', id)
    }
    return id
  } catch {
    return ''
  }
}

function PotLoader({ text }) {
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
          <line x1="50" y1="28" x2="50" y2="60" className="spoon-stick" />
          <ellipse cx="50" cy="61" rx="6" ry="5" className="spoon-head" />
        </g>
      </svg>
      <p className="pot-loader-text">{text}</p>
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
  const [cookeo, setCookeo] = useState(false)
  const [thermomix, setThermomix] = useState(false)
  const [recipes, setRecipes] = useState(null)
  const [openRecipes, setOpenRecipes] = useState({})
  const [loadingIngredients, setLoadingIngredients] = useState(false)
  const [loadingRecipe, setLoadingRecipe] = useState(false)
  const [error, setError] = useState(null)
  const [manualIngredient, setManualIngredient] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [historyItems, setHistoryItems] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('captfood_lang') || 'fr'
    } catch {
      return 'fr'
    }
  })
  const t = getT(lang)

  useEffect(() => {
    try {
      localStorage.setItem('captfood_lang', lang)
    } catch {
      // ignore (stockage indisponible)
    }
    document.documentElement.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }, [lang])

  function handlePhotoChange(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    if (files.length > MAX_PHOTOS) {
      setError(t.maxPhotosError(MAX_PHOTOS))
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
      formData.append('lang', LANG_NAMES_FOR_API[lang] || 'français')
      const res = await fetch(`${API_URL}/detect-ingredients`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error(await readErrorDetail(res, t.serverError(res.status)))
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
        body: JSON.stringify({
          ingredients,
          halal,
          sans_alcool: sansAlcool,
          cookeo,
          thermomix,
          lang: LANG_NAMES_FOR_API[lang] || 'français',
          device_id: getDeviceId(),
        }),
      })
      if (!res.ok) throw new Error(await readErrorDetail(res, t.serverError(res.status)))
      const data = await res.json()
      console.log('Recettes générées :', data) // vérification étape 2
      const recettes = data.recettes || []
      setRecipes(recettes)
      setOpenRecipes(recettes.length > 0 ? { 0: true } : {})
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

  function addManualIngredient() {
    const value = manualIngredient.trim()
    if (!value) return
    if (ingredients.some((ing) => ing.toLowerCase() === value.toLowerCase())) {
      setManualIngredient('')
      return
    }
    setIngredients([...ingredients, value])
    setManualIngredient('')
  }

  function toggleRecipe(idx) {
    setOpenRecipes((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  function restart() {
    setPhotos([])
    setPhotoPreviews([])
    setIngredients(null)
    setIncertain([])
    setRecipes(null)
    setOpenRecipes({})
    setError(null)
  }

  async function openHistory() {
    setShowHistory(true)
    setLoadingHistory(true)
    setHistoryError(null)
    try {
      const deviceId = getDeviceId()
      const res = await fetch(`${API_URL}/recipe-history?device_id=${encodeURIComponent(deviceId)}`)
      if (!res.ok) throw new Error(await readErrorDetail(res, t.serverError(res.status)))
      const data = await res.json()
      setHistoryItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setHistoryError(err.message)
    } finally {
      setLoadingHistory(false)
    }
  }

  function loadHistoryItem(item) {
    setRecipes(item.recettes || [])
    setOpenRecipes(item.recettes && item.recettes.length > 0 ? { 0: true } : {})
    setIngredients(item.ingredients || [])
    setIncertain([])
    setShowHistory(false)
  }

  return (
    <div className="container">
      <div className="top-bar">
        <button type="button" className="history-toggle" onClick={showHistory ? () => setShowHistory(false) : openHistory}>
          {showHistory ? `← ${t.backButton}` : `🕘 ${t.historyButton}`}
        </button>
        <div className="lang-switcher">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            aria-label="Langue"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showHistory ? (
        <section className="step history-panel">
          <h2>{t.historyButton}</h2>
          {loadingHistory && <PotLoader text={t.historyLoading} />}
          {historyError && <p className="error">{t.errorPrefix} : {historyError}</p>}
          {!loadingHistory && !historyError && historyItems.length === 0 && (
            <p className="hint">{t.historyEmpty}</p>
          )}
          {!loadingHistory && historyItems.length > 0 && (
            <ul className="history-list">
              {historyItems.map((item) => (
                <li key={item.id} className="history-item">
                  <button type="button" className="history-item-button" onClick={() => loadHistoryItem(item)}>
                    <span className="history-item-date">
                      {new Date(item.created_at).toLocaleString(lang)}
                    </span>
                    <span className="history-item-ingredients">
                      {(item.ingredients || []).slice(0, 4).join(', ')}
                      {(item.ingredients || []).length > 4 ? '…' : ''}
                    </span>
                    <span className="history-item-tags">
                      {item.halal && <span className="history-tag">☪️</span>}
                      {item.sans_alcool && <span className="history-tag">🚫🍷</span>}
                      {item.cookeo && <span className="history-tag">Cookeo</span>}
                      {item.thermomix && <span className="history-tag">Thermomix</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
      <header>
        <h1>CaptFood</h1>
        <p className="subtitle">{t.subtitle}</p>
        <div className="benefits">
          <div className="benefit">
            <span className="benefit-icon">🌱</span>
            <span>{t.benefitAntiGaspi}</span>
          </div>
          <div className="benefit">
            <span className="benefit-icon">☪️</span>
            <span>{t.benefitHalal}</span>
          </div>
          <div className="benefit">
            <span className="benefit-icon">⚡</span>
            <span>{t.benefitFast}</span>
          </div>
          <div className="benefit">
            <span className="benefit-icon">🍽️</span>
            <span>{t.benefitRecipes}</span>
          </div>
        </div>
      </header>

      <section className="step canvas">
        <h2>{t.step1Title(MAX_PHOTOS)}</h2>
        <label className="canvas-dropzone">
          {photoPreviews.length > 0 ? (
            <div className="preview-row">
              {photoPreviews.map((src, i) => (
                <img key={i} src={src} alt={`aperçu ${i + 1}`} className="preview-thumb" />
              ))}
            </div>
          ) : (
            <span className="canvas-icon">📷</span>
          )}
          <span className="canvas-text">
            {photos.length > 0 ? t.photosSelected(photos.length) : t.chooseFiles}
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoChange}
          />
        </label>
        <p className="hint">{t.hintPhotos}</p>
        {photos.length > 0 && !ingredients && !loadingIngredients && (
          <button onClick={detectIngredients}>
            {t.analyzeButton(photos.length)}
          </button>
        )}
        {loadingIngredients && <PotLoader text={t.photoLoaderText} />}
      </section>

      {ingredients && (
        <section className="step">
          <h2>{t.step2Title}</h2>
          <p className="hint">{t.hintVerify}</p>
          {ingredients.length === 0 ? (
            <p className="hint empty-ingredients">{t.emptyIngredients}</p>
          ) : (
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
          )}

          <div className="manual-add-row">
            <input
              type="text"
              className="manual-add-input"
              placeholder={t.manualAddPlaceholder}
              value={manualIngredient}
              onChange={(e) => setManualIngredient(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addManualIngredient()
                }
              }}
            />
            <button
              type="button"
              className="manual-add-button"
              onClick={addManualIngredient}
              disabled={!manualIngredient.trim()}
            >
              {t.manualAddButton}
            </button>
          </div>

          {incertain.length > 0 && (
            <>
              <p className="hint uncertain-title">{t.uncertainTitle}</p>
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
            {t.halalOnly}
          </label>
          <label className="halal-checkbox">
            <input
              type="checkbox"
              checked={sansAlcool}
              onChange={(e) => setSansAlcool(e.target.checked)}
            />
            {t.noAlcohol}
          </label>

          <div className="appliance-checkboxes">
            <label className="halal-checkbox appliance-checkbox">
              <input
                type="checkbox"
                checked={cookeo}
                onChange={(e) => setCookeo(e.target.checked)}
              />
              {t.cookeoLabel}
            </label>
            <label className="halal-checkbox appliance-checkbox">
              <input
                type="checkbox"
                checked={thermomix}
                onChange={(e) => setThermomix(e.target.checked)}
              />
              {t.thermomixLabel}
            </label>
          </div>

          {!loadingRecipe && (
            <button onClick={generateRecipe} disabled={ingredients.length === 0}>
              {recipes ? t.regenerateButton : t.generateButton}
            </button>
          )}

          {loadingRecipe && <PotLoader text={t.potLoaderText} />}
        </section>
      )}

      {recipes && recipes.length > 0 && (
        <>
          <h2 className="recipes-title">{t.step3Title}</h2>
          <div className="recipes-accordion">
          {recipes.map((recipe, ri) => {
            const isOpen = !!openRecipes[ri]
            return (
              <section className={`recipe-card ${isOpen ? 'open' : ''}`} key={ri}>
                <button
                  type="button"
                  className="recipe-header"
                  onClick={() => toggleRecipe(ri)}
                  aria-expanded={isOpen}
                >
                  <span className="recipe-header-text">
                    <span className="recipe-title">{recipe.titre}</span>
                    <span className="time">
                      ⏱ {recipe.temps_preparation}
                      {recipe.difficulte && ` · ${recipe.difficulte}`}
                      {recipe.calories_estimees && (
                        <span title={t.caloriesLabel}> · 🔥 {recipe.calories_estimees}</span>
                      )}
                    </span>
                  </span>
                  <span className="recipe-chevron">▾</span>
                </button>

                {isOpen && (
                  <div className="recipe-body">
                    <h3>{t.ingredientsUsed}</h3>
                    <ul>
                      {recipe.ingredients_utilises?.map((ing, i) => <li key={i}>{ing}</li>)}
                    </ul>

                    {recipe.ingredients_a_ajouter?.length > 0 && (
                      <>
                        <h3>{t.toAdd}</h3>
                        <ul>
                          {recipe.ingredients_a_ajouter.map((ing, i) => <li key={i}>{ing}</li>)}
                        </ul>
                      </>
                    )}

                    <h3>{t.stepsTitle}</h3>
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
                        <h3>{t.halalNotes}</h3>
                        <ul>
                          {recipe.notes_halal.map((note, i) => <li key={i}>{note}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )
          })}
          </div>
          <button type="button" className="restart-button" onClick={restart}>
            {t.restartButton}
          </button>
        </>
      )}

      <section className="seo-section">
        <p className="seo-intro">{t.seoIntro}</p>

        <h2>{t.seoHowTitle}</h2>
        <ol className="seo-how-list">
          <li>{t.seoHowStep1}</li>
          <li>{t.seoHowStep2}</li>
          <li>{t.seoHowStep3}</li>
        </ol>

        <h2>{t.seoWhyTitle}</h2>
        <p>{t.seoWhyText}</p>

        <p className="contact-line">
          {t.contactIntro} <a href="mailto:yassop76@hotmail.fr">yassop76@hotmail.fr</a>
        </p>
        <p className="privacy-line">
          <a href="/privacy">{t.privacyLink}</a>
        </p>
      </section>

        </>
      )}

      {error && <p className="error">{t.errorPrefix} : {error}</p>}
    </div>
  )
}
