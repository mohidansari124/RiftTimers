import { LIVE_MATCH_ENABLED, type Row } from "@rift/shared";
/** Future integrations must have documented Riot approval before implementing this boundary. */
export interface GameAdapter {
  readonly enabled: boolean;
  getLineup(): Promise<Row[]>;
}
export const gameAdapter: GameAdapter = {
  enabled: LIVE_MATCH_ENABLED,
  async getLineup() {
    throw new Error(
      "Live-match integration is disabled. Select a manual simulation lineup.",
    );
  },
};
