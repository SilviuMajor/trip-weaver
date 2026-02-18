export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  lat: number;
  lng: number;
}

// Comprehensive commercial airport dataset (~410 major airports)
// Covers all major international and regional airports worldwide
const AIRPORTS: Airport[] = [
  // United Kingdom
  { iata: 'LHR', name: 'Heathrow', city: 'London', country: 'GB', timezone: 'Europe/London', lat: 51.4700, lng: -0.4543 },
  { iata: 'LGW', name: 'Gatwick', city: 'London', country: 'GB', timezone: 'Europe/London', lat: 51.1537, lng: -0.1821 },
  { iata: 'STN', name: 'Stansted', city: 'London', country: 'GB', timezone: 'Europe/London', lat: 51.8860, lng: 0.2389 },
  { iata: 'LTN', name: 'Luton', city: 'London', country: 'GB', timezone: 'Europe/London', lat: 51.8747, lng: -0.3684 },
  { iata: 'LCY', name: 'City Airport', city: 'London', country: 'GB', timezone: 'Europe/London', lat: 51.5053, lng: 0.0553 },
  { iata: 'SEN', name: 'Southend', city: 'London', country: 'GB', timezone: 'Europe/London', lat: 51.5714, lng: 0.6956 },
  { iata: 'MAN', name: 'Manchester', city: 'Manchester', country: 'GB', timezone: 'Europe/London', lat: 53.3537, lng: -2.2750 },
  { iata: 'BHX', name: 'Birmingham', city: 'Birmingham', country: 'GB', timezone: 'Europe/London', lat: 52.4539, lng: -1.7480 },
  { iata: 'EDI', name: 'Edinburgh', city: 'Edinburgh', country: 'GB', timezone: 'Europe/London', lat: 55.9508, lng: -3.3615 },
  { iata: 'GLA', name: 'Glasgow', city: 'Glasgow', country: 'GB', timezone: 'Europe/London', lat: 55.8642, lng: -4.4332 },
  { iata: 'BRS', name: 'Bristol', city: 'Bristol', country: 'GB', timezone: 'Europe/London', lat: 51.3827, lng: -2.7191 },
  { iata: 'LPL', name: 'John Lennon', city: 'Liverpool', country: 'GB', timezone: 'Europe/London', lat: 53.3336, lng: -2.8497 },
  { iata: 'NCL', name: 'Newcastle', city: 'Newcastle', country: 'GB', timezone: 'Europe/London', lat: 55.0375, lng: -1.6917 },
  { iata: 'EMA', name: 'East Midlands', city: 'Nottingham', country: 'GB', timezone: 'Europe/London', lat: 52.8311, lng: -1.3281 },
  { iata: 'LBA', name: 'Leeds Bradford', city: 'Leeds', country: 'GB', timezone: 'Europe/London', lat: 53.8659, lng: -1.6606 },
  { iata: 'ABZ', name: 'Aberdeen', city: 'Aberdeen', country: 'GB', timezone: 'Europe/London', lat: 57.2019, lng: -2.1978 },
  { iata: 'BFS', name: 'Belfast International', city: 'Belfast', country: 'GB', timezone: 'Europe/London', lat: 54.6575, lng: -6.2158 },
  { iata: 'CWL', name: 'Cardiff', city: 'Cardiff', country: 'GB', timezone: 'Europe/London', lat: 51.3967, lng: -3.3433 },

  // Netherlands
  { iata: 'AMS', name: 'Schiphol', city: 'Amsterdam', country: 'NL', timezone: 'Europe/Amsterdam', lat: 52.3105, lng: 4.7683 },
  { iata: 'EIN', name: 'Eindhoven', city: 'Eindhoven', country: 'NL', timezone: 'Europe/Amsterdam', lat: 51.4501, lng: 5.3745 },
  { iata: 'RTM', name: 'Rotterdam The Hague', city: 'Rotterdam', country: 'NL', timezone: 'Europe/Amsterdam', lat: 51.9569, lng: 4.4372 },
  { iata: 'GRQ', name: 'Eelde', city: 'Groningen', country: 'NL', timezone: 'Europe/Amsterdam', lat: 53.1197, lng: 6.5794 },
  { iata: 'MST', name: 'Maastricht Aachen', city: 'Maastricht', country: 'NL', timezone: 'Europe/Amsterdam', lat: 50.9117, lng: 5.7706 },

  // France
  { iata: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'FR', timezone: 'Europe/Paris', lat: 49.0097, lng: 2.5479 },
  { iata: 'ORY', name: 'Orly', city: 'Paris', country: 'FR', timezone: 'Europe/Paris', lat: 48.7262, lng: 2.3652 },
  { iata: 'NCE', name: 'Nice Côte d\'Azur', city: 'Nice', country: 'FR', timezone: 'Europe/Paris', lat: 43.6584, lng: 7.2159 },
  { iata: 'LYS', name: 'Saint-Exupéry', city: 'Lyon', country: 'FR', timezone: 'Europe/Paris', lat: 45.7256, lng: 5.0811 },
  { iata: 'MRS', name: 'Provence', city: 'Marseille', country: 'FR', timezone: 'Europe/Paris', lat: 43.4393, lng: 5.2214 },
  { iata: 'TLS', name: 'Blagnac', city: 'Toulouse', country: 'FR', timezone: 'Europe/Paris', lat: 43.6291, lng: 1.3638 },
  { iata: 'BOD', name: 'Mérignac', city: 'Bordeaux', country: 'FR', timezone: 'Europe/Paris', lat: 44.8283, lng: -0.7153 },
  { iata: 'NTE', name: 'Atlantique', city: 'Nantes', country: 'FR', timezone: 'Europe/Paris', lat: 47.1532, lng: -1.6108 },
  { iata: 'BVA', name: 'Beauvais-Tillé', city: 'Paris Beauvais', country: 'FR', timezone: 'Europe/Paris', lat: 49.4544, lng: 2.1128 },

  // Germany
  { iata: 'FRA', name: 'Frankfurt', city: 'Frankfurt', country: 'DE', timezone: 'Europe/Berlin', lat: 50.0379, lng: 8.5622 },
  { iata: 'MUC', name: 'Franz Josef Strauss', city: 'Munich', country: 'DE', timezone: 'Europe/Berlin', lat: 48.3538, lng: 11.7861 },
  { iata: 'BER', name: 'Berlin Brandenburg', city: 'Berlin', country: 'DE', timezone: 'Europe/Berlin', lat: 52.3667, lng: 13.5033 },
  { iata: 'DUS', name: 'Düsseldorf', city: 'Düsseldorf', country: 'DE', timezone: 'Europe/Berlin', lat: 51.2895, lng: 6.7668 },
  { iata: 'HAM', name: 'Hamburg', city: 'Hamburg', country: 'DE', timezone: 'Europe/Berlin', lat: 53.6304, lng: 9.9882 },
  { iata: 'CGN', name: 'Cologne Bonn', city: 'Cologne', country: 'DE', timezone: 'Europe/Berlin', lat: 50.8659, lng: 7.1427 },
  { iata: 'STR', name: 'Stuttgart', city: 'Stuttgart', country: 'DE', timezone: 'Europe/Berlin', lat: 48.6899, lng: 9.2220 },
  { iata: 'HAJ', name: 'Hannover', city: 'Hannover', country: 'DE', timezone: 'Europe/Berlin', lat: 52.4611, lng: 9.6850 },
  { iata: 'NUE', name: 'Albrecht Dürer', city: 'Nuremberg', country: 'DE', timezone: 'Europe/Berlin', lat: 49.4987, lng: 11.0669 },
  { iata: 'LEJ', name: 'Leipzig/Halle', city: 'Leipzig', country: 'DE', timezone: 'Europe/Berlin', lat: 51.4324, lng: 12.2416 },
  { iata: 'DRS', name: 'Dresden', city: 'Dresden', country: 'DE', timezone: 'Europe/Berlin', lat: 51.1328, lng: 13.7672 },
  { iata: 'HHN', name: 'Frankfurt-Hahn', city: 'Frankfurt Hahn', country: 'DE', timezone: 'Europe/Berlin', lat: 49.9487, lng: 7.2639 },

  // Spain
  { iata: 'MAD', name: 'Barajas', city: 'Madrid', country: 'ES', timezone: 'Europe/Madrid', lat: 40.4719, lng: -3.5626 },
  { iata: 'BCN', name: 'El Prat', city: 'Barcelona', country: 'ES', timezone: 'Europe/Madrid', lat: 41.2971, lng: 2.0785 },
  { iata: 'PMI', name: 'Palma de Mallorca', city: 'Palma', country: 'ES', timezone: 'Europe/Madrid', lat: 39.5517, lng: 2.7388 },
  { iata: 'AGP', name: 'Málaga-Costa del Sol', city: 'Málaga', country: 'ES', timezone: 'Europe/Madrid', lat: 36.6749, lng: -4.4991 },
  { iata: 'ALC', name: 'Alicante-Elche', city: 'Alicante', country: 'ES', timezone: 'Europe/Madrid', lat: 38.2822, lng: -0.5582 },
  { iata: 'TFS', name: 'Tenerife South', city: 'Tenerife', country: 'ES', timezone: 'Atlantic/Canary', lat: 28.0445, lng: -16.5725 },
  { iata: 'LPA', name: 'Gran Canaria', city: 'Las Palmas', country: 'ES', timezone: 'Atlantic/Canary', lat: 27.9319, lng: -15.3866 },
  { iata: 'IBZ', name: 'Ibiza', city: 'Ibiza', country: 'ES', timezone: 'Europe/Madrid', lat: 38.8729, lng: 1.3731 },
  { iata: 'SVQ', name: 'San Pablo', city: 'Seville', country: 'ES', timezone: 'Europe/Madrid', lat: 37.4180, lng: -5.8931 },
  { iata: 'VLC', name: 'Valencia', city: 'Valencia', country: 'ES', timezone: 'Europe/Madrid', lat: 39.4893, lng: -0.4816 },
  { iata: 'BIO', name: 'Bilbao', city: 'Bilbao', country: 'ES', timezone: 'Europe/Madrid', lat: 43.3011, lng: -2.9106 },
  { iata: 'FUE', name: 'Fuerteventura', city: 'Fuerteventura', country: 'ES', timezone: 'Atlantic/Canary', lat: 28.4527, lng: -13.8638 },
  { iata: 'ACE', name: 'Lanzarote', city: 'Lanzarote', country: 'ES', timezone: 'Atlantic/Canary', lat: 28.9455, lng: -13.6052 },

  // Italy
  { iata: 'FCO', name: 'Fiumicino', city: 'Rome', country: 'IT', timezone: 'Europe/Rome', lat: 41.8003, lng: 12.2389 },
  { iata: 'MXP', name: 'Malpensa', city: 'Milan', country: 'IT', timezone: 'Europe/Rome', lat: 45.6306, lng: 8.7281 },
  { iata: 'LIN', name: 'Linate', city: 'Milan', country: 'IT', timezone: 'Europe/Rome', lat: 45.4494, lng: 9.2783 },
  { iata: 'BGY', name: 'Orio al Serio', city: 'Bergamo', country: 'IT', timezone: 'Europe/Rome', lat: 45.6739, lng: 9.7042 },
  { iata: 'NAP', name: 'Capodichino', city: 'Naples', country: 'IT', timezone: 'Europe/Rome', lat: 40.8860, lng: 14.2908 },
  { iata: 'VCE', name: 'Marco Polo', city: 'Venice', country: 'IT', timezone: 'Europe/Rome', lat: 45.5053, lng: 12.3519 },
  { iata: 'BLQ', name: 'Guglielmo Marconi', city: 'Bologna', country: 'IT', timezone: 'Europe/Rome', lat: 44.5354, lng: 11.2887 },
  { iata: 'CAG', name: 'Elmas', city: 'Cagliari', country: 'IT', timezone: 'Europe/Rome', lat: 39.2515, lng: 9.0543 },
  { iata: 'CTA', name: 'Fontanarossa', city: 'Catania', country: 'IT', timezone: 'Europe/Rome', lat: 37.4668, lng: 15.0664 },
  { iata: 'PMO', name: 'Falcone-Borsellino', city: 'Palermo', country: 'IT', timezone: 'Europe/Rome', lat: 38.1760, lng: 13.0910 },
  { iata: 'PSA', name: 'Galileo Galilei', city: 'Pisa', country: 'IT', timezone: 'Europe/Rome', lat: 43.6839, lng: 10.3927 },
  { iata: 'FLR', name: 'Peretola', city: 'Florence', country: 'IT', timezone: 'Europe/Rome', lat: 43.8100, lng: 11.2051 },
  { iata: 'TRN', name: 'Caselle', city: 'Turin', country: 'IT', timezone: 'Europe/Rome', lat: 45.2008, lng: 7.6497 },
  { iata: 'CIA', name: 'Ciampino', city: 'Rome', country: 'IT', timezone: 'Europe/Rome', lat: 41.7994, lng: 12.5949 },

  // Portugal
  { iata: 'LIS', name: 'Humberto Delgado', city: 'Lisbon', country: 'PT', timezone: 'Europe/Lisbon', lat: 38.7813, lng: -9.1359 },
  { iata: 'OPO', name: 'Francisco Sá Carneiro', city: 'Porto', country: 'PT', timezone: 'Europe/Lisbon', lat: 41.2481, lng: -8.6814 },
  { iata: 'FAO', name: 'Faro', city: 'Faro', country: 'PT', timezone: 'Europe/Lisbon', lat: 37.0144, lng: -7.9659 },
  { iata: 'FNC', name: 'Cristiano Ronaldo', city: 'Funchal', country: 'PT', timezone: 'Atlantic/Madeira', lat: 32.6942, lng: -16.7745 },
  { iata: 'PDL', name: 'João Paulo II', city: 'Ponta Delgada', country: 'PT', timezone: 'Atlantic/Azores', lat: 37.7412, lng: -25.6979 },

  // Ireland
  { iata: 'DUB', name: 'Dublin', city: 'Dublin', country: 'IE', timezone: 'Europe/Dublin', lat: 53.4264, lng: -6.2499 },
  { iata: 'ORK', name: 'Cork', city: 'Cork', country: 'IE', timezone: 'Europe/Dublin', lat: 51.8413, lng: -8.4911 },
  { iata: 'SNN', name: 'Shannon', city: 'Shannon', country: 'IE', timezone: 'Europe/Dublin', lat: 52.7020, lng: -8.9248 },
  { iata: 'KNO', name: 'Knock', city: 'Knock', country: 'IE', timezone: 'Europe/Dublin', lat: 53.9103, lng: -8.8186 },

  // Belgium
  { iata: 'BRU', name: 'Brussels', city: 'Brussels', country: 'BE', timezone: 'Europe/Brussels', lat: 50.9014, lng: 4.4844 },
  { iata: 'CRL', name: 'Charleroi', city: 'Charleroi', country: 'BE', timezone: 'Europe/Brussels', lat: 50.4592, lng: 4.4538 },

  // Switzerland
  { iata: 'ZRH', name: 'Zürich', city: 'Zürich', country: 'CH', timezone: 'Europe/Zurich', lat: 47.4647, lng: 8.5492 },
  { iata: 'GVA', name: 'Geneva', city: 'Geneva', country: 'CH', timezone: 'Europe/Zurich', lat: 46.2381, lng: 6.1090 },
  { iata: 'BSL', name: 'EuroAirport Basel', city: 'Basel', country: 'CH', timezone: 'Europe/Zurich', lat: 47.5896, lng: 7.5299 },

  // Austria
  { iata: 'VIE', name: 'Vienna', city: 'Vienna', country: 'AT', timezone: 'Europe/Vienna', lat: 48.1103, lng: 16.5697 },
  { iata: 'SZG', name: 'Salzburg', city: 'Salzburg', country: 'AT', timezone: 'Europe/Vienna', lat: 47.7933, lng: 13.0043 },
  { iata: 'INN', name: 'Innsbruck', city: 'Innsbruck', country: 'AT', timezone: 'Europe/Vienna', lat: 47.2602, lng: 11.3440 },

  // Scandinavia
  { iata: 'CPH', name: 'Copenhagen', city: 'Copenhagen', country: 'DK', timezone: 'Europe/Copenhagen', lat: 55.6181, lng: 12.6561 },
  { iata: 'ARN', name: 'Arlanda', city: 'Stockholm', country: 'SE', timezone: 'Europe/Stockholm', lat: 59.6519, lng: 17.9186 },
  { iata: 'GOT', name: 'Landvetter', city: 'Gothenburg', country: 'SE', timezone: 'Europe/Stockholm', lat: 57.6628, lng: 12.2798 },
  { iata: 'OSL', name: 'Gardermoen', city: 'Oslo', country: 'NO', timezone: 'Europe/Oslo', lat: 60.1939, lng: 11.1004 },
  { iata: 'BGO', name: 'Flesland', city: 'Bergen', country: 'NO', timezone: 'Europe/Oslo', lat: 60.2934, lng: 5.2181 },
  { iata: 'TRD', name: 'Værnes', city: 'Trondheim', country: 'NO', timezone: 'Europe/Oslo', lat: 63.4578, lng: 10.9240 },
  { iata: 'HEL', name: 'Helsinki-Vantaa', city: 'Helsinki', country: 'FI', timezone: 'Europe/Helsinki', lat: 60.3172, lng: 24.9633 },
  { iata: 'KEF', name: 'Keflavík', city: 'Reykjavík', country: 'IS', timezone: 'Atlantic/Reykjavik', lat: 63.9850, lng: -22.6056 },

  // Eastern Europe
  { iata: 'WAW', name: 'Chopin', city: 'Warsaw', country: 'PL', timezone: 'Europe/Warsaw', lat: 52.1657, lng: 20.9671 },
  { iata: 'KRK', name: 'John Paul II', city: 'Kraków', country: 'PL', timezone: 'Europe/Warsaw', lat: 50.0777, lng: 19.7848 },
  { iata: 'GDN', name: 'Lech Wałęsa', city: 'Gdańsk', country: 'PL', timezone: 'Europe/Warsaw', lat: 54.3776, lng: 18.4662 },
  { iata: 'WRO', name: 'Copernicus', city: 'Wrocław', country: 'PL', timezone: 'Europe/Warsaw', lat: 51.1027, lng: 16.8858 },
  { iata: 'PRG', name: 'Václav Havel', city: 'Prague', country: 'CZ', timezone: 'Europe/Prague', lat: 50.1008, lng: 14.2600 },
  { iata: 'BUD', name: 'Ferenc Liszt', city: 'Budapest', country: 'HU', timezone: 'Europe/Budapest', lat: 47.4298, lng: 19.2611 },
  { iata: 'OTP', name: 'Henri Coandă', city: 'Bucharest', country: 'RO', timezone: 'Europe/Bucharest', lat: 44.5711, lng: 26.0850 },
  { iata: 'CLJ', name: 'Avram Iancu', city: 'Cluj-Napoca', country: 'RO', timezone: 'Europe/Bucharest', lat: 46.7852, lng: 23.6862 },
  { iata: 'SOF', name: 'Sofia', city: 'Sofia', country: 'BG', timezone: 'Europe/Sofia', lat: 42.6952, lng: 23.4062 },
  { iata: 'BEG', name: 'Nikola Tesla', city: 'Belgrade', country: 'RS', timezone: 'Europe/Belgrade', lat: 44.8184, lng: 20.3091 },
  { iata: 'ZAG', name: 'Franjo Tuđman', city: 'Zagreb', country: 'HR', timezone: 'Europe/Zagreb', lat: 45.7429, lng: 16.0688 },
  { iata: 'SPU', name: 'Split', city: 'Split', country: 'HR', timezone: 'Europe/Zagreb', lat: 43.5389, lng: 16.2980 },
  { iata: 'DBV', name: 'Dubrovnik', city: 'Dubrovnik', country: 'HR', timezone: 'Europe/Zagreb', lat: 42.5614, lng: 18.2682 },
  { iata: 'LJU', name: 'Jože Pučnik', city: 'Ljubljana', country: 'SI', timezone: 'Europe/Ljubljana', lat: 46.2237, lng: 14.4576 },
  { iata: 'BTS', name: 'M.R. Štefánik', city: 'Bratislava', country: 'SK', timezone: 'Europe/Bratislava', lat: 48.1702, lng: 17.2127 },
  { iata: 'TLL', name: 'Lennart Meri', city: 'Tallinn', country: 'EE', timezone: 'Europe/Tallinn', lat: 59.4133, lng: 24.8328 },
  { iata: 'RIX', name: 'Riga', city: 'Riga', country: 'LV', timezone: 'Europe/Riga', lat: 56.9236, lng: 23.9711 },
  { iata: 'VNO', name: 'Vilnius', city: 'Vilnius', country: 'LT', timezone: 'Europe/Vilnius', lat: 54.6341, lng: 25.2858 },
  { iata: 'KIV', name: 'Chișinău', city: 'Chișinău', country: 'MD', timezone: 'Europe/Chisinau', lat: 46.9277, lng: 28.9313 },

  // Greece & Cyprus
  { iata: 'ATH', name: 'Eleftherios Venizelos', city: 'Athens', country: 'GR', timezone: 'Europe/Athens', lat: 37.9364, lng: 23.9445 },
  { iata: 'SKG', name: 'Makedonia', city: 'Thessaloniki', country: 'GR', timezone: 'Europe/Athens', lat: 40.5197, lng: 22.9709 },
  { iata: 'HER', name: 'Heraklion', city: 'Heraklion', country: 'GR', timezone: 'Europe/Athens', lat: 35.3397, lng: 25.1803 },
  { iata: 'RHO', name: 'Diagoras', city: 'Rhodes', country: 'GR', timezone: 'Europe/Athens', lat: 36.4054, lng: 28.0862 },
  { iata: 'CFU', name: 'Ioannis Kapodistrias', city: 'Corfu', country: 'GR', timezone: 'Europe/Athens', lat: 39.6019, lng: 19.9117 },
  { iata: 'JMK', name: 'Mykonos', city: 'Mykonos', country: 'GR', timezone: 'Europe/Athens', lat: 37.4351, lng: 25.3481 },
  { iata: 'JTR', name: 'Santorini', city: 'Santorini', country: 'GR', timezone: 'Europe/Athens', lat: 36.3992, lng: 25.4793 },
  { iata: 'CHQ', name: 'Chania', city: 'Chania', country: 'GR', timezone: 'Europe/Athens', lat: 35.5317, lng: 24.1497 },
  { iata: 'LCA', name: 'Larnaca', city: 'Larnaca', country: 'CY', timezone: 'Asia/Nicosia', lat: 34.8751, lng: 33.6249 },
  { iata: 'PFO', name: 'Paphos', city: 'Paphos', country: 'CY', timezone: 'Asia/Nicosia', lat: 34.7180, lng: 32.4857 },

  // Turkey
  { iata: 'IST', name: 'Istanbul', city: 'Istanbul', country: 'TR', timezone: 'Europe/Istanbul', lat: 41.2753, lng: 28.7519 },
  { iata: 'SAW', name: 'Sabiha Gökçen', city: 'Istanbul', country: 'TR', timezone: 'Europe/Istanbul', lat: 40.8986, lng: 29.3092 },
  { iata: 'AYT', name: 'Antalya', city: 'Antalya', country: 'TR', timezone: 'Europe/Istanbul', lat: 36.8987, lng: 30.8005 },
  { iata: 'ESB', name: 'Esenboğa', city: 'Ankara', country: 'TR', timezone: 'Europe/Istanbul', lat: 40.1281, lng: 32.9951 },
  { iata: 'ADB', name: 'Adnan Menderes', city: 'Izmir', country: 'TR', timezone: 'Europe/Istanbul', lat: 38.2924, lng: 27.1570 },
  { iata: 'DLM', name: 'Dalaman', city: 'Dalaman', country: 'TR', timezone: 'Europe/Istanbul', lat: 36.7131, lng: 28.7925 },
  { iata: 'BJV', name: 'Milas-Bodrum', city: 'Bodrum', country: 'TR', timezone: 'Europe/Istanbul', lat: 37.2506, lng: 27.6643 },

  // Russia
  { iata: 'SVO', name: 'Sheremetyevo', city: 'Moscow', country: 'RU', timezone: 'Europe/Moscow', lat: 55.9726, lng: 37.4146 },
  { iata: 'DME', name: 'Domodedovo', city: 'Moscow', country: 'RU', timezone: 'Europe/Moscow', lat: 55.4088, lng: 37.9063 },
  { iata: 'VKO', name: 'Vnukovo', city: 'Moscow', country: 'RU', timezone: 'Europe/Moscow', lat: 55.5915, lng: 37.2615 },
  { iata: 'LED', name: 'Pulkovo', city: 'St Petersburg', country: 'RU', timezone: 'Europe/Moscow', lat: 59.8003, lng: 30.2625 },

  // Middle East
  { iata: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'AE', timezone: 'Asia/Dubai', lat: 25.2532, lng: 55.3657 },
  { iata: 'AUH', name: 'Abu Dhabi', city: 'Abu Dhabi', country: 'AE', timezone: 'Asia/Dubai', lat: 24.4330, lng: 54.6511 },
  { iata: 'DOH', name: 'Hamad', city: 'Doha', country: 'QA', timezone: 'Asia/Qatar', lat: 25.2731, lng: 51.6081 },
  { iata: 'BAH', name: 'Bahrain', city: 'Manama', country: 'BH', timezone: 'Asia/Bahrain', lat: 26.2708, lng: 50.6336 },
  { iata: 'KWI', name: 'Kuwait', city: 'Kuwait City', country: 'KW', timezone: 'Asia/Kuwait', lat: 29.2266, lng: 47.9689 },
  { iata: 'MCT', name: 'Muscat', city: 'Muscat', country: 'OM', timezone: 'Asia/Muscat', lat: 23.5933, lng: 58.2844 },
  { iata: 'AMM', name: 'Queen Alia', city: 'Amman', country: 'JO', timezone: 'Asia/Amman', lat: 31.7226, lng: 35.9932 },
  { iata: 'BEY', name: 'Rafic Hariri', city: 'Beirut', country: 'LB', timezone: 'Asia/Beirut', lat: 33.8209, lng: 35.4884 },
  { iata: 'TLV', name: 'Ben Gurion', city: 'Tel Aviv', country: 'IL', timezone: 'Asia/Jerusalem', lat: 32.0114, lng: 34.8867 },
  { iata: 'RUH', name: 'King Khalid', city: 'Riyadh', country: 'SA', timezone: 'Asia/Riyadh', lat: 24.9578, lng: 46.6989 },
  { iata: 'JED', name: 'King Abdulaziz', city: 'Jeddah', country: 'SA', timezone: 'Asia/Riyadh', lat: 21.6796, lng: 39.1565 },

  // Africa
  { iata: 'JNB', name: 'O.R. Tambo', city: 'Johannesburg', country: 'ZA', timezone: 'Africa/Johannesburg', lat: -26.1392, lng: 28.2460 },
  { iata: 'CPT', name: 'Cape Town', city: 'Cape Town', country: 'ZA', timezone: 'Africa/Johannesburg', lat: -33.9649, lng: 18.6017 },
  { iata: 'DUR', name: 'King Shaka', city: 'Durban', country: 'ZA', timezone: 'Africa/Johannesburg', lat: -29.6144, lng: 31.1197 },
  { iata: 'CAI', name: 'Cairo', city: 'Cairo', country: 'EG', timezone: 'Africa/Cairo', lat: 30.1219, lng: 31.4056 },
  { iata: 'HRG', name: 'Hurghada', city: 'Hurghada', country: 'EG', timezone: 'Africa/Cairo', lat: 27.1784, lng: 33.7994 },
  { iata: 'SSH', name: 'Sharm el-Sheikh', city: 'Sharm el-Sheikh', country: 'EG', timezone: 'Africa/Cairo', lat: 27.9773, lng: 34.3950 },
  { iata: 'CMN', name: 'Mohammed V', city: 'Casablanca', country: 'MA', timezone: 'Africa/Casablanca', lat: 33.3675, lng: -7.5900 },
  { iata: 'RAK', name: 'Menara', city: 'Marrakech', country: 'MA', timezone: 'Africa/Casablanca', lat: 31.6069, lng: -8.0363 },
  { iata: 'TUN', name: 'Tunis-Carthage', city: 'Tunis', country: 'TN', timezone: 'Africa/Tunis', lat: 36.8510, lng: 10.2272 },
  { iata: 'ALG', name: 'Houari Boumediene', city: 'Algiers', country: 'DZ', timezone: 'Africa/Algiers', lat: 36.6910, lng: 3.2154 },
  { iata: 'NBO', name: 'Jomo Kenyatta', city: 'Nairobi', country: 'KE', timezone: 'Africa/Nairobi', lat: -1.3192, lng: 36.9278 },
  { iata: 'ADD', name: 'Bole', city: 'Addis Ababa', country: 'ET', timezone: 'Africa/Addis_Ababa', lat: 8.9779, lng: 38.7994 },
  { iata: 'LOS', name: 'Murtala Muhammed', city: 'Lagos', country: 'NG', timezone: 'Africa/Lagos', lat: 6.5774, lng: 3.3211 },
  { iata: 'ABJ', name: 'Félix-Houphouët-Boigny', city: 'Abidjan', country: 'CI', timezone: 'Africa/Abidjan', lat: 5.2614, lng: -3.9262 },
  { iata: 'DSS', name: 'Blaise Diagne', city: 'Dakar', country: 'SN', timezone: 'Africa/Dakar', lat: 14.6700, lng: -17.0733 },
  { iata: 'ACC', name: 'Kotoka', city: 'Accra', country: 'GH', timezone: 'Africa/Accra', lat: 5.6052, lng: -0.1668 },
  { iata: 'DAR', name: 'Julius Nyerere', city: 'Dar es Salaam', country: 'TZ', timezone: 'Africa/Dar_es_Salaam', lat: -6.8781, lng: 39.2026 },
  { iata: 'MRU', name: 'Sir Seewoosagur Ramgoolam', city: 'Mauritius', country: 'MU', timezone: 'Indian/Mauritius', lat: -20.4302, lng: 57.6836 },

  // South Asia
  { iata: 'DEL', name: 'Indira Gandhi', city: 'Delhi', country: 'IN', timezone: 'Asia/Kolkata', lat: 28.5562, lng: 77.1000 },
  { iata: 'BOM', name: 'Chhatrapati Shivaji', city: 'Mumbai', country: 'IN', timezone: 'Asia/Kolkata', lat: 19.0896, lng: 72.8656 },
  { iata: 'BLR', name: 'Kempegowda', city: 'Bangalore', country: 'IN', timezone: 'Asia/Kolkata', lat: 13.1979, lng: 77.7063 },
  { iata: 'MAA', name: 'Chennai', city: 'Chennai', country: 'IN', timezone: 'Asia/Kolkata', lat: 12.9941, lng: 80.1709 },
  { iata: 'HYD', name: 'Rajiv Gandhi', city: 'Hyderabad', country: 'IN', timezone: 'Asia/Kolkata', lat: 17.2403, lng: 78.4294 },
  { iata: 'CCU', name: 'Netaji Subhas Chandra Bose', city: 'Kolkata', country: 'IN', timezone: 'Asia/Kolkata', lat: 22.6547, lng: 88.4467 },
  { iata: 'COK', name: 'Cochin', city: 'Kochi', country: 'IN', timezone: 'Asia/Kolkata', lat: 10.1520, lng: 76.4019 },
  { iata: 'GOI', name: 'Manohar', city: 'Goa', country: 'IN', timezone: 'Asia/Kolkata', lat: 15.3809, lng: 73.8314 },
  { iata: 'CMB', name: 'Bandaranaike', city: 'Colombo', country: 'LK', timezone: 'Asia/Colombo', lat: 7.1808, lng: 79.8841 },
  { iata: 'MLE', name: 'Velana', city: 'Malé', country: 'MV', timezone: 'Indian/Maldives', lat: 4.1918, lng: 73.5290 },
  { iata: 'KTM', name: 'Tribhuvan', city: 'Kathmandu', country: 'NP', timezone: 'Asia/Kathmandu', lat: 27.6966, lng: 85.3591 },
  { iata: 'ISB', name: 'Islamabad', city: 'Islamabad', country: 'PK', timezone: 'Asia/Karachi', lat: 33.5605, lng: 72.8526 },
  { iata: 'KHI', name: 'Jinnah', city: 'Karachi', country: 'PK', timezone: 'Asia/Karachi', lat: 24.9065, lng: 67.1609 },
  { iata: 'LHE', name: 'Allama Iqbal', city: 'Lahore', country: 'PK', timezone: 'Asia/Karachi', lat: 31.5216, lng: 74.4036 },
  { iata: 'DAC', name: 'Hazrat Shahjalal', city: 'Dhaka', country: 'BD', timezone: 'Asia/Dhaka', lat: 23.8432, lng: 90.3978 },

  // East Asia
  { iata: 'NRT', name: 'Narita', city: 'Tokyo', country: 'JP', timezone: 'Asia/Tokyo', lat: 35.7647, lng: 140.3864 },
  { iata: 'HND', name: 'Haneda', city: 'Tokyo', country: 'JP', timezone: 'Asia/Tokyo', lat: 35.5494, lng: 139.7798 },
  { iata: 'KIX', name: 'Kansai', city: 'Osaka', country: 'JP', timezone: 'Asia/Tokyo', lat: 34.4347, lng: 135.2440 },
  { iata: 'ITM', name: 'Itami', city: 'Osaka', country: 'JP', timezone: 'Asia/Tokyo', lat: 34.7855, lng: 135.4381 },
  { iata: 'NGO', name: 'Chubu Centrair', city: 'Nagoya', country: 'JP', timezone: 'Asia/Tokyo', lat: 34.8584, lng: 136.8125 },
  { iata: 'CTS', name: 'New Chitose', city: 'Sapporo', country: 'JP', timezone: 'Asia/Tokyo', lat: 42.7752, lng: 141.6924 },
  { iata: 'FUK', name: 'Fukuoka', city: 'Fukuoka', country: 'JP', timezone: 'Asia/Tokyo', lat: 33.5859, lng: 130.4511 },
  { iata: 'OKA', name: 'Naha', city: 'Okinawa', country: 'JP', timezone: 'Asia/Tokyo', lat: 26.1958, lng: 127.6459 },
  { iata: 'ICN', name: 'Incheon', city: 'Seoul', country: 'KR', timezone: 'Asia/Seoul', lat: 37.4602, lng: 126.4407 },
  { iata: 'GMP', name: 'Gimpo', city: 'Seoul', country: 'KR', timezone: 'Asia/Seoul', lat: 37.5583, lng: 126.7906 },
  { iata: 'PUS', name: 'Gimhae', city: 'Busan', country: 'KR', timezone: 'Asia/Seoul', lat: 35.1796, lng: 128.9382 },
  { iata: 'PEK', name: 'Capital', city: 'Beijing', country: 'CN', timezone: 'Asia/Shanghai', lat: 40.0799, lng: 116.6031 },
  { iata: 'PKX', name: 'Daxing', city: 'Beijing', country: 'CN', timezone: 'Asia/Shanghai', lat: 39.5098, lng: 116.4105 },
  { iata: 'PVG', name: 'Pudong', city: 'Shanghai', country: 'CN', timezone: 'Asia/Shanghai', lat: 31.1443, lng: 121.8083 },
  { iata: 'SHA', name: 'Hongqiao', city: 'Shanghai', country: 'CN', timezone: 'Asia/Shanghai', lat: 31.1979, lng: 121.3363 },
  { iata: 'CAN', name: 'Baiyun', city: 'Guangzhou', country: 'CN', timezone: 'Asia/Shanghai', lat: 23.3924, lng: 113.2988 },
  { iata: 'SZX', name: 'Bao\'an', city: 'Shenzhen', country: 'CN', timezone: 'Asia/Shanghai', lat: 22.6393, lng: 113.8107 },
  { iata: 'CTU', name: 'Shuangliu', city: 'Chengdu', country: 'CN', timezone: 'Asia/Shanghai', lat: 30.5785, lng: 103.9471 },
  { iata: 'CKG', name: 'Jiangbei', city: 'Chongqing', country: 'CN', timezone: 'Asia/Shanghai', lat: 29.7192, lng: 106.6417 },
  { iata: 'HKG', name: 'Hong Kong', city: 'Hong Kong', country: 'HK', timezone: 'Asia/Hong_Kong', lat: 22.3080, lng: 113.9185 },
  { iata: 'MFM', name: 'Macau', city: 'Macau', country: 'MO', timezone: 'Asia/Macau', lat: 22.1496, lng: 113.5920 },
  { iata: 'TPE', name: 'Taoyuan', city: 'Taipei', country: 'TW', timezone: 'Asia/Taipei', lat: 25.0777, lng: 121.2330 },
  { iata: 'ULN', name: 'Chinggis Khaan', city: 'Ulaanbaatar', country: 'MN', timezone: 'Asia/Ulaanbaatar', lat: 47.8431, lng: 106.7668 },

  // Southeast Asia
  { iata: 'SIN', name: 'Changi', city: 'Singapore', country: 'SG', timezone: 'Asia/Singapore', lat: 1.3644, lng: 103.9915 },
  { iata: 'KUL', name: 'Kuala Lumpur', city: 'Kuala Lumpur', country: 'MY', timezone: 'Asia/Kuala_Lumpur', lat: 2.7456, lng: 101.7099 },
  { iata: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', country: 'TH', timezone: 'Asia/Bangkok', lat: 13.6900, lng: 100.7501 },
  { iata: 'DMK', name: 'Don Mueang', city: 'Bangkok', country: 'TH', timezone: 'Asia/Bangkok', lat: 13.9126, lng: 100.6068 },
  { iata: 'HKT', name: 'Phuket', city: 'Phuket', country: 'TH', timezone: 'Asia/Bangkok', lat: 8.1132, lng: 98.3169 },
  { iata: 'CNX', name: 'Chiang Mai', city: 'Chiang Mai', country: 'TH', timezone: 'Asia/Bangkok', lat: 18.7668, lng: 98.9626 },
  { iata: 'CGK', name: 'Soekarno-Hatta', city: 'Jakarta', country: 'ID', timezone: 'Asia/Jakarta', lat: -6.1256, lng: 106.6559 },
  { iata: 'DPS', name: 'Ngurah Rai', city: 'Bali', country: 'ID', timezone: 'Asia/Makassar', lat: -8.7482, lng: 115.1672 },
  { iata: 'SGN', name: 'Tan Son Nhat', city: 'Ho Chi Minh City', country: 'VN', timezone: 'Asia/Ho_Chi_Minh', lat: 10.8188, lng: 106.6520 },
  { iata: 'HAN', name: 'Noi Bai', city: 'Hanoi', country: 'VN', timezone: 'Asia/Ho_Chi_Minh', lat: 21.2212, lng: 105.8072 },
  { iata: 'DAD', name: 'Da Nang', city: 'Da Nang', country: 'VN', timezone: 'Asia/Ho_Chi_Minh', lat: 16.0439, lng: 108.1992 },
  { iata: 'MNL', name: 'Ninoy Aquino', city: 'Manila', country: 'PH', timezone: 'Asia/Manila', lat: 14.5086, lng: 121.0198 },
  { iata: 'CEB', name: 'Mactan-Cebu', city: 'Cebu', country: 'PH', timezone: 'Asia/Manila', lat: 10.3075, lng: 123.9794 },
  { iata: 'PNH', name: 'Phnom Penh', city: 'Phnom Penh', country: 'KH', timezone: 'Asia/Phnom_Penh', lat: 11.5466, lng: 104.8441 },
  { iata: 'REP', name: 'Siem Reap', city: 'Siem Reap', country: 'KH', timezone: 'Asia/Phnom_Penh', lat: 13.4107, lng: 103.8128 },
  { iata: 'RGN', name: 'Yangon', city: 'Yangon', country: 'MM', timezone: 'Asia/Yangon', lat: 16.9074, lng: 96.1332 },
  { iata: 'VTE', name: 'Wattay', city: 'Vientiane', country: 'LA', timezone: 'Asia/Vientiane', lat: 17.9884, lng: 102.5633 },
  { iata: 'BWN', name: 'Brunei', city: 'Bandar Seri Begawan', country: 'BN', timezone: 'Asia/Brunei', lat: 4.9442, lng: 114.9281 },

  // Central Asia
  { iata: 'TAS', name: 'Islam Karimov', city: 'Tashkent', country: 'UZ', timezone: 'Asia/Tashkent', lat: 41.2579, lng: 69.2813 },
  { iata: 'ALA', name: 'Almaty', city: 'Almaty', country: 'KZ', timezone: 'Asia/Almaty', lat: 43.3521, lng: 77.0405 },
  { iata: 'NQZ', name: 'Nursultan Nazarbayev', city: 'Astana', country: 'KZ', timezone: 'Asia/Almaty', lat: 51.0222, lng: 71.4669 },
  { iata: 'GYD', name: 'Heydar Aliyev', city: 'Baku', country: 'AZ', timezone: 'Asia/Baku', lat: 40.4675, lng: 50.0467 },
  { iata: 'TBS', name: 'Shota Rustaveli', city: 'Tbilisi', country: 'GE', timezone: 'Asia/Tbilisi', lat: 41.6692, lng: 44.9547 },
  { iata: 'EVN', name: 'Zvartnots', city: 'Yerevan', country: 'AM', timezone: 'Asia/Yerevan', lat: 40.1473, lng: 44.3959 },

  // Oceania
  { iata: 'SYD', name: 'Kingsford Smith', city: 'Sydney', country: 'AU', timezone: 'Australia/Sydney', lat: -33.9461, lng: 151.1772 },
  { iata: 'MEL', name: 'Tullamarine', city: 'Melbourne', country: 'AU', timezone: 'Australia/Melbourne', lat: -37.6690, lng: 144.8410 },
  { iata: 'BNE', name: 'Brisbane', city: 'Brisbane', country: 'AU', timezone: 'Australia/Brisbane', lat: -27.3842, lng: 153.1175 },
  { iata: 'PER', name: 'Perth', city: 'Perth', country: 'AU', timezone: 'Australia/Perth', lat: -31.9403, lng: 115.9672 },
  { iata: 'ADL', name: 'Adelaide', city: 'Adelaide', country: 'AU', timezone: 'Australia/Adelaide', lat: -34.9461, lng: 138.5311 },
  { iata: 'OOL', name: 'Gold Coast', city: 'Gold Coast', country: 'AU', timezone: 'Australia/Brisbane', lat: -28.1644, lng: 153.5047 },
  { iata: 'CNS', name: 'Cairns', city: 'Cairns', country: 'AU', timezone: 'Australia/Brisbane', lat: -16.8858, lng: 145.7555 },
  { iata: 'CBR', name: 'Canberra', city: 'Canberra', country: 'AU', timezone: 'Australia/Sydney', lat: -35.3069, lng: 149.1953 },
  { iata: 'HBA', name: 'Hobart', city: 'Hobart', country: 'AU', timezone: 'Australia/Hobart', lat: -42.8361, lng: 147.5103 },
  { iata: 'DRW', name: 'Darwin', city: 'Darwin', country: 'AU', timezone: 'Australia/Darwin', lat: -12.4147, lng: 130.8729 },
  { iata: 'AKL', name: 'Auckland', city: 'Auckland', country: 'NZ', timezone: 'Pacific/Auckland', lat: -37.0082, lng: 174.7850 },
  { iata: 'WLG', name: 'Wellington', city: 'Wellington', country: 'NZ', timezone: 'Pacific/Auckland', lat: -41.3272, lng: 174.8053 },
  { iata: 'CHC', name: 'Christchurch', city: 'Christchurch', country: 'NZ', timezone: 'Pacific/Auckland', lat: -43.4894, lng: 172.5325 },
  { iata: 'ZQN', name: 'Queenstown', city: 'Queenstown', country: 'NZ', timezone: 'Pacific/Auckland', lat: -45.0211, lng: 168.7392 },
  { iata: 'NAN', name: 'Nadi', city: 'Nadi', country: 'FJ', timezone: 'Pacific/Fiji', lat: -17.7554, lng: 177.4431 },
  { iata: 'PPT', name: 'Faa\'a', city: 'Papeete', country: 'PF', timezone: 'Pacific/Tahiti', lat: -17.5537, lng: -149.6071 },
  { iata: 'NOU', name: 'La Tontouta', city: 'Nouméa', country: 'NC', timezone: 'Pacific/Noumea', lat: -22.0146, lng: 166.2128 },

  // North America - USA
  { iata: 'JFK', name: 'John F. Kennedy', city: 'New York', country: 'US', timezone: 'America/New_York', lat: 40.6413, lng: -73.7781 },
  { iata: 'EWR', name: 'Newark Liberty', city: 'Newark', country: 'US', timezone: 'America/New_York', lat: 40.6895, lng: -74.1745 },
  { iata: 'LGA', name: 'LaGuardia', city: 'New York', country: 'US', timezone: 'America/New_York', lat: 40.7769, lng: -73.8740 },
  { iata: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'US', timezone: 'America/Los_Angeles', lat: 33.9425, lng: -118.4081 },
  { iata: 'SFO', name: 'San Francisco', city: 'San Francisco', country: 'US', timezone: 'America/Los_Angeles', lat: 37.6213, lng: -122.3790 },
  { iata: 'ORD', name: 'O\'Hare', city: 'Chicago', country: 'US', timezone: 'America/Chicago', lat: 41.9742, lng: -87.9073 },
  { iata: 'MDW', name: 'Midway', city: 'Chicago', country: 'US', timezone: 'America/Chicago', lat: 41.7868, lng: -87.7522 },
  { iata: 'ATL', name: 'Hartsfield-Jackson', city: 'Atlanta', country: 'US', timezone: 'America/New_York', lat: 33.6407, lng: -84.4277 },
  { iata: 'DFW', name: 'Dallas/Fort Worth', city: 'Dallas', country: 'US', timezone: 'America/Chicago', lat: 32.8998, lng: -97.0403 },
  { iata: 'DEN', name: 'Denver', city: 'Denver', country: 'US', timezone: 'America/Denver', lat: 39.8561, lng: -104.6737 },
  { iata: 'SEA', name: 'Seattle-Tacoma', city: 'Seattle', country: 'US', timezone: 'America/Los_Angeles', lat: 47.4502, lng: -122.3088 },
  { iata: 'MIA', name: 'Miami', city: 'Miami', country: 'US', timezone: 'America/New_York', lat: 25.7959, lng: -80.2870 },
  { iata: 'FLL', name: 'Fort Lauderdale', city: 'Fort Lauderdale', country: 'US', timezone: 'America/New_York', lat: 26.0726, lng: -80.1527 },
  { iata: 'MCO', name: 'Orlando', city: 'Orlando', country: 'US', timezone: 'America/New_York', lat: 28.4312, lng: -81.3081 },
  { iata: 'TPA', name: 'Tampa', city: 'Tampa', country: 'US', timezone: 'America/New_York', lat: 27.9755, lng: -82.5332 },
  { iata: 'BOS', name: 'Logan', city: 'Boston', country: 'US', timezone: 'America/New_York', lat: 42.3656, lng: -71.0096 },
  { iata: 'PHL', name: 'Philadelphia', city: 'Philadelphia', country: 'US', timezone: 'America/New_York', lat: 39.8721, lng: -75.2411 },
  { iata: 'IAD', name: 'Dulles', city: 'Washington DC', country: 'US', timezone: 'America/New_York', lat: 38.9531, lng: -77.4565 },
  { iata: 'DCA', name: 'Reagan National', city: 'Washington DC', country: 'US', timezone: 'America/New_York', lat: 38.8512, lng: -77.0402 },
  { iata: 'BWI', name: 'Baltimore/Washington', city: 'Baltimore', country: 'US', timezone: 'America/New_York', lat: 39.1754, lng: -76.6683 },
  { iata: 'MSP', name: 'Minneapolis-Saint Paul', city: 'Minneapolis', country: 'US', timezone: 'America/Chicago', lat: 44.8848, lng: -93.2223 },
  { iata: 'DTW', name: 'Detroit Metro', city: 'Detroit', country: 'US', timezone: 'America/New_York', lat: 42.2162, lng: -83.3554 },
  { iata: 'CLT', name: 'Charlotte Douglas', city: 'Charlotte', country: 'US', timezone: 'America/New_York', lat: 35.2140, lng: -80.9431 },
  { iata: 'PHX', name: 'Sky Harbor', city: 'Phoenix', country: 'US', timezone: 'America/Phoenix', lat: 33.4373, lng: -112.0078 },
  { iata: 'IAH', name: 'George Bush', city: 'Houston', country: 'US', timezone: 'America/Chicago', lat: 29.9902, lng: -95.3368 },
  { iata: 'HOU', name: 'William P. Hobby', city: 'Houston', country: 'US', timezone: 'America/Chicago', lat: 29.6454, lng: -95.2789 },
  { iata: 'SAN', name: 'San Diego', city: 'San Diego', country: 'US', timezone: 'America/Los_Angeles', lat: 32.7338, lng: -117.1933 },
  { iata: 'SJC', name: 'Mineta San Jose', city: 'San Jose', country: 'US', timezone: 'America/Los_Angeles', lat: 37.3639, lng: -121.9289 },
  { iata: 'OAK', name: 'Oakland', city: 'Oakland', country: 'US', timezone: 'America/Los_Angeles', lat: 37.7213, lng: -122.2208 },
  { iata: 'PDX', name: 'Portland', city: 'Portland', country: 'US', timezone: 'America/Los_Angeles', lat: 45.5898, lng: -122.5951 },
  { iata: 'LAS', name: 'Harry Reid', city: 'Las Vegas', country: 'US', timezone: 'America/Los_Angeles', lat: 36.0840, lng: -115.1537 },
  { iata: 'SLC', name: 'Salt Lake City', city: 'Salt Lake City', country: 'US', timezone: 'America/Denver', lat: 40.7884, lng: -111.9778 },
  { iata: 'STL', name: 'Lambert', city: 'St. Louis', country: 'US', timezone: 'America/Chicago', lat: 38.7487, lng: -90.3700 },
  { iata: 'BNA', name: 'Nashville', city: 'Nashville', country: 'US', timezone: 'America/Chicago', lat: 36.1263, lng: -86.6774 },
  { iata: 'AUS', name: 'Austin-Bergstrom', city: 'Austin', country: 'US', timezone: 'America/Chicago', lat: 30.1975, lng: -97.6664 },
  { iata: 'RDU', name: 'Raleigh-Durham', city: 'Raleigh', country: 'US', timezone: 'America/New_York', lat: 35.8801, lng: -78.7880 },
  { iata: 'CLE', name: 'Cleveland Hopkins', city: 'Cleveland', country: 'US', timezone: 'America/New_York', lat: 41.4117, lng: -81.8498 },
  { iata: 'MKE', name: 'Mitchell', city: 'Milwaukee', country: 'US', timezone: 'America/Chicago', lat: 42.9472, lng: -87.8966 },
  { iata: 'IND', name: 'Indianapolis', city: 'Indianapolis', country: 'US', timezone: 'America/Indiana/Indianapolis', lat: 39.7173, lng: -86.2944 },
  { iata: 'PIT', name: 'Pittsburgh', city: 'Pittsburgh', country: 'US', timezone: 'America/New_York', lat: 40.4915, lng: -80.2329 },
  { iata: 'CMH', name: 'John Glenn', city: 'Columbus', country: 'US', timezone: 'America/New_York', lat: 39.9981, lng: -82.8919 },
  { iata: 'SAT', name: 'San Antonio', city: 'San Antonio', country: 'US', timezone: 'America/Chicago', lat: 29.5337, lng: -98.4698 },
  { iata: 'HNL', name: 'Daniel K. Inouye', city: 'Honolulu', country: 'US', timezone: 'Pacific/Honolulu', lat: 21.3187, lng: -157.9224 },
  { iata: 'OGG', name: 'Kahului', city: 'Maui', country: 'US', timezone: 'Pacific/Honolulu', lat: 20.8986, lng: -156.4305 },
  { iata: 'ANC', name: 'Ted Stevens', city: 'Anchorage', country: 'US', timezone: 'America/Anchorage', lat: 61.1743, lng: -149.9982 },

  // Canada
  { iata: 'YYZ', name: 'Pearson', city: 'Toronto', country: 'CA', timezone: 'America/Toronto', lat: 43.6777, lng: -79.6248 },
  { iata: 'YVR', name: 'Vancouver', city: 'Vancouver', country: 'CA', timezone: 'America/Vancouver', lat: 49.1967, lng: -123.1815 },
  { iata: 'YUL', name: 'Trudeau', city: 'Montreal', country: 'CA', timezone: 'America/Montreal', lat: 45.4706, lng: -73.7408 },
  { iata: 'YYC', name: 'Calgary', city: 'Calgary', country: 'CA', timezone: 'America/Edmonton', lat: 51.1215, lng: -114.0076 },
  { iata: 'YEG', name: 'Edmonton', city: 'Edmonton', country: 'CA', timezone: 'America/Edmonton', lat: 53.3097, lng: -113.5800 },
  { iata: 'YOW', name: 'Macdonald-Cartier', city: 'Ottawa', country: 'CA', timezone: 'America/Toronto', lat: 45.3208, lng: -75.6692 },
  { iata: 'YWG', name: 'Richardson', city: 'Winnipeg', country: 'CA', timezone: 'America/Winnipeg', lat: 49.9100, lng: -97.2399 },
  { iata: 'YHZ', name: 'Stanfield', city: 'Halifax', country: 'CA', timezone: 'America/Halifax', lat: 44.8808, lng: -63.5086 },

  // Mexico
  { iata: 'MEX', name: 'Benito Juárez', city: 'Mexico City', country: 'MX', timezone: 'America/Mexico_City', lat: 19.4363, lng: -99.0721 },
  { iata: 'CUN', name: 'Cancún', city: 'Cancún', country: 'MX', timezone: 'America/Cancun', lat: 21.0365, lng: -86.8771 },
  { iata: 'GDL', name: 'Don Miguel Hidalgo', city: 'Guadalajara', country: 'MX', timezone: 'America/Mexico_City', lat: 20.5218, lng: -103.3113 },
  { iata: 'SJD', name: 'San José del Cabo', city: 'Los Cabos', country: 'MX', timezone: 'America/Mazatlan', lat: 23.1518, lng: -109.7215 },
  { iata: 'PVR', name: 'Gustavo Díaz Ordaz', city: 'Puerto Vallarta', country: 'MX', timezone: 'America/Mexico_City', lat: 20.6801, lng: -105.2544 },
  { iata: 'MTY', name: 'Monterrey', city: 'Monterrey', country: 'MX', timezone: 'America/Monterrey', lat: 25.7785, lng: -100.1069 },

  // Caribbean
  { iata: 'SJU', name: 'Luis Muñoz Marín', city: 'San Juan', country: 'PR', timezone: 'America/Puerto_Rico', lat: 18.4394, lng: -66.0018 },
  { iata: 'NAS', name: 'Lynden Pindling', city: 'Nassau', country: 'BS', timezone: 'America/Nassau', lat: 25.0390, lng: -77.4662 },
  { iata: 'MBJ', name: 'Sangster', city: 'Montego Bay', country: 'JM', timezone: 'America/Jamaica', lat: 18.5037, lng: -77.9134 },
  { iata: 'KIN', name: 'Norman Manley', city: 'Kingston', country: 'JM', timezone: 'America/Jamaica', lat: 17.9357, lng: -76.7875 },
  { iata: 'PUJ', name: 'Punta Cana', city: 'Punta Cana', country: 'DO', timezone: 'America/Santo_Domingo', lat: 18.5674, lng: -68.3634 },
  { iata: 'SDQ', name: 'Las Américas', city: 'Santo Domingo', country: 'DO', timezone: 'America/Santo_Domingo', lat: 18.4297, lng: -69.6689 },
  { iata: 'HAV', name: 'José Martí', city: 'Havana', country: 'CU', timezone: 'America/Havana', lat: 22.9892, lng: -82.4091 },
  { iata: 'AUA', name: 'Queen Beatrix', city: 'Oranjestad', country: 'AW', timezone: 'America/Aruba', lat: 12.5014, lng: -70.0152 },
  { iata: 'CUR', name: 'Hato', city: 'Willemstad', country: 'CW', timezone: 'America/Curacao', lat: 12.1889, lng: -68.9598 },
  { iata: 'SXM', name: 'Princess Juliana', city: 'St Maarten', country: 'SX', timezone: 'America/Lower_Princes', lat: 18.0410, lng: -63.1089 },
  { iata: 'BGI', name: 'Grantley Adams', city: 'Bridgetown', country: 'BB', timezone: 'America/Barbados', lat: 13.0746, lng: -59.4925 },
  { iata: 'POS', name: 'Piarco', city: 'Port of Spain', country: 'TT', timezone: 'America/Port_of_Spain', lat: 10.5954, lng: -61.3372 },

  // Central America
  { iata: 'PTY', name: 'Tocumen', city: 'Panama City', country: 'PA', timezone: 'America/Panama', lat: 9.0714, lng: -79.3835 },
  { iata: 'SJO', name: 'Juan Santamaría', city: 'San José', country: 'CR', timezone: 'America/Costa_Rica', lat: 9.9939, lng: -84.2088 },
  { iata: 'GUA', name: 'La Aurora', city: 'Guatemala City', country: 'GT', timezone: 'America/Guatemala', lat: 14.5833, lng: -90.5275 },
  { iata: 'BZE', name: 'Philip S.W. Goldson', city: 'Belize City', country: 'BZ', timezone: 'America/Belize', lat: 17.5391, lng: -88.3082 },

  // South America
  { iata: 'GRU', name: 'Guarulhos', city: 'São Paulo', country: 'BR', timezone: 'America/Sao_Paulo', lat: -23.4356, lng: -46.4731 },
  { iata: 'GIG', name: 'Galeão', city: 'Rio de Janeiro', country: 'BR', timezone: 'America/Sao_Paulo', lat: -22.8100, lng: -43.2505 },
  { iata: 'BSB', name: 'Brasília', city: 'Brasília', country: 'BR', timezone: 'America/Sao_Paulo', lat: -15.8711, lng: -47.9186 },
  { iata: 'CNF', name: 'Confins', city: 'Belo Horizonte', country: 'BR', timezone: 'America/Sao_Paulo', lat: -19.6244, lng: -43.9719 },
  { iata: 'SSA', name: 'Deputado Luís Eduardo Magalhães', city: 'Salvador', country: 'BR', timezone: 'America/Bahia', lat: -12.9086, lng: -38.3225 },
  { iata: 'REC', name: 'Guararapes', city: 'Recife', country: 'BR', timezone: 'America/Recife', lat: -8.1264, lng: -34.9236 },
  { iata: 'FOR', name: 'Pinto Martins', city: 'Fortaleza', country: 'BR', timezone: 'America/Fortaleza', lat: -3.7763, lng: -38.5326 },
  { iata: 'EZE', name: 'Ministro Pistarini', city: 'Buenos Aires', country: 'AR', timezone: 'America/Argentina/Buenos_Aires', lat: -34.8222, lng: -58.5358 },
  { iata: 'AEP', name: 'Jorge Newbery', city: 'Buenos Aires', country: 'AR', timezone: 'America/Argentina/Buenos_Aires', lat: -34.5592, lng: -58.4156 },
  { iata: 'SCL', name: 'Arturo Merino Benítez', city: 'Santiago', country: 'CL', timezone: 'America/Santiago', lat: -33.3930, lng: -70.7858 },
  { iata: 'LIM', name: 'Jorge Chávez', city: 'Lima', country: 'PE', timezone: 'America/Lima', lat: -12.0219, lng: -77.1143 },
  { iata: 'BOG', name: 'El Dorado', city: 'Bogotá', country: 'CO', timezone: 'America/Bogota', lat: 4.7016, lng: -74.1469 },
  { iata: 'MDE', name: 'José María Córdova', city: 'Medellín', country: 'CO', timezone: 'America/Bogota', lat: 6.1645, lng: -75.4231 },
  { iata: 'CTG', name: 'Rafael Núñez', city: 'Cartagena', country: 'CO', timezone: 'America/Bogota', lat: 10.4424, lng: -75.5130 },
  { iata: 'UIO', name: 'Mariscal Sucre', city: 'Quito', country: 'EC', timezone: 'America/Guayaquil', lat: -0.1292, lng: -78.3575 },
  { iata: 'GYE', name: 'José Joaquín de Olmedo', city: 'Guayaquil', country: 'EC', timezone: 'America/Guayaquil', lat: -2.1574, lng: -79.8837 },
  { iata: 'CCS', name: 'Simón Bolívar', city: 'Caracas', country: 'VE', timezone: 'America/Caracas', lat: 10.6012, lng: -66.9912 },
  { iata: 'MVD', name: 'Carrasco', city: 'Montevideo', country: 'UY', timezone: 'America/Montevideo', lat: -34.8384, lng: -56.0308 },
  { iata: 'ASU', name: 'Silvio Pettirossi', city: 'Asunción', country: 'PY', timezone: 'America/Asuncion', lat: -25.2400, lng: -57.5190 },
  { iata: 'VVI', name: 'Viru Viru', city: 'Santa Cruz', country: 'BO', timezone: 'America/La_Paz', lat: -17.6448, lng: -63.1354 },
  { iata: 'LPB', name: 'El Alto', city: 'La Paz', country: 'BO', timezone: 'America/La_Paz', lat: -16.5133, lng: -68.1923 },

  // Malta
  { iata: 'MLA', name: 'Malta', city: 'Valletta', country: 'MT', timezone: 'Europe/Malta', lat: 35.8575, lng: 14.4775 },

  // Luxembourg
  { iata: 'LUX', name: 'Findel', city: 'Luxembourg', country: 'LU', timezone: 'Europe/Luxembourg', lat: 49.6233, lng: 6.2044 },

  // Morocco (additional)
  { iata: 'FEZ', name: 'Saïss', city: 'Fez', country: 'MA', timezone: 'Africa/Casablanca', lat: 33.9273, lng: -4.9780 },
  { iata: 'AGA', name: 'Al Massira', city: 'Agadir', country: 'MA', timezone: 'Africa/Casablanca', lat: 30.3250, lng: -9.4131 },
  { iata: 'TNG', name: 'Ibn Battouta', city: 'Tangier', country: 'MA', timezone: 'Africa/Casablanca', lat: 35.7269, lng: -5.9169 },
];

/**
 * Search airports by IATA code, name, or city.
 * Returns top 20 matches, case-insensitive.
 */
export function searchAirports(query: string): Airport[] {
  if (!query || query.trim().length === 0) return [];
  const q = query.trim().toLowerCase();

  // Exact IATA match first
  const exactIata = AIRPORTS.filter(a => a.iata.toLowerCase() === q);
  const rest = AIRPORTS.filter(a => {
    if (a.iata.toLowerCase() === q) return false;
    return (
      a.iata.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q)
    );
  });

  return [...exactIata, ...rest].slice(0, 20);
}

export default AIRPORTS;
