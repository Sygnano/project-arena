import { db } from "../db.js";
import { riotGateway } from "../riot.js";
import { RefreshQueue } from "./refreshQueue.js";

/** The API process's single refresh queue (see `RefreshQueue`). */
export const refreshQueue = new RefreshQueue(db, riotGateway);
