import { createRuntimeObject, createRuntimeWorker } from "@softmax-universe/runtime";
import assets from "universe:assets";
import { environment, createSessionTrial } from "../environment/index.js";
export class UniverseRuntime extends createRuntimeObject({ environment, createSessionTrial }) {}
export default createRuntimeWorker({ assets });
