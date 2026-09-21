import { db } from "../db.js";
import { riot } from "../riot/index.js";
import { RefreshQueue } from "./refreshQueue.js";

/** The API process's single refresh queue (see `RefreshQueue`). */
export const refreshQueue = new RefreshQueue(db, riot);
