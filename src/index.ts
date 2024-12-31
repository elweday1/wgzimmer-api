
import YAML from 'yaml'

type TelegramMessage = {
  message_id: number;
  date: number;
  text: string;
  reply_to_message?: TelegramMessage;
  chat: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
    type: "private" | "group" | "supergroup" | "channel";
  };
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name: string;
    username: string;
    language_code: string;
  };
};

type TelegramUpdate = {
  update_id: number;
  message: TelegramMessage;
};

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Allow-Headers": "*",
}
const twitterBasePost = "https://x.com/intent/post?url="
const mySiteLink = "elweday.vercel.app/questions"
const myResumeFile = "https://drive.google.com/file/d/18dNMu9h8MxWmr5pUI8QUCC7gs-SnW_2G/view"

export interface Env {
  MY_CHAT_ID: string;
  TELEGRAM_BOT_TOKEN: string;
}

function shareToTwitter(update : TelegramUpdate) {
  const message = `
=> ${update.message.text}
-> ${update.message.reply_to_message?.text || ""}
  
  ${mySiteLink}
  `.trim();
  return `
  Sharing Link:
  ${twitterBasePost}${encodeURIComponent(message)}`.trim();
}

async function handleTelegramWebhook(request: Request, { MY_CHAT_ID, TELEGRAM_BOT_TOKEN }: Env) {
  const updateData = await request.json() as TelegramUpdate;
  if (updateData.message.reply_to_message && updateData.message.from.id === Number(MY_CHAT_ID) ) {
    await sendTelegramMessage(
      shareToTwitter(updateData), TELEGRAM_BOT_TOKEN, MY_CHAT_ID
    );
  }
  return new Response(updateData.message.text, { status: 200 }); 
}

async function handleRecieveQuestion(request: Request, { MY_CHAT_ID, TELEGRAM_BOT_TOKEN }: Env) {
  const data = await request.text();
  await sendTelegramMessage(
    `Question Recieved: ${data}`, TELEGRAM_BOT_TOKEN, MY_CHAT_ID
  );
  return Response.redirect("Ok", 200);
}

async function handleResumeView(request: Request, { MY_CHAT_ID, TELEGRAM_BOT_TOKEN }: Env) {
  const {asOrganization, latitude, longitude, country, timezone, continent} = request.cf!;
  const data = YAML.stringify({
    timestamp: new Date().toISOString(),
    asOrganization, latitude, longitude, country, timezone, continent, 
  })

  await sendTelegramMessage(data, TELEGRAM_BOT_TOKEN, MY_CHAT_ID);
  return Response.redirect(myResumeFile, 302);

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

    if (url.pathname === "/webhook/telegram" && request.method === "POST") {
      return await handleTelegramWebhook(request, { MY_CHAT_ID, TELEGRAM_BOT_TOKEN });
    }

    if (url.pathname === "/resume" && request.method === "GET") {
      return await handleResumeView(request, { MY_CHAT_ID, TELEGRAM_BOT_TOKEN });
    }

    if (url.pathname === "/questions/ask" && request.method === "POST") {
      return await handleRecieveQuestion(request, { MY_CHAT_ID, TELEGRAM_BOT_TOKEN });
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