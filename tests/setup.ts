import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

const live = process.env.ITAD_LIVE === "1";

if (!live) {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });
  afterEach(() => {
    server.resetHandlers();
  });
  afterAll(() => {
    server.close();
  });
}
