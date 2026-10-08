import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

// São dados de identidade, não permissões administrativas da aplicação.
const identidadeSchema = z.object({
  sub: z.uuid(),
  email: z.email().max(254),
  role: z.literal("authenticated"),
  is_anonymous: z.literal(false).optional(),
});

export function criarAutenticacao({ supabaseUrl, resolverChaves } = {}) {
  const url = new URL(supabaseUrl ?? process.env.SUPABASE_URL ?? "");
  if (
    url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")
    || url.username || url.password || url.port || url.search || url.hash
    || url.pathname !== "/"
  ) {
    throw new Error("SUPABASE_URL deve ser a URL HTTPS do projeto Supabase.");
  }

  // A URL vem da configuração do servidor, nunca do token recebido.
  // As chaves públicas verificam a assinatura; não precisamos de service_role.
  const issuer = `${url.origin}/auth/v1`;
  const chaves = resolverChaves ?? createRemoteJWKSet(
    new URL(`${issuer}/.well-known/jwks.json`),
    { timeoutDuration: 5000, cacheMaxAge: 600000, cooldownDuration: 30000 },
  );

  return async function exigirAutenticacao(req, res, next) {
    res.set("Cache-Control", "no-store");
    const authorization = req.get("Authorization") ?? "";
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization);
    if (!match || authorization.length > 16000) {
      return res.status(401).json({ erro: "Entre na sua conta para continuar." });
    }

    try {
      // Além da assinatura, validar projeto, público e validade do token.
      const { payload } = await jwtVerify(match[1], chaves, {
        issuer,
        audience: "authenticated",
        algorithms: ["ES256"],
        requiredClaims: ["sub", "exp", "iat"],
        clockTolerance: 5,
      });
      const resultado = identidadeSchema.safeParse(payload);
      if (!resultado.success) {
        return res.status(401).json({ erro: "Sessão inválida. Entre novamente na sua conta." });
      }

      // Metadata serve somente como sugestão inicial de nome.
      // Nunca usar user_metadata.papel para conceder acesso administrativo.
      const metadataNome = payload.user_metadata?.name;
      const nome = typeof metadataNome === "string" && metadataNome.trim()
        ? Array.from(metadataNome.trim()).slice(0, 120).join("")
        : Array.from(resultado.data.email.split("@")[0]).slice(0, 120).join("");
      req.identidade = Object.freeze({
        id: resultado.data.sub.toLowerCase(),
        email: resultado.data.email.trim().toLowerCase(),
        nome,
      });
    } catch (error) {
      // Não registrar JWT, e-mail ou o conteúdo da requisição nos logs.
      const invalido = new Set([
        "ERR_JWT_EXPIRED", "ERR_JWT_CLAIM_VALIDATION_FAILED", "ERR_JWS_INVALID",
        "ERR_JWS_SIGNATURE_VERIFICATION_FAILED", "ERR_JOSE_ALG_NOT_ALLOWED",
        "ERR_JWT_INVALID", "ERR_JWKS_NO_MATCHING_KEY",
      ]);
      if (invalido.has(error.code)) {
        return res.status(401).json({ erro: "Sessão inválida ou expirada. Entre novamente na sua conta." });
      }
      console.error("Falha na verificação da sessão:", { codigo: error.code ?? "verificacao_indisponivel" });
      return res.status(503).json({ erro: "Não foi possível verificar sua sessão. Tente novamente em instantes." });
    }
    // Fora do try: falhas posteriores da aplicação não são erros de JWT.
    return next();
  };
}
