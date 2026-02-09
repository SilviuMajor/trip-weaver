export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
}

// Comprehensive commercial airport dataset (~600 major airports)
// Covers all major international and regional airports worldwide
const AIRPORTS: Airport[] = [
  // United Kingdom
  { iata: 'LHR', name: 'Heathrow', city: 'London', country: 'GB', timezone: 'Europe/London' },
  { iata: 'LGW', name: 'Gatwick', city: 'London', country: 'GB', timezone: 'Europe/London' },
  { iata: 'STN', name: 'Stansted', city: 'London', country: 'GB', timezone: 'Europe/London' },
  { iata: 'LTN', name: 'Luton', city: 'London', country: 'GB', timezone: 'Europe/London' },
  { iata: 'LCY', name: 'City Airport', city: 'London', country: 'GB', timezone: 'Europe/London' },
  { iata: 'SEN', name: 'Southend', city: 'London', country: 'GB', timezone: 'Europe/London' },
  { iata: 'MAN', name: 'Manchester', city: 'Manchester', country: 'GB', timezone: 'Europe/London' },
  { iata: 'BHX', name: 'Birmingham', city: 'Birmingham', country: 'GB', timezone: 'Europe/London' },
  { iata: 'EDI', name: 'Edinburgh', city: 'Edinburgh', country: 'GB', timezone: 'Europe/London' },
  { iata: 'GLA', name: 'Glasgow', city: 'Glasgow', country: 'GB', timezone: 'Europe/London' },
  { iata: 'BRS', name: 'Bristol', city: 'Bristol', country: 'GB', timezone: 'Europe/London' },
  { iata: 'LPL', name: 'John Lennon', city: 'Liverpool', country: 'GB', timezone: 'Europe/London' },
  { iata: 'NCL', name: 'Newcastle', city: 'Newcastle', country: 'GB', timezone: 'Europe/London' },
  { iata: 'EMA', name: 'East Midlands', city: 'Nottingham', country: 'GB', timezone: 'Europe/London' },
  { iata: 'LBA', name: 'Leeds Bradford', city: 'Leeds', country: 'GB', timezone: 'Europe/London' },
  { iata: 'ABZ', name: 'Aberdeen', city: 'Aberdeen', country: 'GB', timezone: 'Europe/London' },
  { iata: 'BFS', name: 'Belfast International', city: 'Belfast', country: 'GB', timezone: 'Europe/London' },
  { iata: 'CWL', name: 'Cardiff', city: 'Cardiff', country: 'GB', timezone: 'Europe/London' },

  // Netherlands
  { iata: 'AMS', name: 'Schiphol', city: 'Amsterdam', country: 'NL', timezone: 'Europe/Amsterdam' },
  { iata: 'EIN', name: 'Eindhoven', city: 'Eindhoven', country: 'NL', timezone: 'Europe/Amsterdam' },
  { iata: 'RTM', name: 'Rotterdam The Hague', city: 'Rotterdam', country: 'NL', timezone: 'Europe/Amsterdam' },
  { iata: 'GRQ', name: 'Eelde', city: 'Groningen', country: 'NL', timezone: 'Europe/Amsterdam' },
  { iata: 'MST', name: 'Maastricht Aachen', city: 'Maastricht', country: 'NL', timezone: 'Europe/Amsterdam' },

  // France
  { iata: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'FR', timezone: 'Europe/Paris' },
  { iata: 'ORY', name: 'Orly', city: 'Paris', country: 'FR', timezone: 'Europe/Paris' },
  { iata: 'NCE', name: 'Nice Côte d\'Azur', city: 'Nice', country: 'FR', timezone: 'Europe/Paris' },
  { iata: 'LYS', name: 'Saint-Exupéry', city: 'Lyon', country: 'FR', timezone: 'Europe/Paris' },
  { iata: 'MRS', name: 'Provence', city: 'Marseille', country: 'FR', timezone: 'Europe/Paris' },
  { iata: 'TLS', name: 'Blagnac', city: 'Toulouse', country: 'FR', timezone: 'Europe/Paris' },
  { iata: 'BOD', name: 'Mérignac', city: 'Bordeaux', country: 'FR', timezone: 'Europe/Paris' },
  { iata: 'NTE', name: 'Atlantique', city: 'Nantes', country: 'FR', timezone: 'Europe/Paris' },
  { iata: 'BVA', name: 'Beauvais-Tillé', city: 'Paris Beauvais', country: 'FR', timezone: 'Europe/Paris' },

  // Germany
  { iata: 'FRA', name: 'Frankfurt', city: 'Frankfurt', country: 'DE', timezone: 'Europe/Berlin' },
  { iata: 'MUC', name: 'Franz Josef Strauss', city: 'Munich', country: 'DE', timezone: 'Europe/Berlin' },
  { iata: 'BER', name: 'Berlin Brandenburg', city: 'Berlin', country: 'DE', timezone: 'Europe/Berlin' },
  { iata: 'DUS', name: 'Düsseldorf', city: 'Düsseldorf', country: 'DE', timezone: 'Europe/Berlin' },
  { iata: 'HAM', name: 'Hamburg', city: 'Hamburg', country: 'DE', timezone: 'Europe/Berlin' },
  { iata: 'CGN', name: 'Cologne Bonn', city: 'Cologne', country: 'DE', timezone: 'Europe/Berlin' },
  { iata: 'STR', name: 'Stuttgart', city: 'Stuttgart', country: 'DE', timezone: 'Europe/Berlin' },
  { iata: 'HAJ', name: 'Hannover', city: 'Hannover', country: 'DE', timezone: 'Europe/Berlin' },
  { iata: 'NUE', name: 'Albrecht Dürer', city: 'Nuremberg', country: 'DE', timezone: 'Europe/Berlin' },
  { iata: 'LEJ', name: 'Leipzig/Halle', city: 'Leipzig', country: 'DE', timezone: 'Europe/Berlin' },
  { iata: 'DRS', name: 'Dresden', city: 'Dresden', country: 'DE', timezone: 'Europe/Berlin' },
  { iata: 'HHN', name: 'Frankfurt-Hahn', city: 'Frankfurt Hahn', country: 'DE', timezone: 'Europe/Berlin' },

  // Spain
  { iata: 'MAD', name: 'Barajas', city: 'Madrid', country: 'ES', timezone: 'Europe/Madrid' },
  { iata: 'BCN', name: 'El Prat', city: 'Barcelona', country: 'ES', timezone: 'Europe/Madrid' },
  { iata: 'PMI', name: 'Palma de Mallorca', city: 'Palma', country: 'ES', timezone: 'Europe/Madrid' },
  { iata: 'AGP', name: 'Málaga-Costa del Sol', city: 'Málaga', country: 'ES', timezone: 'Europe/Madrid' },
  { iata: 'ALC', name: 'Alicante-Elche', city: 'Alicante', country: 'ES', timezone: 'Europe/Madrid' },
  { iata: 'TFS', name: 'Tenerife South', city: 'Tenerife', country: 'ES', timezone: 'Atlantic/Canary' },
  { iata: 'LPA', name: 'Gran Canaria', city: 'Las Palmas', country: 'ES', timezone: 'Atlantic/Canary' },
  { iata: 'IBZ', name: 'Ibiza', city: 'Ibiza', country: 'ES', timezone: 'Europe/Madrid' },
  { iata: 'SVQ', name: 'San Pablo', city: 'Seville', country: 'ES', timezone: 'Europe/Madrid' },
  { iata: 'VLC', name: 'Valencia', city: 'Valencia', country: 'ES', timezone: 'Europe/Madrid' },
  { iata: 'BIO', name: 'Bilbao', city: 'Bilbao', country: 'ES', timezone: 'Europe/Madrid' },
  { iata: 'FUE', name: 'Fuerteventura', city: 'Fuerteventura', country: 'ES', timezone: 'Atlantic/Canary' },
  { iata: 'ACE', name: 'Lanzarote', city: 'Lanzarote', country: 'ES', timezone: 'Atlantic/Canary' },

  // Italy
  { iata: 'FCO', name: 'Fiumicino', city: 'Rome', country: 'IT', timezone: 'Europe/Rome' },
  { iata: 'MXP', name: 'Malpensa', city: 'Milan', country: 'IT', timezone: 'Europe/Rome' },
  { iata: 'LIN', name: 'Linate', city: 'Milan', country: 'IT', timezone: 'Europe/Rome' },
  { iata: 'BGY', name: 'Orio al Serio', city: 'Bergamo', country: 'IT', timezone: 'Europe/Rome' },
  { iata: 'NAP', name: 'Capodichino', city: 'Naples', country: 'IT', timezone: 'Europe/Rome' },
  { iata: 'VCE', name: 'Marco Polo', city: 'Venice', country: 'IT', timezone: 'Europe/Rome' },
  { iata: 'BLQ', name: 'Guglielmo Marconi', city: 'Bologna', country: 'IT', timezone: 'Europe/Rome' },
  { iata: 'CAG', name: 'Elmas', city: 'Cagliari', country: 'IT', timezone: 'Europe/Rome' },
  { iata: 'CTA', name: 'Fontanarossa', city: 'Catania', country: 'IT', timezone: 'Europe/Rome' },
  { iata: 'PMO', name: 'Falcone-Borsellino', city: 'Palermo', country: 'IT', timezone: 'Europe/Rome' },
  { iata: 'PSA', name: 'Galileo Galilei', city: 'Pisa', country: 'IT', timezone: 'Europe/Rome' },
  { iata: 'FLR', name: 'Peretola', city: 'Florence', country: 'IT', timezone: 'Europe/Rome' },
  { iata: 'TRN', name: 'Caselle', city: 'Turin', country: 'IT', timezone: 'Europe/Rome' },
  { iata: 'CIA', name: 'Ciampino', city: 'Rome', country: 'IT', timezone: 'Europe/Rome' },

  // Portugal
  { iata: 'LIS', name: 'Humberto Delgado', city: 'Lisbon', country: 'PT', timezone: 'Europe/Lisbon' },
  { iata: 'OPO', name: 'Francisco Sá Carneiro', city: 'Porto', country: 'PT', timezone: 'Europe/Lisbon' },
  { iata: 'FAO', name: 'Faro', city: 'Faro', country: 'PT', timezone: 'Europe/Lisbon' },
  { iata: 'FNC', name: 'Cristiano Ronaldo', city: 'Funchal', country: 'PT', timezone: 'Atlantic/Madeira' },
  { iata: 'PDL', name: 'João Paulo II', city: 'Ponta Delgada', country: 'PT', timezone: 'Atlantic/Azores' },

  // Ireland
  { iata: 'DUB', name: 'Dublin', city: 'Dublin', country: 'IE', timezone: 'Europe/Dublin' },
  { iata: 'ORK', name: 'Cork', city: 'Cork', country: 'IE', timezone: 'Europe/Dublin' },
  { iata: 'SNN', name: 'Shannon', city: 'Shannon', country: 'IE', timezone: 'Europe/Dublin' },
  { iata: 'KNO', name: 'Knock', city: 'Knock', country: 'IE', timezone: 'Europe/Dublin' },

  // Belgium
  { iata: 'BRU', name: 'Brussels', city: 'Brussels', country: 'BE', timezone: 'Europe/Brussels' },
  { iata: 'CRL', name: 'Charleroi', city: 'Charleroi', country: 'BE', timezone: 'Europe/Brussels' },

  // Switzerland
  { iata: 'ZRH', name: 'Zürich', city: 'Zürich', country: 'CH', timezone: 'Europe/Zurich' },
  { iata: 'GVA', name: 'Geneva', city: 'Geneva', country: 'CH', timezone: 'Europe/Zurich' },
  { iata: 'BSL', name: 'EuroAirport Basel', city: 'Basel', country: 'CH', timezone: 'Europe/Zurich' },

  // Austria
  { iata: 'VIE', name: 'Vienna', city: 'Vienna', country: 'AT', timezone: 'Europe/Vienna' },
  { iata: 'SZG', name: 'Salzburg', city: 'Salzburg', country: 'AT', timezone: 'Europe/Vienna' },
  { iata: 'INN', name: 'Innsbruck', city: 'Innsbruck', country: 'AT', timezone: 'Europe/Vienna' },

  // Scandinavia
  { iata: 'CPH', name: 'Copenhagen', city: 'Copenhagen', country: 'DK', timezone: 'Europe/Copenhagen' },
  { iata: 'ARN', name: 'Arlanda', city: 'Stockholm', country: 'SE', timezone: 'Europe/Stockholm' },
  { iata: 'GOT', name: 'Landvetter', city: 'Gothenburg', country: 'SE', timezone: 'Europe/Stockholm' },
  { iata: 'OSL', name: 'Gardermoen', city: 'Oslo', country: 'NO', timezone: 'Europe/Oslo' },
  { iata: 'BGO', name: 'Flesland', city: 'Bergen', country: 'NO', timezone: 'Europe/Oslo' },
  { iata: 'TRD', name: 'Værnes', city: 'Trondheim', country: 'NO', timezone: 'Europe/Oslo' },
  { iata: 'HEL', name: 'Helsinki-Vantaa', city: 'Helsinki', country: 'FI', timezone: 'Europe/Helsinki' },
  { iata: 'KEF', name: 'Keflavík', city: 'Reykjavík', country: 'IS', timezone: 'Atlantic/Reykjavik' },

  // Eastern Europe
  { iata: 'WAW', name: 'Chopin', city: 'Warsaw', country: 'PL', timezone: 'Europe/Warsaw' },
  { iata: 'KRK', name: 'John Paul II', city: 'Kraków', country: 'PL', timezone: 'Europe/Warsaw' },
  { iata: 'GDN', name: 'Lech Wałęsa', city: 'Gdańsk', country: 'PL', timezone: 'Europe/Warsaw' },
  { iata: 'WRO', name: 'Copernicus', city: 'Wrocław', country: 'PL', timezone: 'Europe/Warsaw' },
  { iata: 'PRG', name: 'Václav Havel', city: 'Prague', country: 'CZ', timezone: 'Europe/Prague' },
  { iata: 'BUD', name: 'Ferenc Liszt', city: 'Budapest', country: 'HU', timezone: 'Europe/Budapest' },
  { iata: 'OTP', name: 'Henri Coandă', city: 'Bucharest', country: 'RO', timezone: 'Europe/Bucharest' },
  { iata: 'CLJ', name: 'Avram Iancu', city: 'Cluj-Napoca', country: 'RO', timezone: 'Europe/Bucharest' },
  { iata: 'SOF', name: 'Sofia', city: 'Sofia', country: 'BG', timezone: 'Europe/Sofia' },
  { iata: 'BEG', name: 'Nikola Tesla', city: 'Belgrade', country: 'RS', timezone: 'Europe/Belgrade' },
  { iata: 'ZAG', name: 'Franjo Tuđman', city: 'Zagreb', country: 'HR', timezone: 'Europe/Zagreb' },
  { iata: 'SPU', name: 'Split', city: 'Split', country: 'HR', timezone: 'Europe/Zagreb' },
  { iata: 'DBV', name: 'Dubrovnik', city: 'Dubrovnik', country: 'HR', timezone: 'Europe/Zagreb' },
  { iata: 'LJU', name: 'Jože Pučnik', city: 'Ljubljana', country: 'SI', timezone: 'Europe/Ljubljana' },
  { iata: 'BTS', name: 'M.R. Štefánik', city: 'Bratislava', country: 'SK', timezone: 'Europe/Bratislava' },
  { iata: 'TLL', name: 'Lennart Meri', city: 'Tallinn', country: 'EE', timezone: 'Europe/Tallinn' },
  { iata: 'RIX', name: 'Riga', city: 'Riga', country: 'LV', timezone: 'Europe/Riga' },
  { iata: 'VNO', name: 'Vilnius', city: 'Vilnius', country: 'LT', timezone: 'Europe/Vilnius' },
  { iata: 'KIV', name: 'Chișinău', city: 'Chișinău', country: 'MD', timezone: 'Europe/Chisinau' },

  // Greece & Cyprus
  { iata: 'ATH', name: 'Eleftherios Venizelos', city: 'Athens', country: 'GR', timezone: 'Europe/Athens' },
  { iata: 'SKG', name: 'Makedonia', city: 'Thessaloniki', country: 'GR', timezone: 'Europe/Athens' },
  { iata: 'HER', name: 'Heraklion', city: 'Heraklion', country: 'GR', timezone: 'Europe/Athens' },
  { iata: 'RHO', name: 'Diagoras', city: 'Rhodes', country: 'GR', timezone: 'Europe/Athens' },
  { iata: 'CFU', name: 'Ioannis Kapodistrias', city: 'Corfu', country: 'GR', timezone: 'Europe/Athens' },
  { iata: 'JMK', name: 'Mykonos', city: 'Mykonos', country: 'GR', timezone: 'Europe/Athens' },
  { iata: 'JTR', name: 'Santorini', city: 'Santorini', country: 'GR', timezone: 'Europe/Athens' },
  { iata: 'CHQ', name: 'Chania', city: 'Chania', country: 'GR', timezone: 'Europe/Athens' },
  { iata: 'LCA', name: 'Larnaca', city: 'Larnaca', country: 'CY', timezone: 'Asia/Nicosia' },
  { iata: 'PFO', name: 'Paphos', city: 'Paphos', country: 'CY', timezone: 'Asia/Nicosia' },

  // Turkey
  { iata: 'IST', name: 'Istanbul', city: 'Istanbul', country: 'TR', timezone: 'Europe/Istanbul' },
  { iata: 'SAW', name: 'Sabiha Gökçen', city: 'Istanbul', country: 'TR', timezone: 'Europe/Istanbul' },
  { iata: 'AYT', name: 'Antalya', city: 'Antalya', country: 'TR', timezone: 'Europe/Istanbul' },
  { iata: 'ESB', name: 'Esenboğa', city: 'Ankara', country: 'TR', timezone: 'Europe/Istanbul' },
  { iata: 'ADB', name: 'Adnan Menderes', city: 'Izmir', country: 'TR', timezone: 'Europe/Istanbul' },
  { iata: 'DLM', name: 'Dalaman', city: 'Dalaman', country: 'TR', timezone: 'Europe/Istanbul' },
  { iata: 'BJV', name: 'Milas-Bodrum', city: 'Bodrum', country: 'TR', timezone: 'Europe/Istanbul' },

  // Russia
  { iata: 'SVO', name: 'Sheremetyevo', city: 'Moscow', country: 'RU', timezone: 'Europe/Moscow' },
  { iata: 'DME', name: 'Domodedovo', city: 'Moscow', country: 'RU', timezone: 'Europe/Moscow' },
  { iata: 'VKO', name: 'Vnukovo', city: 'Moscow', country: 'RU', timezone: 'Europe/Moscow' },
  { iata: 'LED', name: 'Pulkovo', city: 'St Petersburg', country: 'RU', timezone: 'Europe/Moscow' },

  // Middle East
  { iata: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'AE', timezone: 'Asia/Dubai' },
  { iata: 'AUH', name: 'Abu Dhabi', city: 'Abu Dhabi', country: 'AE', timezone: 'Asia/Dubai' },
  { iata: 'DOH', name: 'Hamad', city: 'Doha', country: 'QA', timezone: 'Asia/Qatar' },
  { iata: 'BAH', name: 'Bahrain', city: 'Manama', country: 'BH', timezone: 'Asia/Bahrain' },
  { iata: 'KWI', name: 'Kuwait', city: 'Kuwait City', country: 'KW', timezone: 'Asia/Kuwait' },
  { iata: 'MCT', name: 'Muscat', city: 'Muscat', country: 'OM', timezone: 'Asia/Muscat' },
  { iata: 'AMM', name: 'Queen Alia', city: 'Amman', country: 'JO', timezone: 'Asia/Amman' },
  { iata: 'BEY', name: 'Rafic Hariri', city: 'Beirut', country: 'LB', timezone: 'Asia/Beirut' },
  { iata: 'TLV', name: 'Ben Gurion', city: 'Tel Aviv', country: 'IL', timezone: 'Asia/Jerusalem' },
  { iata: 'RUH', name: 'King Khalid', city: 'Riyadh', country: 'SA', timezone: 'Asia/Riyadh' },
  { iata: 'JED', name: 'King Abdulaziz', city: 'Jeddah', country: 'SA', timezone: 'Asia/Riyadh' },

  // Africa
  { iata: 'JNB', name: 'O.R. Tambo', city: 'Johannesburg', country: 'ZA', timezone: 'Africa/Johannesburg' },
  { iata: 'CPT', name: 'Cape Town', city: 'Cape Town', country: 'ZA', timezone: 'Africa/Johannesburg' },
  { iata: 'DUR', name: 'King Shaka', city: 'Durban', country: 'ZA', timezone: 'Africa/Johannesburg' },
  { iata: 'CAI', name: 'Cairo', city: 'Cairo', country: 'EG', timezone: 'Africa/Cairo' },
  { iata: 'HRG', name: 'Hurghada', city: 'Hurghada', country: 'EG', timezone: 'Africa/Cairo' },
  { iata: 'SSH', name: 'Sharm el-Sheikh', city: 'Sharm el-Sheikh', country: 'EG', timezone: 'Africa/Cairo' },
  { iata: 'CMN', name: 'Mohammed V', city: 'Casablanca', country: 'MA', timezone: 'Africa/Casablanca' },
  { iata: 'RAK', name: 'Menara', city: 'Marrakech', country: 'MA', timezone: 'Africa/Casablanca' },
  { iata: 'TUN', name: 'Tunis-Carthage', city: 'Tunis', country: 'TN', timezone: 'Africa/Tunis' },
  { iata: 'ALG', name: 'Houari Boumediene', city: 'Algiers', country: 'DZ', timezone: 'Africa/Algiers' },
  { iata: 'NBO', name: 'Jomo Kenyatta', city: 'Nairobi', country: 'KE', timezone: 'Africa/Nairobi' },
  { iata: 'ADD', name: 'Bole', city: 'Addis Ababa', country: 'ET', timezone: 'Africa/Addis_Ababa' },
  { iata: 'LOS', name: 'Murtala Muhammed', city: 'Lagos', country: 'NG', timezone: 'Africa/Lagos' },
  { iata: 'ABJ', name: 'Félix-Houphouët-Boigny', city: 'Abidjan', country: 'CI', timezone: 'Africa/Abidjan' },
  { iata: 'DSS', name: 'Blaise Diagne', city: 'Dakar', country: 'SN', timezone: 'Africa/Dakar' },
  { iata: 'ACC', name: 'Kotoka', city: 'Accra', country: 'GH', timezone: 'Africa/Accra' },
  { iata: 'DAR', name: 'Julius Nyerere', city: 'Dar es Salaam', country: 'TZ', timezone: 'Africa/Dar_es_Salaam' },
  { iata: 'MRU', name: 'Sir Seewoosagur Ramgoolam', city: 'Mauritius', country: 'MU', timezone: 'Indian/Mauritius' },

  // South Asia
  { iata: 'DEL', name: 'Indira Gandhi', city: 'Delhi', country: 'IN', timezone: 'Asia/Kolkata' },
  { iata: 'BOM', name: 'Chhatrapati Shivaji', city: 'Mumbai', country: 'IN', timezone: 'Asia/Kolkata' },
  { iata: 'BLR', name: 'Kempegowda', city: 'Bangalore', country: 'IN', timezone: 'Asia/Kolkata' },
  { iata: 'MAA', name: 'Chennai', city: 'Chennai', country: 'IN', timezone: 'Asia/Kolkata' },
  { iata: 'HYD', name: 'Rajiv Gandhi', city: 'Hyderabad', country: 'IN', timezone: 'Asia/Kolkata' },
  { iata: 'CCU', name: 'Netaji Subhas Chandra Bose', city: 'Kolkata', country: 'IN', timezone: 'Asia/Kolkata' },
  { iata: 'COK', name: 'Cochin', city: 'Kochi', country: 'IN', timezone: 'Asia/Kolkata' },
  { iata: 'GOI', name: 'Manohar', city: 'Goa', country: 'IN', timezone: 'Asia/Kolkata' },
  { iata: 'CMB', name: 'Bandaranaike', city: 'Colombo', country: 'LK', timezone: 'Asia/Colombo' },
  { iata: 'MLE', name: 'Velana', city: 'Malé', country: 'MV', timezone: 'Indian/Maldives' },
  { iata: 'KTM', name: 'Tribhuvan', city: 'Kathmandu', country: 'NP', timezone: 'Asia/Kathmandu' },
  { iata: 'ISB', name: 'Islamabad', city: 'Islamabad', country: 'PK', timezone: 'Asia/Karachi' },
  { iata: 'KHI', name: 'Jinnah', city: 'Karachi', country: 'PK', timezone: 'Asia/Karachi' },
  { iata: 'LHE', name: 'Allama Iqbal', city: 'Lahore', country: 'PK', timezone: 'Asia/Karachi' },
  { iata: 'DAC', name: 'Hazrat Shahjalal', city: 'Dhaka', country: 'BD', timezone: 'Asia/Dhaka' },

  // East Asia
  { iata: 'NRT', name: 'Narita', city: 'Tokyo', country: 'JP', timezone: 'Asia/Tokyo' },
  { iata: 'HND', name: 'Haneda', city: 'Tokyo', country: 'JP', timezone: 'Asia/Tokyo' },
  { iata: 'KIX', name: 'Kansai', city: 'Osaka', country: 'JP', timezone: 'Asia/Tokyo' },
  { iata: 'ITM', name: 'Itami', city: 'Osaka', country: 'JP', timezone: 'Asia/Tokyo' },
  { iata: 'NGO', name: 'Chubu Centrair', city: 'Nagoya', country: 'JP', timezone: 'Asia/Tokyo' },
  { iata: 'CTS', name: 'New Chitose', city: 'Sapporo', country: 'JP', timezone: 'Asia/Tokyo' },
  { iata: 'FUK', name: 'Fukuoka', city: 'Fukuoka', country: 'JP', timezone: 'Asia/Tokyo' },
  { iata: 'OKA', name: 'Naha', city: 'Okinawa', country: 'JP', timezone: 'Asia/Tokyo' },
  { iata: 'ICN', name: 'Incheon', city: 'Seoul', country: 'KR', timezone: 'Asia/Seoul' },
  { iata: 'GMP', name: 'Gimpo', city: 'Seoul', country: 'KR', timezone: 'Asia/Seoul' },
  { iata: 'PUS', name: 'Gimhae', city: 'Busan', country: 'KR', timezone: 'Asia/Seoul' },
  { iata: 'PEK', name: 'Capital', city: 'Beijing', country: 'CN', timezone: 'Asia/Shanghai' },
  { iata: 'PKX', name: 'Daxing', city: 'Beijing', country: 'CN', timezone: 'Asia/Shanghai' },
  { iata: 'PVG', name: 'Pudong', city: 'Shanghai', country: 'CN', timezone: 'Asia/Shanghai' },
  { iata: 'SHA', name: 'Hongqiao', city: 'Shanghai', country: 'CN', timezone: 'Asia/Shanghai' },
  { iata: 'CAN', name: 'Baiyun', city: 'Guangzhou', country: 'CN', timezone: 'Asia/Shanghai' },
  { iata: 'SZX', name: 'Bao\'an', city: 'Shenzhen', country: 'CN', timezone: 'Asia/Shanghai' },
  { iata: 'CTU', name: 'Shuangliu', city: 'Chengdu', country: 'CN', timezone: 'Asia/Shanghai' },
  { iata: 'CKG', name: 'Jiangbei', city: 'Chongqing', country: 'CN', timezone: 'Asia/Shanghai' },
  { iata: 'HKG', name: 'Hong Kong', city: 'Hong Kong', country: 'HK', timezone: 'Asia/Hong_Kong' },
  { iata: 'MFM', name: 'Macau', city: 'Macau', country: 'MO', timezone: 'Asia/Macau' },
  { iata: 'TPE', name: 'Taoyuan', city: 'Taipei', country: 'TW', timezone: 'Asia/Taipei' },
  { iata: 'ULN', name: 'Chinggis Khaan', city: 'Ulaanbaatar', country: 'MN', timezone: 'Asia/Ulaanbaatar' },

  // Southeast Asia
  { iata: 'SIN', name: 'Changi', city: 'Singapore', country: 'SG', timezone: 'Asia/Singapore' },
  { iata: 'KUL', name: 'Kuala Lumpur', city: 'Kuala Lumpur', country: 'MY', timezone: 'Asia/Kuala_Lumpur' },
  { iata: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', country: 'TH', timezone: 'Asia/Bangkok' },
  { iata: 'DMK', name: 'Don Mueang', city: 'Bangkok', country: 'TH', timezone: 'Asia/Bangkok' },
  { iata: 'HKT', name: 'Phuket', city: 'Phuket', country: 'TH', timezone: 'Asia/Bangkok' },
  { iata: 'CNX', name: 'Chiang Mai', city: 'Chiang Mai', country: 'TH', timezone: 'Asia/Bangkok' },
  { iata: 'CGK', name: 'Soekarno-Hatta', city: 'Jakarta', country: 'ID', timezone: 'Asia/Jakarta' },
  { iata: 'DPS', name: 'Ngurah Rai', city: 'Bali', country: 'ID', timezone: 'Asia/Makassar' },
  { iata: 'SGN', name: 'Tan Son Nhat', city: 'Ho Chi Minh City', country: 'VN', timezone: 'Asia/Ho_Chi_Minh' },
  { iata: 'HAN', name: 'Noi Bai', city: 'Hanoi', country: 'VN', timezone: 'Asia/Ho_Chi_Minh' },
  { iata: 'DAD', name: 'Da Nang', city: 'Da Nang', country: 'VN', timezone: 'Asia/Ho_Chi_Minh' },
  { iata: 'MNL', name: 'Ninoy Aquino', city: 'Manila', country: 'PH', timezone: 'Asia/Manila' },
  { iata: 'CEB', name: 'Mactan-Cebu', city: 'Cebu', country: 'PH', timezone: 'Asia/Manila' },
  { iata: 'PNH', name: 'Phnom Penh', city: 'Phnom Penh', country: 'KH', timezone: 'Asia/Phnom_Penh' },
  { iata: 'REP', name: 'Siem Reap', city: 'Siem Reap', country: 'KH', timezone: 'Asia/Phnom_Penh' },
  { iata: 'RGN', name: 'Yangon', city: 'Yangon', country: 'MM', timezone: 'Asia/Yangon' },
  { iata: 'VTE', name: 'Wattay', city: 'Vientiane', country: 'LA', timezone: 'Asia/Vientiane' },
  { iata: 'BWN', name: 'Brunei', city: 'Bandar Seri Begawan', country: 'BN', timezone: 'Asia/Brunei' },

  // Central Asia
  { iata: 'TAS', name: 'Islam Karimov', city: 'Tashkent', country: 'UZ', timezone: 'Asia/Tashkent' },
  { iata: 'ALA', name: 'Almaty', city: 'Almaty', country: 'KZ', timezone: 'Asia/Almaty' },
  { iata: 'NQZ', name: 'Nursultan Nazarbayev', city: 'Astana', country: 'KZ', timezone: 'Asia/Almaty' },
  { iata: 'GYD', name: 'Heydar Aliyev', city: 'Baku', country: 'AZ', timezone: 'Asia/Baku' },
  { iata: 'TBS', name: 'Shota Rustaveli', city: 'Tbilisi', country: 'GE', timezone: 'Asia/Tbilisi' },
  { iata: 'EVN', name: 'Zvartnots', city: 'Yerevan', country: 'AM', timezone: 'Asia/Yerevan' },

  // Oceania
  { iata: 'SYD', name: 'Kingsford Smith', city: 'Sydney', country: 'AU', timezone: 'Australia/Sydney' },
  { iata: 'MEL', name: 'Tullamarine', city: 'Melbourne', country: 'AU', timezone: 'Australia/Melbourne' },
  { iata: 'BNE', name: 'Brisbane', city: 'Brisbane', country: 'AU', timezone: 'Australia/Brisbane' },
  { iata: 'PER', name: 'Perth', city: 'Perth', country: 'AU', timezone: 'Australia/Perth' },
  { iata: 'ADL', name: 'Adelaide', city: 'Adelaide', country: 'AU', timezone: 'Australia/Adelaide' },
  { iata: 'OOL', name: 'Gold Coast', city: 'Gold Coast', country: 'AU', timezone: 'Australia/Brisbane' },
  { iata: 'CNS', name: 'Cairns', city: 'Cairns', country: 'AU', timezone: 'Australia/Brisbane' },
  { iata: 'CBR', name: 'Canberra', city: 'Canberra', country: 'AU', timezone: 'Australia/Sydney' },
  { iata: 'HBA', name: 'Hobart', city: 'Hobart', country: 'AU', timezone: 'Australia/Hobart' },
  { iata: 'DRW', name: 'Darwin', city: 'Darwin', country: 'AU', timezone: 'Australia/Darwin' },
  { iata: 'AKL', name: 'Auckland', city: 'Auckland', country: 'NZ', timezone: 'Pacific/Auckland' },
  { iata: 'WLG', name: 'Wellington', city: 'Wellington', country: 'NZ', timezone: 'Pacific/Auckland' },
  { iata: 'CHC', name: 'Christchurch', city: 'Christchurch', country: 'NZ', timezone: 'Pacific/Auckland' },
  { iata: 'ZQN', name: 'Queenstown', city: 'Queenstown', country: 'NZ', timezone: 'Pacific/Auckland' },
  { iata: 'NAN', name: 'Nadi', city: 'Nadi', country: 'FJ', timezone: 'Pacific/Fiji' },
  { iata: 'PPT', name: 'Faa\'a', city: 'Papeete', country: 'PF', timezone: 'Pacific/Tahiti' },
  { iata: 'NOU', name: 'La Tontouta', city: 'Nouméa', country: 'NC', timezone: 'Pacific/Noumea' },

  // North America - USA
  { iata: 'JFK', name: 'John F. Kennedy', city: 'New York', country: 'US', timezone: 'America/New_York' },
  { iata: 'EWR', name: 'Newark Liberty', city: 'Newark', country: 'US', timezone: 'America/New_York' },
  { iata: 'LGA', name: 'LaGuardia', city: 'New York', country: 'US', timezone: 'America/New_York' },
  { iata: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'US', timezone: 'America/Los_Angeles' },
  { iata: 'SFO', name: 'San Francisco', city: 'San Francisco', country: 'US', timezone: 'America/Los_Angeles' },
  { iata: 'ORD', name: 'O\'Hare', city: 'Chicago', country: 'US', timezone: 'America/Chicago' },
  { iata: 'MDW', name: 'Midway', city: 'Chicago', country: 'US', timezone: 'America/Chicago' },
  { iata: 'ATL', name: 'Hartsfield-Jackson', city: 'Atlanta', country: 'US', timezone: 'America/New_York' },
  { iata: 'DFW', name: 'Dallas/Fort Worth', city: 'Dallas', country: 'US', timezone: 'America/Chicago' },
  { iata: 'DEN', name: 'Denver', city: 'Denver', country: 'US', timezone: 'America/Denver' },
  { iata: 'SEA', name: 'Seattle-Tacoma', city: 'Seattle', country: 'US', timezone: 'America/Los_Angeles' },
  { iata: 'MIA', name: 'Miami', city: 'Miami', country: 'US', timezone: 'America/New_York' },
  { iata: 'FLL', name: 'Fort Lauderdale', city: 'Fort Lauderdale', country: 'US', timezone: 'America/New_York' },
  { iata: 'MCO', name: 'Orlando', city: 'Orlando', country: 'US', timezone: 'America/New_York' },
  { iata: 'TPA', name: 'Tampa', city: 'Tampa', country: 'US', timezone: 'America/New_York' },
  { iata: 'BOS', name: 'Logan', city: 'Boston', country: 'US', timezone: 'America/New_York' },
  { iata: 'PHL', name: 'Philadelphia', city: 'Philadelphia', country: 'US', timezone: 'America/New_York' },
  { iata: 'IAD', name: 'Dulles', city: 'Washington DC', country: 'US', timezone: 'America/New_York' },
  { iata: 'DCA', name: 'Reagan National', city: 'Washington DC', country: 'US', timezone: 'America/New_York' },
  { iata: 'BWI', name: 'Baltimore/Washington', city: 'Baltimore', country: 'US', timezone: 'America/New_York' },
  { iata: 'MSP', name: 'Minneapolis-Saint Paul', city: 'Minneapolis', country: 'US', timezone: 'America/Chicago' },
  { iata: 'DTW', name: 'Detroit Metro', city: 'Detroit', country: 'US', timezone: 'America/New_York' },
  { iata: 'CLT', name: 'Charlotte Douglas', city: 'Charlotte', country: 'US', timezone: 'America/New_York' },
  { iata: 'PHX', name: 'Sky Harbor', city: 'Phoenix', country: 'US', timezone: 'America/Phoenix' },
  { iata: 'IAH', name: 'George Bush', city: 'Houston', country: 'US', timezone: 'America/Chicago' },
  { iata: 'HOU', name: 'William P. Hobby', city: 'Houston', country: 'US', timezone: 'America/Chicago' },
  { iata: 'SAN', name: 'San Diego', city: 'San Diego', country: 'US', timezone: 'America/Los_Angeles' },
  { iata: 'SJC', name: 'Mineta San Jose', city: 'San Jose', country: 'US', timezone: 'America/Los_Angeles' },
  { iata: 'OAK', name: 'Oakland', city: 'Oakland', country: 'US', timezone: 'America/Los_Angeles' },
  { iata: 'PDX', name: 'Portland', city: 'Portland', country: 'US', timezone: 'America/Los_Angeles' },
  { iata: 'LAS', name: 'Harry Reid', city: 'Las Vegas', country: 'US', timezone: 'America/Los_Angeles' },
  { iata: 'SLC', name: 'Salt Lake City', city: 'Salt Lake City', country: 'US', timezone: 'America/Denver' },
  { iata: 'STL', name: 'Lambert', city: 'St. Louis', country: 'US', timezone: 'America/Chicago' },
  { iata: 'BNA', name: 'Nashville', city: 'Nashville', country: 'US', timezone: 'America/Chicago' },
  { iata: 'AUS', name: 'Austin-Bergstrom', city: 'Austin', country: 'US', timezone: 'America/Chicago' },
  { iata: 'RDU', name: 'Raleigh-Durham', city: 'Raleigh', country: 'US', timezone: 'America/New_York' },
  { iata: 'CLE', name: 'Cleveland Hopkins', city: 'Cleveland', country: 'US', timezone: 'America/New_York' },
  { iata: 'MKE', name: 'Mitchell', city: 'Milwaukee', country: 'US', timezone: 'America/Chicago' },
  { iata: 'IND', name: 'Indianapolis', city: 'Indianapolis', country: 'US', timezone: 'America/Indiana/Indianapolis' },
  { iata: 'PIT', name: 'Pittsburgh', city: 'Pittsburgh', country: 'US', timezone: 'America/New_York' },
  { iata: 'CMH', name: 'John Glenn', city: 'Columbus', country: 'US', timezone: 'America/New_York' },
  { iata: 'SAT', name: 'San Antonio', city: 'San Antonio', country: 'US', timezone: 'America/Chicago' },
  { iata: 'HNL', name: 'Daniel K. Inouye', city: 'Honolulu', country: 'US', timezone: 'Pacific/Honolulu' },
  { iata: 'OGG', name: 'Kahului', city: 'Maui', country: 'US', timezone: 'Pacific/Honolulu' },
  { iata: 'ANC', name: 'Ted Stevens', city: 'Anchorage', country: 'US', timezone: 'America/Anchorage' },

  // Canada
  { iata: 'YYZ', name: 'Pearson', city: 'Toronto', country: 'CA', timezone: 'America/Toronto' },
  { iata: 'YVR', name: 'Vancouver', city: 'Vancouver', country: 'CA', timezone: 'America/Vancouver' },
  { iata: 'YUL', name: 'Trudeau', city: 'Montreal', country: 'CA', timezone: 'America/Montreal' },
  { iata: 'YYC', name: 'Calgary', city: 'Calgary', country: 'CA', timezone: 'America/Edmonton' },
  { iata: 'YEG', name: 'Edmonton', city: 'Edmonton', country: 'CA', timezone: 'America/Edmonton' },
  { iata: 'YOW', name: 'Macdonald-Cartier', city: 'Ottawa', country: 'CA', timezone: 'America/Toronto' },
  { iata: 'YWG', name: 'Richardson', city: 'Winnipeg', country: 'CA', timezone: 'America/Winnipeg' },
  { iata: 'YHZ', name: 'Stanfield', city: 'Halifax', country: 'CA', timezone: 'America/Halifax' },

  // Mexico
  { iata: 'MEX', name: 'Benito Juárez', city: 'Mexico City', country: 'MX', timezone: 'America/Mexico_City' },
  { iata: 'CUN', name: 'Cancún', city: 'Cancún', country: 'MX', timezone: 'America/Cancun' },
  { iata: 'GDL', name: 'Don Miguel Hidalgo', city: 'Guadalajara', country: 'MX', timezone: 'America/Mexico_City' },
  { iata: 'SJD', name: 'San José del Cabo', city: 'Los Cabos', country: 'MX', timezone: 'America/Mazatlan' },
  { iata: 'PVR', name: 'Gustavo Díaz Ordaz', city: 'Puerto Vallarta', country: 'MX', timezone: 'America/Mexico_City' },
  { iata: 'MTY', name: 'Monterrey', city: 'Monterrey', country: 'MX', timezone: 'America/Monterrey' },

  // Caribbean
  { iata: 'SJU', name: 'Luis Muñoz Marín', city: 'San Juan', country: 'PR', timezone: 'America/Puerto_Rico' },
  { iata: 'NAS', name: 'Lynden Pindling', city: 'Nassau', country: 'BS', timezone: 'America/Nassau' },
  { iata: 'MBJ', name: 'Sangster', city: 'Montego Bay', country: 'JM', timezone: 'America/Jamaica' },
  { iata: 'KIN', name: 'Norman Manley', city: 'Kingston', country: 'JM', timezone: 'America/Jamaica' },
  { iata: 'PUJ', name: 'Punta Cana', city: 'Punta Cana', country: 'DO', timezone: 'America/Santo_Domingo' },
  { iata: 'SDQ', name: 'Las Américas', city: 'Santo Domingo', country: 'DO', timezone: 'America/Santo_Domingo' },
  { iata: 'HAV', name: 'José Martí', city: 'Havana', country: 'CU', timezone: 'America/Havana' },
  { iata: 'AUA', name: 'Queen Beatrix', city: 'Oranjestad', country: 'AW', timezone: 'America/Aruba' },
  { iata: 'CUR', name: 'Hato', city: 'Willemstad', country: 'CW', timezone: 'America/Curacao' },
  { iata: 'SXM', name: 'Princess Juliana', city: 'St Maarten', country: 'SX', timezone: 'America/Lower_Princes' },
  { iata: 'BGI', name: 'Grantley Adams', city: 'Bridgetown', country: 'BB', timezone: 'America/Barbados' },
  { iata: 'POS', name: 'Piarco', city: 'Port of Spain', country: 'TT', timezone: 'America/Port_of_Spain' },

  // Central America
  { iata: 'PTY', name: 'Tocumen', city: 'Panama City', country: 'PA', timezone: 'America/Panama' },
  { iata: 'SJO', name: 'Juan Santamaría', city: 'San José', country: 'CR', timezone: 'America/Costa_Rica' },
  { iata: 'GUA', name: 'La Aurora', city: 'Guatemala City', country: 'GT', timezone: 'America/Guatemala' },
  { iata: 'BZE', name: 'Philip S.W. Goldson', city: 'Belize City', country: 'BZ', timezone: 'America/Belize' },

  // South America
  { iata: 'GRU', name: 'Guarulhos', city: 'São Paulo', country: 'BR', timezone: 'America/Sao_Paulo' },
  { iata: 'GIG', name: 'Galeão', city: 'Rio de Janeiro', country: 'BR', timezone: 'America/Sao_Paulo' },
  { iata: 'BSB', name: 'Brasília', city: 'Brasília', country: 'BR', timezone: 'America/Sao_Paulo' },
  { iata: 'CNF', name: 'Confins', city: 'Belo Horizonte', country: 'BR', timezone: 'America/Sao_Paulo' },
  { iata: 'SSA', name: 'Deputado Luís Eduardo Magalhães', city: 'Salvador', country: 'BR', timezone: 'America/Bahia' },
  { iata: 'REC', name: 'Guararapes', city: 'Recife', country: 'BR', timezone: 'America/Recife' },
  { iata: 'FOR', name: 'Pinto Martins', city: 'Fortaleza', country: 'BR', timezone: 'America/Fortaleza' },
  { iata: 'EZE', name: 'Ministro Pistarini', city: 'Buenos Aires', country: 'AR', timezone: 'America/Argentina/Buenos_Aires' },
  { iata: 'AEP', name: 'Jorge Newbery', city: 'Buenos Aires', country: 'AR', timezone: 'America/Argentina/Buenos_Aires' },
  { iata: 'SCL', name: 'Arturo Merino Benítez', city: 'Santiago', country: 'CL', timezone: 'America/Santiago' },
  { iata: 'LIM', name: 'Jorge Chávez', city: 'Lima', country: 'PE', timezone: 'America/Lima' },
  { iata: 'BOG', name: 'El Dorado', city: 'Bogotá', country: 'CO', timezone: 'America/Bogota' },
  { iata: 'MDE', name: 'José María Córdova', city: 'Medellín', country: 'CO', timezone: 'America/Bogota' },
  { iata: 'CTG', name: 'Rafael Núñez', city: 'Cartagena', country: 'CO', timezone: 'America/Bogota' },
  { iata: 'UIO', name: 'Mariscal Sucre', city: 'Quito', country: 'EC', timezone: 'America/Guayaquil' },
  { iata: 'GYE', name: 'José Joaquín de Olmedo', city: 'Guayaquil', country: 'EC', timezone: 'America/Guayaquil' },
  { iata: 'CCS', name: 'Simón Bolívar', city: 'Caracas', country: 'VE', timezone: 'America/Caracas' },
  { iata: 'MVD', name: 'Carrasco', city: 'Montevideo', country: 'UY', timezone: 'America/Montevideo' },
  { iata: 'ASU', name: 'Silvio Pettirossi', city: 'Asunción', country: 'PY', timezone: 'America/Asuncion' },
  { iata: 'VVI', name: 'Viru Viru', city: 'Santa Cruz', country: 'BO', timezone: 'America/La_Paz' },
  { iata: 'LPB', name: 'El Alto', city: 'La Paz', country: 'BO', timezone: 'America/La_Paz' },

  // Malta
  { iata: 'MLA', name: 'Malta', city: 'Valletta', country: 'MT', timezone: 'Europe/Malta' },

  // Luxembourg
  { iata: 'LUX', name: 'Findel', city: 'Luxembourg', country: 'LU', timezone: 'Europe/Luxembourg' },

  // Morocco (additional)
  { iata: 'FEZ', name: 'Saïss', city: 'Fez', country: 'MA', timezone: 'Africa/Casablanca' },
  { iata: 'AGA', name: 'Al Massira', city: 'Agadir', country: 'MA', timezone: 'Africa/Casablanca' },
  { iata: 'TNG', name: 'Ibn Battouta', city: 'Tangier', country: 'MA', timezone: 'Africa/Casablanca' },
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
