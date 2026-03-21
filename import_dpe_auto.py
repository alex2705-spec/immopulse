import requests, math, os, time

SB_URL = os.environ.get('SUPABASE_URL', 'https://lpqpfwmmmeytpbxaoqms.supabase.co')
SB_KEY = os.environ.get('SUPABASE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwcXBmd21tbWV5dHBieGFvcW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Nzk5NTIsImV4cCI6MjA4OTQ1NTk1Mn0.pO0NTkF2VrI4UNk50SD0KmzmcygqPak9lAzWNXKTNrc')

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
    "etiquette_dpe","conso_5_usages_par_m2_ep",
    "etiquette_ges","emission_ges_5_usages_par_m2",
    "surface_habitable_logement","type_batiment","numero_etage_appartement"
])

def get_codes_postaux():
    r = requests.get(
        f"{SB_URL}/rest/v1/user_access?select=code_postal",
        headers=HEADERS_SB,
        timeout=15
    )
    if r.status_code != 200:
        print(f"Erreur lecture user_access: {r.status_code}")
        return []
    data = r.json()
    codes = list(set(row['code_postal'] for row in data if row.get('code_postal')))
    return sorted(codes)

def lambert93_to_wgs84(x, y):
    n,c,xs,ys,e = 0.7256077650532670,11754255.4260960,700000.0,12655612.0499,0.0818191910428158
    r = math.sqrt((x-xs)**2+(y-ys)**2)
    lon = math.atan((x-xs)/(ys-y))/n + 3.0*math.pi/180.0
    lat_iso = -1/n*math.log(abs(r/c))
    lat = 2*math.atan(math.exp(lat_iso))-math.pi/2
    for _ in range(10):
        lat = 2*math.atan(((1+e*math.sin(lat))/(1-e*math.sin(lat)))**(e/2)*math.exp(lat_iso))-math.pi/2
    return math.degrees(lat), math.degrees(lon)

def fetch_dpe(cp):
    r = requests.get(ADEME_URL, params={
        "size": 150,
        "q": cp,
        "q_fields": "code_postal_ban",
        "select": FIELDS,
        "sort": "-date_etablissement_dpe"
    }, timeout=15)
    return r.json().get("results", []) if r.status_code == 200 else []

def transform(item, cp):
    def sf(v):
        try: return float(v) if v else None
        except: return None
    def si(v):
        try: return int(float(v)) if v else None
        except: return None

    x = sf(item.get("coordonnee_cartographique_x_ban"))
    y = sf(item.get("coordonnee_cartographique_y_ban"))
    if not x or not y or not item.get("adresse_ban"):
        return None

    lat, lon = lambert93_to_wgs84(x, y)
    etage = item.get("numero_etage_appartement")
    etage = str(int(etage)) if etage and str(etage) != "0" else None

    return {
        "numero_dpe":                   item.get("numero_dpe"),
        "date_etablissement":           item.get("date_etablissement_dpe"),
        "adresse":                      item.get("adresse_ban", ""),
        "code_postal":                  cp,
        "ville":                        item.get("nom_commune_ban", ""),
        "latitude":                     round(lat, 6),
        "longitude":                    round(lon, 6),
        "classe_dpe":                   item.get("etiquette_dpe"),
        "consommation_energie":         si(item.get("conso_5_usages_par_m2_ep")),
        "conso_5_usages_par_m2_ep":     sf(item.get("conso_5_usages_par_m2_ep")),
        "emission_ges":                 item.get("etiquette_ges"),
        "emission_ges_5_usages_par_m2": sf(item.get("emission_ges_5_usages_par_m2")),
        "surface_habitable":            sf(item.get("surface_habitable_logement")),
        "type_batiment":                item.get("type_batiment"),
        "etage":                        etage,
        "annee_construction":           None,
        "is_new":                       True,
    }

def main():
    codes = get_codes_postaux()
    if not codes:
        print("❌ Aucun code postal trouvé dans user_access")
        return

    print(f"📋 {len(codes)} code(s) postal(aux) à scraper : {', '.join(codes)}")
    total = 0

    for cp in codes:
        print(f"\n📍 {cp}...")

        requests.delete(
            f"{SB_URL}/rest/v1/dpes?code_postal=eq.{cp}",
            headers=HEADERS_SB,
            timeout=15
        )

        items = fetch_dpe(cp)
        rows = [r for r in [transform(i, cp) for i in items] if r]
        print(f"  → {len(rows)} DPE avec GPS")

        if rows:
            resp = requests.post(
                f"{SB_URL}/rest/v1/dpes",
                headers=HEADERS_SB,
                json=rows,
                timeout=30
            )
            if resp.status_code in (200, 201):
                print(f"  ✅ {len(rows)} insérés")
            else:
                print(f"  ⚠️ Erreur {resp.status_code}: {resp.text[:200]}")

        total += len(rows)
        time.sleep(1)

    print(f"\n🎉 Terminé — {total} DPE mis à jour pour {len(codes)} secteur(s)")

if __name__ == "__main__":
    main()
