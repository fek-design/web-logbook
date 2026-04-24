# TERMINAL / LOGBOG OS

Dette er fundamentet for vores tidsregistreringssystem. Jeg har designet det til at være en brutalistisk, lynhurtig "Thin Client" med minimal friktion. Ingen unødvendige pop-ups, ingen tunge indlæsningstider. Ren React på frontenden og et lukket PHP/MySQL-kredsløb på backenden.

Her er den komplette, trinvise protokol til at klone projektet, opsætte databasen og gå live på dit eget domæne.

---

## PREREQUISITES
Før du starter, skal du have følgende klar:
* **Node.js** installeret på din computer.
* **Et Webhotel** (fx [Simply.com/UnoEuro](https://Simply.com/UnoEuro)) med understøttelse af PHP og MySQL.
* **FTP-adgang** til dit webhotel.

---

## FASE 1: KLON KODEN
Start med at få koden ned lokalt på din maskine og installer afhængighederne.

1. Åbn din terminal og klon projektet (eller download ZIP'en).
2. Navigér ind i projektet og installer alle React-afhængigheder (i roden af mappen):

```bash
npm install
```

---

## FASE 2: DATABASE ARKITEKTUR (FIREWALLEN)
Frontend'en er bare et visuelt lag. Den reelle motor ligger i databasen. Du skal oprette den korrekte tabel-struktur, ellers crasher API'et.

1. Log ind på dit webhotel og find **MySQL**.
2. Opret en ny, tom MySQL-database.
3. Åbn databasen.
4. Gå til **SQL**-fanen i databasen, indsæt følgende kode og kør den:

<img width="1193" height="587" alt="Screenshot 2026-04-24 at 11 35 45" src="https://github.com/user-attachments/assets/8c397e2b-4694-4a4c-a5ab-66bd31de5f1c" />


```sql
-- 1. Historisk Logbog (Kvitteringsrullen)
CREATE TABLE time_ledger (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user VARCHAR(50),
    work_date DATE,
    start_time TIME,
    end_time TIME,
    hours DECIMAL(5,2),
    task TEXT
);

-- 2. Operatør Katalog (Unikke Noder)
CREATE TABLE nodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    USER VARCHAR(50) NOT NULL UNIQUE
);

-- 3. Opgave Kategorier (Unikke Tags)
CREATE TABLE tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);
```

---

## FASE 3: BACKEND ROUTING (`api.php`)
Din API skal kende dine nye database-informationer.

1. Find filen `api.php`.
2. Åbn filen og find **DATABASE CREDENTIALS**.
3. Udskift standard-værdierne med dine egne oplysninger:

```php
$host = 'din-database-server.com'; // F.eks. mysql22.unoeuro.com
$db   = 'dit_databasenavn';
$user = 'din_databasebruger';
$pass = 'DIT_HEMMELIGE_KODEORD'; 
```

* **Admin Sikkerhed:** Hvis du vil ændre adgangskoden til Admin-panelet, skal du generere et nyt `bcrypt` hash og erstatte `$admin_hash` i koden.
* **Upload:** Upload `api.php` via FTP til dit domæne (dvs. i samme rootfolder som appen, fx `https://logbog.ditdomæne.dk/api.php`).

---

## FASE 4: FRONTEND TARGETING (`App.jsx`)
Nu skal vi fortælle React, hvor den skal sende sin data hen.

1. Åbn `src/App.jsx`.
2. Find `API_URL` og peg den på din nye, live backend:

```javascript
const API_URL = "https://logbog.ditdomæne.dk/api.php";
```
---

## FASE 5: BUILD OG DEPLOYMENT
Når alt er konfigureret, skal vi bygge den færdige app.

1. Kør build-kommandoen i din terminal:

```bash
npm run build
```

2. Gå ind i mappen `dist`.
3. Upload alt indhold fra `dist` via FTP til dit webhotel. 

Det skal se sådan ud:
<img width="1126" height="387" alt="Screenshot 2026-04-24 at 11 22 10" src="https://github.com/user-attachments/assets/c619f96a-112d-4e2d-9380-5b3032e964b8" />


---

## FASE 6: INITIEL SETUP (DAY 1)
Når appen er live, skal den klargøres i Admin-panelet.

1. Gå til dit domæne i browseren.
2. Klik på **Skjold-ikonet** i højre hjørne for at logge ind som Admin.
3. Rul ned til **Node Registry** og tilføj teamets navne (Operatører).
4. Rul ned til **Tag Registry** og tilføj jeres opgavekategorier (fx "Udvikling", "Møde").

**Systemet er nu operationelt.** Dit data-kredsløb er fuldstændig lukket og sikkert.
