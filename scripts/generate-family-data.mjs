import { writeFileSync, mkdirSync } from 'node:fs';

const allSeasons = ['primavera', 'estiu', 'tardor', 'hivern'];
const recipe = (id, title, category, time, tags, ingredients, steps, options = {}) => ({
  id, title, category,
  season: options.season || allSeasons,
  time,
  difficulty: options.difficulty || 'Fàcil',
  servings: options.servings || 4,
  tags,
  image: `assets/images/recipes/${id}.jpg`,
  ingredients: ingredients.map(ingredient => ({ ingredient, amount: '', unit: '' })),
  steps,
  allergens: options.allergens || [],
  babyNotes: options.babyNotes || 'Separa la ració infantil abans de salar i adapta la textura i la mida dels trossos.',
  variations: options.variations || [],
  pairings: options.pairings || []
});

const recipes = [
  recipe('pasta-bolonyesa', 'Pasta bolonyesa', 'pasta', 35, ['pasta', 'carn'], ['pasta', 'carn picada', 'tomàquet', 'ceba', 'pastanaga'], ['Fes un sofregit amb la ceba i la pastanaga.', 'Daurar la carn, afegeix el tomàquet i cuina 20 minuts.', 'Bull la pasta i barreja-la amb la salsa.'], { pairings: ['tomates-huerto'] }),
  recipe('pasta-carbonara', 'Pasta carbonara', 'pasta', 25, ['pasta', 'carn'], ['pasta', 'ou', 'formatge curat', 'cansalada'], ['Daurar la cansalada sense afegir oli.', 'Barreja els ous amb el formatge.', 'Integra la pasta calenta fora del foc fins que quedi cremosa.'], { allergens: ['gluten', 'ou', 'lactis'] }),
  recipe('pasta-alberginia-olives', 'Pasta amb albergínia i olives negres', 'pasta', 30, ['pasta', 'vegetarià', 'de temporada'], ['pasta', 'albergínia', 'olives negres', 'tomàquet', 'all'], ['Daurar l’albergínia a daus amb oli i all.', 'Afegeix tomàquet i olives i cuina 12 minuts.', 'Barreja amb la pasta acabada de bullir.'], { season: ['estiu', 'tardor'] }),
  recipe('amanida-pasta', 'Amanida de pasta amb tonyina', 'amanides', 20, ['pasta', 'peix'], ['pasta curta', 'tonyina', 'ou', 'tomàquets cherry', 'olives verdes'], ['Bull la pasta i refreda-la.', 'Cou els ous i talla tots els ingredients.', 'Barreja i amaneix just abans de servir.'], { allergens: ['gluten', 'ou', 'peix'] }),
  recipe('ensaladilla-russa', 'Ensaladilla russa', 'amanides', 35, ['peix'], ['patata', 'pastanaga', 'pèsols', 'tonyina', 'ou', 'maionesa'], ['Cou les verdures fins que siguin tendres.', 'Refreda-les i barreja-les amb la tonyina i l’ou.', 'Incorpora la maionesa i reserva en fred.'], { allergens: ['ou', 'peix'] }),
  recipe('ensaladilla-tonyina', 'Ensaladilla de tonyina, ou i olives', 'amanides', 15, ['peix'], ['tonyina', 'ou', 'olives verdes', 'maionesa'], ['Cou i pica els ous.', 'Escorre la tonyina i talla les olives.', 'Barreja-ho tot amb la maionesa i refreda.'], { allergens: ['ou', 'peix'] }),
  recipe('amanida-cigrons', 'Amanida fresca de cigrons', 'amanides', 15, ['llegums', 'peix'], ['cigrons cuits', 'remolatxa', 'pastanaga', 'olives', 'tomàquet', 'tonyina'], ['Esbandeix i escorre els cigrons.', 'Talla les hortalisses a daus.', 'Barreja, amaneix i afegeix la tonyina.']),
  recipe('amanida-llenties', 'Amanida fresca de llenties', 'amanides', 15, ['llegums', 'peix'], ['llenties cuites', 'remolatxa', 'pastanaga', 'olives', 'tomàquet', 'tonyina'], ['Esbandeix i escorre les llenties.', 'Talla les hortalisses a daus petits.', 'Barreja i amaneix amb oli i vinagre.']),
  recipe('amanida-quinoa', 'Amanida fresca de quinoa', 'amanides', 25, ['vegetarià', 'de temporada'], ['quinoa', 'remolatxa', 'pastanaga', 'olives', 'tomàquet'], ['Renta i cou la quinoa.', 'Deixa-la refredar completament.', 'Barreja amb les hortalisses i amaneix.']),
  recipe('llenties-xorico', 'Llenties amb xoriço', 'llegums', 50, ['llegums', 'carn'], ['llenties', 'xoriço', 'ceba', 'pastanaga', 'tomàquet'], ['Fes un sofregit amb les verdures.', 'Afegeix les llenties, el xoriço i aigua.', 'Cou a foc suau fins que les llenties siguin tendres.']),
  recipe('caldo-pollastre', 'Caldo de pollastre', 'cremes', 75, ['carn'], ['pollastre', 'verdures per al brou', 'galets', 'pilota opcional'], ['Posa el pollastre i les verdures en aigua freda.', 'Cou a foc suau, escumant el brou.', 'Cola i serveix amb galets, pollastre o pilota.'], { season: ['tardor', 'hivern', 'primavera'], variations: ['Amb pilota', 'Amb pollastre esmicolat', 'Amb galets', 'Només brou'] }),
  recipe('botifarra-remendada', 'Botifarra remenada amb ou, patata i porro', 'catalana', 35, ['carn'], ['botifarra', 'ous', 'patata', 'porro'], ['Daurar la patata a daus i el porro.', 'Afegeix la botifarra esmicolada.', 'Incorpora els ous i remena fins al punt desitjat.'], { allergens: ['ou'] }),
  recipe('truita-patata', 'Truita de patata', 'ous', 40, ['vegetarià'], ['patates', 'ous', 'ceba opcional', 'oli d’oliva'], ['Confita la patata i la ceba a foc mitjà.', 'Escorre i barreja amb els ous batuts.', 'Qualla la truita pels dos costats, deixant-la sucosa.'], { difficulty: 'Mitjana', allergens: ['ou'], variations: ['Amb ceba', 'Sense ceba'] }),
  recipe('truita-verdures', 'Truita de verdures', 'ous', 25, ['vegetarià', 'de temporada'], ['ous', 'verdures de temporada', 'oli d’oliva'], ['Salta les verdures tallades petites.', 'Afegeix-les als ous batuts.', 'Qualla la truita pels dos costats.'], { allergens: ['ou'] }),
  recipe('paella-pollastre', 'Paella de pollastre', 'arròs', 55, ['arròs', 'carn'], ['arròs', 'pollastre', 'mongeta verda', 'tomàquet', 'brou'], ['Daurar el pollastre i la mongeta.', 'Fes el sofregit i afegeix el brou.', 'Incorpora l’arròs i cou sense remenar.'], { difficulty: 'Mitjana' }),
  recipe('paella-bolets', 'Paella de bolets', 'arròs', 50, ['arròs', 'vegetarià', 'de temporada'], ['arròs', 'bolets variats', 'ceba', 'tomàquet', 'brou vegetal'], ['Salta els bolets i reserva’n una part.', 'Prepara un sofregit i afegeix el brou.', 'Cou l’arròs i acaba amb els bolets reservats.'], { season: ['tardor', 'hivern'], difficulty: 'Mitjana' }),
  recipe('fideua-sepia', 'Fideuà amb sèpia', 'pasta', 45, ['pasta', 'peix'], ['fideus', 'sèpia', 'tomàquet', 'all', 'brou de peix'], ['Daurar la sèpia i prepara el sofregit.', 'Torra lleugerament els fideus.', 'Afegeix el brou i cou fins que els fideus quedin al punt.'], { difficulty: 'Mitjana', allergens: ['gluten', 'mol·luscs'] }),
  recipe('hummus', 'Hummus casolà', 'llegums', 10, ['llegums', 'vegetarià'], ['cigrons cuits', 'tahina', 'llimona', 'all', 'oli d’oliva'], ['Tritura tots els ingredients.', 'Ajusta la textura amb aigua freda.', 'Serveix amb un raig d’oli.'], { allergens: ['sèsam'], pairings: ['calabacin-llimona', 'tomates-huerto'] }),
  recipe('salmo-planxa', 'Salmó a la planxa', 'peix', 15, ['peix'], ['lloms de salmó', 'oli d’oliva', 'llimona'], ['Asseca i tempera el salmó.', 'Cuina’l primer per la pell en una planxa calenta.', 'Gira’l breument i acaba amb llimona.'], { pairings: ['patata-boniato-forn', 'calabacin-llimona'] }),
  recipe('lluc-planxa', 'Lluç a la planxa', 'peix', 15, ['peix'], ['filets de lluç', 'oli d’oliva', 'all', 'julivert'], ['Asseca bé el peix.', 'Cuina’l en una planxa calenta pels dos costats.', 'Acaba amb all, julivert i oli.'], { pairings: ['tomates-huerto', 'patata-boniato-forn'] }),
  recipe('orada-planxa', 'Orada a la planxa', 'peix', 18, ['peix'], ['filets d’orada', 'oli d’oliva', 'llimona'], ['Asseca i sala lleugerament els filets.', 'Cuina’ls primer per la pell.', 'Gira’ls i acaba amb unes gotes de llimona.']),
  recipe('patata-boniato-forn', 'Patates i moniato al forn', 'acompanyaments', 40, ['vegetarià'], ['patates', 'moniato opcional', 'oli d’oliva', 'herbes'], ['Talla la patata i el moniato a grills.', 'Amaneix amb oli i herbes.', 'Enforna fins que quedin daurats.'], { variations: ['Només patata', 'Patata i moniato'], pairings: ['salmo-planxa', 'lluc-planxa', 'pollastre-planxa'] }),
  recipe('orada-forn', 'Orada al forn', 'forn', 40, ['peix'], ['orada sencera', 'patata', 'ceba', 'llimona'], ['Precuina la patata i la ceba al forn.', 'Posa l’orada al damunt amb la llimona.', 'Enforna fins que el peix sigui sucós.'], { pairings: ['tomates-huerto'] }),
  recipe('aletes-forn', 'Aletes de pollastre al forn', 'forn', 45, ['carn'], ['aletes de pollastre', 'llimona', 'pebre vermell', 'oli d’oliva'], ['Amaneix les aletes i deixa-les reposar.', 'Enforna-les girant-les a mitja cocció.', 'Acaba amb uns minuts de gratinador.']),
  recipe('cuixes-pollastre', 'Cuixes de pollastre a la brasa o al forn', 'carn', 45, ['carn'], ['cuixes de pollastre', 'llimona', 'herbes', 'oli d’oliva'], ['Amaneix les cuixes amb llimona i herbes.', 'Cuina-les a la brasa o al forn.', 'Deixa-les reposar abans de servir.'], { variations: ['A la brasa', 'Al forn'] }),
  recipe('pollastre-planxa', 'Pit de pollastre a la planxa', 'carn', 15, ['carn'], ['pit de pollastre', 'oli d’oliva', 'llimona', 'herbes'], ['Talla el pit a filets regulars.', 'Cuina’l a la planxa ben calenta.', 'Acaba amb llimona i herbes.'], { pairings: ['calabacin-llimona', 'tomates-huerto'] }),
  recipe('pizza-casolana', 'Pizza casolana', 'pizza', 35, ['vegetarià'], ['massa de pizza', 'tomàquet', 'mozzarella', 'ingredients al gust'], ['Estira la massa i reparteix el tomàquet.', 'Afegeix formatge i els ingredients escollits.', 'Enforna a temperatura alta fins que quedi cruixent.'], { allergens: ['gluten', 'lactis'], variations: ['Verdures', 'Pernil i formatge', 'Tonyina i olives'] }),
  recipe('bikini', 'Bikini de pernil i formatge', 'entrepans', 10, ['carn'], ['pa de motlle', 'pernil dolç', 'formatge', 'mantega opcional'], ['Munta l’entrepà amb pernil i formatge.', 'Torra’l a la planxa pels dos costats.', 'Serveix-lo calent i cruixent.'], { allergens: ['gluten', 'lactis'] }),
  recipe('pernil-iberic', 'Pernil ibèric amb pa amb tomàquet', 'entrepans', 10, ['carn', 'de temporada'], ['pernil ibèric', 'pa de pagès', 'tomàquet', 'oli d’oliva'], ['Torra lleugerament el pa.', 'Frega’l amb tomàquet i afegeix oli.', 'Serveix amb el pernil a temperatura ambient.'], { season: ['tardor', 'hivern', 'primavera'], allergens: ['gluten'] }),
  recipe('calabacin-llimona', 'Daus de carbassó a la llimona', 'acompanyaments', 12, ['vegetarià', 'de temporada'], ['carbassó', 'llimona', 'oli d’oliva', 'pebre'], ['Talla el carbassó a daus.', 'Salta’l a foc viu perquè quedi daurat.', 'Acaba amb suc i ratlladura de llimona.'], { season: ['primavera', 'estiu', 'tardor'] }),
  recipe('tomates-huerto', 'Tomàquets de l’hort amanits', 'acompanyaments', 5, ['vegetarià', 'de temporada'], ['tomàquets de l’hort', 'oli d’oliva', 'sal'], ['Talla els tomàquets just abans de menjar.', 'Amaneix-los amb oli d’oliva.', 'Serveix-los sols o com a acompanyament.'], { season: ['estiu'] }),
  recipe('arros-cubana', 'Arròs a la cubana, sense plàtan', 'arròs', 25, ['arròs', 'vegetarià'], ['arròs blanc', 'tomàquet fregit', 'ous'], ['Bull l’arròs i escorre’l.', 'Escalfa el tomàquet a foc suau.', 'Serveix amb un ou ferrat, sense plàtan.'], { allergens: ['ou'] }),
  recipe('ous-estrellats', 'Ous estrellats amb pernil o xoriço', 'ous', 30, ['carn'], ['patates', 'ous', 'pernil ibèric o xoriço'], ['Fregir o rostir les patates.', 'Cuina els ous deixant el rovell líquid.', 'Posa’ls sobre les patates, afegeix pernil o xoriço i trenca’ls.'], { allergens: ['ou'], variations: ['Amb pernil', 'Amb xoriço'] }),
  recipe('ous-farcits', 'Ous farcits de tonyina', 'ous', 25, ['peix'], ['ous', 'tonyina', 'maionesa', 'olives'], ['Cou els ous, refreda’ls i talla’ls.', 'Barreja els rovells amb tonyina i maionesa.', 'Farcir les clares i reserva en fred.'], { allergens: ['ou', 'peix'] }),
  recipe('hamburguesa', 'Hamburguesa casolana', 'carn', 25, ['carn'], ['carn picada', 'pa d’hamburguesa', 'formatge opcional', 'tomàquet', 'enciam'], ['Forma les hamburgueses sense compactar massa.', 'Cuina-les a la planxa.', 'Munta-les amb els acompanyaments escollits.'], { allergens: ['gluten'], variations: ['Al plat', 'Amb pa i formatge'] }),
  recipe('seques-botifarra', 'Seques amb botifarra i ou ferrat', 'catalana', 35, ['llegums', 'carn'], ['mongetes seques cuites', 'botifarra', 'ous', 'all', 'julivert'], ['Salta les mongetes amb all i julivert.', 'Cuina la botifarra a la planxa.', 'Completa el plat amb un ou ferrat.'], { allergens: ['ou'] }),
  recipe('alberginies-farcides', 'Albergínies farcides', 'forn', 55, ['carn', 'de temporada'], ['albergínies', 'carn picada', 'ceba', 'tomàquet', 'formatge'], ['Rosteix les albergínies partides.', 'Buida-les i barreja la polpa amb el sofregit i la carn.', 'Farcir, cobrir amb formatge i gratinar.'], { season: ['estiu', 'tardor'], allergens: ['lactis'] }),
  recipe('croquetes-pollastre', 'Croquetes casolanes de pollastre', 'catalana', 60, ['carn'], ['pollastre rostit', 'llet', 'farina', 'mantega', 'ou', 'pa ratllat'], ['Prepara una beixamel espessa amb el pollastre picat.', 'Refreda la massa, forma les croquetes i arrebossa-les.', 'Fregir fins que quedin daurades.'], { difficulty: 'Mitjana', allergens: ['gluten', 'ou', 'lactis'] }),
  recipe('crema-verdures', 'Crema suau de verdures', 'cremes', 35, ['vegetarià', 'BLW', 'de temporada'], ['verdures de temporada', 'patata', 'porro', 'oli d’oliva'], ['Talla i sofregeix lleugerament les verdures.', 'Cobreix amb aigua i cou fins que siguin tendres.', 'Tritura fins a obtenir una crema fina.']),
  recipe('amanida-verda', 'Amanida verda de temporada', 'amanides', 10, ['vegetarià', 'de temporada'], ['fulles verdes', 'cogombre', 'pastanaga', 'tomàquet'], ['Renta i asseca bé les verdures.', 'Talla-les i combina-les.', 'Amaneix just abans de servir.']),
  recipe('verdures-forn', 'Safata de verdures al forn', 'acompanyaments', 40, ['vegetarià', 'de temporada'], ['verdures de temporada', 'oli d’oliva', 'herbes'], ['Talla les verdures en peces regulars.', 'Amaneix-les amb oli i herbes.', 'Enforna fins que quedin tendres i daurades.'])
];

