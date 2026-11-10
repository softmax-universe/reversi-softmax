declare module "reversi" {
  type PieceType = "BLACK" | "WHITE" | "BLANK";
  type Player = Exclude<PieceType, "BLANK">;

  type Square = {
    rowIndex: number;
    colIndex: number;
    pieceType: PieceType;
  };

  class Game {
    readonly board: {
      readonly squares: Square[][];
      getPlaceableSquares(pieceType: Player): Square[];
      countByPieceType(): Record<PieceType, number>;
    };
    readonly isEnded: boolean;
    proceed(
      rowIndex: number,
      colIndex: number,
    ): {
      isSuccess: boolean;
      pieceType: Player;
      rivalPieceType: Player;
      isNextActorPassed: boolean;
    };
    getHighScorer(): Player | null;
  }

  const reversi: { Game: typeof Game };
  export default reversi;
}
