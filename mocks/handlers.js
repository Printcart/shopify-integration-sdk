import { rest } from "msw";

export const handlers = [
  // Handles a POST /login request
  rest.get("/products/*", (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({ variants: [{ id: 42670097072384 }] })
    );
  }),
];
