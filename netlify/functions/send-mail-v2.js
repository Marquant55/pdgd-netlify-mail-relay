const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return reponseJson(405, { ok: false, message: 'Method not allowed' });
    }

    const tokenRecu =
      event.headers['x-webhook-token'] ||
      event.headers['X-Webhook-Token'] ||
      '';

    const tokenAttendu = process.env.WEBHOOK_TOKEN || '';

    console.log('DEBUG method =', event.httpMethod);
    console.log('DEBUG header x-webhook-token present =', !!tokenRecu);
    console.log('DEBUG header x-webhook-token length =', tokenRecu.length);
    console.log('DEBUG env WEBHOOK_TOKEN present =', !!tokenAttendu);
    console.log('DEBUG env WEBHOOK_TOKEN length =', tokenAttendu.length);

    if (!tokenRecu || tokenRecu !== tokenAttendu) {
      return reponseJson(401, {
        ok: false,
        message: 'Unauthorized',
        debug: {
          token_recu_present: !!tokenRecu,
          token_recu_length: tokenRecu.length,
          token_attendu_present: !!tokenAttendu,
          token_attendu_length: tokenAttendu.length
        }
      });
    }

    const data = JSON.parse(event.body || '{}');

    const to_email = (data.to_email || '').trim();
    const to_name = (data.to_name || '').trim();
    const subject = (data.subject || '').trim();
    const text = data.text || '';
    const html = data.html || '';
    const reply_email = (data.reply_email || '').trim();
    const reply_name = (data.reply_name || '').trim();

    if (!to_email || !subject) {
      return reponseJson(400, {
        ok: false,
        message: 'Champs requis manquants : to_email / subject'
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_EMAIL}>`,
      to: to_name ? `"${to_name}" <${to_email}>` : to_email,
      subject: subject,
      text: text || stripHtml(html) || ' ',
      html: html || undefined,
      replyTo: reply_email
        ? (reply_name ? `"${reply_name}" <${reply_email}>` : reply_email)
        : undefined
    };

    const info = await transporter.sendMail(mailOptions);

    return reponseJson(200, {
      ok: true,
      message: 'Email envoyé',
      messageId: info.messageId || null
    });

  } catch (error) {
    console.log('DEBUG erreur =', error.message || String(error));

    return reponseJson(500, {
      ok: false,
      message: error.message || String(error)
    });
  }
};

function reponseJson(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(data)
  };
}

function stripHtml(html) {
  return (html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}