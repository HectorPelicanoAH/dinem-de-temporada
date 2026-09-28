// The source photos are sent to OpenAI once and are not persisted by this function.
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
const allowedOrigins = (Deno.env.get('SITE_ORIGINS') || 'https://hectorpelicanoah.github.io,http://localhost:8080,http://127.0.0.1:8080').split(',');

function reply(status: number, body: unknown, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    },
  });
}

const recipeSchema = {
  type: 'object', additionalProperties: false,
  required: ['title', 'category', 'difficulty', 'time', 'servings', 'servingsUnit', 'ingredients', 'steps', 'season', 'tags', 'allergens', 'babyNotes', 'variations', 'warnings'],
  properties: {
    title: { type: 'string' }, category: { type: 'string' }, difficulty: { type: 'string' },
    time: { type: ['integer', 'null'] }, servings: { type: ['integer', 'null'] }, servingsUnit: { type: 'string' },
    ingredients: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['ingredient', 'amount', 'unit'], properties: {
      ingredient: { type: 'string' }, amount: { type: 'string' }, unit: { type: 'string' },
    } } },
    steps: { type: 'array', items: { type: 'string' } },
    season: { type: 'array', items: { type: 'string' } }, tags: { type: 'array', items: { type: 'string' } },
    allergens: { type: 'array', items: { type: 'string' } }, babyNotes: { type: 'string' },
    variations: { type: 'array', items: { type: 'string' } }, warnings: { type: 'array', items: { type: 'string' } },
  },
};

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin') || '';
  if (!allowedOrigins.includes(origin)) return reply(403, { error: 'Origen no permès.' }, 'null');
  if (request.method === 'OPTIONS') return reply(200, {}, origin);
  if (request.method !== 'POST') return reply(405, { error: 'Mètode no permès.' }, origin);
  if (!supabaseUrl || !publicKey || !openaiKey) return reply(503, { error: 'El processament de fotos encara no està configurat.' }, origin);

  const authorization = request.headers.get('Authorization') || '';
  if (!/^Bearer [^ ]+$/.test(authorization)) return reply(401, { error: 'Entra amb Google per continuar.' }, origin);
  try {
    // Verify the user with Supabase Auth; the browser's email is never trusted.
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: publicKey, Authorization: authorization } });
    const user = await userResponse.json().catch(() => null);
    if (!userResponse.ok || !user?.id) return reply(401, { error: 'La sessió ha caducat. Torna a entrar.' }, origin);

    const raw = await request.text();
    if (raw.length > 12_000_000) return reply(413, { error: 'Les fotos són massa grans.' }, origin);
    let body: { images?: unknown };
    try { body = JSON.parse(raw); } catch { return reply(400, { error: 'Petició no vàlida.' }, origin); }
    const images = body.images;
    if (!Array.isArray(images) || images.length < 1 || images.length > 4 ||
      !images.every((image) => typeof image === 'string' && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) && image.length < 3_000_000)) {
      return reply(400, { error: 'Puja entre una i quatre fotos JPG, PNG o WebP.' }, origin);
    }

    const reserved = await fetch(`${supabaseUrl}/rest/v1/rpc/reserve_recipe_extraction`, {
      method: 'POST', headers: { apikey: publicKey, Authorization: authorization, 'Content-Type': 'application/json' }, body: '{}',
    });
    if (!reserved.ok) {
      const failure = await reserved.json().catch(() => ({}));
      if (failure.message === 'quota_exceeded') return reply(429, { error: 'Has arribat al límit de processaments. Torna-ho a provar més tard.' }, origin);
      return reply(reserved.status === 401 ? 401 : 403, { error: 'Aquest compte no pot processar receptes.' }, origin);
    }

    const content = [
      { type: 'input_text', text: 'Extreu UNA recepta de les fotos. Escriu la fitxa en català natural, amb ingredients, quantitats, passos, temperatures i temps fidels a la font. Les fotos poden ser pàgines consecutives. No inventis dades: temps i racions han de ser null si no consten; indica dubtes i camps il·legibles a warnings. Si hi ha diverses receptes, centra’t en la més completa i avisa. No copiïs literalment paràgrafs llargs de la font: reformula els passos sense canviar el procediment. No presentis cap valoració mèdica ni edat mínima per a nadons. Marca BLW només si és clarament una recepta per a nadons. Una llista buida d’al·lèrgens no és una garantia d’absència. Usa només primavera, estiu, tardor i hivern per a season.' },
      ...images.map((image) => ({ type: 'input_image', image_url: image, detail: 'high' })),
    ];
    const aiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-6-luna', reasoning: { effort: 'none' }, max_output_tokens: 3000,
        input: [{ role: 'user', content }], text: { format: { type: 'json_schema', name: 'recipe_extraction', strict: true, schema: recipeSchema } } }),
      signal: AbortSignal.timeout(65000),
    });
    if (!aiResponse.ok) return reply(502, { error: 'No s’han pogut processar les fotos. Torna-ho a provar més tard.' }, origin);
    const ai = await aiResponse.json();
    const output = ai.output?.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || [])
      .find((item: { type: string; text?: string }) => item.type === 'output_text')?.text;
    if (!output) return reply(502, { error: 'No s’ha pogut llegir la recepta. Prova amb fotos més nítides.' }, origin);
    const recipe = JSON.parse(output);
    return reply(200, { recipe }, origin);
  } catch {
    return reply(502, { error: 'El processament no ha respost. Conserva les fotos i torna-ho a provar.' }, origin);
  }
});
