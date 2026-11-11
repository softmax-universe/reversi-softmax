declare module "reversi" {
  type PieceType = "BLACK" | "WHITE" | "BLANK";
  type Player = Exclude<PieceType, "BLANK">;

  type Square = {
    rowIndex: number;
    colIndex: number;
    pieceType: PieceType;
  };

  interface Board {
    readonly squares: Square[][];
    getPlaceableSquares(pieceType: Player): Square[];
    countByPieceType(): Record<PieceType, number>;
    isPlaceableSquare(row: number, column: number, pieceType: Player): boolean;
    placePiece(row: number, column: number, pieceType: Player): unknown;
    hasPlacableSquare(pieceType: Player): boolean;
  }
  interface Game {
    readonly board: Board;
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

  const reversi: { Game: new () => Game; Board: new (options: { mapText: string }) => Board };
  export default reversi;
}
