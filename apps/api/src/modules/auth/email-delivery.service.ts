import { Injectable, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";

/**
 * Sends one-time email verification codes with Resend's HTTPS API.
 * No provider secret is ever returned to the client. For local development only,
 * EMAIL_DELIVERY_MODE=console prints a code when NODE_ENV is not production.
 */
@Injectable()
export class EmailDeliveryService implements OnModuleInit {
  onModuleInit() {
    if (process.env.NODE_ENV === "production") {
      const secret = process.env.OTP_SECRET;
      if (!secret || secret.length < 32 || secret.includes("replace-with")) {
        throw new Error("Set OTP_SECRET to an independent random value of at least 32 characters in production");
      }
    }
  }

  async sendVerificationCode(to: string, name: string, code: string) {
    const mode = (process.env.EMAIL_DELIVERY_MODE ?? (process.env.NODE_ENV === "test" ? "console" : "resend")).toLowerCase();
    if (mode === "console" && process.env.NODE_ENV !== "production") {
      // Explicitly opt-in development fallback; never enabled in production.
      console.info(`[DEV EMAIL OTP] to=${to} code=${code} expires_in_minutes=10`);
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      throw new ServiceUnavailableException(
        "Email verification is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
      );
    }

    const firstName = (name.trim().split(/\s+/).at(-1) || "bạn").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] || ""));
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: "Mã xác thực tài khoản MoveFlow",
          text: `Xin chào ${firstName}, mã xác thực tài khoản của bạn là ${code}. Mã có hiệu lực trong 10 phút. Nếu bạn không tạo tài khoản, hãy bỏ qua email này.`,
          html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#18233d"><p>Xin chào ${firstName},</p><h2>Xác thực email của bạn</h2><p>Nhập mã xác thực bên dưới để hoàn tất đăng ký MoveFlow.</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f0f4ff;padding:20px;border-radius:12px;text-align:center">${code}</div><p>Mã có hiệu lực trong <b>10 phút</b>. Không chia sẻ mã này với bất kỳ ai.</p><p>Nếu bạn không tạo tài khoản, hãy bỏ qua email này.</p></div>`,
        }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new ServiceUnavailableException("Unable to deliver verification email. Try again later.");
    }
    if (!response.ok) {
      // Avoid leaking raw provider error responses to users or logs.
      throw new ServiceUnavailableException("Email provider rejected the verification email. Check sender configuration.");
    }
  }
}
