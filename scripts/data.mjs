import { mkdir, writeFile } from "node:fs/promises";
const get = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw Error(`${r.status} ${url}`);
  return r;
};
const patch = (
  await (
    await get("https://ddragon.leagueoflegends.com/api/versions.json")
  ).json()
)[0];
const base = `https://ddragon.leagueoflegends.com/cdn/${patch}`;
const champions = Object.values(
  (await (await get(`${base}/data/en_US/champion.json`)).json()).data,
).map((c) => ({ id: c.id, name: c.name }));
const spells = Object.values(
  (await (await get(`${base}/data/en_US/summoner.json`)).json()).data,
)
  .filter((s) => s.modes.includes("CLASSIC"))
  .map((s) => ({
    id: s.id,
    name: s.name,
    seconds: s.cooldown[0],
    description: s.description.replace(/<[^>]*>/g, ""),
    complex: ["SummonerSmite", "SummonerTeleport"].includes(s.id),
  }));
await mkdir("packages/shared/src/data", { recursive: true });
await writeFile(
  "packages/shared/src/data/catalog.json",
  JSON.stringify(
    {
      patch,
      retrieved: new Date().toISOString(),
      source: base,
      champions,
      spells,
    },
    null,
    2,
  ),
);
for (const [kind, items] of [
  ["champion", champions],
  ["spell", spells],
]) {
  const dest = `apps/desktop/public/assets/${kind}`;
  await mkdir(dest, { recursive: true });
  for (let i = 0; i < items.length; i += 8)
    await Promise.all(
      items
        .slice(i, i + 8)
        .map(async (item) =>
          writeFile(
            `${dest}/${item.id}.png`,
            Buffer.from(
              await (
                await get(`${base}/img/${kind}/${item.id}.png`)
              ).arrayBuffer(),
            ),
          ),
        ),
    );
}
console.log(
  `Cached patch ${patch}: ${champions.length} champions, ${spells.length} spells`,
);
