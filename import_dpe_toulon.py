import requests
import math

SB_URL = "https://lpqpfwmmmeytpbxaoqms.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwcXBmd21tbWV5dHBieGFvcW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Nzk5NTIsImV4cCI6MjA4OTQ1NTk1Mn0.pO0NTkF2VrI4UNk50SD0KmzmcygqPak9lAzWNXKTNrc"

CODES_POSTAUX = ["83000", "83100", "83200"]
ADEME_URL = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines"

HEADERS_SB = {
    "apikey": SB_KEY,
    "Authorization": f"Bearer {SB_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

FIELDS = ",".join([
    "numero_dpe","date_etablissement_dpe","adresse_ban","code_postal_ban",
    "nom_commune_ban","coordonnee_cartographique_x_ban","coordonnee_cartographique_y_ban",
    "etiquette_dpe","conso_5_usages_ef","etiquette_ges","surface_habitable_logement",
    "type_batiment","numero_etage_appartement",
])

def lambert93_to_wgs84(x, y):
    """Convertit Lambert 93 (RGF93) en WGS84 lat/lng"""
    # Paramètres Lambert 93
    n = 0.7256077650532670
    c = 11754255.4260960
    xs = 700000.0
    ys = 12655612.0499

    # Paramètres ellipsoïde GRS80
    e = 0.0818191910428158

    r = math.sqrt((x - xs)**2 + (y - ys)**2)
    gamma = math.atan((x - xs) / (ys - y))

    lon = gamma / n + 3.0 * math.pi / 180.0

    lat_iso = -1/n * math.log(abs(r/c))
    lat = 2 * math.atan(math.exp(lat_iso)) - math.pi / 2

    # Itération pour affiner
    for _ in range(10):
        lat = 2 * math.atan(
            ((1 + e * math.sin(lat)) / (1 - e * math.sin(lat)))**(e/2)
            * math.exp(lat_iso)
        ) - math.pi / 2

    return math.degrees(lat), math.degrees(lon)

def fetch_dpe(code_postal):
    params = {
        "size": 60,
        "q": code_postal,
        "q_fields": "code_postal_ban",
        "select": FIELDS,
        "sort": "-date_etablissement_dpe"
    }
    r = requests.get(ADEME_URL, params=params, timeout=15)
    if r.status_code != 200:
        print(f"  Erreur ADEME {r.status_code}: {r.text[:200]}")
        return []
    return r.json().get("results", [])

def transform(item, code_postal):
    def safe_float(v):
        try: return float(v) if v else None
        except: return None
    def safe_int(v):
        try: return int(float(v)) if v else None
        except: return None

    x = safe_float(item.get("coordonnee_cartographique_x_ban"))
    y = safe_float(item.get("coordonnee_cartographique_y_ban"))

    if not x or not y:
        return None

    lat, lon = lambert93_to_wgs84(x, y)

    etage = item.get("numero_etage_appartement")
    etage = str(int(etage)) if etage and str(etage) != "0" else None

    return {
        "numero_dpe": item.get("numero_dpe"),
        "date_etablissement": item.get("date_etablissement_dpe"),
        "adresse": item.get("adresse_ban", ""),
        "code_postal": code_postal,
        "ville": item.get("nom_commune_ban", "Toulon"),
        "latitude": round(lat, 6),
        "longitude": round(lon, 6),
        "classe_dpe": item.get("etiquette_dpe"),
        "consommation_energie": safe_int(item.get("conso_5_usages_ef")),
        "emission_ges": item.get("etiquette_ges"),
        "surface_habitable": safe_float(item.get("surface_habitable_logement")),
        "type_batiment": item.get("type_batiment"),
        "etage": etage,
        "annee_construction": None,
        "is_new": True,
    }

def main():
    total = 0
    for cp in CODES_POSTAUX:
        print(f"\n📍 {cp}...")
        items = fetch_dpe(cp)
        print(f"  → {len(items)} DPE récupérés")
        if not items:
            continue
        rows = [r for r in [transform(i, cp) for i in items] if r]
        print(f"  → {len(rows)} avec GPS convertis en WGS84")
        # Vérification sur le premier
        if rows:
            print(f"  Exemple: {rows[0]['adresse']} → lat={rows[0]['latitude']}, lng={rows[0]['longitude']}")
        if rows:
            resp = requests.post(
                f"{SB_URL}/rest/v1/dpes",
                headers=HEADERS_SB,
                json=rows,
                timeout=30
            )
            if resp.status_code not in (200, 201):
                print(f"  ⚠️  Erreur: {resp.status_code} — {resp.text[:300]}")
            else:
                print(f"  ✅ {len(rows)} lignes insérées")
        total += len(rows)
    print(f"\n🎉 {total} DPE importés pour Toulon avec coordonnées WGS84")

if __name__ == "__main__":
    main()
