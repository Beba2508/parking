document.addEventListener("DOMContentLoaded", () => {

  // === CONFIGURATION ===
  const parkingConfig = {
    CRA: 15,
    BLUBINI: 4,
    TOMICEVA: 5
  };

  // === PAGE NAVIGATION ===
  function showPage(pageId) {
    document.querySelectorAll('.container').forEach(div => div.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    lucide.createIcons(); // Refresh icons
    if (pageId === 'statusPage') loadParking();
    if (pageId === 'statisticsPage') showStatistics();
  }

  // === ADD RESERVATION ===
  async function addReservation() {
    const location = document.getElementById("parkingSelect").value;
    const name = document.getElementById("guestName").value.trim();
    const plate = document.getElementById("carPlate").value.trim();
    const apartment = document.getElementById("apartment").value.trim();
    const carSize = document.getElementById("carSize").value;
    const arrival = document.getElementById("arrivalDate").value;
    const departure = document.getElementById("departureDate").value;

    if (!name || !plate || !apartment || !arrival || !departure) {
      alert("Molimo popunite sva polja.");
      return;
    }

    if (new Date(arrival) > new Date(departure)) {
      alert("Datum dolaska ne može biti nakon datuma odlaska.");
      return;
    }

    const reservation = {
      location,
      name,
      plate,
      apartment,
      carSize,
      arrival,
      departure
    };

    const response = await fetch('saveReservation.php', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reservation)
    });

    const result = await response.json();
    if (result.success) {
      alert("Rezervacija dodana!");
      document.getElementById("reservationForm").reset();
      loadParking();
    } else {
      alert("Greška pri spremanju: " + (result.error || "Nepoznata greška."));
    }
  }

  // === LOAD PARKING STATUS ===
  async function loadParking() {
    const location = document.getElementById("parkingLocation").value;
    const month = parseInt(document.getElementById("monthSelect").value);
    const table = document.getElementById("parkingTable");
    table.innerHTML = "";

    const daysInMonth = new Date(2025, month + 1, 0).getDate();
    const spots = Array.from({ length: parkingConfig[location] }, (_, i) => (i + 1).toString());

    // Header
    let headerRow = `<tr><th>Datum</th>`;
    spots.forEach(spot => {
      headerRow += `<th>Mjesto ${spot}</th>`;
    });
    headerRow += `<th>Ukupno zauzeto</th></tr>`;
    table.innerHTML += headerRow;

    // Fetch reservations
    const response = await fetch('getReservations.php');
    const reservations = await response.json();

    const filtered = reservations.filter(r => r.location === location);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(2025, month, day);
      let row = `<tr><td>${day}</td>`;
      let occupiedCount = 0;

      spots.forEach(spot => {
        const res = filtered.find(r => {
          const arrival = new Date(r.arrival);
          const departure = new Date(r.departure);
          return r.spot && r.spot.toString() === spot &&
            arrival <= date &&
            departure > date;
        });

        if (res) {
          row += `<td class="occupied" title="${res.name} - ${res.plate} - ${res.apartment}" onclick="deleteReservation(${res.id})">
                    ${res.name}<br>${res.plate}<br>${res.apartment || ''}
                  </td>`;
          occupiedCount++;
        } else {
          row += `<td class="available">Free</td>`;
        }
      });

      row += occupiedCount === spots.length
        ? `<td style="color:#ef4444; font-weight:bold;">${occupiedCount} 🔴 Puno</td>`
        : `<td class="summary">${occupiedCount}</td>`;

      row += "</tr>";
      table.innerHTML += row;
    }
  }

  // === DELETE RESERVATION ===
  async function deleteReservation(id) {
    if (!confirm("Jeste li sigurni da želite obrisati ovu rezervaciju?")) return;

    await fetch('deleteReservation.php', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });

    loadParking();
  }

  // === EXPORT RESERVATIONS TO CSV ===
  async function exportReservationsToCSV() {
    const response = await fetch('getReservations.php');
    const reservations = await response.json();

    if (reservations.length === 0) {
      alert("Nema rezervacija za izvoz.");
      return;
    }

    const header = ["Lokacija", "Ime gosta", "Tablica", "Apartman", "Veličina", "Dolazak", "Odlazak", "Mjesto"];
    const rows = reservations.map(r => [
      r.location, r.name, r.plate, r.apartment, r.carSize, r.arrival, r.departure, r.spot || ""
    ]);

    let csvContent = header.join(",") + "\n";
    rows.forEach(row => {
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "irundo_rezervacije.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // === EXPORT REVENUE TO CSV ===
  async function exportRevenueToCSV() {
    const response = await fetch('getReservations.php');
    const reservations = await response.json();

    const from = document.getElementById("filterStart").value
      ? new Date(document.getElementById("filterStart").value)
      : null;
    const to = document.getElementById("filterEnd").value
      ? new Date(document.getElementById("filterEnd").value)
      : null;

    const priceTable = {
      CRA: 10,
      BLUBINI: 15,
      TOMICEVA: 12
    };

    const revenue = {};

    reservations.forEach(res => {
      const start = new Date(res.arrival);
      const end = new Date(res.departure);
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const date = new Date(d);
        if ((from && date < from) || (to && date > to)) continue;
        const loc = res.location;
        if (!revenue[loc]) revenue[loc] = 0;
        revenue[loc] += priceTable[loc] || 0;
      }
    });

    let csvContent = ["Lokacija", "Zarada (€)"].join(",") + "\n";
    Object.keys(revenue).forEach(loc => {
      csvContent += [loc, revenue[loc].toFixed(2)].join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "irundo_zarada.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // === STATISTICS PAGE ===
  async function showStatistics() {
    document.querySelectorAll('.container').forEach(div => div.classList.remove('active'));
    document.getElementById("statisticsPage").classList.add('active');

    const statsContainer = document.getElementById("statsContent");
    statsContainer.innerHTML = "";

    const response = await fetch('getReservations.php');
    const reservations = await response.json();

    const from = document.getElementById("filterStart").value
      ? new Date(document.getElementById("filterStart").value)
      : null;
    const to = document.getElementById("filterEnd").value
      ? new Date(document.getElementById("filterEnd").value)
      : null;

    const filtered = reservations.filter(r => {
      const arr = new Date(r.arrival);
      const dep = new Date(r.departure);
      if (from && dep < from) return false;
      if (to && arr > to) return false;
      return true;
    });

    const grouped = {};
    filtered.forEach(res => {
      if (!grouped[res.location]) grouped[res.location] = 0;
      grouped[res.location]++;
    });

    Object.keys(grouped).forEach(loc => {
      statsContainer.innerHTML += `
        <div class="stat-card">
          <h3>${loc}</h3>
          <p><strong>${grouped[loc]}</strong> rezervacija</p>
        </div>
      `;
    });

    if (filtered.length === 0) {
      statsContainer.innerHTML = "<p style='color:#94a3b8; text-align:center;'>Nema rezervacija u odabranom periodu.</p>";
    }
  }

  // === EXPOSE FUNCTIONS TO HTML ===
  window.showPage = showPage;
  window.addReservation = addReservation;
  window.loadParking = loadParking;
  window.deleteReservation = deleteReservation;
  window.exportReservationsToCSV = exportReservationsToCSV;
  window.exportRevenueToCSV = exportRevenueToCSV;
  window.showStatistics = showStatistics;
});
