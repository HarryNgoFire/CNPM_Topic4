import { Injectable, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import nodemailer from "nodemailer";

/** SMTP email OTP delivery. Use Gmail App Password, never the normal login password. */
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
    const mode = (process.env.EMAIL_DELIVERY_MODE ?? (process.env.NODE_ENV === "test" ? "console" : "smtp")).toLowerCase();
    if (mode === "console" && process.env.NODE_ENV !== "production") {
      console.info(`[DEV EMAIL OTP] to=${to} code=${code} expires_in_minutes=10`);
      return;
    }
    if (mode !== "smtp") throw new ServiceUnavailableException("Unsupported EMAIL_DELIVERY_MODE");
    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_APP_PASSWORD?.replace(/\s/g, "");
    const from = process.env.EMAIL_FROM || user;
    if (!user || !password || !from) {
      throw new ServiceUnavailableException("SMTP is not configured. Set SMTP_USER and SMTP_APP_PASSWORD.");
    }
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT || 465);
    const firstName = (name.trim().split(/\s+/).at(-1) || "bạn").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" }[char] || ""));
    try {
      const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass: password }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
      await transporter.sendMail({
        from, to, subject: "Mã xác thực tài khoản MoveFlow",
        text: `Xin chào ${name}, mã xác thực MoveFlow của bạn là ${code}. Mã có hiệu lực trong 10 phút.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#18233d"><p>Xin chào ${firstName},</p><h2>Xác thực email MoveFlow</h2><div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f0f4ff;padding:20px;border-radius:12px;text-align:center">${code}</div><p>Mã có hiệu lực 10 phút. Không chia sẻ mã này.</p></div>`,
      });
    } catch {
      throw new ServiceUnavailableException("Cannot send OTP by SMTP. Check Gmail App Password, SMTP access and network.");
    }
  }
}
