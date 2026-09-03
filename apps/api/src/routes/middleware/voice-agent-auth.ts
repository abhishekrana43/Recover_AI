import type { Request, Response, NextFunction } from "express";

export function requireVoiceAgentAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const configuredKey =
    process.env.VOICE_AGENT_API_KEY;

  if (!configuredKey) {
    console.error(
      "VOICE_AGENT_API_KEY is not configured"
    );

    return res.status(500).json({
      success: false,
      message:
        "Voice agent authentication is not configured",
    });
  }

  const authorization =
    req.headers.authorization;

  if (typeof authorization !== "string") {
    return res.status(401).json({
      success: false,
      message: "Missing authorization header",
    });
  }

  const [scheme, token] =
    authorization.split(" ");

  if (
    scheme !== "Bearer" ||
    !token
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid authorization header",
    });
  }

  if (token !== configuredKey) {
    return res.status(401).json({
      success: false,
      message: "Invalid voice agent credentials",
    });
  }

  next();
}