import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { conso, emission, codesPostaux, dateDebut, dateFin } = body

    // ── 1. Validation ──
    if (!conso || !emission || isNaN(Number(conso)) || isNaN(Number(emission))) {
      return NextResponse.json({ errorCode: 'INVALID_INPUT', error: 'Conso et émission obligatoires' }, { status: 400 })
    }

    const consoVal = Number(conso)
    const emissionVal = Number(emission)

    if (consoVal < 10 || consoVal > 800) {
      return NextResponse.json({ errorCode: 'INVALID_INPUT', error: 'Conso invalide (entre 10 et 800 kWh/m²)' }, { status: 400 })
    }
    if (emissionVal < 1 || emissionVal > 150) {
      return NextResponse.json({ errorCode: 'INVALID_INPUT', error: 'Émission invalide (entre 1 et 150 kgCO₂/m²)' }, { status: 400 })
    }

    // Arrondi par défaut + 1 : ex 122 → [122, 123], ex 122.2 → [122, 123]
    const consoMin = Math.floor(consoVal)
    const consoMax = Math.floor(consoVal) + 1
    const emissionMin = Math.floor(emissionVal)
    const emissionMax = Math.floor(emissionVal) + 1

    // ── 2. Validation dates ──
    if (dateDebut && dateFin && new Date(dateFin) < new Date(dateDebut)) {
      return NextResponse.json({
        errorCode: 'DATE_ERROR',
        error: 'La date de fin doit être postérieure à la date de début'
      }, { status: 400 })
    }

    // ── 3. Recherche Supabase ──
    let query = supabase
      .from('dpes')
      .select('id, adresse, ville, code_postal, classe_dpe, surface_habitable, latitude, longitude, date_etablissement, consommation_energie, emission_ges, emission_ges_5_usages_par_m2')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .gte('consommation_energie', consoMin)
      .lte('consommation_energie', consoMax)

    if (codesPostaux && codesPostaux.length > 0) {
      query = query.in('code_postal', codesPostaux)
    }
    if (dateDebut) query = query.gte('date_etablissement', dateDebut)
    if (dateFin)   query = query.lte('date_etablissement', dateFin + 'T23:59:59')

    const { data: matches, error: dbError } = await query.limit(20)
    if (dbError) {
      return NextResponse.json({ errorCode: 'DB_ERROR', error: 'Erreur base de données' }, { status: 500 })
    }

    // Filtre secondaire sur émission_ges_valeur [floor, floor+1]
    // emission_ges = lettre (A/B/C...), emission_ges_valeur = valeur numérique
    let filtered = (matches || []).filter((dpe: any) => {
      if (dpe.emission_ges_5_usages_par_m2 == null) return false
      const gesVal = parseFloat(dpe.emission_ges_5_usages_par_m2)
      return !isNaN(gesVal) && gesVal >= emissionMin && gesVal <= emissionMax
    })

    // ── 3. Aucun match ──
    if (filtered.length === 0) {
      return NextResponse.json({
        errorCode: 'NOT_FOUND',
        error: 'Aucun DPE correspondant trouvé dans votre secteur',
        extracted: { conso: consoVal, emission: emissionVal },
        matches: [],
      })
    }

    return NextResponse.json({
      errorCode: null,
      extracted: { conso: consoVal, emission: emissionVal },
      matches: filtered,
    })

  } catch (err: any) {
    console.error('[match-annonce]', err)
    return NextResponse.json({ errorCode: 'SERVER_ERROR', error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
