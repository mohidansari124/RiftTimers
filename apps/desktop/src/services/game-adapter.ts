import { AUTOMATIC_LINEUP_ENABLED, type Row } from "@rift/shared";
/** Renderer facade: network access stays in Electron's fixed-endpoint adapter. */
export interface GameAdapter {
  readonly enabled: boolean;
  getLineup(): Promise<Row[]>;
}
export const gameAdapter: GameAdapter = {
  enabled: AUTOMATIC_LINEUP_ENABLED,
  async getLineup() {
    const game = await window.rift?.getGame();
    if (!game?.lineup)
      throw Error(
        game?.status ??
          "Automatic lineup loading requires the desktop application.",
      );
    return game.lineup;
  },
};
