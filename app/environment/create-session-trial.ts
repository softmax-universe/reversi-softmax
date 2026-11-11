import { Schema } from "effect";
import type { Json, Trial } from "@softmax-universe/protocol/game";

const controllerSchema = Schema.Struct({
  kind: Schema.Literals(["human", "bot"]),
  policy: Schema.String.check(Schema.isBetweenLength(1, 200)),
  model: Schema.optionalKey(Schema.String.check(Schema.isBetweenLength(1, 200))),
});
const configurationSchema = Schema.Struct({
  controllers: Schema.optionalKey(
    Schema.Struct({ black: controllerSchema, white: controllerSchema }),
  ),
});

export function createSessionTrial(input: {
  seed: number;
  configuration?: Record<string, Json>;
}): Trial {
  const configuration = Schema.decodeUnknownSync(configurationSchema, {
    onExcessProperty: "error",
  })(input.configuration ?? {});
  return {
    id: "direct",
    seed: input.seed,
    participants: (["black", "white"] as const).map((id) => ({
      id,
      label: id === "black" ? "Black" : "White",
      ...(configuration.controllers?.[id] ?? { kind: "human", policy: "direct" }),
    })),
  };
}
