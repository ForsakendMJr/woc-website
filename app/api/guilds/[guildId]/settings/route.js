export async function PUT(req, ctx) {
  const guildId = extractGuildId(req, ctx?.params);

  if (!isSnowflake(guildId)) {
    return NextResponse.json(
      { ok: false, settings: null, guildId: "", error: "Missing/invalid guildId." },
      { status: 400 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const incoming =
      body && typeof body === "object" && body.settings && typeof body.settings === "object"
        ? body.settings
        : body;

    if (!incoming || typeof incoming !== "object") {
      return NextResponse.json(
        { ok: false, settings: null, guildId, error: "Body must be JSON." },
        { status: 400 }
      );
    }

    await dbConnect();

    const existingDoc = await GuildSettings.findOne({ guildId });
    const base = existingDoc?.toObject?.() || defaultSettings(guildId);

    // merge without touching guildId
    const next = deepMerge(base, incoming);

    // 🚫 CRITICAL: never set guildId inside $set
    delete next.guildId;

    next.modules = mergeModuleDefaults(next.modules);

    // normalize welcome safely
    const mergedWelcomeRaw = deepMerge(base?.welcome || {}, incoming?.welcome || {});
    next.welcome = normalizeWelcomeOnSave(mergedWelcomeRaw);

    const updated = await GuildSettings.findOneAndUpdate(
      { guildId },
      {
        $set: next,
        $setOnInsert: { guildId }, // ✅ only set guildId on insert
      },
      { new: true, upsert: true }
    );

    return NextResponse.json(
      { ok: true, settings: updated?.toObject?.() ?? updated, guildId },
      { status: 200 }
    );
  } catch (e) {
    console.error("[settings PUT]", e);
    return NextResponse.json(
      { ok: false, settings: null, guildId, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
