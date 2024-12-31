
import YAML from 'yaml'
import * as v from 'valibot'; // 1.24 kB

export const MessageSchema = v.object({
  type: v.literal("message"),
  email: v.pipe(v.string(), v.email()),
  subject: v.pipe(v.string(), v.maxLength(50)),
  message: v.pipe(v.string(), v.maxLength(255)),
  clientAddress: v.optional(v.string()),
});

export const NotificationSchema = v.object({
  type: v.literal("notification"),
  clientAddress: v.string(),
});

export const Schema = v.union([MessageSchema, NotificationSchema]);

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Allow-Headers": "*",
}

export interface Env {
  MY_CHAT_ID: string;
  TELEGRAM_BOT_TOKEN: string;
}

async function notifyMe(clientAddress: string, TELEGRAM_BOT_TOKEN: string, MY_CHAT_ID: string) {
  const response = await fetch(`http://ip-api.com/json/${clientAddress}`);
  const data = (await response.json()) as IpData;
  return await sendTelegramMessage(YAML.stringify(data), TELEGRAM_BOT_TOKEN, MY_CHAT_ID);
}

async function handleTelegramWebhook(request: Request) {
  const body = await request.text();
  console.table({body});
  return new Response("OK", { status: 200 }); 
}


export default {
  async fetch(request, { MY_CHAT_ID, TELEGRAM_BOT_TOKEN }): Promise<Response> {

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers,
        status: 204,
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/webhook/telegram" && request.method === "GET") {
      return await handleTelegramWebhook(request);
    }

    if (url.pathname === "/resume" && request.method === "GET") {
      const ip = request.headers.get('cf-connecting-ip')!;
      await notifyMe(ip, TELEGRAM_BOT_TOKEN, MY_CHAT_ID);
      return Response.redirect("https://drive.google.com/file/d/18dNMu9h8MxWmr5pUI8QUCC7gs-SnW_2G/view", 302);
    }

    const requestData = await request.json();
    const { success, output: msg, issues } = v.safeParse(Schema, requestData)

    if (!success) {
      return new Response(JSON.stringify(issues.flat()), { status: 400, headers });
    }

    if (msg.type === "notification") {
      const response = await fetch(`http://ip-api.com/json/${msg.clientAddress}`);
      const data = (await response.json()) as IpData;
      return await sendTelegramMessage(YAML.stringify(data), TELEGRAM_BOT_TOKEN, MY_CHAT_ID);
    }

    if (msg.type === "message") {
      const telegramResponse = await sendTelegramMessage(formatMessage(msg), TELEGRAM_BOT_TOKEN, MY_CHAT_ID);
      if (!telegramResponse.ok) {
        return new Response(JSON.stringify({
          title: "Something went Wrong!!",
          message: "Sorry for inconvenience. Please try again later!.",
          success: false
        }), { status: 500, headers });
      }
      return new Response(JSON.stringify({
        title: "Thank you!",
        message: "Thank you for contacting me. I will get back to you as soon as possible.",
        success: true
      }), { status: 200, headers}
      )

    }

    return new Response(JSON.stringify({ error: "invalid request" }), { status: 400 });
  },
} satisfies ExportedHandler<Env>;

async function sendTelegramMessage(message: string, TELEGRAM_BOT_TOKEN: string, MY_CHAT_ID: string) {
  const msg = encodeURIComponent(message);
  const endPoint = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${MY_CHAT_ID}&text=${msg}`;
  const res = await fetch(endPoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.text();
  return new Response(data, {
    headers,
    status: res.status,
  });
  
}

function formatMessage({ email, message, subject, clientAddress }: v.InferInput<typeof MessageSchema>): string {
  return (
    `
Subject: ${subject}
Email: ${email}
\n\n
${message}
`);
}
type IpData = {
  query: string;
  status: "success" | "fail";
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
};
