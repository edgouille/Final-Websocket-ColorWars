export const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
export const HOST = "0.0.0.0";
export const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
