# 🫒 Dinem en Família

Aplicació web estàtica de planificació de menús mediterranis per a tota la família, cada dia de l'any. Inclou un calendari anual/mensual de menús, receptes de temporada i notes per a nadons (BLW).

---

## 🚀 Com arrancar l'aplicació

L'aplicació és **100% estàtica** (HTML + CSS + JS pur). No necessita Node.js, ni instal·lació de paquets, ni backend.

### Opció 1 — Servidor local amb Python (recomanat)

```bash
# Python 3
python3 -m http.server 8080
```

Obre el navegador a: **http://localhost:8080**

### Opció 2 — Servidor local amb Node.js

```bash
npx serve .
```

Obre el navegador a: **http://localhost:3000** (o el port que indiqui)

### Opció 3 — VS Code Live Server

1. Instal·la l'extensió [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
2. Fes clic dret a `index.html` → **Open with Live Server**

> ⚠️ **No obris els fitxers directament al navegador** (`file://...`) perquè les peticions `fetch()` de JSON fallaran per restriccions CORS. Sempre usa un servidor local.

---

## 📁 Estructura del projecte

```
dinem-de-temporada/
├── index.html              # Pàgina principal — Calendari
├── recepta.html            # Pàgina de receptes
├── assets/
│   ├── css/
│   │   ├── main.css        # Estils globals
│   │   └── calendar.css    # Estils del calendari
│   └── js/
│       ├── utils.js        # Utilitats: dates, tags, localStorage
│       ├── recipes.js      # Lògica de receptes
│       ├── calendar.js     # Motor del calendari
│       └── app.js          # Punt d'entrada de l'aplicació
└── data/
    ├── recipes.json        # Base de dades de receptes
    └── menus/
        └── 2026.json       # Menús assignats per cada dia de l'any
```

---

## ✨ Funcionalitats

- **Calendari anual** amb tots els mesos de l'any
- **Vista mensual** detallada amb menús per dia
- **Modal de dia** amb dinar, sopar, opció ràpida i notes BLW
- **Cercador** de receptes per nom o ingredient
- **Filtres** per etiqueta (BLW, Vegetarià, Peix, Carn, Temporada)
- **Pàgina de receptes** amb índex complet i fitxa de cada recepta
- **Favorits** (guardat en localStorage)
- **Disseny responsive** per a mòbil i escriptori
- **Accessibilitat** (ARIA, focus trap, skip link)

---

## 📦 Afegir nous menús o receptes

### Afegir receptes

Edita `data/recipes.json` i afegeix un nou objecte amb la clau de l'ID:

```json
"id-de-la-recepta": {
  "id": "id-de-la-recepta",
  "title": "Nom de la recepta",
  "category": "pasta",
  "season": ["primavera", "estiu"],
  "time": 30,
  "difficulty": "Fàcil",
  "servings": 4,
  "tags": ["vegetarià", "BLW"],
  "ingredients": [
    { "ingredient": "pasta", "amount": "400", "unit": "g" }
  ],
  "steps": [
    "Pas 1...",
    "Pas 2..."
  ],
  "allergens": ["gluten"],
  "babyNotes": "Notes per al nadó..."
}
```

**Categories disponibles:** `arròs`, `pasta`, `peix`, `carn`, `llegums`, `cremes`, `amanides`, `pizza`, `forn`, `catalana`, `mediterrània`

**Estacions disponibles:** `primavera`, `estiu`, `tardor`, `hivern`

**Etiquetes disponibles:** `BLW`, `vegetarià`, `peix`, `carn`, `de temporada`, `pasta`, `arròs`, `llegums`

### Afegir menús per a un altre any

Crea un fitxer `data/menus/YYYY.json` amb el format:

```json
{
  "year": 2027,
  "days": {
    "2027-01-01": {
      "lunch": { "title": "Nom del dinar", "recipe": "id-de-la-recepta" },
      "dinner": { "title": "Nom del sopar", "recipe": "id-de-la-recepta" },
      "quickOption": { "title": "Opció ràpida" }
    }
  }
}
```

---

## 🌐 Desplegar a GitHub Pages

1. Ves a **Settings → Pages** del repositori
2. Selecciona la branca `main` i la carpeta `/` (root)
3. L'aplicació estarà disponible a `https://<usuari>.github.io/<repositori>/`

---

## 🛠️ Tecnologies

- HTML5 semàntic
- CSS3 (variables, grid, flexbox)
- JavaScript ES6+ (Vanilla, sense frameworks)
- Google Fonts (Lora + Inter)

---

## 📄 Llicència

Fet amb ❤️ per a la família.