const recipeMap = Object.fromEntries(recipes.map(item => [item.id, item]));

const weekdayLunches = ['pasta-bolonyesa','pasta-carbonara','pasta-alberginia-olives','amanida-pasta','amanida-cigrons','amanida-llenties','llenties-xorico','caldo-pollastre','botifarra-remendada','truita-patata','truita-verdures','salmo-planxa','lluc-planxa','pollastre-planxa','arros-cubana','ous-estrellats','hamburguesa','seques-botifarra','alberginies-farcides'];
const weekendLunches = ['paella-pollastre','paella-bolets','fideua-sepia','orada-forn','aletes-forn','cuixes-pollastre','pizza-casolana','croquetes-pollastre','truita-patata','seques-botifarra'];
const dinners = ['bikini','hummus','ensaladilla-russa','ensaladilla-tonyina','amanida-quinoa','caldo-pollastre','truita-patata','truita-verdures','salmo-planxa','lluc-planxa','orada-planxa','pollastre-planxa','ous-farcits','crema-verdures','amanida-verda','pernil-iberic'];
const quicks = ['Bikini de pernil i formatge','Hummus amb pa torrat','Truita francesa','Pernil ibèric amb pa amb tomàquet','Ous remenats','Tomàquets de l’hort amb tonyina'];
const sides = ['patata-boniato-forn','calabacin-llimona','tomates-huerto','verdures-forn','amanida-verda'];

const seasonalAllowed = (id, month) => {
  const season = month >= 3 && month <= 5 ? 'primavera' : month >= 6 && month <= 8 ? 'estiu' : month >= 9 && month <= 11 ? 'tardor' : 'hivern';
  return recipeMap[id].season.includes(season);
};
const pick = (pool, index, month, offset = 0) => {
  const allowed = pool.filter(id => seasonalAllowed(id, month));
  return allowed[(index * 7 + month * 3 + offset) % allowed.length];
};

const days = {};
let dayIndex = 0;
for (let month = 1; month <= 12; month++) {
  const count = new Date(2026, month, 0).getDate();
  for (let day = 1; day <= count; day++, dayIndex++) {
    const date = new Date(2026, month - 1, day);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const lunchId = pick(weekend ? weekendLunches : weekdayLunches, dayIndex, month);
    let dinnerId = pick(dinners, dayIndex, month, 5);
    for (let attempt = 0; attempt < dinners.length && (dinnerId === lunchId || recipeMap[dinnerId].category === recipeMap[lunchId].category); attempt++) {
      dinnerId = pick(dinners, dayIndex, month, 6 + attempt);
    }
    const sideId = pick(sides, dayIndex, month, 2);
    const side = recipeMap[sideId];
    const addSide = ['peix', 'carn', 'forn'].includes(recipeMap[lunchId].category);
    days[`2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`] = {
      lunch: { title: addSide ? `${recipeMap[lunchId].title} · ${side.title}` : recipeMap[lunchId].title, recipe: lunchId, ...(addSide ? { side: sideId } : {}) },
      dinner: { title: recipeMap[dinnerId].title, recipe: dinnerId },
      quickOption: { title: quicks[(dayIndex + month) % quicks.length] }
    };
  }
}

mkdirSync('data/menus', { recursive: true });
writeFileSync('data/recipes.json', `${JSON.stringify(recipeMap, null, 2)}\n`);
writeFileSync('data/menus/2026.json', `${JSON.stringify({ year: 2026, days }, null, 2)}\n`);
console.log(`Generated ${recipes.length} recipes and ${Object.keys(days).length} menu days.`);
